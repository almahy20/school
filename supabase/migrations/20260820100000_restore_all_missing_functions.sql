-- ==========================================================================
-- Migration: 20260820100000_restore_all_missing_functions.sql
-- Purpose  : Restore all RPC functions that were lost after database restore/pause.
--            Run this after any database restore to recover all functions.
-- ==========================================================================

-- ── 1. get_dashboard_stats ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_school_id UUID, p_is_super_admin BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_students INTEGER;
  v_teachers INTEGER;
  v_parents INTEGER;
  v_classes INTEGER;
  v_fee_stats JSONB;
  v_attendance_stats JSONB;
  v_today DATE;
BEGIN
  v_today := CURRENT_DATE;

  SELECT COUNT(*) INTO v_students
  FROM students
  WHERE (p_is_super_admin OR school_id = p_school_id);

  SELECT COUNT(*) INTO v_teachers
  FROM user_roles
  WHERE (p_is_super_admin OR school_id = p_school_id)
    AND role = 'teacher'
    AND approval_status = 'approved';

  SELECT COUNT(*) INTO v_parents
  FROM user_roles
  WHERE (p_is_super_admin OR school_id = p_school_id)
    AND role = 'parent'
    AND approval_status = 'approved';

  SELECT COUNT(*) INTO v_classes
  FROM classes
  WHERE (p_is_super_admin OR school_id = p_school_id);

  SELECT jsonb_build_object(
    'total_due',  COALESCE(SUM(amount_due), 0),
    'total_paid', COALESCE(SUM(amount_paid), 0)
  ) INTO v_fee_stats
  FROM fees
  WHERE (p_is_super_admin OR school_id = p_school_id);

  SELECT jsonb_build_object(
    'present_count', COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late')),
    'absent_count',  COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent'),
    'total_count',   v_students,
    'attendance_rate', CASE
      WHEN v_students > 0
      THEN ROUND((COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late'))::NUMERIC / v_students::NUMERIC) * 100)
      ELSE 0
    END
  ) INTO v_attendance_stats
  FROM attendance
  WHERE (p_is_super_admin OR school_id = p_school_id)
    AND date = v_today;

  RETURN jsonb_build_object(
    'students',       v_students,
    'teachers',       v_teachers,
    'parents',        v_parents,
    'classes',        v_classes,
    'totalDue',       COALESCE((v_fee_stats->>'total_due')::NUMERIC, 0),
    'totalPaid',      COALESCE((v_fee_stats->>'total_paid')::NUMERIC, 0),
    'presentToday',   COALESCE((v_attendance_stats->>'present_count')::INTEGER, 0),
    'absentToday',    COALESCE((v_attendance_stats->>'absent_count')::INTEGER, 0),
    'attendanceRate', COALESCE((v_attendance_stats->>'attendance_rate')::INTEGER, 0)
  );
END;
$$;

-- ── 2. get_admin_dashboard_activities ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin' AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(combined))
      FROM (
        SELECT * FROM (
          SELECT c.id, 'complaint'::text AS type, 'شكوى جديدة'::text AS title,
            CASE WHEN length(c.content) > 60 THEN substring(c.content FROM 1 FOR 60) || '...' ELSE c.content END AS description,
            c.created_at AS date, c.status::text AS status
          FROM complaints c WHERE c.school_id = p_school_id ORDER BY c.created_at DESC LIMIT 5
        ) c_sub
        UNION ALL
        SELECT * FROM (
          SELECT ur.id, 'registration'::text AS type, 'طلب انضمام جديد'::text AS title,
            'المستخدم: ' || COALESCE(p.full_name, 'غير معروف') AS description,
            ur.created_at AS date, ur.approval_status::text AS status
          FROM user_roles ur LEFT JOIN profiles p ON p.id = ur.user_id
          WHERE ur.school_id = p_school_id AND ur.approval_status = 'pending'
          ORDER BY ur.created_at DESC LIMIT 5
        ) r_sub
        UNION ALL
        SELECT * FROM (
          SELECT fp.id, 'payment'::text AS type, 'تم دفع رسوم'::text AS title,
            'المبلغ: ' || fp.amount || ' ج.م للطالب ' || COALESCE(s.name, 'غير معروف') AS description,
            fp.payment_date AS date, 'success'::text AS status
          FROM fee_payments fp JOIN fees f ON f.id = fp.fee_id JOIN students s ON s.id = f.student_id
          WHERE fp.school_id = p_school_id ORDER BY fp.payment_date DESC LIMIT 5
        ) p_sub
        ORDER BY date DESC LIMIT 10
      ) combined
    ),
    '[]'::jsonb
  );
END;
$$;

-- ── 3. get_parent_dashboard_summary ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary(p_parent_id uuid, p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_current_term text;
BEGIN
  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1 THEN 'يناير' WHEN 2 THEN 'فبراير' WHEN 3 THEN 'مارس'
      WHEN 4 THEN 'أبريل' WHEN 5 THEN 'مايو'   WHEN 6 THEN 'يونيو'
      WHEN 7 THEN 'يوليو' WHEN 8 THEN 'أغسطس'  WHEN 9 THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر' WHEN 11 THEN 'نوفمبر' WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  IF auth.uid() <> p_parent_id AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin' AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',             s.id,
      'name',           s.name,
      'class_id',       s.class_id,
      'className',      c.name,
      'avgGrade', (
        SELECT COALESCE(ROUND(AVG(
          CASE WHEN trim(score::text) ~ '^\d+(\.\d+)?$' AND trim(max_score::text) ~ '^\d+(\.\d+)?$' AND trim(max_score::text)::float > 0
               THEN (trim(score::text)::float / trim(max_score::text)::float) * 100 ELSE NULL END
        )), 0) FROM grades WHERE student_id = s.id AND school_id = p_school_id
      ),
      'attendanceRate', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
               ELSE ROUND((COUNT(*) FILTER (WHERE status = 'present')::float / COUNT(*)::float) * 100) END
        FROM attendance WHERE student_id = s.id AND school_id = p_school_id
      ),
      'feesRemaining', (
        COALESCE((SELECT SUM(amount_due - amount_paid) FROM fees
                  WHERE student_id = s.id AND term != v_current_term AND school_id = p_school_id), 0) +
        GREATEST(0, COALESCE(s.monthly_fee, 0) - COALESCE((
          SELECT SUM(amount_paid) FROM fees WHERE student_id = s.id AND term = v_current_term AND school_id = p_school_id
        ), 0))
      )
    )
  ) INTO v_result
  FROM student_parents sp
  JOIN students s ON s.id = sp.student_id
  LEFT JOIN classes c ON c.id = s.class_id
  WHERE sp.parent_id = p_parent_id AND sp.school_id = p_school_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── 4. get_child_full_details ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_child_full_details(p_student_id uuid, p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student jsonb;
  v_grades jsonb;
  v_attendance jsonb;
  v_fees jsonb;
  v_payments jsonb;
  v_curriculum jsonb;
  v_class_id uuid;
  v_curriculum_id uuid;
  v_current_term text;
BEGIN
  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1 THEN 'يناير' WHEN 2 THEN 'فبراير' WHEN 3 THEN 'مارس'
      WHEN 4 THEN 'أبريل' WHEN 5 THEN 'مايو'   WHEN 6 THEN 'يونيو'
      WHEN 7 THEN 'يوليو' WHEN 8 THEN 'أغسطس'  WHEN 9 THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر' WHEN 11 THEN 'نوفمبر' WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  IF NOT EXISTS (
    SELECT 1 FROM student_parents WHERE student_id = p_student_id AND parent_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'teacher') AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  SELECT
    jsonb_build_object(
      'id', s.id, 'name', s.name, 'class_id', s.class_id,
      'parent_phone', s.parent_phone, 'school_id', s.school_id,
      'monthly_fee', s.monthly_fee,
      'address', s.address,
      'classes', jsonb_build_object('id', c.id, 'name', c.name, 'curriculum_id', c.curriculum_id)
    ),
    s.class_id, c.curriculum_id
  INTO v_student, v_class_id, v_curriculum_id
  FROM students s LEFT JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_student_id AND s.school_id = p_school_id;

  IF v_student IS NULL THEN RETURN NULL; END IF;

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
      'exam_templates', CASE WHEN et.id IS NOT NULL THEN
        jsonb_build_object('id', et.id, 'title', et.title, 'term', et.term, 'subject', et.subject)
      ELSE NULL END
    )
    ORDER BY g.created_at ASC
  ) INTO v_grades
  FROM grades g
  LEFT JOIN exam_templates et ON et.id = g.exam_template_id
  WHERE g.student_id = p_student_id AND g.school_id = p_school_id;

  SELECT jsonb_agg(a) INTO v_attendance
  FROM (SELECT * FROM attendance WHERE student_id = p_student_id AND school_id = p_school_id ORDER BY date DESC) a;

  SELECT jsonb_agg(f) INTO v_fees
  FROM (SELECT * FROM fees WHERE student_id = p_student_id AND school_id = p_school_id ORDER BY created_at DESC) f;

  SELECT jsonb_agg(p) INTO v_payments
  FROM (
    SELECT * FROM fee_payments
    WHERE school_id = p_school_id AND fee_id IN (SELECT id FROM fees WHERE student_id = p_student_id)
    ORDER BY payment_date DESC
  ) p;

  IF v_curriculum_id IS NOT NULL THEN
    SELECT jsonb_agg(cs) INTO v_curriculum
    FROM (SELECT * FROM curriculum_subjects WHERE curriculum_id = v_curriculum_id ORDER BY subject_name) cs;
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

-- ── 5. Permissions ────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN)       FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN)       TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid)     FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid)     TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid)       FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid)       TO authenticated, service_role;

-- ── 6. Table grants (safety net) ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fees           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_templates TO authenticated;

NOTIFY pgrst, 'reload schema';
