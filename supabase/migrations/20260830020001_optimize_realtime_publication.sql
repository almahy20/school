-- ==========================================================================
-- Migration: 20260830020000_optimize_realtime_publication.sql
-- Purpose  : حل أزمة استنزاف موارد Realtime (PostgresCdcRls Connection Pool Error)
--            وإزالة الجداول غير الضرورية من Realtime لتخفيض الـ CPU من 96% إلى < 5%
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. إزالة الجداول غير الحية من supabase_realtime
--    (الجداول الثابتة لا تحتاج Realtime وتسبب ضغطاً هائلاً على المعالج والـ Pool)
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  heavy_tables text[] := ARRAY[
    'curriculum_subjects',
    'classes',
    'teachers',
    'students',
    'student_parents',
    'user_roles',
    'profiles',
    'fees',
    'grades',
    'attendance',
    'complaints',
    'schools',
    'exam_questions'
  ];
BEGIN
  FOREACH tbl IN ARRAY heavy_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I;', tbl);
        RAISE NOTICE 'Removed % from supabase_realtime', tbl;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not drop % from publication: %', tbl, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. إبقاء جداول الإشعارات والدردشة فقط في Realtime
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  chat_tables text[] := ARRAY[
    'notifications',
    'class_chat_messages',
    'conversation_messages',
    'messages',
    'class_chat_rooms',
    'conversations'
  ];
BEGIN
  FOREACH tbl IN ARRAY chat_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
        RAISE NOTICE 'Ensured % in supabase_realtime', tbl;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. تحديث الإحصائيات وإعادة تحميل PostgREST
-- ─────────────────────────────────────────────────────────────────────────
ANALYZE;

NOTIFY pgrst, 'reload schema';
