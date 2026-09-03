CREATE TYPE public.certificate_status AS ENUM ('pending', 'minting', 'minted', 'failed');

CREATE TABLE public.blockchain_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  status public.certificate_status NOT NULL DEFAULT 'pending',
  product_ref text NOT NULL UNIQUE,
  manifest jsonb,
  snapshot_at timestamp with time zone,
  metadata_hash text,
  metadata_uri text,
  seller_wallet text,
  network text NOT NULL DEFAULT 'sepolia',
  contract_address text,
  token_id text,
  mint_tx_hash text,
  mint_block_number bigint,
  current_owner_wallet text,
  last_error_code text,
  last_error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  minted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX blockchain_certificates_seller_idx ON public.blockchain_certificates(seller_id);
CREATE INDEX blockchain_certificates_status_idx ON public.blockchain_certificates(status);

GRANT SELECT ON public.blockchain_certificates TO authenticated;
GRANT SELECT ON public.blockchain_certificates TO anon;
GRANT ALL ON public.blockchain_certificates TO service_role;

ALTER TABLE public.blockchain_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers read own certificates"
ON public.blockchain_certificates FOR SELECT TO authenticated
USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public reads certificates of publicly listed products"
ON public.blockchain_certificates FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.auctions a
  WHERE a.product_id = blockchain_certificates.product_id
    AND a.status IN ('scheduled', 'live', 'ended')
));

CREATE TRIGGER blockchain_certificates_set_updated_at
BEFORE UPDATE ON public.blockchain_certificates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_certificate_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.product_ref IS DISTINCT FROM OLD.product_ref THEN
    RAISE EXCEPTION 'CERTIFICATE_IMMUTABLE_REF';
  END IF;

  IF OLD.manifest IS NOT NULL AND NEW.manifest IS DISTINCT FROM OLD.manifest THEN
    RAISE EXCEPTION 'CERTIFICATE_IMMUTABLE_MANIFEST';
  END IF;

  IF OLD.snapshot_at IS NOT NULL AND NEW.snapshot_at IS DISTINCT FROM OLD.snapshot_at THEN
    RAISE EXCEPTION 'CERTIFICATE_IMMUTABLE_SNAPSHOT';
  END IF;

  IF OLD.metadata_hash IS NOT NULL AND NEW.metadata_hash IS DISTINCT FROM OLD.metadata_hash THEN
    RAISE EXCEPTION 'CERTIFICATE_IMMUTABLE_HASH';
  END IF;

  IF OLD.status = 'minted' THEN
    IF NEW.token_id IS DISTINCT FROM OLD.token_id THEN
      RAISE EXCEPTION 'CERTIFICATE_IMMUTABLE_TOKEN';
    END IF;
    IF NEW.mint_tx_hash IS DISTINCT FROM OLD.mint_tx_hash THEN
      RAISE EXCEPTION 'CERTIFICATE_IMMUTABLE_TX';
    END IF;
    IF NEW.status <> 'minted' THEN
      RAISE EXCEPTION 'CERTIFICATE_ALREADY_MINTED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER blockchain_certificates_guard_immutability
BEFORE UPDATE ON public.blockchain_certificates
FOR EACH ROW EXECUTE FUNCTION public.guard_certificate_immutability();

-- New auctions require a minted certificate. Existing auctions are untouched.
CREATE OR REPLACE FUNCTION public.guard_auction_requires_certificate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.blockchain_certificates c
    WHERE c.product_id = NEW.product_id AND c.status = 'minted'
  ) THEN
    RAISE EXCEPTION 'CERTIFICATE_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auctions_require_certificate
BEFORE INSERT ON public.auctions
FOR EACH ROW EXECUTE FUNCTION public.guard_auction_requires_certificate();