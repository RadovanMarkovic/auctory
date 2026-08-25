ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_address text,
  ADD COLUMN IF NOT EXISTS wallet_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS wallet_network text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_wallet_address_key
  ON public.profiles (lower(wallet_address))
  WHERE wallet_address IS NOT NULL;