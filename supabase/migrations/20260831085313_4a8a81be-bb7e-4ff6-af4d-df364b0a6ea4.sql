DROP POLICY "Sellers can create auctions for their published products" ON public.auctions;

CREATE POLICY "Sellers can create auctions for their published products"
ON public.auctions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = seller_id
  AND public.has_role(auth.uid(), 'seller')
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = auctions.product_id
      AND p.seller_id = auth.uid()
      AND p.status = 'published'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.product_id = auctions.product_id
  )
);

CREATE OR REPLACE FUNCTION public.guard_auction_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.original_ends_at IS NULL THEN
      NEW.original_ends_at := NEW.ends_at;
    END IF;
    IF NEW.status = 'scheduled' AND NEW.ends_at <= now() THEN
      RAISE EXCEPTION 'Auction end time must be in the future';
    END IF;
    IF EXISTS (SELECT 1 FROM public.transactions t WHERE t.product_id = NEW.product_id) THEN
      RAISE EXCEPTION 'Product already sold and cannot be auctioned again';
    END IF;
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('auctory.system', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'Ended or cancelled auctions can no longer be changed';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.bid_count = 0 THEN
    RETURN NEW;
  END IF;

  IF OLD.bid_count > 0 THEN
    RAISE EXCEPTION 'Auctions with bids can no longer be edited';
  END IF;

  IF NEW.product_id IS DISTINCT FROM OLD.product_id
     AND NOT EXISTS (
       SELECT 1 FROM public.products p
       WHERE p.id = NEW.product_id AND p.seller_id = auth.uid() AND p.status = 'published'
     ) THEN
    RAISE EXCEPTION 'Product must be your own published product';
  END IF;

  IF NEW.product_id IS DISTINCT FROM OLD.product_id
     AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'Product already sold and cannot be auctioned again';
  END IF;

  -- Drafts were never public: editable and publishable at any time.
  IF OLD.status = 'draft' THEN
    IF NEW.status = 'scheduled' THEN
      IF NEW.ends_at <= now() THEN
        RAISE EXCEPTION 'Auction end time must be in the future';
      END IF;
      IF NEW.starts_at <= now() THEN
        NEW.starts_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'live' OR OLD.starts_at <= now() THEN
    RAISE EXCEPTION 'Auctions can only be edited before they start';
  END IF;

  RETURN NEW;
END;
$function$;