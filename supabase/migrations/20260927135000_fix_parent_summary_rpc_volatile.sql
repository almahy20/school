-- ============================================================================
-- Migration: 20260927135000_fix_parent_summary_rpc_volatile.sql
-- Description: Make get_parent_dashboard_summary VOLATILE to allow Auto-Heal INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary(
    p_parent_id uuid,
    p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          uuid;
  v_parent_phone    text;
  v_parent_school   uuid;
  v_current_term    text;
  v_result          jsonb;
BEGIN
  v_caller := auth.uid();

  -- Security check
  IF v_caller <> p_parent_id AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'admin'
      AND (p_school_id IS NULL OR school_id = p_school_id) AND approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  -- جلب بيانات هاتف ومدرسة ولي الأمر
  SELECT phone, school_id INTO v_parent_phone, v_parent_school
  FROM public.profiles
  WHERE id = p_parent_id;

  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- ⚡ Auto-Heal: ربط أي أبناء مطابقين بالهاتف في student_parents قبل الـ SELECT
  IF v_parent_phone IS NOT NULL AND v_parent_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT DISTINCT
      s.school_id,
      s.id AS student_id,
      p_parent_id AS parent_id
    FROM public.students s
    WHERE s.parent_phone IS NOT NULL AND s.parent_phone <> ''
      AND public.phones_match(s.parent_phone, v_parent_phone)
      AND (p_school_id IS NULL OR s.school_id = p_school_id OR s.school_id = v_parent_school)
      AND NOT EXISTS (
        SELECT 1 FROM public.student_parents sp
        WHERE sp.student_id = s.id AND sp.parent_id = p_parent_id
      )
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  WITH
  children AS (
    -- ⚡ المسار السريع: روابط صريحة في student_parents (يستخدم الفهارس مباشرة)
    SELECT s.id, s.name, s.class_id, s.school_id, s.monthly_fee,
           c.name AS class_name
    FROM public.student_parents sp
    JOIN public.students s ON s.id = sp.student_id
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE sp.parent_id = p_parent_id
      AND (p_school_id IS NULL OR s.school_id = p_school_id OR s.school_id = v_parent_school OR v_parent_school IS NULL)

    UNION  -- يزيل التكرارات تلقائياً (يستبدل DISTINCT البطيء)

    -- ⚡ المسار البطيء: مطابقة رقم الهاتف (فقط للطلاب الذين لم يتم ربطهم بعد)
    SELECT s.id, s.name, s.class_id, s.school_id, s.monthly_fee,
           c.name AS class_name
    FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE v_parent_phone IS NOT NULL AND v_parent_phone <> ''
      AND s.parent_phone IS NOT NULL AND s.parent_phone <> ''
      AND public.phones_match(s.parent_phone, v_parent_phone)
      AND (p_school_id IS NULL OR s.school_id = p_school_id OR s.school_id = v_parent_school OR v_parent_school IS NULL)
  ),
  grade_avgs AS (
    SELECT
      g.student_id,
      ROUND(AVG(
        CASE
          WHEN trim(g.score) ~ '^\d+(\.\d+)?$'
           AND g.max_score IS NOT NULL
           AND g.max_score > 0
          THEN (trim(g.score)::float / g.max_score::float) * 100
          ELSE NULL
        END
      )) AS avg_grade
    FROM public.grades g
    WHERE (p_school_id IS NULL OR g.school_id = p_school_id)
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
    FROM public.attendance a
    WHERE (p_school_id IS NULL OR a.school_id = p_school_id)
      AND a.student_id IN (SELECT id FROM children)
      AND a.date >= CURRENT_DATE - INTERVAL '365 days'
    GROUP BY a.student_id
  ),
  fees_data AS (
    SELECT
      f.student_id,
      COALESCE(SUM(f.amount_due - f.amount_paid)
        FILTER (WHERE f.term <> v_current_term), 0) AS old_remaining,
      COALESCE(SUM(f.amount_paid)
        FILTER (WHERE f.term  = v_current_term), 0) AS current_paid
    FROM public.fees f
    WHERE (p_school_id IS NULL OR f.school_id = p_school_id)
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
