CREATE TYPE public.transaction_status AS ENUM (
  'awaiting_buyer', 'awaiting_seller', 'ready_for_transfer', 'disputed', 'transferring_certificate', 'completed'
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL UNIQUE REFERENCES public.auctions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  final_price numeric NOT NULL,
  bid_history_hash text NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'awaiting_buyer',
  buyer_confirmed_at timestamptz,
  buyer_confirmed_by uuid,
  seller_confirmed_at timestamptz,
  seller_confirmed_by uuid,
  dispute_reason text,
  dispute_opened_by uuid,
  dispute_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer, seller and admin can view a transaction"
ON public.transactions FOR SELECT TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER transactions_set_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX transactions_buyer_id_idx ON public.transactions (buyer_id);
CREATE INDEX transactions_seller_id_idx ON public.transactions (seller_id);

-- Extend the existing finalization job: create at most one transaction per won auction.
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

  INSERT INTO public.transactions (auction_id, product_id, seller_id, buyer_id, final_price, bid_history_hash)
  SELECT a.id, a.product_id, a.seller_id, a.winner_id, a.final_price,
         md5(coalesce(
           (SELECT string_agg(b.id::text || ':' || b.bidder_id::text || ':' || b.amount::text || ':' ||
                              extract(epoch from b.created_at)::text, '|' ORDER BY b.created_at, b.id)
            FROM public.bids b WHERE b.auction_id = a.id), ''))
  FROM public.auctions a
  WHERE a.status = 'ended'
    AND a.winner_id IS NOT NULL
    AND a.final_price IS NOT NULL
  ON CONFLICT (auction_id) DO NOTHING;

  PERFORM set_config('auctory.system', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_auctions() FROM public, anon, authenticated;

-- Shared helper: recompute status from the stored confirmations.
CREATE OR REPLACE FUNCTION public.transaction_next_status(_buyer_at timestamptz, _seller_at timestamptz)
 RETURNS public.transaction_status
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _buyer_at IS NOT NULL AND _seller_at IS NOT NULL THEN 'ready_for_transfer'::public.transaction_status
    WHEN _buyer_at IS NOT NULL THEN 'awaiting_seller'::public.transaction_status
    ELSE 'awaiting_buyer'::public.transaction_status
  END
$function$;

CREATE OR REPLACE FUNCTION public.confirm_transaction_buyer(_transaction_id uuid)
 RETURNS public.transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.transactions%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO t FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'; END IF;
  IF t.buyer_id <> caller THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF t.status = 'disputed' THEN RAISE EXCEPTION 'TRANSACTION_DISPUTED'; END IF;
  IF t.status IN ('transferring_certificate', 'completed') THEN RAISE EXCEPTION 'TRANSACTION_LOCKED'; END IF;

  IF t.buyer_confirmed_at IS NOT NULL THEN
    RETURN t;
  END IF;

  UPDATE public.transactions
  SET buyer_confirmed_at = now(),
      buyer_confirmed_by = caller,
      status = public.transaction_next_status(now(), t.seller_confirmed_at)
  WHERE id = _transaction_id
  RETURNING * INTO t;

  RETURN t;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_transaction_seller(_transaction_id uuid)
 RETURNS public.transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.transactions%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO t FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'; END IF;
  IF t.seller_id <> caller THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF t.status = 'disputed' THEN RAISE EXCEPTION 'TRANSACTION_DISPUTED'; END IF;
  IF t.status IN ('transferring_certificate', 'completed') THEN RAISE EXCEPTION 'TRANSACTION_LOCKED'; END IF;

  IF t.seller_confirmed_at IS NOT NULL THEN
    RETURN t;
  END IF;

  UPDATE public.transactions
  SET seller_confirmed_at = now(),
      seller_confirmed_by = caller,
      status = public.transaction_next_status(t.buyer_confirmed_at, now())
  WHERE id = _transaction_id
  RETURNING * INTO t;

  RETURN t;
END;
$function$;

CREATE OR REPLACE FUNCTION public.open_transaction_dispute(_transaction_id uuid, _reason text)
 RETURNS public.transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.transactions%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;

  SELECT * INTO t FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'; END IF;
  IF t.buyer_id <> caller AND t.seller_id <> caller THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF t.status = 'disputed' THEN RETURN t; END IF;
  IF t.status IN ('transferring_certificate', 'completed') THEN RAISE EXCEPTION 'TRANSACTION_LOCKED'; END IF;

  UPDATE public.transactions
  SET status = 'disputed',
      dispute_reason = btrim(_reason),
      dispute_opened_by = caller,
      dispute_opened_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO t;

  RETURN t;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_transaction_buyer(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.confirm_transaction_seller(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.open_transaction_dispute(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_transaction_buyer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_transaction_seller(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_transaction_dispute(uuid, text) TO authenticated;