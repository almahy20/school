-- ═══════════════════════════════════════════════════
-- FULL CHILD DETAILS RPC (Unified Data Fetching)
-- ═══════════════════════════════════════════════════

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
BEGIN
  -- ✅ Security Check: Ensure the caller is linked to this student or is an admin/teacher
  IF NOT EXISTS (
    -- Case 1: Caller is the parent of the student
    SELECT 1 FROM student_parents 
    WHERE student_id = p_student_id AND parent_id = auth.uid()
  ) AND NOT EXISTS (
    -- Case 2: Caller is an admin/teacher in the same school
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

  -- 4. Fees
  SELECT jsonb_agg(f) INTO v_fees
  FROM (SELECT * FROM fees WHERE student_id = p_student_id AND school_id = p_school_id) f;

  -- 5. Payments (Batch fetch all payments for this student's fees)
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
    'curriculum', COALESCE(v_curriculum, '[]'::jsonb)
  );
END;
$$;
