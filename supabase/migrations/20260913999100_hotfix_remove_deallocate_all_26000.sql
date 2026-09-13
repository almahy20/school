-- ==============================================================================
-- Hotfix Migration: 20260913999100_hotfix_remove_deallocate_all_26000.sql
--
-- NEW ERROR  : 26000 — prepared statement "N" does not exist
-- ROOT CAUSE : The previous migration ran DEALLOCATE ALL *inside* the RPC
--              function body. That wiped out PostgREST's own prepared statements
--              for subsequent REST/RPC calls, causing the exact failure we see
--              in the client logs on EVERY next request.
--
-- FIX        : Remove the DEALLOCATE ALL block from the function body.
--              The "42P05 already exists" class of issues (if they ever appear
--              on pgbouncer transaction pooling) are handled by Supabase
--              infrastructure — NOT from inside a function.
-- ==============================================================================

-- 1. Re-drop (idempotent) and rebuild WITHOUT the destructive DEALLOCATE block.
DROP FUNCTION IF EXISTS public.get_child_full_details(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_child_full_details(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_child_full_details(UUID);

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
  -- ⚠️ NO DEALLOCATE ALL here. That killed PostgREST's own prepared statements
  -- on the same connection pool, triggering error 26000 for every follow-up call.

  -- Tolerate load spikes without rolling back the whole function call.
  SET LOCAL statement_timeout = '30s';
  SET LOCAL lock_timeout      = '10s';
  SET LOCAL idle_in_transaction_session_timeout = '0';

  v_caller := auth.uid();

  -- ── A. Authorization ────────────────────────────────────────────────────────
  SELECT (
    v_caller IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_caller AND ur.is_super_admin = TRUE LIMIT 1)
      OR
      EXISTS (SELECT 1 FROM public.student_parents sp WHERE sp.student_id = p_student_id AND sp.parent_id = v_caller LIMIT 1)
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.profiles p ON p.id = v_caller
        WHERE s.id = p_student_id
          AND s.parent_phone IS NOT NULL
          AND p.phone IS NOT NULL
          AND (
            s.parent_phone = p.phone
            OR regexp_replace(s.parent_phone, '\D', '', 'g')
             = regexp_replace(p.phone,        '\D', '', 'g')
          )
        LIMIT 1
      )
      OR
      (p_school_id IS NOT NULL AND p_school_id = COALESCE(
         (SELECT school_id FROM public.user_roles  WHERE user_id = v_caller LIMIT 1),
         (SELECT school_id FROM public.profiles    WHERE id      = v_caller LIMIT 1),
         NULL::UUID
      ))
    )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  -- ── B. Auto-heal student_parents link ───────────────────────────────────────
  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_caller AND ur.is_super_admin = TRUE LIMIT 1
  ) THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT s.school_id, s.id, v_caller
    FROM public.students s
    WHERE s.id = p_student_id
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  -- ── C. current_term label ───────────────────────────────────────────────────
  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- ── D. Aggregate ────────────────────────────────────────────────────────────
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
    LIMIT 1
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
        'teacher_id',       g.teacher_id,
        'exam_templates',   CASE WHEN et.id IS NOT NULL THEN
                              jsonb_build_object(
                                'id',        et.id,
                                'title',     et.title,
                                'term',      et.term,
                                'subject',   et.subject,
                                'max_score', et.max_score
                              )
                            ELSE NULL END
      )
      ORDER BY g.created_at ASC
    ) AS data
    FROM (
      SELECT g2.id, g2.student_id, g2.school_id, g2.subject,
             g2.score, g2.max_score, g2.term, g2.date, g2.notes,
             g2.exam_template_id, g2.created_at, g2.teacher_id
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
    SELECT jsonb_agg(
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
    LEFT JOIN public.curriculum_subjects cs
      ON cs.curriculum_id = sd.curriculum_id
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
  FROM student_data        sd
  CROSS JOIN grades_data      gd
  CROSS JOIN attendance_data  ad
  CROSS JOIN fees_data        fd
  CROSS JOIN payments_data    pd
  CROSS JOIN curriculum_data  cd;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Permissions (match the previous hotfix)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) TO authenticated, service_role;
ALTER  FUNCTION public.get_child_full_details(UUID, UUID) SET search_path = public;

-- ---------------------------------------------------------------------------
-- 3. Reset PostgREST schema cache so the new (clean) function body is used
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
