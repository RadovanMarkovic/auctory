-- 1. Nonce table (server-only)
CREATE TABLE public.wallet_verification_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  nonce text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nonce)
);

-- No grants for anon/authenticated: the table is reachable only through
-- security-definer functions callable by service_role.
GRANT ALL ON public.wallet_verification_nonces TO service_role;

ALTER TABLE public.wallet_verification_nonces ENABLE ROW LEVEL SECURITY;

CREATE INDEX wallet_nonces_user_addr_idx
  ON public.wallet_verification_nonces (user_id, address);

CREATE TRIGGER wallet_verification_nonces_set_updated_at
  BEFORE UPDATE ON public.wallet_verification_nonces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. One wallet per user, database-enforced on the normalized address
CREATE UNIQUE INDEX profiles_wallet_address_unique_idx
  ON public.profiles (lower(wallet_address))
  WHERE wallet_address IS NOT NULL;

-- 3. Wallet columns are not directly writable
CREATE OR REPLACE FUNCTION public.guard_profile_wallet_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('auctory.wallet_verify', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.wallet_address IS DISTINCT FROM OLD.wallet_address
     OR NEW.wallet_verified_at IS DISTINCT FROM OLD.wallet_verified_at
     OR NEW.wallet_network IS DISTINCT FROM OLD.wallet_network THEN
    RAISE EXCEPTION 'WALLET_NOT_DIRECTLY_WRITABLE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_wallet_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_wallet_columns();

-- 4. Nonce issuance (server-only)
CREATE OR REPLACE FUNCTION public.issue_wallet_nonce(_user_id uuid, _address text, _nonce text, _expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL OR _address IS NULL OR _nonce IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  DELETE FROM public.wallet_verification_nonces
  WHERE used_at IS NOT NULL OR expires_at < now() - interval '1 day';

  INSERT INTO public.wallet_verification_nonces (user_id, address, nonce, expires_at)
  VALUES (_user_id, lower(_address), _nonce, _expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_wallet_nonce(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_wallet_nonce(uuid, text, text, timestamptz) TO service_role;

-- 5. Nonce consumption (conditional, single-use) — returns the bound address
CREATE OR REPLACE FUNCTION public.consume_wallet_nonce(_user_id uuid, _nonce text)
RETURNS TABLE(address text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.wallet_verification_nonces n
  SET used_at = now()
  WHERE n.nonce = _nonce
    AND n.user_id = _user_id
    AND n.used_at IS NULL
    AND n.expires_at > now()
  RETURNING n.address, n.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_wallet_nonce(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_wallet_nonce(uuid, text) TO service_role;

-- 6. Store the verified wallet (only path that may write the wallet columns)
CREATE OR REPLACE FUNCTION public.link_verified_wallet(_user_id uuid, _address text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.wallet_address) = lower(_address) AND p.id <> _user_id
  ) THEN
    RAISE EXCEPTION 'WALLET_ALREADY_LINKED';
  END IF;

  PERFORM set_config('auctory.wallet_verify', 'on', true);

  UPDATE public.profiles
  SET wallet_address = _address,
      wallet_network = 'sepolia',
      wallet_verified_at = now()
  WHERE id = _user_id;

  PERFORM set_config('auctory.wallet_verify', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.link_verified_wallet(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_verified_wallet(uuid, text) TO service_role;

-- 7. Publishing a product requires a verified Sepolia wallet (drafts unaffected)
CREATE OR REPLACE FUNCTION public.guard_product_publish_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.seller_id
        AND p.wallet_address IS NOT NULL
        AND p.wallet_verified_at IS NOT NULL
        AND p.wallet_network = 'sepolia'
    ) THEN
      RAISE EXCEPTION 'WALLET_VERIFICATION_REQUIRED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER products_guard_publish_wallet
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_publish_wallet();