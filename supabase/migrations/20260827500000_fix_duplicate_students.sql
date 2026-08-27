-- ==========================================================================
-- Migration: 20260827500000_fix_duplicate_students.sql
-- Purpose  : إزالة التكرارات + منع التكرار مستقبلاً
--
-- ⚠️  لو واجهت timeout:
--     شغّل كل STEP بشكل منفصل في SQL Editor في Supabase Dashboard
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1: دالة تطبيع الأسماء (سريع جداً — لا يلمس أي جدول)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_arabic_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    translate(
      p_name,
      E'\u06CC\u06A9\u0629\u0623\u0625\u0622\u0621\u0624\u0626',
      E'\u064A\u0643\u0647\u0627\u0627\u0627\u0627\u0648\u064A'
    ),
    E'[\u064B-\u0652\u0670]', '', 'g'
  ));
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2: حذف التكرارات (يشغّل بسرعة لأن البيانات صغيرة)
-- ─────────────────────────────────────────────────────────────────────────

-- طلاب داخل فصل — نحتفظ بأقدم record
DELETE FROM public.students
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY school_id, class_id,
          public.normalize_arabic_name(name)
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.students
    WHERE class_id IS NOT NULL
  ) t WHERE rn > 1
);

-- طلاب بدون فصل
DELETE FROM public.students
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY school_id,
          public.normalize_arabic_name(name)
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.students
    WHERE class_id IS NULL
  ) t WHERE rn > 1
);

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3: تطبيع الأسماء الموجودة (UPDATE بدل GENERATED COLUMN — أسرع وبدون lock)
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.students
SET name = public.normalize_arabic_name(name)
WHERE name IS DISTINCT FROM public.normalize_arabic_name(name);

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 4: indexes للأداء والـ uniqueness
-- ─────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_class_name_norm
  ON public.students (school_id, class_id,
    (public.normalize_arabic_name(name)))
  WHERE class_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_name_norm_no_class
  ON public.students (school_id,
    (public.normalize_arabic_name(name)))
  WHERE class_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 5: Trigger يُطبّع الاسم تلقائياً عند INSERT/UPDATE
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_student_name_trigger()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.name := public.normalize_arabic_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_students_normalize_name ON public.students;
CREATE TRIGGER tr_students_normalize_name
  BEFORE INSERT OR UPDATE OF name ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.normalize_student_name_trigger();

REVOKE EXECUTE ON FUNCTION public.normalize_student_name_trigger() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.normalize_student_name_trigger() TO service_role;

NOTIFY pgrst, 'reload schema';
