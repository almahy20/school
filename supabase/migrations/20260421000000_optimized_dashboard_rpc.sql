-- ═══════════════════════════════════════════════════
-- OPTIMIZED PARENT DASHBOARD RPC
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary(p_parent_id uuid, p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- ✅ Security Check: Ensure the caller is either the parent themselves or an admin
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
      'feesRemaining', (
        SELECT COALESCE(SUM(amount_due) - SUM(amount_paid), 0)
        FROM fees
        WHERE student_id = s.id AND school_id = p_school_id
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
