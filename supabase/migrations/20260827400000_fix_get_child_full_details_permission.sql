-- ==========================================================================
-- Migration: 20260827400000_fix_get_child_full_details_permission.sql
-- Purpose  : Fix "permission denied for function get_child_full_details"
--            error (42501). The DROP + CREATE in a previous migration may
--            have wiped the GRANT, leaving authenticated role without EXECUTE.
-- ==========================================================================

-- Re-grant EXECUTE to authenticated and service_role (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_child_full_details'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) FROM public, anon';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) TO authenticated, service_role';
  END IF;
END $$;

-- Also fix search_path while we're here (linter requirement)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_child_full_details'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_child_full_details(uuid, uuid) SET search_path = public';
  END IF;
END $$;

-- Re-grant any other child-related RPCs that might have the same issue
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_child_overview') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_child_overview(uuid) FROM public, anon';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION public.get_child_overview(uuid) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_child_curriculum') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_child_curriculum(uuid) FROM public, anon';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION public.get_child_curriculum(uuid) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_parent_dashboard_summary') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) FROM public, anon';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_complete_user_data') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_complete_user_data(uuid) FROM public, anon';
    EXECUTE 'GRANT  EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated, service_role';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
