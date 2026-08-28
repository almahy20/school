-- ==========================================================================
-- Migration: 20260828000000_fix_realtime_filters_and_rpc_permissions.sql
-- Purpose  : 
--   1. Fix "invalid column for filter school_id / user_id / receiver_id" (P0001)
--      by setting REPLICA IDENTITY FULL and adding tables to supabase_realtime.
--   2. Fix "permission denied for function get_complete_user_data" (42501)
--      by granting EXECUTE to authenticated, anon, and service_role.
--   3. Ensure proper permissions on helper functions and triggers dynamically.
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Set REPLICA IDENTITY FULL on all tables used in Realtime subscriptions
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  realtime_tables text[] := ARRAY[
    'electronic_exams',
    'exam_questions',
    'exam_attempts',
    'class_chat_rooms',
    'class_chat_messages',
    'conversations',
    'conversation_messages',
    'students',
    'classes',
    'schools',
    'profiles',
    'notifications',
    'messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY realtime_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
        RAISE NOTICE 'Set REPLICA IDENTITY FULL on %', tbl;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not set REPLICA IDENTITY FULL on %: %', tbl, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Add all Realtime tables to the `supabase_realtime` publication
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  realtime_tables text[] := ARRAY[
    'electronic_exams',
    'exam_questions',
    'exam_attempts',
    'class_chat_rooms',
    'class_chat_messages',
    'conversations',
    'conversation_messages',
    'students',
    'classes',
    'schools',
    'profiles',
    'notifications',
    'messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY realtime_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname    = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = tbl
      ) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
          RAISE NOTICE 'Added % to supabase_realtime', tbl;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Could not add % to supabase_realtime: %', tbl, SQLERRM;
        END;
      ELSE
        RAISE NOTICE '% is already in supabase_realtime', tbl;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Fix RPC Permissions Dynamically (Zero Signature Mismatch)
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS func_signature, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname IN (
        'get_complete_user_data',
        'get_child_full_details',
        'log_action',
        'normalize_student_name_trigger'
      )
  ) LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role;', r.func_signature);
      EXECUTE format('ALTER FUNCTION %s SET search_path = public;', r.func_signature);
      RAISE NOTICE 'Granted permissions on function %', r.func_signature;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not set permissions on %: %', r.func_signature, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Fix Student Name Normalization Trigger (Preserve Hamzas and Arabic Letters)
-- ─────────────────────────────────────────────────────────────────────────

-- إصلاح دالة تريجر الأسماء بحيث تزيل التشكيل والمسافات الزائدة فقط
-- وتحافظ على الحروف العربية والهمزات (أ، إ، آ، ء، ة، ي) دون استبدالها أو تشويهها
CREATE OR REPLACE FUNCTION public.normalize_student_name_trigger()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.name := trim(regexp_replace(
    regexp_replace(NEW.name, E'[\u064B-\u0652\u0670]', '', 'g'),
    '\s+', ' ', 'g'
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_students_normalize_name ON public.students;
CREATE TRIGGER tr_students_normalize_name
  BEFORE INSERT OR UPDATE OF name ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.normalize_student_name_trigger();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Reload schema cache
-- ─────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
