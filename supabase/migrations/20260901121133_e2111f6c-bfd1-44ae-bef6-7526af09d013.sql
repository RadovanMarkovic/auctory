CREATE OR REPLACE FUNCTION public.guard_auction_publish_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('scheduled','live') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.seller_id
        AND wallet_verified_at IS NOT NULL
        AND wallet_network = 'sepolia'
    ) THEN
      RAISE EXCEPTION 'wallet_not_verified' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_auction_publish_wallet
BEFORE INSERT OR UPDATE OF status ON public.auctions
FOR EACH ROW EXECUTE FUNCTION public.guard_auction_publish_wallet();