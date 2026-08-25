-- 1. Seller request status enum + column
CREATE TYPE public.seller_request_status AS ENUM ('none', 'pending', 'approved', 'rejected');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_request_status public.seller_request_status NOT NULL DEFAULT 'none';

-- 2. Prevent self-escalation of seller_request_status
CREATE OR REPLACE FUNCTION public.guard_seller_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_request_status IS DISTINCT FROM OLD.seller_request_status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NOT (NEW.seller_request_status = 'pending'
            AND OLD.seller_request_status IN ('none', 'rejected')) THEN
      RAISE EXCEPTION 'Not allowed to change seller request status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_seller_request_status ON public.profiles;
CREATE TRIGGER profiles_guard_seller_request_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_seller_request_status();

-- 3. Admin RLS policies
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins may grant/revoke buyer and seller roles, never admin
CREATE POLICY "Admins can grant non-admin roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND role <> 'admin');

CREATE POLICY "Admins can revoke non-admin roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND role <> 'admin');

-- 4. Admin listing helper (joins auth emails safely)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  country text,
  account_status public.account_status,
  seller_request_status public.seller_request_status,
  created_at timestamptz,
  roles public.app_role[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    u.email::text,
    p.full_name,
    p.country,
    p.account_status,
    p.seller_request_status,
    p.created_at,
    COALESCE(ARRAY(SELECT r.role FROM public.user_roles r WHERE r.user_id = p.id ORDER BY r.role), '{}'::public.app_role[])
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;