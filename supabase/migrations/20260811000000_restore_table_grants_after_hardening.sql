-- ════════════════════════════════════════════════════════════════════════
-- Migration: restore_table_grants_after_hardening
-- Problem: After the security hardening migrations, some tables lost their
--          GRANT permissions for the `authenticated` role, causing:
--          "permission denied for table notifications / attendance / classes / fees"
--
-- Root cause: PostgreSQL table-level GRANTs are separate from RLS policies.
--   Both must be in place:
--   1. GRANT (table-level) → allows the role to even attempt access
--   2. RLS policy          → controls which rows the role can see/modify
--
-- This migration re-grants the minimum necessary privileges on all core
-- tables to ensure the app works correctly.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- authenticated role: SELECT + INSERT + UPDATE + DELETE on all user-facing
-- tables. RLS policies already enforce row-level access control.
-- ─────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fees                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_parents     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_templates      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_stats  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs          TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- anon role: SELECT only on schools (needed for login page + branding)
-- branding columns are part of the schools table itself (no separate table)
-- ─────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.schools       TO anon;
GRANT INSERT ON public.school_orders TO anon;

-- ─────────────────────────────────────────────────────────────────────────
-- service_role: ALL privileges on all tables (unrestricted server-side)
-- ─────────────────────────────────────────────────────────────────────────

GRANT ALL ON public.notifications       TO service_role;
GRANT ALL ON public.attendance          TO service_role;
GRANT ALL ON public.classes             TO service_role;
GRANT ALL ON public.fees                TO service_role;
GRANT ALL ON public.students            TO service_role;
GRANT ALL ON public.profiles            TO service_role;
GRANT ALL ON public.messages            TO service_role;
GRANT ALL ON public.grades              TO service_role;
GRANT ALL ON public.complaints          TO service_role;
GRANT ALL ON public.user_roles          TO service_role;
GRANT ALL ON public.teachers            TO service_role;
GRANT ALL ON public.student_parents     TO service_role;
GRANT ALL ON public.curriculum_subjects TO service_role;
GRANT ALL ON public.exam_templates      TO service_role;
GRANT ALL ON public.assignments         TO service_role;
GRANT ALL ON public.submissions         TO service_role;
GRANT ALL ON public.push_subscriptions  TO service_role;
GRANT ALL ON public.notification_stats  TO service_role;
GRANT ALL ON public.audit_logs          TO service_role;
GRANT ALL ON public.schools             TO service_role;
GRANT ALL ON public.school_orders       TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Sequence grants (needed for INSERT with auto-increment / uuid sequences)
-- ─────────────────────────────────────────────────────────────────────────

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
