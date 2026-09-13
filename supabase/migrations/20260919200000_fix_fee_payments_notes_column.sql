-- ==============================================================================
-- Migration: 20260919200000_fix_fee_payments_notes_column.sql
-- Fix: column fp.notes does not exist (error 42703)
-- The get_child_full_details RPC references fee_payments.notes but the column
-- was never added to the table. This adds it and recreates the RPC cleanly.
-- ==============================================================================

-- 1. Add the missing column
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Recreate the RPC to ensure it matches the current schema
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
  v_caller        UUID;
  v_is_authorized BOOLEAN;
  v_current_term  TEXT;
  v_result        JSONB;
BEGIN
  v_caller := auth.uid();

  -- 1. Authorization check (admin, teacher, super_admin, or matched parent)
  SELECT (
    v_caller IS NOT NULL AND (
      public.get_auth_is_super_admin()
      OR
      EXISTS (
        SELECT 1 FROM public.student_parents sp
        WHERE sp.student_id = p_student_id AND sp.parent_id = v_caller
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.profiles p ON p.id = v_caller
        WHERE s.id = p_student_id
          AND s.parent_phone IS NOT NULL
          AND p.phone IS NOT NULL
          AND (
            s.parent_phone = p.phone
            OR regexp_replace(s.parent_phone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g')
          )
      )
      OR
      (
        p_school_id IS NOT NULL 
        AND p_school_id = public.get_auth_school_id()
      )
    )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  -- 2. Auto-heal: Ensure student_parents link exists if caller is parent
  IF v_caller IS NOT NULL AND NOT public.get_auth_is_super_admin() THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT s.school_id, s.id, v_caller
    FROM public.students s
    WHERE s.id = p_student_id
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  -- 3. Current term formatting
  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- 4. Aggregate student data
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
                            'grade_level',   c.grade_level,
                            'curriculum_id', c.curriculum_id
                          )
                        ELSE NULL END
      ) AS info,
      s.class_id,
      c.curriculum_id
    FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_student_id
      AND (p_school_id IS NULL OR s.school_id = p_school_id)
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
        'notes',            g.notes,
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
             g2.score, g2.max_score, g2.term, g2.date, g2.notes,
             g2.exam_template_id, g2.created_at
      FROM public.grades g2
      WHERE g2.student_id = p_student_id
      ORDER BY g2.created_at ASC
      LIMIT 500
    ) g
    LEFT JOIN public.exam_templates et ON et.id = g.exam_template_id
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
      FROM public.attendance a2
      WHERE a2.student_id = p_student_id
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
          'description', COALESCE(f.description, f.term, ''),
          'amount_due',  f.amount_due,
          'amount_paid', f.amount_paid,
          'term',        f.term,
          'status',      f.status,
          'created_at',  f.created_at
        )
        ORDER BY f.created_at DESC
      ) AS data
    FROM public.fees f
    WHERE f.student_id = p_student_id
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
    FROM public.fee_payments fp
    JOIN public.fees f ON f.id = fp.fee_id AND f.student_id = p_student_id
  ),
  curriculum_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',            cs.id,
        'subject_name',  cs.subject_name,
        'description',   cs.description,
        'curriculum_id', cs.curriculum_id
      )
      ORDER BY cs.subject_name ASC
    ) AS data
    FROM student_data sd
    JOIN public.curriculum_subjects cs ON cs.curriculum_id = sd.curriculum_id
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

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 3. Permissions
REVOKE EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) TO authenticated, service_role;
ALTER FUNCTION public.get_child_full_details(UUID, UUID) SET search_path = public;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
