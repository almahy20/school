-- Migration: update_parent_dashboard_rpcs_for_monthly_fees
-- Description: Update parent dashboard and child detail RPCs to use the new fixed monthly_fee logic

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
  -- ✅ Calculate current term string (matching app format: شهر [أسم الشهر] [السنة])
  v_current_term := 'شهر ' || 
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1 THEN 'يناير'
      WHEN 2 THEN 'فبراير'
      WHEN 3 THEN 'مارس'
      WHEN 4 THEN 'أبريل'
      WHEN 5 THEN 'مايو'
      WHEN 6 THEN 'يونيو'
      WHEN 7 THEN 'يوليو'
      WHEN 8 THEN 'أغسطس'
      WHEN 9 THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'
      WHEN 11 THEN 'نوفمبر'
      WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- ✅ Security Check
  IF auth.uid() <> p_parent_id AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin' AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'class_id', s.class_id,
      'className', c.name,
      'avgGrade', (
        SELECT COALESCE(ROUND(AVG((score::float / max_score::float) * 100)), 0)
        FROM grades
        WHERE student_id = s.id AND school_id = p_school_id
      ),
      'attendanceRate', (
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE status = 'present')::float / COUNT(*)::float) * 100)
          END
        FROM attendance
        WHERE student_id = s.id AND school_id = p_school_id
      ),
      -- ✅ Updated: Calculate total remaining based on (past unpaid fees) + (current month's fixed fee - paid)
      'feesRemaining', (
        COALESCE((
          SELECT SUM(amount_due - amount_paid)
          FROM fees
          WHERE student_id = s.id AND term != v_current_term AND school_id = p_school_id
        ), 0) +
        GREATEST(0, COALESCE(s.monthly_fee, 0) - COALESCE((
          SELECT SUM(amount_paid) 
          FROM fees 
          WHERE student_id = s.id AND term = v_current_term AND school_id = p_school_id
        ), 0))
      )
    )
  ) INTO v_result
  FROM student_parents sp
  JOIN students s ON s.id = sp.student_id
  LEFT JOIN classes c ON c.id = s.class_id
  WHERE sp.parent_id = p_parent_id 
    AND sp.school_id = p_school_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


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
  -- ✅ Calculate current term string
  v_current_term := 'شهر ' || 
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1 THEN 'يناير'
      WHEN 2 THEN 'فبراير'
      WHEN 3 THEN 'مارس'
      WHEN 4 THEN 'أبريل'
      WHEN 5 THEN 'مايو'
      WHEN 6 THEN 'يونيو'
      WHEN 7 THEN 'يوليو'
      WHEN 8 THEN 'أغسطس'
      WHEN 9 THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'
      WHEN 11 THEN 'نوفمبر'
      WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- ✅ Security Check
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

  -- 1. Basic Student and Class info
  SELECT 
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'class_id', s.class_id,
      'parent_phone', s.parent_phone,
      'school_id', s.school_id,
      'monthly_fee', s.monthly_fee, -- ✅ Added monthly_fee
      'classes', jsonb_build_object('id', c.id, 'name', c.name, 'curriculum_id', c.curriculum_id)
    ),
    s.class_id,
    c.curriculum_id
  INTO v_student, v_class_id, v_curriculum_id
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_student_id AND s.school_id = p_school_id;

  IF v_student IS NULL THEN RETURN NULL; END IF;

  -- 2. Grades
  SELECT jsonb_agg(g) INTO v_grades
  FROM (SELECT * FROM grades WHERE student_id = p_student_id AND school_id = p_school_id ORDER BY date ASC) g;

  -- 3. Attendance
  SELECT jsonb_agg(a) INTO v_attendance
  FROM (SELECT * FROM attendance WHERE student_id = p_student_id AND school_id = p_school_id ORDER BY date DESC) a;

  -- 4. Fees (Only show relevant fees or all history?)
  -- ✅ Updated: We still show all history, but the summary will handle the current month logic
  SELECT jsonb_agg(f) INTO v_fees
  FROM (SELECT * FROM fees WHERE student_id = p_student_id AND school_id = p_school_id ORDER BY created_at DESC) f;

  -- 5. Payments
  SELECT jsonb_agg(p) INTO v_payments
  FROM (
    SELECT * FROM fee_payments 
    WHERE school_id = p_school_id 
    AND fee_id IN (SELECT id FROM fees WHERE student_id = p_student_id)
    ORDER BY payment_date DESC
  ) p;

  -- 6. Curriculum Subjects
  IF v_curriculum_id IS NOT NULL THEN
    SELECT jsonb_agg(cs) INTO v_curriculum
    FROM (SELECT * FROM curriculum_subjects WHERE curriculum_id = v_curriculum_id ORDER BY subject_name) cs;
  END IF;

  -- 7. Combine everything
  RETURN jsonb_build_object(
    'student', v_student,
    'grades', COALESCE(v_grades, '[]'::jsonb),
    'attendance', COALESCE(v_attendance, '[]'::jsonb),
    'fees', COALESCE(v_fees, '[]'::jsonb),
    'payments', COALESCE(v_payments, '[]'::jsonb),
    'curriculum', COALESCE(v_curriculum, '[]'::jsonb),
    'current_term', v_current_term -- ✅ Added current_term for UI context
  );
END;
$$;
