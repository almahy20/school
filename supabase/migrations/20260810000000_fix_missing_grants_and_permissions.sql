-- ==========================================================================
-- Migration: 20260810000000_fix_missing_grants_and_permissions.sql
-- Purpose  : Fix all "permission denied" errors seen in Supabase logs:
--
--   Error 42501 — permission denied for table:
--     classes, students, fees, attendance, messages, notifications
--
--   Error 42501 — permission denied for function:
--     get_dashboard_stats, get_admin_dashboard_activities
--
--   Error P0001 — invalid column for filter:
--     user_id (notifications Realtime), receiver_id (messages Realtime)
--
-- Root Causes:
--   1. get_dashboard_stats was recreated in 20260424000003 without re-granting
--      EXECUTE — previous grant from 20260415000004 was lost.
--   2. get_admin_dashboard_activities (20260421000002) never had GRANT EXECUTE.
--   3. Table-level GRANTs for several tables were stripped by a DROP/RECREATE
--      policies migration and never restored for authenticated role.
--   4. Realtime filter `receiver_id=eq.<id>` on messages fails if the column
--      is not indexed or missing from the publication replica identity.
--      (column exists — this is a Realtime replica-identity issue)
-- ==========================================================================


-- ── 1. GRANT EXECUTE on RPC / helper functions ────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_activities(UUID)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_parent_dashboard_summary(UUID, UUID)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID)
  TO authenticated;

-- internal helpers used by RLS policies and RPCs
GRANT USAGE  ON SCHEMA internal TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO authenticated, service_role;


-- ── 2. Table-level GRANTs ─────────────────────────────────────────────────
-- RLS policies control row-level access; table grants control whether the
-- role is allowed to touch the table AT ALL (separate layer).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fees          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

GRANT ALL ON public.classes       TO service_role;
GRANT ALL ON public.students      TO service_role;
GRANT ALL ON public.fees          TO service_role;
GRANT ALL ON public.attendance    TO service_role;
GRANT ALL ON public.messages      TO service_role;
GRANT ALL ON public.notifications TO service_role;


-- ── 3. Fix Realtime "invalid column for filter receiver_id / user_id" ─────
-- Supabase Realtime filters require the column to be part of the table's
-- REPLICA IDENTITY (default = PRIMARY KEY only).
-- Setting REPLICA IDENTITY FULL means all columns are available for filters.
-- This is safe for tables that aren't write-heavy.

ALTER TABLE public.messages      REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;


-- ── 4. Ensure receiver_id column exists on messages (used by Realtime + RLS)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);


-- ── 5. Reload PostgREST schema cache ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';
