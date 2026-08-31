CREATE TABLE IF NOT EXISTS public.auction_reserves (
  auction_id uuid PRIMARY KEY REFERENCES public.auctions(id) ON DELETE CASCADE,
  reserve_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auction_reserves TO authenticated;
GRANT ALL ON public.auction_reserves TO service_role;
ALTER TABLE public.auction_reserves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers manage their own auction reserve" ON public.auction_reserves;
CREATE POLICY "Sellers manage their own auction reserve"
ON public.auction_reserves FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.auctions a WHERE a.id = auction_reserves.auction_id AND a.seller_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.auctions a WHERE a.id = auction_reserves.auction_id AND a.seller_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view auction reserves" ON public.auction_reserves;
CREATE POLICY "Admins can view auction reserves"
ON public.auction_reserves FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS auction_reserves_set_updated_at ON public.auction_reserves;
CREATE TRIGGER auction_reserves_set_updated_at BEFORE UPDATE ON public.auction_reserves
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.auction_reserves (auction_id, reserve_price)
SELECT id, reserve_price FROM public.auctions WHERE reserve_price IS NOT NULL
ON CONFLICT (auction_id) DO NOTHING;

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS has_reserve boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserve_met boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.set_auction_reserve_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rp numeric;
BEGIN
  SELECT reserve_price INTO rp FROM public.auction_reserves WHERE auction_id = NEW.id;
  NEW.has_reserve := rp IS NOT NULL;
  NEW.reserve_met := rp IS NULL OR (NEW.highest_bid_amount IS NOT NULL AND NEW.highest_bid_amount >= rp);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auctions_set_reserve_flags ON public.auctions;
CREATE TRIGGER auctions_set_reserve_flags BEFORE INSERT OR UPDATE ON public.auctions
FOR EACH ROW EXECUTE FUNCTION public.set_auction_reserve_flags();

CREATE OR REPLACE FUNCTION public.sync_auction_reserve_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE aid uuid := COALESCE(NEW.auction_id, OLD.auction_id);
BEGIN
  PERFORM set_config('auctory.system', 'on', true);
  UPDATE public.auctions SET updated_at = updated_at WHERE id = aid;
  PERFORM set_config('auctory.system', 'off', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS auction_reserves_sync_flags ON public.auction_reserves;
CREATE TRIGGER auction_reserves_sync_flags AFTER INSERT OR UPDATE OR DELETE ON public.auction_reserves
FOR EACH ROW EXECUTE FUNCTION public.sync_auction_reserve_flags();

SELECT set_config('auctory.system', 'on', true);
UPDATE public.auctions a
SET has_reserve = (ar.reserve_price IS NOT NULL),
    reserve_met = (ar.reserve_price IS NULL OR (a.highest_bid_amount IS NOT NULL AND a.highest_bid_amount >= ar.reserve_price))
FROM (SELECT a2.id, ar2.reserve_price FROM public.auctions a2 LEFT JOIN public.auction_reserves ar2 ON ar2.auction_id = a2.id) ar
WHERE ar.id = a.id;
SELECT set_config('auctory.system', 'off', true);

CREATE OR REPLACE FUNCTION public.finalize_auctions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM set_config('auctory.system', 'on', true);

  UPDATE public.auctions
  SET status = 'live'
  WHERE status = 'scheduled' AND starts_at <= now() AND ends_at > now();

  UPDATE public.auctions
  SET status = 'ended',
      finalized_at = now(),
      winner_id = CASE WHEN highest_bidder_id IS NOT NULL AND reserve_met THEN highest_bidder_id ELSE NULL END,
      final_price = CASE WHEN highest_bidder_id IS NOT NULL AND reserve_met THEN highest_bid_amount ELSE NULL END
  WHERE status IN ('scheduled', 'live') AND ends_at <= now();

  INSERT INTO public.transactions (auction_id, product_id, seller_id, buyer_id, final_price, bid_history_hash)
  SELECT a.id, a.product_id, a.seller_id, a.winner_id, a.final_price,
         md5(coalesce(
           (SELECT string_agg(b.id::text || ':' || b.bidder_id::text || ':' || b.amount::text || ':' ||
                              extract(epoch from b.created_at)::text, '|' ORDER BY b.created_at, b.id)
            FROM public.bids b WHERE b.auction_id = a.id), ''))
  FROM public.auctions a
  WHERE a.status = 'ended' AND a.winner_id IS NOT NULL AND a.final_price IS NOT NULL
  ON CONFLICT (auction_id) DO NOTHING;

  PERFORM set_config('auctory.system', 'off', true);
END;
$$;

-- Policies referencing the view must go before the view is rebuilt.
DROP POLICY IF EXISTS "Anyone can view products with a visible auction" ON public.products;
DROP POLICY IF EXISTS "Anyone can view images of products with a visible auction" ON public.product_images;

DROP VIEW IF EXISTS public.public_auctions;
ALTER TABLE public.auctions DROP COLUMN IF EXISTS reserve_price;

CREATE VIEW public.public_auctions WITH (security_invoker = true) AS
SELECT id, product_id, seller_id, start_price, minimum_increment, starts_at, ends_at,
       original_ends_at, anti_sniping_minutes, status, highest_bid_amount, bid_count,
       final_price, created_at, finalized_at,
       has_reserve, reserve_met,
       COALESCE(highest_bid_amount, start_price) AS current_price,
       CASE WHEN bid_count = 0 OR highest_bid_amount IS NULL THEN start_price
            ELSE highest_bid_amount + minimum_increment END AS minimum_next_bid
FROM public.auctions a
WHERE status = ANY (ARRAY['scheduled'::auction_status, 'live'::auction_status, 'ended'::auction_status]);

GRANT SELECT ON public.public_auctions TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view public auctions" ON public.auctions;
CREATE POLICY "Anyone can view public auctions"
ON public.auctions FOR SELECT TO anon, authenticated
USING (status = ANY (ARRAY['scheduled'::auction_status, 'live'::auction_status, 'ended'::auction_status]));

CREATE POLICY "Anyone can view products with a visible auction"
ON public.products FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.auctions a WHERE a.product_id = products.id
               AND a.status = ANY (ARRAY['scheduled'::auction_status,'live'::auction_status,'ended'::auction_status])));

CREATE POLICY "Anyone can view images of products with a visible auction"
ON public.product_images FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.auctions a WHERE a.product_id = product_images.product_id
               AND a.status = ANY (ARRAY['scheduled'::auction_status,'live'::auction_status,'ended'::auction_status])));

REVOKE ALL ON public.auctions FROM anon, authenticated;
GRANT SELECT (id, product_id, seller_id, start_price, minimum_increment, starts_at, ends_at,
              original_ends_at, anti_sniping_minutes, status, highest_bid_amount, bid_count,
              final_price, created_at, updated_at, finalized_at, has_reserve, reserve_met)
  ON public.auctions TO anon, authenticated;
GRANT INSERT (product_id, seller_id, start_price, minimum_increment, starts_at, ends_at,
              original_ends_at, anti_sniping_minutes, status)
  ON public.auctions TO authenticated;
GRANT UPDATE (product_id, start_price, minimum_increment, starts_at, ends_at,
              anti_sniping_minutes, status)
  ON public.auctions TO authenticated;
GRANT DELETE ON public.auctions TO authenticated;
GRANT ALL ON public.auctions TO service_role;

REVOKE ALL ON FUNCTION public.set_auction_reserve_flags() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_auction_reserve_flags() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.transaction_next_status(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bidder_mask(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_auction(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_bid(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_transaction_buyer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_transaction_seller(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_transaction_dispute(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_auctions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_auction_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_seller_request_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;