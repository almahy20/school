-- ==========================================================================
-- Migration: 20260903300000_fix_grade_cast_and_realtime.sql
-- Purpose  : إصلاح مشكلتين ظهرتا في اللوقات بعد migration 20260903100000
--
-- المشكلة 1: 22P02 invalid input syntax for type numeric: "تمكين رباعي فتحه"
--   السبب  : grades.score عمود TEXT يحتوي على قيم عربية (نظام التقدير النصي)
--             استبدلنا regex بـ g.score::numeric مباشرة وهذا خطأ
--   الحل   : استعادة منطق الـ regex للـ score (لأنه TEXT)
--             الإبقاء على cast مباشر للـ max_score (لأنه NUMERIC)
--
-- المشكلة 2: P0001 invalid column for filter school_id / parent_id
--   السبب  : جدول conversations في supabase_realtime publication لكن بدون
--             REPLICA IDENTITY FULL — Realtime لا يستطيع رؤية قيم الأعمدة
--   الحل   : SET REPLICA IDENTITY FULL على conversations و conversation_messages
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. إصلاح get_parent_dashboard_summary
--    استعادة regex للـ score (TEXT) مع الإبقاء على تحسينات الأداء الأخرى
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary(
    p_parent_id uuid,
    p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid;
  v_current_term text;
  v_result       jsonb;
BEGIN
  v_caller := auth.uid();

  -- Security check: وليّ الأمر نفسه أو مدير معتمد في المدرسة
  IF v_caller <> p_parent_id AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_caller AND role = 'admin'
      AND school_id = p_school_id AND approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  WITH
  children AS (
    SELECT s.id, s.name, s.class_id, s.school_id, s.monthly_fee,
           c.name AS class_name
    FROM student_parents sp
    JOIN students s ON s.id = sp.student_id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE sp.parent_id = p_parent_id AND sp.school_id = p_school_id
  ),
  grade_avgs AS (
    -- grades.score هو TEXT (يحتوي على قيم عربية مثل "تمكين رباعي فتحه")
    -- لذلك يجب استخدام regex للتحقق قبل الـ cast
    -- grades.max_score هو NUMERIC — cast مباشر آمن
    SELECT
      g.student_id,
      ROUND(AVG(
        CASE
          WHEN trim(g.score::text) ~ '^\d+(\.\d+)?$'
           AND g.max_score IS NOT NULL
           AND g.max_score > 0
          THEN (trim(g.score::text)::float / g.max_score::float) * 100
          ELSE NULL
        END
      )) AS avg_grade
    FROM grades g
    WHERE g.school_id  = p_school_id
      AND g.student_id IN (SELECT id FROM children)
    GROUP BY g.student_id
  ),
  attendance_rates AS (
    SELECT
      a.student_id,
      CASE WHEN COUNT(*) = 0 THEN 0
           ELSE ROUND(
             (COUNT(*) FILTER (WHERE a.status = 'present')::float
              / COUNT(*)::float) * 100
           )
      END AS attendance_rate
    FROM attendance a
    WHERE a.school_id  = p_school_id
      AND a.student_id IN (SELECT id FROM children)
    GROUP BY a.student_id
  ),
  fees_data AS (
    SELECT
      f.student_id,
      COALESCE(SUM(f.amount_due - f.amount_paid)
        FILTER (WHERE f.term <> v_current_term), 0) AS old_remaining,
      COALESCE(SUM(f.amount_paid)
        FILTER (WHERE f.term  = v_current_term), 0) AS current_paid
    FROM fees f
    WHERE f.school_id  = p_school_id
      AND f.student_id IN (SELECT id FROM children)
    GROUP BY f.student_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             ch.id,
      'name',           ch.name,
      'class_id',       ch.class_id,
      'className',      ch.class_name,
      'avgGrade',       COALESCE(ga.avg_grade, 0),
      'attendanceRate', COALESCE(ar.attendance_rate, 0),
      'feesRemaining',  COALESCE(fd.old_remaining, 0) +
                        GREATEST(0, COALESCE(ch.monthly_fee, 0) - COALESCE(fd.current_paid, 0))
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM children ch
  LEFT JOIN grade_avgs       ga ON ga.student_id = ch.id
  LEFT JOIN attendance_rates ar ON ar.student_id = ch.id
  LEFT JOIN fees_data        fd ON fd.student_id = ch.id;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) TO authenticated, service_role;

-- ==========================================================================
-- 2. إصلاح get_child_full_details — نفس مشكلة score::numeric
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_child_full_details(
    p_student_id UUID,
    p_school_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid;
  v_is_authorized boolean;
  v_current_term  text;
  v_result        jsonb;
BEGIN
  v_caller := auth.uid();

  SELECT (
    EXISTS (
      SELECT 1 FROM student_parents
      WHERE student_id = p_student_id AND parent_id = v_caller
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = v_caller
        AND role IN ('admin', 'teacher')
        AND school_id = p_school_id
    )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  WITH
  student_data AS (
    SELECT
      jsonb_build_object(
        'id',           s.id,
        'name',         s.name,
        'class_id',     s.class_id,
        'parent_phone', s.parent_phone,
        'school_id',    s.school_id,
        'monthly_fee',  s.monthly_fee,
        'classes',      CASE WHEN c.id IS NOT NULL THEN
                          jsonb_build_object(
                            'id',            c.id,
                            'name',          c.name,
                            'curriculum_id', c.curriculum_id
                          )
                        ELSE NULL END
      ) AS info,
      s.class_id,
      c.curriculum_id
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.id = p_student_id AND s.school_id = p_school_id
  ),
  grades_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',               g.id,
        'student_id',       g.student_id,
        'school_id',        g.school_id,
        'subject',          g.subject,
        'score',            g.score,
        'max_score',        g.max_score,
        'term',             g.term,
        'date',             g.date,
        'exam_template_id', g.exam_template_id,
        'created_at',       g.created_at,
        'exam_templates',   CASE WHEN et.id IS NOT NULL THEN
                              jsonb_build_object(
                                'id',      et.id,
                                'title',   et.title,
                                'term',    et.term,
                                'subject', et.subject
                              )
                            ELSE NULL END
      )
      ORDER BY g.created_at ASC
    ) AS data
    FROM (
      SELECT g2.id, g2.student_id, g2.school_id, g2.subject,
             g2.score, g2.max_score, g2.term, g2.date,
             g2.exam_template_id, g2.created_at
      FROM grades g2
      WHERE g2.student_id = p_student_id AND g2.school_id = p_school_id
      ORDER BY g2.created_at ASC
      LIMIT 200
    ) g
    LEFT JOIN exam_templates et ON et.id = g.exam_template_id
  ),
  attendance_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',         a.id,
        'date',       a.date,
        'status',     a.status,
        'student_id', a.student_id,
        'school_id',  a.school_id,
        'class_id',   a.class_id,
        'notes',      a.notes
      )
      ORDER BY a.date DESC
    ) AS data
    FROM (
      SELECT a2.id, a2.date, a2.status, a2.student_id,
             a2.school_id, a2.class_id, a2.notes
      FROM attendance a2
      WHERE a2.student_id = p_student_id AND a2.school_id = p_school_id
      ORDER BY a2.date DESC
      LIMIT 365
    ) a
  ),
  fees_data AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id',          f.id,
          'student_id',  f.student_id,
          'school_id',   f.school_id,
          'description', f.description,
          'amount_due',  f.amount_due,
          'amount_paid', f.amount_paid,
          'term',        f.term,
          'status',      f.status,
          'created_at',  f.created_at
        )
        ORDER BY f.created_at DESC
      ) AS data,
      array_agg(f.id) AS ids
    FROM fees f
    WHERE f.student_id = p_student_id AND f.school_id = p_school_id
  ),
  payments_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',           fp.id,
        'fee_id',       fp.fee_id,
        'school_id',    fp.school_id,
        'amount',       fp.amount,
        'payment_date', fp.payment_date,
        'notes',        fp.notes
      )
      ORDER BY fp.payment_date DESC
    ) AS data
    FROM fee_payments fp
    JOIN fees f ON f.id = fp.fee_id AND f.student_id = p_student_id
    WHERE fp.school_id = p_school_id
  ),
  curriculum_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',            cs.id,
        'subject_name',  cs.subject_name,
        'description',   cs.description,
        'curriculum_id', cs.curriculum_id
      )
      ORDER BY cs.subject_name
    ) AS data
    FROM student_data sd
    JOIN curriculum_subjects cs ON cs.curriculum_id = sd.curriculum_id
    WHERE sd.curriculum_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'student',      sd.info,
    'grades',       COALESCE(gd.data, '[]'::jsonb),
    'attendance',   COALESCE(ad.data, '[]'::jsonb),
    'fees',         COALESCE(fd.data, '[]'::jsonb),
    'payments',     COALESCE(pd.data, '[]'::jsonb),
    'curriculum',   COALESCE(cd.data, '[]'::jsonb),
    'current_term', v_current_term
  )
  INTO v_result
  FROM student_data   sd
  CROSS JOIN grades_data     gd
  CROSS JOIN attendance_data ad
  CROSS JOIN fees_data       fd
  CROSS JOIN payments_data   pd
  CROSS JOIN curriculum_data cd;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) TO authenticated, service_role;

-- ==========================================================================
-- 3. إصلاح Realtime: REPLICA IDENTITY FULL على conversations
--    السبب: Realtime يحتاج REPLICA IDENTITY FULL ليرى قيم الأعمدة القديمة
--    بدونه يرمي "invalid column for filter school_id / parent_id"
-- ==========================================================================

ALTER TABLE public.conversations          REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_messages  REPLICA IDENTITY FULL;

-- التأكد من وجودهما في publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not update supabase_realtime publication: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
