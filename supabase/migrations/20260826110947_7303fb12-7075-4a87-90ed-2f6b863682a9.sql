-- Enum
CREATE TYPE public.auction_status AS ENUM ('draft', 'scheduled', 'live', 'ended', 'cancelled');

-- Auctions
CREATE TABLE public.auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_price numeric(12,2) NOT NULL,
  reserve_price numeric(12,2),
  minimum_increment numeric(12,2) NOT NULL DEFAULT 10,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  original_ends_at timestamptz NOT NULL,
  anti_sniping_minutes integer NOT NULL DEFAULT 5,
  status public.auction_status NOT NULL DEFAULT 'draft',
  highest_bid_amount numeric(12,2),
  highest_bidder_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bid_count integer NOT NULL DEFAULT 0,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  final_price numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CONSTRAINT auctions_start_price_positive CHECK (start_price > 0),
  CONSTRAINT auctions_reserve_gte_start CHECK (reserve_price IS NULL OR reserve_price >= start_price),
  CONSTRAINT auctions_increment_positive CHECK (minimum_increment > 0),
  CONSTRAINT auctions_ends_after_starts CHECK (ends_at > starts_at),
  CONSTRAINT auctions_anti_sniping_range CHECK (anti_sniping_minutes >= 0 AND anti_sniping_minutes <= 60),
  CONSTRAINT auctions_bid_count_non_negative CHECK (bid_count >= 0)
);

CREATE INDEX auctions_seller_id_idx ON public.auctions (seller_id);
CREATE INDEX auctions_status_ends_at_idx ON public.auctions (status, ends_at);
CREATE UNIQUE INDEX auctions_one_active_per_product
  ON public.auctions (product_id)
  WHERE status IN ('draft', 'scheduled', 'live');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auctions TO authenticated;
GRANT SELECT ON public.auctions TO anon;
GRANT ALL ON public.auctions TO service_role;

ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can create auctions for their published products"
  ON public.auctions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND public.has_role(auth.uid(), 'seller')
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = auctions.product_id
        AND p.seller_id = auth.uid()
        AND p.status = 'published'
    )
  );

CREATE POLICY "Sellers can view their own auctions"
  ON public.auctions FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Anyone can view scheduled and live auctions"
  ON public.auctions FOR SELECT TO anon, authenticated
  USING (status IN ('scheduled', 'live'));

CREATE POLICY "Admins can view all auctions"
  ON public.auctions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can update their own auctions"
  ON public.auctions FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'))
  WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));

CREATE POLICY "Admins can update all auctions"
  ON public.auctions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can delete their own draft auctions"
  ON public.auctions FOR DELETE TO authenticated
  USING (auth.uid() = seller_id AND status = 'draft' AND bid_count = 0);

-- Bids
CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bids_auction_id_created_at_idx ON public.bids (auction_id, created_at DESC);

GRANT SELECT, INSERT ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bidders can view their own bids"
  ON public.bids FOR SELECT TO authenticated
  USING (auth.uid() = bidder_id);

CREATE POLICY "Sellers can view bids on their auctions"
  ON public.bids FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auctions a WHERE a.id = bids.auction_id AND a.seller_id = auth.uid()));

CREATE POLICY "Admins can view all bids"
  ON public.bids FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER auctions_set_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Guard: edits only before start and with no bids; enforce product ownership/published
CREATE OR REPLACE FUNCTION public.guard_auction_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'Ended or cancelled auctions can no longer be changed';
  END IF;

  -- Cancelling is always allowed while there are no bids
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
$$;

CREATE TRIGGER auctions_guard_changes
  BEFORE INSERT OR UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.guard_auction_changes();

-- Public view without reserve_price
CREATE VIEW public.public_auctions
WITH (security_invoker = true)
AS
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
  a.highest_bidder_id,
  a.bid_count,
  a.winner_id,
  a.final_price,
  a.created_at,
  a.finalized_at
FROM public.auctions a
WHERE a.status IN ('scheduled', 'live');

GRANT SELECT ON public.public_auctions TO anon, authenticated;
GRANT ALL ON public.public_auctions TO service_role;

-- Public read of products/images that back a visible auction
CREATE POLICY "Anyone can view products with a visible auction"
  ON public.products FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.product_id = products.id AND a.status IN ('scheduled', 'live')
  ));

CREATE POLICY "Anyone can view images of products with a visible auction"
  ON public.product_images FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.auctions a
    WHERE a.product_id = product_images.product_id AND a.status IN ('scheduled', 'live')
  ));

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_images TO anon;