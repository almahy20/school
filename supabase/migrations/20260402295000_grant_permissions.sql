-- 20260402290000_grant_permissions.sql

-- Ensure authenticated role has access to notifications
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT SELECT ON TABLE public.notifications TO anon; -- Just in case, though they shouldn't see any rows

-- Ensure the is_super_admin function is solid
CREATE OR REPLACE FUNCTION public.is_super_admin() 
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER
STABLE
AS $$ 
  SELECT COALESCE((internal.get_user_context(auth.uid()))->>'is_super_admin', 'false')::boolean; 
$$;

-- Ensure the get_my_school_id function is solid
CREATE OR REPLACE FUNCTION public.get_my_school_id() 
RETURNS uuid 
LANGUAGE sql 
SECURITY DEFINER
STABLE
AS $$ 
  SELECT ((internal.get_user_context(auth.uid()))->>'school_id')::uuid; 
$$;

-- Allow authenticated users to see their own notifications even if the context function is slow
DROP POLICY IF EXISTS "notifications_select_owner" ON public.notifications;
CREATE POLICY "notifications_select_owner" ON public.notifications 
FOR SELECT TO authenticated 
USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
