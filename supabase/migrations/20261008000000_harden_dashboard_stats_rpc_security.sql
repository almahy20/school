-- ============================================================
-- Migration: Harden Dashboard Stats RPC Security
-- Date: 2026-10-08
-- ============================================================

-- 1. Harden get_teacher_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_teacher_dashboard_stats(
  p_teacher_id uuid,
  p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid;
  v_is_auth     boolean := false;
  v_class_ids   uuid[];
  v_students    int := 0;
  v_classes     int := 0;
  v_present     int := 0;
  v_total_att   int := 0;
  v_att_rate    int := 0;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller = p_teacher_id 
     OR public.is_school_admin(p_school_id) 
     OR public.is_super_admin() THEN
    v_is_auth := true;
  END IF;

  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT array_agg(id)
  INTO v_class_ids
  FROM public.classes
  WHERE teacher_id = p_teacher_id
    AND school_id  = p_school_id;

  IF v_class_ids IS NULL OR cardinality(v_class_ids) = 0 THEN
    RETURN jsonb_build_object('students', 0, 'classes', 0, 'attendanceRate', 0);
  END IF;

  v_classes := cardinality(v_class_ids);

  SELECT COUNT(*) INTO v_students
  FROM public.students
  WHERE school_id = p_school_id
    AND class_id = ANY(v_class_ids);

  SELECT
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*)
  INTO v_present, v_total_att
  FROM public.attendance
  WHERE school_id = p_school_id
    AND class_id  = ANY(v_class_ids)
    AND date >= (CURRENT_DATE - INTERVAL '90 days');

  IF v_total_att > 0 THEN
    v_att_rate := ROUND((v_present::numeric / v_total_att) * 100);
  END IF;

  RETURN jsonb_build_object(
    'students',       v_students,
    'classes',        v_classes,
    'attendanceRate', v_att_rate
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_teacher_dashboard_stats(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_dashboard_stats(uuid, uuid) TO authenticated;

-- 2. Harden get_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_school_id uuid, p_is_super_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        uuid;
    v_is_super      boolean := false;
    v_students      bigint;
    v_classes       bigint;
    v_teachers      bigint;
    v_parents       bigint;
    v_total_due     numeric := 0;
    v_total_paid    numeric := 0;
    v_present       bigint := 0;
    v_absent        bigint := 0;
BEGIN
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_is_super := public.is_super_admin();

    IF p_is_super_admin AND v_is_super THEN
        SELECT COUNT(*) INTO v_students FROM public.students;
        SELECT COUNT(*) INTO v_classes  FROM public.classes;

        SELECT
            COUNT(*) FILTER (WHERE role = 'teacher' AND approval_status = 'approved'),
            COUNT(*) FILTER (WHERE role = 'parent'  AND approval_status = 'approved')
        INTO v_teachers, v_parents
        FROM public.user_roles;

        SELECT
            COALESCE(SUM(amount_due),  0),
            COALESCE(SUM(amount_paid), 0)
        INTO v_total_due, v_total_paid
        FROM public.fees;

        SELECT
            COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late')),
            COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent')
        INTO v_present, v_absent
        FROM public.attendance
        WHERE date = CURRENT_DATE;
    ELSE
        IF NOT (
            v_is_super
            OR public.is_school_admin(p_school_id)
            OR EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = v_caller
                  AND school_id = p_school_id
                  AND approval_status = 'approved'
            )
        ) THEN
            RAISE EXCEPTION 'Unauthorized access to school stats';
        END IF;

        SELECT COUNT(*) INTO v_students
        FROM public.students
        WHERE school_id = p_school_id;

        SELECT COUNT(*) INTO v_classes
        FROM public.classes
        WHERE school_id = p_school_id;

        SELECT
            COUNT(*) FILTER (WHERE role = 'teacher' AND approval_status = 'approved'),
            COUNT(*) FILTER (WHERE role = 'parent'  AND approval_status = 'approved')
        INTO v_teachers, v_parents
        FROM public.user_roles
        WHERE school_id = p_school_id;

        SELECT
            COALESCE(SUM(amount_due),  0),
            COALESCE(SUM(amount_paid), 0)
        INTO v_total_due, v_total_paid
        FROM public.fees
        WHERE school_id = p_school_id;

        SELECT
            COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late')),
            COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent')
        INTO v_present, v_absent
        FROM public.attendance
        WHERE school_id = p_school_id
          AND date = CURRENT_DATE;
    END IF;

    RETURN jsonb_build_object(
        'students',       COALESCE(v_students, 0),
        'teachers',       COALESCE(v_teachers, 0),
        'parents',        COALESCE(v_parents, 0),
        'classes',        COALESCE(v_classes, 0),
        'totalDue',       COALESCE(v_total_due, 0),
        'totalPaid',      COALESCE(v_total_paid, 0),
        'presentToday',   COALESCE(v_present, 0),
        'absentToday',    COALESCE(v_absent, 0),
        'attendanceRate', CASE WHEN COALESCE(v_students, 0) > 0
                          THEN ROUND((COALESCE(v_present, 0)::NUMERIC / v_students::NUMERIC) * 100)
                          ELSE 0 END
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, boolean) TO authenticated;
