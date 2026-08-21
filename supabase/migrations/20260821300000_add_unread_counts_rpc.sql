-- ════════════════════════════════════════════════════════════════════════
-- Migration: add_unread_counts_rpc
-- Goal: Replace the two parallel notification count queries in useUnreadCounts
--       with a single RPC call, cutting 1 round-trip on every page load.
--
-- NOTE: Run this in the Supabase SQL Editor with the following prefix:
--   SET search_path TO public;
-- ════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_unread_notification_counts(uuid);

CREATE OR REPLACE FUNCTION public.get_unread_notification_counts(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unread     bigint := 0;
  v_complaints bigint := 0;
BEGIN
  -- Guard: if the table doesn't exist yet (e.g. during initial migration), return zeros
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'notifications'
  ) THEN
    RETURN jsonb_build_object('unread', 0, 'complaints', 0);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE is_read = false),
    COUNT(*) FILTER (WHERE is_read = false AND type ILIKE 'complaint%')
  INTO v_unread, v_complaints
  FROM public.notifications
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('unread', v_unread, 'complaints', v_complaints);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) FROM anon;

NOTIFY pgrst, 'reload schema';
