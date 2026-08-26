REVOKE ALL ON FUNCTION public.auction_bid_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_seller_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auction_bid_history(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_seller_summary(uuid) TO anon, authenticated;