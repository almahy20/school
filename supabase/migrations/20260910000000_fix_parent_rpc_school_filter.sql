-- ==========================================================================
-- Migration: 20260910000000_fix_parent_rpc_school_filter.sql
-- Purpose  : إصلاح get_parent_dashboard_summary
--
-- المشكلة:
--   CTE children تُفلتر بـ "sp.school_id = p_school_id"
--   لكن بعض rows في student_parents كانت school_id = NULL قبل الإصلاح،
--   وبعض أولياء الأمور JWT بتاعهم فيه school_id قديم أو فاضي.
--
-- الحل:
--   - نشيل فلتر sp.school_id من student_parents
--   - نعتمد على s.school_id = p_school_id (من جدول students نفسه)
--   - هذا أصح منطقياً: الطالب ينتمي للمدرسة، مش الـ link
-- ==========================================================================

SET search_path TO public;

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

  -- Security check
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
    -- ✅ الإصلاح: نعتمد على s.school_id بدل sp.school_id
    -- هكذا يعمل حتى لو sp.school_id = NULL أو قديم
    SELECT s.id, s.name, s.class_id, s.school_id, s.monthly_fee,
           c.name AS class_name
    FROM student_parents sp
    JOIN students s ON s.id = sp.student_id
                    AND s.school_id = p_school_id   -- ← من الطالب
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE sp.parent_id = p_parent_id               -- ← بدون sp.school_id
  ),
  grade_avgs AS (
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

NOTIFY pgrst, 'reload schema';
