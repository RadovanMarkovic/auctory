-- 1) Stop exposing full auction rows (reserve_price, highest_bidder_id, winner_id) publicly.
DROP POLICY IF EXISTS "Anyone can view public auctions" ON public.auctions;

-- Public reads now go exclusively through the safe view, which excludes
-- reserve_price, highest_bidder_id and winner_id.
ALTER VIEW public.public_auctions SET (security_invoker = false);
REVOKE ALL ON public.public_auctions FROM anon, authenticated;
GRANT SELECT ON public.public_auctions TO anon, authenticated;

-- Base table: no anonymous access at all.
REVOKE ALL ON public.auctions FROM anon;

-- 2) Policies that depended on public auction visibility now use the safe view.
DROP POLICY IF EXISTS "Anyone can view products with a visible auction" ON public.products;
CREATE POLICY "Anyone can view products with a visible auction"
ON public.products FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.public_auctions v WHERE v.product_id = products.id));

DROP POLICY IF EXISTS "Anyone can view images of products with a visible auction" ON public.product_images;
CREATE POLICY "Anyone can view images of products with a visible auction"
ON public.product_images FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.public_auctions v WHERE v.product_id = product_images.product_id));

-- 3) Tighten EXECUTE privileges on SECURITY DEFINER / helper functions.
REVOKE ALL ON FUNCTION public.transaction_next_status(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bidder_mask(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Admin/owner-scoped definer functions must never be callable anonymously.
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

-- Public-facing read helpers stay callable but only return non-sensitive,
-- already-public data (masked/visible bid history and seller display summary).
GRANT EXECUTE ON FUNCTION public.auction_bid_history(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_seller_summary(uuid) TO anon, authenticated;