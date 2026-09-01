REVOKE ALL ON FUNCTION public.guard_profile_wallet_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_product_publish_wallet() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_profile_wallet_columns() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_product_publish_wallet() TO service_role;