-- ==========================================================================
-- Migration: 20260903100000_fix_slow_rpc_functions.sql
-- Purpose  : إصلاح 6 دوال RPC بطيئة تستهلك معظم وقت قاعدة البيانات
--            بناءً على تحليل pg_stat_statements
--
-- المشاكل المُصلَحة:
--   1. get_dashboard_stats       → Cartesian product (students × classes × fees)
--   2. get_child_full_details    → 6 queries متسلسلة + fetches غير محدودة
--   3. get_unread_notification_counts → فحص pg_catalog في كل استدعاء + ILIKE
--   4. get_admin_dashboard_activities → row_to_json + ORDER BY inside UNION member
--   5. get_parent_dashboard_summary  → regex cast على grades يمنع استخدام الفهارس
--   6. Indexes مفقودة تعتمد عليها الدوال كلها
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. get_dashboard_stats
--    المشكلة: school_filter CTE يجمع students × classes × fees على school_id
--             → حاصل ضرب ديكارتي ضخم قبل COUNT(DISTINCT)
--    الحل   : عدّ كل كيان في CTE منفصل (لا joins بين الكيانات الثلاثة)
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_school_id      UUID,
    p_is_super_admin BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  student_count AS (
    SELECT COUNT(*) AS n
    FROM students
    WHERE p_is_super_admin OR school_id = p_school_id
  ),
  class_count AS (
    SELECT COUNT(*) AS n
    FROM classes
    WHERE p_is_super_admin OR school_id = p_school_id
  ),
  fees_totals AS (
    SELECT
      COALESCE(SUM(amount_due),  0) AS total_due,
      COALESCE(SUM(amount_paid), 0) AS total_paid
    FROM fees
    WHERE p_is_super_admin OR school_id = p_school_id
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
      COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late')) AS present_count,
      COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent')             AS absent_count
    FROM attendance
    WHERE (p_is_super_admin OR school_id = p_school_id)
      AND date = CURRENT_DATE
  )
  SELECT jsonb_build_object(
    'students',       sc.n,
    'teachers',       rs.teachers,
    'parents',        rs.parents,
    'classes',        cc.n,
    'totalDue',       ft.total_due,
    'totalPaid',      ft.total_paid,
    'presentToday',   at.present_count,
    'absentToday',    at.absent_count,
    'attendanceRate', CASE WHEN sc.n > 0
                      THEN ROUND((at.present_count::NUMERIC / sc.n::NUMERIC) * 100)
                      ELSE 0 END
  )
  FROM student_count sc,
       class_count   cc,
       fees_totals   ft,
       roles_stats   rs,
       attendance_today at;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN) TO authenticated, service_role;


-- ==========================================================================
-- 2. get_child_full_details
--    المشاكل:
--      a) auth.uid() يُستدعى مرتين في subqueries منفصلتين
--      b) 6 SELECT INTO متسلسلة (كل واحدة round-trip منفصل)
--      c) Attendance/grades بدون LIMIT → يُعيد آلاف الصفوف القديمة
--      d) Payments تستخدم IN(subquery) داخل subquery
--    الحل:
--      - cache auth.uid() في متغير واحد
--      - security check بـ OR بدلاً من UNION ALL (لا حاجة لـ UNION داخل EXISTS)
--      - إعادة كتابة كـ CTEs في جملة واحدة
--      - LIMIT على attendance (365) و grades (200)
--      - IN(subquery) → JOIN للـ payments
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_child_full_details(
    p_student_id UUID,
    p_school_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid;
  v_is_authorized boolean;
  v_current_term  text;
  v_result        jsonb;
BEGIN
  -- حساب auth.uid() مرة واحدة فقط
  v_caller := auth.uid();

  -- التحقق من الصلاحية: وليّ أمر مرتبط بالطالب أو مدير/معلم في المدرسة
  SELECT (
    EXISTS (
      SELECT 1 FROM student_parents
      WHERE student_id = p_student_id AND parent_id = v_caller
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = v_caller
        AND role IN ('admin', 'teacher')
        AND school_id = p_school_id
    )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  -- بناء اسم الفترة الحالية
  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- جميع البيانات في CTEs — PostgreSQL يُنفّذها في خطة واحدة
  WITH
  student_data AS (
    SELECT
      jsonb_build_object(
        'id',           s.id,
        'name',         s.name,
        'class_id',     s.class_id,
        'parent_phone', s.parent_phone,
        'school_id',    s.school_id,
        'monthly_fee',  s.monthly_fee,
        'classes',      CASE WHEN c.id IS NOT NULL THEN
                          jsonb_build_object(
                            'id',            c.id,
                            'name',          c.name,
                            'curriculum_id', c.curriculum_id
                          )
                        ELSE NULL END
      ) AS info,
      s.class_id,
      c.curriculum_id
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.id = p_student_id AND s.school_id = p_school_id
  ),
  grades_data AS (
    -- jsonb_agg مع subquery محدودة بـ LIMIT داخل FROM لتجنب full scan
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
        'exam_templates',   CASE WHEN et.id IS NOT NULL THEN
                              jsonb_build_object(
                                'id',      et.id,
                                'title',   et.title,
                                'term',    et.term,
                                'subject', et.subject
                              )
                            ELSE NULL END
      )
      ORDER BY g.created_at ASC
    ) AS data
    FROM (
      SELECT g2.id, g2.student_id, g2.school_id, g2.subject,
             g2.score, g2.max_score, g2.term, g2.date,
             g2.exam_template_id, g2.created_at
      FROM grades g2
      WHERE g2.student_id = p_student_id AND g2.school_id = p_school_id
      ORDER BY g2.created_at ASC
      LIMIT 200
    ) g
    LEFT JOIN exam_templates et ON et.id = g.exam_template_id
  ),
  attendance_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',         a.id,
        'date',       a.date,
        'status',     a.status,
        'student_id', a.student_id,
        'school_id',  a.school_id,
        'class_id',   a.class_id,
        'notes',      a.notes
      )
      ORDER BY a.date DESC
    ) AS data
    FROM (
      SELECT a2.id, a2.date, a2.status, a2.student_id,
             a2.school_id, a2.class_id, a2.notes
      FROM attendance a2
      WHERE a2.student_id = p_student_id AND a2.school_id = p_school_id
      ORDER BY a2.date DESC
      LIMIT 365
    ) a
  ),
  fees_data AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id',          f.id,
          'student_id',  f.student_id,
          'school_id',   f.school_id,
          'description', f.description,
          'amount_due',  f.amount_due,
          'amount_paid', f.amount_paid,
          'term',        f.term,
          'status',      f.status,
          'created_at',  f.created_at
        )
        ORDER BY f.created_at DESC
      ) AS data,
      array_agg(f.id) AS ids
    FROM fees f
    WHERE f.student_id = p_student_id AND f.school_id = p_school_id
  ),
  payments_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',           fp.id,
        'fee_id',       fp.fee_id,
        'school_id',    fp.school_id,
        'amount',       fp.amount,
        'payment_date', fp.payment_date,
        'notes',        fp.notes
      )
      ORDER BY fp.payment_date DESC
    ) AS data
    FROM fee_payments fp
    -- JOIN مباشر بدلاً من IN(subquery)
    JOIN fees f ON f.id = fp.fee_id AND f.student_id = p_student_id
    WHERE fp.school_id = p_school_id
  ),
  curriculum_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',            cs.id,
        'subject_name',  cs.subject_name,
        'description',   cs.description,
        'curriculum_id', cs.curriculum_id
      )
      ORDER BY cs.subject_name
    ) AS data
    FROM student_data sd
    JOIN curriculum_subjects cs ON cs.curriculum_id = sd.curriculum_id
    WHERE sd.curriculum_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'student',      sd.info,
    'grades',       COALESCE(gd.data, '[]'::jsonb),
    'attendance',   COALESCE(ad.data, '[]'::jsonb),
    'fees',         COALESCE(fd.data, '[]'::jsonb),
    'payments',     COALESCE(pd.data, '[]'::jsonb),
    'curriculum',   COALESCE(cd.data, '[]'::jsonb),
    'current_term', v_current_term
  )
  INTO v_result
  FROM student_data   sd
  CROSS JOIN grades_data     gd
  CROSS JOIN attendance_data ad
  CROSS JOIN fees_data       fd
  CROSS JOIN payments_data   pd
  CROSS JOIN curriculum_data cd;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) TO authenticated, service_role;


-- ==========================================================================
-- 3. get_unread_notification_counts
--    المشاكل:
--      a) فحص pg_catalog.pg_class في كل استدعاء (مسح system catalog)
--      b) type ILIKE 'complaint%' يمنع استخدام btree index
--    الحل:
--      - حذف فحص pg_catalog (الجدول موجود دائماً في production)
--      - استبدال ILIKE بـ LIKE (القيم lowercase دائماً)
--      - تحويل إلى LANGUAGE sql STABLE (أسرع من plpgsql للـ simple queries)
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_unread_notification_counts(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'unread',     COUNT(*) FILTER (WHERE is_read = false),
    'complaints', COUNT(*) FILTER (WHERE is_read = false AND type LIKE 'complaint%')
  )
  FROM public.notifications
  WHERE user_id = p_user_id;
$$;

GRANT  EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) FROM anon;


-- ==========================================================================
-- 4. get_admin_dashboard_activities
--    المشاكل:
--      a) ORDER BY + LIMIT داخل كل فرع UNION ALL مباشرةً → syntax error
--         يجب لفّ كل فرع بـ subquery
--      b) row_to_json أبطأ من jsonb_build_object
--      c) auth.uid() يُحسب داخل EXISTS مما قد يُطلق RLS recursion
--    الحل:
--      - لفّ كل فرع بـ (SELECT ... ORDER BY ... LIMIT) كـ subquery
--      - auth.uid() في متغير
--      - jsonb_build_object مع jsonb_agg بدلاً من row_to_json
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
BEGIN
  v_caller := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_caller
      AND role = 'admin'
      AND school_id = p_school_id
      AND approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',          combined.id,
          'type',        combined.type,
          'title',       combined.title,
          'description', combined.description,
          'date',        combined.date,
          'status',      combined.status
        )
        ORDER BY combined.date DESC
      )
      FROM (
        -- شكاوى حديثة
        SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
        FROM (
          SELECT
            c.id,
            'complaint'::text AS type,
            'شكوى جديدة'::text AS title,
            CASE WHEN length(c.content) > 60
                 THEN substring(c.content FROM 1 FOR 60) || '...'
                 ELSE c.content
            END AS description,
            c.created_at AS date,
            c.status::text AS status
          FROM complaints c
          WHERE c.school_id = p_school_id
          ORDER BY c.created_at DESC
          LIMIT 5
        ) sub

        UNION ALL

        -- طلبات انضمام معلقة
        SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
        FROM (
          SELECT
            ur.id,
            'registration'::text AS type,
            'طلب انضمام جديد'::text AS title,
            'المستخدم: ' || COALESCE(p.full_name, 'غير معروف') AS description,
            ur.created_at AS date,
            ur.approval_status::text AS status
          FROM user_roles ur
          LEFT JOIN profiles p ON p.id = ur.user_id
          WHERE ur.school_id = p_school_id AND ur.approval_status = 'pending'
          ORDER BY ur.created_at DESC
          LIMIT 5
        ) sub

        UNION ALL

        -- مدفوعات رسوم حديثة
        SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
        FROM (
          SELECT
            fp.id,
            'payment'::text AS type,
            'تم دفع رسوم'::text AS title,
            'المبلغ: ' || fp.amount::text || ' ج.م للطالب ' ||
            COALESCE(s.name, 'غير معروف') AS description,
            fp.payment_date AS date,
            'success'::text AS status
          FROM fee_payments fp
          JOIN fees     f ON f.id  = fp.fee_id
          JOIN students s ON s.id  = f.student_id
          WHERE fp.school_id = p_school_id
          ORDER BY fp.payment_date DESC
          LIMIT 5
        ) sub
      ) combined
      LIMIT 10
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) TO authenticated, service_role;


-- ==========================================================================
-- 5. get_parent_dashboard_summary
--    المشاكل:
--      a) grade_avgs CTE يستخدم regex على كل صف:
--         trim(score::text) ~ '^\d+(\.\d+)?$'
--         يمنع استخدام الفهارس ويُجري text conversion لكل صف
--      b) (SELECT term FROM current_term) كـ correlated subquery مكررة
--      c) لا يوجد security check في النسخة الحالية
--    الحل:
--      a) استخدام NULLIF + numeric cast بدلاً من regex
--      b) v_current_term كـ plpgsql variable يُحسب مرة واحدة
--      c) إعادة security check بشكل آمن
-- ==========================================================================

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

  -- Security check: وليّ الأمر نفسه أو مدير معتمد في المدرسة
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
    SELECT s.id, s.name, s.class_id, s.school_id, s.monthly_fee,
           c.name AS class_name
    FROM student_parents sp
    JOIN students s ON s.id = sp.student_id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE sp.parent_id = p_parent_id AND sp.school_id = p_school_id
  ),
  grade_avgs AS (
    -- NULLIF+cast بدلاً من regex: يسمح بالفهارس ويتجنب per-row regex evaluation
    SELECT
      g.student_id,
      ROUND(AVG(
        CASE
          WHEN g.max_score IS NOT NULL
           AND NULLIF(g.max_score::text, '')::numeric > 0
          THEN (g.score::numeric / g.max_score::numeric) * 100
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
    -- v_current_term محسوب مرة واحدة → لا correlated subqueries
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


-- ==========================================================================
-- 6. Indexes المفقودة
-- ==========================================================================

-- notifications: partial index للـ unread فقط → get_unread_notification_counts
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, type)
    WHERE is_read = false;

-- attendance: covering index لـ get_dashboard_stats (COUNT DISTINCT بـ school+date)
CREATE INDEX IF NOT EXISTS idx_attendance_school_date_status
    ON public.attendance (school_id, date, status, student_id);

-- grades: covering index لـ get_parent_dashboard_summary و get_child_full_details
CREATE INDEX IF NOT EXISTS idx_grades_school_student_created
    ON public.grades (school_id, student_id, created_at ASC);

-- fees: covering index لـ get_parent_dashboard_summary
CREATE INDEX IF NOT EXISTS idx_fees_school_student_term
    ON public.fees (school_id, student_id, term);

-- fee_payments: لـ get_child_full_details (JOIN مع fees)
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_fee
    ON public.fee_payments (school_id, fee_id, payment_date DESC);

-- user_roles: covering index لـ security guards في جميع الدوال
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role_school_status
    ON public.user_roles (user_id, role, school_id, approval_status);

-- student_parents: لـ security check في get_child_full_details
CREATE INDEX IF NOT EXISTS idx_student_parents_student_parent
    ON public.student_parents (student_id, parent_id);

-- complaints: لـ get_admin_dashboard_activities
CREATE INDEX IF NOT EXISTS idx_complaints_school_created
    ON public.complaints (school_id, created_at DESC);

-- fee_payments: لـ get_admin_dashboard_activities
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_date
    ON public.fee_payments (school_id, payment_date DESC);

-- curriculum_subjects: لـ get_child_full_details
CREATE INDEX IF NOT EXISTS idx_curriculum_subjects_curriculum
    ON public.curriculum_subjects (curriculum_id, subject_name);

-- ==========================================================================
-- 7. تحديث الإحصائيات
-- ==========================================================================

ANALYZE public.notifications;
ANALYZE public.attendance;
ANALYZE public.grades;
ANALYZE public.fees;
ANALYZE public.fee_payments;
ANALYZE public.user_roles;
ANALYZE public.student_parents;
ANALYZE public.complaints;
ANALYZE public.curriculum_subjects;

NOTIFY pgrst, 'reload schema';
