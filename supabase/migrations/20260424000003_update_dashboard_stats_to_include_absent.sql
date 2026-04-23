-- Update get_dashboard_stats to include absentToday
-- Date: 2026-04-24

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_school_id UUID, p_is_super_admin BOOLEAN)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
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
  
  -- Get counts (optimized with indexes)
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
  
  -- Get fee statistics
  SELECT jsonb_build_object(
    'total_due', COALESCE(SUM(amount_due), 0),
    'total_paid', COALESCE(SUM(amount_paid), 0)
  ) INTO v_fee_stats
  FROM fees
  WHERE (p_is_super_admin OR school_id = p_school_id);
  
  -- Get today's attendance stats
  SELECT jsonb_build_object(
    'present_count', COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late')),
    'absent_count', COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent'),
    'total_count', v_students,
    'attendance_rate', CASE 
      WHEN v_students > 0 
      THEN ROUND((COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late'))::NUMERIC / v_students::NUMERIC) * 100)
      ELSE 0 
    END
  ) INTO v_attendance_stats
  FROM attendance
  WHERE (p_is_super_admin OR school_id = p_school_id) 
    AND date = v_today;
  
  -- Return combined result
  RETURN jsonb_build_object(
    'students', v_students,
    'teachers', v_teachers,
    'parents', v_parents,
    'classes', v_classes,
    'totalDue', COALESCE((v_fee_stats->>'total_due')::NUMERIC, 0),
    'totalPaid', COALESCE((v_fee_stats->>'total_paid')::NUMERIC, 0),
    'presentToday', COALESCE((v_attendance_stats->>'present_count')::INTEGER, 0),
    'absentToday', COALESCE((v_attendance_stats->>'absent_count')::INTEGER, 0),
    'attendanceRate', COALESCE((v_attendance_stats->>'attendance_rate')::INTEGER, 0)
  );
END;
$$;
