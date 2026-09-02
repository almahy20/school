-- ==========================================================================
-- Migration: 20260902000000_optimize_slow_queries_and_fix_errors.sql
-- Purpose  :
--   1. تحسين get_dashboard_stats — استبدال 5 sequential queries بـ query واحدة
--   2. تحسين get_parent_dashboard_summary — استبدال correlated subqueries
--   3. إنشاء جدول notification_delivery_logs الذي تتوقعه Edge Function
--   4. إصلاح profiles.role error من أي مكان متبقي
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. تحسين get_dashboard_stats (كانت 5 queries → الآن 1 query مع CTEs)
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_school_id UUID, p_is_super_admin BOOLEAN)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  school_filter AS (
    SELECT
      COUNT(DISTINCT s.id)                                                    AS students,
      COUNT(DISTINCT c.id)                                                    AS classes,
      COALESCE(SUM(f.amount_due),  0)                                         AS total_due,
      COALESCE(SUM(f.amount_paid), 0)                                         AS total_paid
    FROM students s
    LEFT JOIN classes c  ON c.school_id  = s.school_id
    LEFT JOIN fees    f  ON f.school_id  = s.school_id
    WHERE p_is_super_admin OR s.school_id = p_school_id
  ),
  roles_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE role = 'teacher' AND approval_status = 'approved') AS teachers,
      COUNT(*) FILTER (WHERE role = 'parent'  AND approval_status = 'approved') AS parents
    FROM user_roles
    WHERE p_is_super_admin OR school_id = p_school_id
  ),
  attendance_today AS (
    SELECT
      COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present','late')) AS present_count,
      COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent')            AS absent_count
    FROM attendance
    WHERE (p_is_super_admin OR school_id = p_school_id)
      AND date = CURRENT_DATE
  )
  SELECT jsonb_build_object(
    'students',       sf.students,
    'teachers',       rs.teachers,
    'parents',        rs.parents,
    'classes',        sf.classes,
    'totalDue',       sf.total_due,
    'totalPaid',      sf.total_paid,
    'presentToday',   at.present_count,
    'absentToday',    at.absent_count,
    'attendanceRate', CASE WHEN sf.students > 0
                      THEN ROUND((at.present_count::NUMERIC / sf.students::NUMERIC) * 100)
                      ELSE 0 END
  )
  FROM school_filter sf, roles_stats rs, attendance_today at;
$$;

-- ==========================================================================
-- 2. تحسين get_parent_dashboard_summary (correlated subqueries → joins)
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary(p_parent_id uuid, p_school_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  current_term AS (
    SELECT 'شهر ' ||
      CASE EXTRACT(MONTH FROM NOW())
        WHEN 1 THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
        WHEN 4 THEN 'أبريل'   WHEN 5  THEN 'مايو'     WHEN 6  THEN 'يونيو'
        WHEN 7 THEN 'يوليو'   WHEN 8  THEN 'أغسطس'   WHEN 9  THEN 'سبتمبر'
        WHEN 10 THEN 'أكتوبر' WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
      END || ' ' || TO_CHAR(NOW(), 'YYYY') AS term
  ),
  children AS (
    SELECT s.id, s.name, s.class_id, s.school_id, s.monthly_fee,
           c.name AS class_name
    FROM student_parents sp
    JOIN students s ON s.id = sp.student_id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE sp.parent_id = p_parent_id AND sp.school_id = p_school_id
  ),
  grade_avgs AS (
    SELECT g.student_id,
           ROUND(AVG(
             CASE WHEN trim(g.score::text) ~ '^\d+(\.\d+)?$'
                   AND trim(g.max_score::text) ~ '^\d+(\.\d+)?$'
                   AND trim(g.max_score::text)::float > 0
             THEN (trim(g.score::text)::float / trim(g.max_score::text)::float) * 100
             ELSE NULL END
           )) AS avg_grade
    FROM grades g
    WHERE g.school_id = p_school_id
      AND g.student_id IN (SELECT id FROM children)
    GROUP BY g.student_id
  ),
  attendance_rates AS (
    SELECT a.student_id,
           CASE WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND((COUNT(*) FILTER (WHERE a.status = 'present')::float / COUNT(*)::float) * 100)
           END AS attendance_rate
    FROM attendance a
    WHERE a.school_id = p_school_id
      AND a.student_id IN (SELECT id FROM children)
    GROUP BY a.student_id
  ),
  fees_remaining AS (
    SELECT f.student_id,
           SUM(f.amount_due - f.amount_paid)
             FILTER (WHERE f.term != (SELECT term FROM current_term)) AS old_remaining,
           COALESCE(SUM(f.amount_paid) FILTER (WHERE f.term = (SELECT term FROM current_term)), 0) AS current_paid
    FROM fees f
    WHERE f.school_id = p_school_id
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
      'feesRemaining',  COALESCE(fr.old_remaining, 0) +
                        GREATEST(0, COALESCE(ch.monthly_fee, 0) - COALESCE(fr.current_paid, 0))
    )
  ), '[]'::jsonb)
  FROM children ch
  LEFT JOIN grade_avgs       ga ON ga.student_id = ch.id
  LEFT JOIN attendance_rates ar ON ar.student_id = ch.id
  LEFT JOIN fees_remaining   fr ON fr.student_id = ch.id;
$$;

-- ==========================================================================
-- 3. إنشاء جدول notification_delivery_logs الذي تتوقعه Edge Function
--    (بدل push_delivery_log الذي له schema مختلف)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id         UUID        REFERENCES public.notifications(id) ON DELETE CASCADE,
  sent_count              INTEGER     NOT NULL DEFAULT 0,
  total_subscriptions     INTEGER     NOT NULL DEFAULT 0,
  has_active_subscription BOOLEAN     NOT NULL DEFAULT false,
  no_device_registered    BOOLEAN     NOT NULL DEFAULT false,
  temporary_outage        BOOLEAN     NOT NULL DEFAULT false,
  raw_response            JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_delivery_notification_id
  ON public.notification_delivery_logs (notification_id);

CREATE INDEX IF NOT EXISTS idx_notif_delivery_created_at
  ON public.notification_delivery_logs (created_at DESC);

-- RLS
ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.notification_delivery_logs TO service_role;

-- ==========================================================================
-- 4. إعادة منح الصلاحيات بعد تعديل الدوال
-- ==========================================================================

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN)       FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN)       TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) TO authenticated, service_role;

-- ==========================================================================
-- 5. ANALYZE لتحديث إحصائيات الجداول المتأثرة
-- ==========================================================================

ANALYZE public.students;
ANALYZE public.classes;
ANALYZE public.fees;
ANALYZE public.attendance;
ANALYZE public.user_roles;
ANALYZE public.grades;
ANALYZE public.student_parents;

NOTIFY pgrst, 'reload schema';
