CREATE OR REPLACE FUNCTION public.auction_bid_history(_auction_id uuid)
 RETURNS TABLE(bid_id uuid, amount numeric, created_at timestamp with time zone, bidder_label text, is_own boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    b.id,
    b.amount,
    b.created_at,
    COALESCE(NULLIF(btrim(p.full_name), ''), public.bidder_mask(b.auction_id, b.bidder_id)),
    b.bidder_id = auth.uid()
  FROM public.bids b
  JOIN public.auctions a ON a.id = b.auction_id
  LEFT JOIN public.profiles p ON p.id = b.bidder_id
  WHERE b.auction_id = _auction_id
    AND a.status IN ('scheduled', 'live', 'ended')
  ORDER BY b.amount DESC, b.created_at DESC
$function$;