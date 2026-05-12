-- Fix: Allow school admins to update their own school branding
-- This allows the "Save Identity" button to work for regular school admins

DROP POLICY IF EXISTS "admins_update_schools" ON public.schools;
CREATE POLICY "admins_update_schools" ON public.schools
FOR UPDATE TO authenticated
USING (
  public.is_super_admin() 
  OR (id = public.get_my_school_id() AND public.get_my_role() = 'admin')
)
WITH CHECK (
  public.is_super_admin() 
  OR (id = public.get_my_school_id() AND public.get_my_role() = 'admin')
);

-- Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
