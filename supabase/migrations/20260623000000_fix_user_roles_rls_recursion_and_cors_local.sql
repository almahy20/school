-- Fix user_roles 500 errors caused by recursive RLS policies.
-- Admin access must use SECURITY DEFINER helper functions, not self-queries
-- against public.user_roles inside a user_roles policy.

CREATE SCHEMA IF NOT EXISTS internal;

CREATE OR REPLACE FUNCTION internal.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION internal.get_user_school_id_from_roles(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION internal.get_user_approval_status(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT approval_status::text FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION internal.is_user_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_super_admin, false) FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT internal.get_user_role(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_my_role_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT internal.get_user_school_id_from_roles(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_my_approval_status()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT internal.get_user_approval_status(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT internal.is_user_super_admin(auth.uid());
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_roles_signup_insert"
ON public.user_roles
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "user_roles_login_read"
ON public.user_roles
FOR SELECT
TO anon
USING (true);

CREATE POLICY "user_roles_own_read"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_roles_admin_school_read"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND public.get_my_approval_status() = 'approved'
    AND school_id = public.get_my_role_school_id()
  )
);

CREATE POLICY "user_roles_admin_school_update"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND public.get_my_approval_status() = 'approved'
    AND school_id = public.get_my_role_school_id()
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND public.get_my_approval_status() = 'approved'
    AND school_id = public.get_my_role_school_id()
  )
);

CREATE POLICY "user_roles_admin_school_insert"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND public.get_my_approval_status() = 'approved'
    AND school_id = public.get_my_role_school_id()
  )
);

CREATE POLICY "user_roles_admin_school_delete"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND public.get_my_approval_status() = 'approved'
    AND school_id = public.get_my_role_school_id()
  )
);

CREATE INDEX IF NOT EXISTS idx_user_roles_school_role_status
ON public.user_roles(school_id, role, approval_status);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
ON public.user_roles(user_id);
