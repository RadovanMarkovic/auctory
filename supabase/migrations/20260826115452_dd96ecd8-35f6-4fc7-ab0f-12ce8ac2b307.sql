-- 1. Public visibility now includes ended auctions
DROP POLICY IF EXISTS "Anyone can view scheduled and live auctions" ON public.auctions;
CREATE POLICY "Anyone can view public auctions"
  ON public.auctions FOR SELECT TO anon, authenticated
  USING (status = ANY (ARRAY['scheduled'::auction_status, 'live'::auction_status, 'ended'::auction_status]));

DROP POLICY IF EXISTS "Anyone can view products with a visible auction" ON public.products;
CREATE POLICY "Anyone can view products with a visible auction"
  ON public.products FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.product_id = products.id
      AND a.status = ANY (ARRAY['scheduled'::auction_status, 'live'::auction_status, 'ended'::auction_status])
  ));

DROP POLICY IF EXISTS "Anyone can view images of products with a visible auction" ON public.product_images;
CREATE POLICY "Anyone can view images of products with a visible auction"
  ON public.product_images FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.product_id = product_images.product_id
      AND a.status = ANY (ARRAY['scheduled'::auction_status, 'live'::auction_status, 'ended'::auction_status])
  ));

-- 2. Public auction view: no reserve amount, no bidder identities
DROP VIEW IF EXISTS public.public_auctions;
CREATE VIEW public.public_auctions
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.product_id,
  a.seller_id,
  a.start_price,
  a.minimum_increment,
  a.starts_at,
  a.ends_at,
  a.original_ends_at,
  a.anti_sniping_minutes,
  a.status,
  a.highest_bid_amount,
  a.bid_count,
  a.final_price,
  a.created_at,
  a.finalized_at,
  (a.reserve_price IS NOT NULL) AS has_reserve,
  (a.reserve_price IS NULL OR (a.highest_bid_amount IS NOT NULL AND a.highest_bid_amount >= a.reserve_price)) AS reserve_met,
  COALESCE(a.highest_bid_amount, a.start_price) AS current_price,
  CASE
    WHEN a.bid_count = 0 OR a.highest_bid_amount IS NULL THEN a.start_price
    ELSE a.highest_bid_amount + a.minimum_increment
  END AS minimum_next_bid
FROM public.auctions a
WHERE a.status = ANY (ARRAY['scheduled'::auction_status, 'live'::auction_status, 'ended'::auction_status]);

GRANT SELECT ON public.public_auctions TO anon, authenticated;

-- 3. Allow trusted server-side functions to bypass the seller edit guard
CREATE OR REPLACE FUNCTION public.guard_auction_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.original_ends_at IS NULL THEN
      NEW.original_ends_at := NEW.ends_at;
    END IF;
    IF NEW.status = 'scheduled' AND NEW.ends_at <= now() THEN
      RAISE EXCEPTION 'Auction end time must be in the future';
    END IF;
    RETURN NEW;
  END IF;

  -- Trusted internal routines (bidding, cancellation, finalization)
  IF coalesce(current_setting('auctory.system', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'Ended or cancelled auctions can no longer be changed';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.bid_count = 0 THEN
    RETURN NEW;
  END IF;

  IF OLD.bid_count > 0 THEN
    RAISE EXCEPTION 'Auctions with bids can no longer be edited';
  END IF;

  IF OLD.status = 'live' OR OLD.starts_at <= now() THEN
    RAISE EXCEPTION 'Auctions can only be edited before they start';
  END IF;

  IF NEW.product_id IS DISTINCT FROM OLD.product_id
     AND NOT EXISTS (
       SELECT 1 FROM public.products p
       WHERE p.id = NEW.product_id AND p.seller_id = auth.uid() AND p.status = 'published'
     ) THEN
    RAISE EXCEPTION 'Product must be your own published product';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Masked bidder label helper
CREATE OR REPLACE FUNCTION public.bidder_mask(_auction_id uuid, _bidder_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT upper(substr(md5(_auction_id::text || ':' || _bidder_id::text), 1, 4))
$function$;

REVOKE ALL ON FUNCTION public.bidder_mask(uuid, uuid) FROM public, anon, authenticated;

-- 5. Public masked bid history
CREATE OR REPLACE FUNCTION public.auction_bid_history(_auction_id uuid)
RETURNS TABLE(bid_id uuid, amount numeric, created_at timestamptz, bidder_label text, is_own boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    b.id,
    b.amount,
    b.created_at,
    public.bidder_mask(b.auction_id, b.bidder_id),
    b.bidder_id = auth.uid()
  FROM public.bids b
  JOIN public.auctions a ON a.id = b.auction_id
  WHERE b.auction_id = _auction_id
    AND a.status IN ('scheduled', 'live', 'ended')
  ORDER BY b.amount DESC, b.created_at DESC
$function$;

GRANT EXECUTE ON FUNCTION public.auction_bid_history(uuid) TO anon, authenticated;

-- 6. Restricted public seller summary
CREATE OR REPLACE FUNCTION public.public_seller_summary(_seller_id uuid)
RETURNS TABLE(id uuid, full_name text, country text, member_since timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.country, p.created_at
  FROM public.profiles p
  WHERE p.id = _seller_id
    AND EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.seller_id = p.id
        AND a.status IN ('scheduled', 'live', 'ended')
    )
$function$;

GRANT EXECUTE ON FUNCTION public.public_seller_summary(uuid) TO anon, authenticated;

-- 7. Placing a bid
CREATE OR REPLACE FUNCTION public.place_bid(_auction_id uuid, _amount numeric)
RETURNS TABLE(amount numeric, ends_at timestamptz, bid_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a public.auctions%ROWTYPE;
  bidder uuid := auth.uid();
  min_bid numeric;
  new_ends timestamptz;
BEGIN
  IF bidder IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO a FROM public.auctions WHERE id = _auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUCTION_NOT_FOUND';
  END IF;

  IF a.status = 'cancelled' OR a.status = 'ended' OR a.ends_at <= now() THEN
    RAISE EXCEPTION 'AUCTION_CLOSED';
  END IF;

  IF a.status NOT IN ('scheduled', 'live') OR a.starts_at > now() THEN
    RAISE EXCEPTION 'AUCTION_NOT_LIVE';
  END IF;

  IF a.seller_id = bidder THEN
    RAISE EXCEPTION 'SELLER_CANNOT_BID';
  END IF;

  IF a.bid_count = 0 OR a.highest_bid_amount IS NULL THEN
    min_bid := a.start_price;
  ELSE
    min_bid := a.highest_bid_amount + a.minimum_increment;
  END IF;

  IF _amount IS NULL OR _amount < min_bid THEN
    RAISE EXCEPTION 'BID_TOO_LOW:%', min_bid;
  END IF;

  new_ends := a.ends_at;
  IF a.anti_sniping_minutes > 0
     AND a.ends_at - now() < make_interval(mins => a.anti_sniping_minutes) THEN
    new_ends := now() + make_interval(mins => a.anti_sniping_minutes);
  END IF;

  PERFORM set_config('auctory.system', 'on', true);

  INSERT INTO public.bids (auction_id, bidder_id, amount)
  VALUES (_auction_id, bidder, _amount);

  UPDATE public.auctions
  SET highest_bid_amount = _amount,
      highest_bidder_id = bidder,
      bid_count = a.bid_count + 1,
      ends_at = new_ends,
      status = 'live'
  WHERE id = _auction_id;

  PERFORM set_config('auctory.system', 'off', true);

  RETURN QUERY SELECT _amount, new_ends, a.bid_count + 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.place_bid(uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, numeric) TO authenticated;

-- 8. Seller cancellation (draft, scheduled or live, only without bids)
CREATE OR REPLACE FUNCTION public.cancel_auction(_auction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a public.auctions%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO a FROM public.auctions WHERE id = _auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUCTION_NOT_FOUND';
  END IF;

  IF a.seller_id <> caller AND NOT public.has_role(caller, 'admin') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF a.status NOT IN ('draft', 'scheduled', 'live') THEN
    RAISE EXCEPTION 'NOT_CANCELLABLE';
  END IF;

  IF a.bid_count > 0 THEN
    RAISE EXCEPTION 'AUCTION_HAS_BIDS';
  END IF;

  PERFORM set_config('auctory.system', 'on', true);
  UPDATE public.auctions SET status = 'cancelled' WHERE id = _auction_id;
  PERFORM set_config('auctory.system', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_auction(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_auction(uuid) TO authenticated;

-- 9. Scheduled finalization (called by pg_cron)
CREATE OR REPLACE FUNCTION public.finalize_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('auctory.system', 'on', true);

  UPDATE public.auctions
  SET status = 'live'
  WHERE status = 'scheduled'
    AND starts_at <= now()
    AND ends_at > now();

  UPDATE public.auctions
  SET status = 'ended',
      finalized_at = now(),
      winner_id = CASE
        WHEN highest_bidder_id IS NOT NULL
         AND (reserve_price IS NULL OR highest_bid_amount >= reserve_price)
        THEN highest_bidder_id ELSE NULL END,
      final_price = CASE
        WHEN highest_bidder_id IS NOT NULL
         AND (reserve_price IS NULL OR highest_bid_amount >= reserve_price)
        THEN highest_bid_amount ELSE NULL END
  WHERE status IN ('scheduled', 'live')
    AND ends_at <= now();

  PERFORM set_config('auctory.system', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_auctions() FROM public, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;