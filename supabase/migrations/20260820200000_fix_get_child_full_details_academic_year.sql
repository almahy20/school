-- ==========================================================================
-- Migration: 20260820200000_fix_get_child_full_details_academic_year.sql
-- Purpose  : Force-drop and recreate get_child_full_details to fix the error:
--            "column s.academic_year does not exist"
--            The live DB has a stale function body that references a column
--            that was never in the students table schema.
-- ==========================================================================

-- Drop first to ensure the old body is completely replaced (CREATE OR REPLACE
-- alone may not always overwrite if the function was created with a different
-- set of column references in an older DB snapshot).
DROP FUNCTION IF EXISTS public.get_child_full_details(uuid, uuid);

CREATE FUNCTION public.get_child_full_details(p_student_id uuid, p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student     jsonb;
  v_grades      jsonb;
  v_attendance  jsonb;
  v_fees        jsonb;
  v_payments    jsonb;
  v_curriculum  jsonb;
  v_class_id    uuid;
  v_curriculum_id uuid;
  v_current_term text;
BEGIN
  -- Build current term string  e.g. "شهر أغسطس 2026"
  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'
      WHEN 2  THEN 'فبراير'
      WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'
      WHEN 5  THEN 'مايو'
      WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'
      WHEN 8  THEN 'أغسطس'
      WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'
      WHEN 11 THEN 'نوفمبر'
      WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- Security: caller must be the linked parent, or an admin/teacher of this school
  IF NOT EXISTS (
    SELECT 1 FROM student_parents
    WHERE student_id = p_student_id AND parent_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'teacher')
      AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  -- 1. Student + class info (no academic_year reference)
  SELECT
    jsonb_build_object(
      'id',           s.id,
      'name',         s.name,
      'class_id',     s.class_id,
      'parent_phone', s.parent_phone,
      'school_id',    s.school_id,
      'monthly_fee',  s.monthly_fee,
      'classes',      jsonb_build_object(
                        'id',            c.id,
                        'name',          c.name,
                        'curriculum_id', c.curriculum_id
                      )
    ),
    s.class_id,
    c.curriculum_id
  INTO v_student, v_class_id, v_curriculum_id
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_student_id AND s.school_id = p_school_id;

  IF v_student IS NULL THEN RETURN NULL; END IF;

  -- 2. Grades (with exam template details)
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
  ) INTO v_grades
  FROM grades g
  LEFT JOIN exam_templates et ON et.id = g.exam_template_id
  WHERE g.student_id = p_student_id AND g.school_id = p_school_id;

  -- 3. Attendance
  SELECT jsonb_agg(a) INTO v_attendance
  FROM (
    SELECT * FROM attendance
    WHERE student_id = p_student_id AND school_id = p_school_id
    ORDER BY date DESC
  ) a;

  -- 4. Fees
  SELECT jsonb_agg(f) INTO v_fees
  FROM (
    SELECT * FROM fees
    WHERE student_id = p_student_id AND school_id = p_school_id
    ORDER BY created_at DESC
  ) f;

  -- 5. Payments
  SELECT jsonb_agg(p) INTO v_payments
  FROM (
    SELECT * FROM fee_payments
    WHERE school_id = p_school_id
      AND fee_id IN (SELECT id FROM fees WHERE student_id = p_student_id)
    ORDER BY payment_date DESC
  ) p;

  -- 6. Curriculum subjects
  IF v_curriculum_id IS NOT NULL THEN
    SELECT jsonb_agg(cs) INTO v_curriculum
    FROM (
      SELECT * FROM curriculum_subjects
      WHERE curriculum_id = v_curriculum_id
      ORDER BY subject_name
    ) cs;
  END IF;

  RETURN jsonb_build_object(
    'student',      v_student,
    'grades',       COALESCE(v_grades,     '[]'::jsonb),
    'attendance',   COALESCE(v_attendance, '[]'::jsonb),
    'fees',         COALESCE(v_fees,       '[]'::jsonb),
    'payments',     COALESCE(v_payments,   '[]'::jsonb),
    'curriculum',   COALESCE(v_curriculum, '[]'::jsonb),
    'current_term', v_current_term
  );
END;
$$;

-- Permissions
REVOKE EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) TO authenticated, service_role;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
