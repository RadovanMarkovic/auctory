CREATE OR REPLACE FUNCTION public.transaction_next_status(_buyer_at timestamptz, _seller_at timestamptz)
 RETURNS public.transaction_status
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _buyer_at IS NOT NULL AND _seller_at IS NOT NULL THEN 'ready_for_transfer'::public.transaction_status
    WHEN _buyer_at IS NOT NULL THEN 'awaiting_seller'::public.transaction_status
    ELSE 'awaiting_buyer'::public.transaction_status
  END
$function$;