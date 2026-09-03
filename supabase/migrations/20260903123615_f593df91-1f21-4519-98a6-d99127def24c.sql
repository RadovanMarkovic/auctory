CREATE TYPE public.ownership_transfer_status AS ENUM ('pending', 'submitted', 'completed', 'failed');

CREATE TABLE public.ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  auction_id uuid NOT NULL REFERENCES public.auctions(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  certificate_id uuid NOT NULL REFERENCES public.blockchain_certificates(id),
  token_id text NOT NULL,
  sale_ref text NOT NULL UNIQUE,
  sale_data_hash text NOT NULL,
  sale_snapshot jsonb NOT NULL,
  previous_owner_wallet text NOT NULL,
  buyer_wallet text NOT NULL,
  status public.ownership_transfer_status NOT NULL DEFAULT 'pending',
  tx_hash text,
  block_number bigint,
  last_error_code text,
  last_error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ownership_transfers TO authenticated;
GRANT ALL ON public.ownership_transfers TO service_role;

ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and admins can view transfers"
ON public.ownership_transfers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = ownership_transfers.transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);

CREATE TRIGGER ownership_transfers_set_updated_at
BEFORE UPDATE ON public.ownership_transfers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_ownership_transfer_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.auction_id IS DISTINCT FROM OLD.auction_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.certificate_id IS DISTINCT FROM OLD.certificate_id
     OR NEW.token_id IS DISTINCT FROM OLD.token_id
     OR NEW.sale_ref IS DISTINCT FROM OLD.sale_ref
     OR NEW.sale_data_hash IS DISTINCT FROM OLD.sale_data_hash
     OR NEW.sale_snapshot IS DISTINCT FROM OLD.sale_snapshot THEN
    RAISE EXCEPTION 'TRANSFER_IMMUTABLE_FIELDS';
  END IF;

  IF OLD.status = 'completed' THEN
    IF NEW.tx_hash IS DISTINCT FROM OLD.tx_hash
       OR NEW.block_number IS DISTINCT FROM OLD.block_number
       OR NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'TRANSFER_ALREADY_COMPLETED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ownership_transfers_guard_immutability
BEFORE UPDATE ON public.ownership_transfers
FOR EACH ROW EXECUTE FUNCTION public.guard_ownership_transfer_immutability();

-- Atomically move the transaction to transferring_certificate and create/claim the transfer row.
CREATE OR REPLACE FUNCTION public.claim_certificate_transfer(
  _transaction_id uuid,
  _auction_id uuid,
  _product_id uuid,
  _certificate_id uuid,
  _token_id text,
  _sale_ref text,
  _sale_data_hash text,
  _sale_snapshot jsonb,
  _previous_owner_wallet text,
  _buyer_wallet text
)
RETURNS public.ownership_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.transactions%ROWTYPE;
  tr public.ownership_transfers%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'; END IF;
  IF t.status <> 'ready_for_transfer' THEN RAISE EXCEPTION 'TRANSFER_NOT_CLAIMABLE'; END IF;

  SELECT * INTO tr FROM public.ownership_transfers
  WHERE transaction_id = _transaction_id FOR UPDATE;

  IF FOUND THEN
    IF tr.status IN ('submitted', 'completed') THEN
      RAISE EXCEPTION 'TRANSFER_IN_PROGRESS';
    END IF;
    UPDATE public.ownership_transfers
    SET status = 'pending',
        previous_owner_wallet = _previous_owner_wallet,
        buyer_wallet = _buyer_wallet,
        last_error_code = NULL,
        last_error_message = NULL,
        retry_count = tr.retry_count + 1
    WHERE id = tr.id
    RETURNING * INTO tr;
  ELSE
    INSERT INTO public.ownership_transfers (
      transaction_id, auction_id, product_id, certificate_id, token_id,
      sale_ref, sale_data_hash, sale_snapshot, previous_owner_wallet, buyer_wallet, status
    ) VALUES (
      _transaction_id, _auction_id, _product_id, _certificate_id, _token_id,
      _sale_ref, _sale_data_hash, _sale_snapshot, _previous_owner_wallet, _buyer_wallet, 'pending'
    )
    RETURNING * INTO tr;
  END IF;

  UPDATE public.transactions
  SET status = 'transferring_certificate'
  WHERE id = _transaction_id;

  RETURN tr;
END;
$$;

-- Record a submitted blockchain transaction hash for a claimed transfer.
CREATE OR REPLACE FUNCTION public.mark_certificate_transfer_submitted(
  _transaction_id uuid,
  _tx_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ownership_transfers
  SET status = 'submitted',
      tx_hash = _tx_hash,
      submitted_at = now()
  WHERE transaction_id = _transaction_id
    AND status <> 'completed';
END;
$$;

-- Atomically finalize: certificate owner + transfer row + transaction status.
CREATE OR REPLACE FUNCTION public.finalize_certificate_transfer(
  _transaction_id uuid,
  _tx_hash text,
  _block_number bigint,
  _owner_wallet text
)
RETURNS public.ownership_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tr public.ownership_transfers%ROWTYPE;
BEGIN
  SELECT * INTO tr FROM public.ownership_transfers
  WHERE transaction_id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;

  IF tr.status <> 'completed' THEN
    UPDATE public.ownership_transfers
    SET status = 'completed',
        tx_hash = COALESCE(_tx_hash, tr.tx_hash),
        block_number = COALESCE(_block_number, tr.block_number),
        completed_at = now(),
        last_error_code = NULL,
        last_error_message = NULL
    WHERE id = tr.id
    RETURNING * INTO tr;
  END IF;

  UPDATE public.blockchain_certificates
  SET current_owner_wallet = _owner_wallet
  WHERE id = tr.certificate_id;

  UPDATE public.transactions
  SET status = 'completed'
  WHERE id = _transaction_id
    AND status <> 'completed';

  RETURN tr;
END;
$$;

-- Submission failed before any blockchain transaction existed: release for retry.
CREATE OR REPLACE FUNCTION public.release_certificate_transfer(
  _transaction_id uuid,
  _code text,
  _message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tr public.ownership_transfers%ROWTYPE;
BEGIN
  SELECT * INTO tr FROM public.ownership_transfers
  WHERE transaction_id = _transaction_id FOR UPDATE;

  IF FOUND THEN
    IF tr.status = 'completed' OR tr.tx_hash IS NOT NULL THEN
      RETURN;
    END IF;
    UPDATE public.ownership_transfers
    SET status = 'failed',
        last_error_code = _code,
        last_error_message = left(COALESCE(_message, ''), 500)
    WHERE id = tr.id;
  END IF;

  UPDATE public.transactions
  SET status = 'ready_for_transfer'
  WHERE id = _transaction_id
    AND status = 'transferring_certificate';
END;
$$;

-- Safe public subset for the digital passport of publicly visible auctions.
CREATE OR REPLACE FUNCTION public.public_certificate_transfer(_product_id uuid)
RETURNS TABLE(
  previous_owner_wallet text,
  buyer_wallet text,
  tx_hash text,
  block_number bigint,
  completed_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ot.previous_owner_wallet, ot.buyer_wallet, ot.tx_hash, ot.block_number, ot.completed_at
  FROM public.ownership_transfers ot
  WHERE ot.product_id = _product_id
    AND ot.status = 'completed'
    AND EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = ot.auction_id
        AND a.status IN ('scheduled', 'live', 'ended')
    )
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.claim_certificate_transfer(uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_certificate_transfer_submitted(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_certificate_transfer(uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_certificate_transfer(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_certificate_transfer(uuid, uuid, uuid, uuid, text, text, text, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_certificate_transfer_submitted(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_certificate_transfer(uuid, text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_certificate_transfer(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.public_certificate_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_certificate_transfer(uuid) TO anon, authenticated, service_role;