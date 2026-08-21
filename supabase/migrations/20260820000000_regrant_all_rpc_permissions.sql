-- ==========================================================================
-- Migration: 20260820000000_regrant_all_rpc_permissions.sql
-- Purpose  : Re-grant EXECUTE on all RPCs after database restore/pause.
--            Uses DO blocks to skip functions that don't exist yet.
-- ==========================================================================

-- ── Table grants (هذه دايماً موجودة) ──────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fees           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_templates TO authenticated;

GRANT ALL ON public.classes        TO service_role;
GRANT ALL ON public.students       TO service_role;
GRANT ALL ON public.fees           TO service_role;
GRANT ALL ON public.attendance     TO service_role;
GRANT ALL ON public.messages       TO service_role;
GRANT ALL ON public.notifications  TO service_role;
GRANT ALL ON public.grades         TO service_role;
GRANT ALL ON public.exam_templates TO service_role;

-- ── Function grants — بـ DO blocks عشان ميكسرش لو الـ function مش موجودة ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_dashboard_stats') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_admin_dashboard_activities') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_activities(UUID) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_parent_dashboard_summary') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_parent_dashboard_summary(UUID, UUID) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_child_full_details') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'get_complete_user_data') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_complete_user_data(UUID) TO authenticated, service_role';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'internal') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA internal TO authenticated, service_role';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO authenticated, service_role';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
