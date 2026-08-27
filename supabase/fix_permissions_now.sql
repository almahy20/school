-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR → IMMEDIATE FIX
-- Fixes: permission denied for function get_child_full_details
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
