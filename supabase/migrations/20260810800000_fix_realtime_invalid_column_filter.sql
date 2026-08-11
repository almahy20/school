-- ════════════════════════════════════════════════════════════════════════
-- Migration: fix_realtime_invalid_column_filter
-- Problem: Supabase Realtime throws:
--   "invalid column for filter user_id"    → notifications table
--   "invalid column for filter receiver_id" → messages table
--
-- Root cause: Both tables have REPLICA IDENTITY FULL set, but they were
-- NEVER added to the `supabase_realtime` publication. Without being in
-- the publication Realtime cannot inspect column values at all, so any
-- filter (eq/neq/etc.) on any column fails with "invalid column".
--
-- Fix:
--   1. Add messages + notifications to supabase_realtime publication.
--   2. Confirm REPLICA IDENTITY FULL on both tables (idempotent).
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Set REPLICA IDENTITY FULL (required for column-level Realtime filters)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.messages      REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Add both tables to the Supabase Realtime publication
-- ─────────────────────────────────────────────────────────────────────────

-- notifications → enables filter on `user_id`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE 'Added notifications to supabase_realtime';
  ELSE
    RAISE NOTICE 'notifications already in supabase_realtime';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not add notifications to supabase_realtime: %', SQLERRM;
END $$;

-- messages → enables filter on `receiver_id`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    RAISE NOTICE 'Added messages to supabase_realtime';
  ELSE
    RAISE NOTICE 'messages already in supabase_realtime';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not add messages to supabase_realtime: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Verify: list all tables currently in the publication
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== Tables in supabase_realtime publication ===';
  FOR r IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    ORDER BY tablename
  LOOP
    RAISE NOTICE '  ✓ %', r.tablename;
  END LOOP;
END $$;
