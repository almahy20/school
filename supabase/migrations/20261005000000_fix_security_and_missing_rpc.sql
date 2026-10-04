-- ============================================================
-- Migration: Fix Security Issues & Add Missing RPC
-- Date: 2026-10-05
-- Issues fixed:
--   1. Add missing get_teacher_dashboard_stats function
--   2. Fix mutable search_path on 2 functions
--   3. Revoke EXECUTE from anon on 5 SECURITY DEFINER functions
-- ============================================================


-- 1. Create missing get_teacher_dashboard_stats function
-- Called by useTeacherStats() in frontend but was missing from DB
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
  v_class_ids   uuid[];
  v_students    int := 0;
  v_classes     int := 0;
  v_present     int := 0;
  v_total_att   int := 0;
  v_att_rate    int := 0;
BEGIN
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
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('students', 0, 'classes', 0, 'attendanceRate', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_dashboard_stats(uuid, uuid) TO authenticated;


-- 2. Fix mutable search_path on get_parent_dashboard_summary
ALTER FUNCTION public.get_parent_dashboard_summary(uuid, uuid) SET search_path = public;


-- 3. Fix mutable search_path on notify_new_grade trigger function
ALTER FUNCTION public.notify_new_grade() SET search_path = public;


-- 4. Revoke EXECUTE from anon on sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_school_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;

-- Keep get_school_id_by_slug accessible to anon (used on login page for slug lookup)

-- Ensure authenticated users still have access
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
