  -- ==============================================================================
  -- Migration: 20260919200000_fix_fee_payments_notes_column.sql
  -- Fix: column fp.notes does not exist (error 42703)
  -- The get_child_full_details RPC references fee_payments.notes but the column
  -- was never added to the table. This adds it and recreates the RPC cleanly.
  -- ==============================================================================

  -- 1. Add the missing column
  ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS notes TEXT;

  -- 2. Recreate the RPC to ensure it matches the current schema
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
    v_caller        UUID;
    v_is_authorized BOOLEAN;
    v_current_term  TEXT;
    v_result        JSONB;
  BEGIN
    v_caller := auth.uid();

    -- 1. Authorization check (admin, teacher, super_admin, or matched parent)
    SELECT (
      v_caller IS NOT NULL AND (
        public.get_auth_is_super_admin()
        OR
        EXISTS (
          SELECT 1 FROM public.student_parents sp
          WHERE sp.student_id = p_student_id AND sp.parent_id = v_caller
        )
        OR
        EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.profiles p ON p.id = v_caller
          WHERE s.id = p_student_id
            AND s.parent_phone IS NOT NULL
            AND p.phone IS NOT NULL
            AND (
              s.parent_phone = p.phone
              OR regexp_replace(s.parent_phone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g')
            )
        )
        OR
        (
          p_school_id IS NOT NULL 
          AND p_school_id = public.get_auth_school_id()
        )
      )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'Unauthorized access to student data';
    END IF;

    -- 2. Auto-heal: Ensure student_parents link exists if caller is parent
    IF v_caller IS NOT NULL AND NOT public.get_auth_is_super_admin() THEN
      INSERT INTO public.student_parents (school_id, student_id, parent_id)
      SELECT s.school_id, s.id, v_caller
      FROM public.students s
      WHERE s.id = p_student_id
      ON CONFLICT (student_id, parent_id) DO NOTHING;
    END IF;

    -- 3. Current term formatting
    v_current_term := 'شهر ' ||
      CASE EXTRACT(MONTH FROM NOW())
        WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
        WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
        WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
        WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
      END || ' ' || TO_CHAR(NOW(), 'YYYY');

    -- 4. Aggregate student data
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
                              'grade_level',   c.grade_level,
                              'curriculum_id', c.curriculum_id
                            )
                          ELSE NULL END
        ) AS info,
        s.class_id,
        c.curriculum_id
      FROM public.students s
      LEFT JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = p_student_id
        AND (p_school_id IS NULL OR s.school_id = p_school_id)
    ),
    grades_data AS (
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
          'notes',            g.notes,
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
              g2.score, g2.max_score, g2.term, g2.date, g2.notes,
              g2.exam_template_id, g2.created_at
        FROM public.grades g2
        WHERE g2.student_id = p_student_id
        ORDER BY g2.created_at ASC
        LIMIT 500
      ) g
      LEFT JOIN public.exam_templates et ON et.id = g.exam_template_id
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
        FROM public.attendance a2
        WHERE a2.student_id = p_student_id
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
            'description', COALESCE(f.description, f.term, ''),
            'amount_due',  f.amount_due,
            'amount_paid', f.amount_paid,
            'term',        f.term,
            'status',      f.status,
            'created_at',  f.created_at
          )
          ORDER BY f.created_at DESC
        ) AS data
      FROM public.fees f
      WHERE f.student_id = p_student_id
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
      FROM public.fee_payments fp
      JOIN public.fees f ON f.id = fp.fee_id AND f.student_id = p_student_id
    ),
    curriculum_data AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            cs.id,
          'subject_name',  cs.subject_name,
          'description',   cs.description,
          'curriculum_id', cs.curriculum_id
        )
        ORDER BY cs.subject_name ASC
      ) AS data
      FROM student_data sd
      JOIN public.curriculum_subjects cs ON cs.curriculum_id = sd.curriculum_id
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

    RETURN COALESCE(v_result, '{}'::jsonb);
  END;
  $$;

  -- 3. Permissions
  REVOKE EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) FROM public, anon;
  GRANT EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) TO authenticated, service_role;
  ALTER FUNCTION public.get_child_full_details(UUID, UUID) SET search_path = public;

  -- 4. Reload PostgREST schema cache
  NOTIFY pgrst, 'reload schema';

  -- ==============================================================================
  -- القسم 5 — تحسينات الأداء بناءً على pg_stat_statements (2026-09-21)
  --
  -- أعلى 3 استعلامات بطئاً (من تقريرك):
  --   1. realtime.list_changes           — 25.8s إجمالي / 6s أقصى (الـ Realtime)
  --   2. realtime.subscription INSERT    — 16.4s إجمالي / 2.5s أقصى (Realtime)
  --   3. public.get_fees_summary         — 2.6s لاستدعاء واحد 🔥🔥🔥
  --   4. public.get_dashboard_stats      — 1.9s أقصى 🔥
  --   5. net._http_response DELETE       — 3.1s لاستدعاءين (مؤشر مفقود)
  --   6. notifications UPDATE metadata   — 1.1s (مؤشر GIN مفقود)
  --   7. user_roles COUNT per school     — 590ms متوسط
  -- ==============================================================================

  -- --------------------------------------------------------------------------
  -- 5.1 مؤشرات COVERING لـ get_fees_summary (2.6 ثانية / استدعاء واحد)
  --     المشكلة: الدالة تقوم بـ SUM(monthly_fee) من students و SUM(amount_paid)
  --     من fees مع JOIN لـ students لفلترة class_id. بدون مؤشرات يشملون الأعمدة
  --     المطلوبة (INCLUDE) يضطر المخطط لعمل Seq Scan ثم Heap Fetches كثيرة.
  -- --------------------------------------------------------------------------
  CREATE INDEX IF NOT EXISTS idx_students_school_class_covering
    ON public.students (school_id, class_id)
    INCLUDE (monthly_fee);

  CREATE INDEX IF NOT EXISTS idx_fees_school_student_term_covering
    ON public.fees (school_id, student_id, term)
    INCLUDE (amount_paid, amount_due);

  -- --------------------------------------------------------------------------
  -- 5.2 مؤشر COVERING لـ get_dashboard_stats — جدول fees للمجاميع الكلية
  -- --------------------------------------------------------------------------
  CREATE INDEX IF NOT EXISTS idx_fees_school_totals_covering
    ON public.fees (school_id)
    INCLUDE (amount_due, amount_paid);

  -- --------------------------------------------------------------------------
  -- 5.3 مؤشر COVERING لـ roles_stats في get_dashboard_stats
  --     يعتمد على COUNT FILTER (role, approval_status) لكل مدرسة
  -- --------------------------------------------------------------------------
  CREATE INDEX IF NOT EXISTS idx_user_roles_school_role_approval_covering
    ON public.user_roles (school_id, role, approval_status)
    INCLUDE (is_super_admin, user_id);

  -- --------------------------------------------------------------------------
  -- 5.4 مؤشر COVERING لـ attendance_today في get_dashboard_stats
  --     (school_id, date, status) مع تضمين student_id → Index Only Scan
  -- --------------------------------------------------------------------------
  CREATE INDEX IF NOT EXISTS idx_attendance_school_date_status_covering
    ON public.attendance (school_id, date, status)
    INCLUDE (student_id);

  -- --------------------------------------------------------------------------
  -- 5.5 مؤشر GIN لـ notifications.metadata — أصل مشكلة UPDATE ب 1.1 ثانية
  --     الاستعلام: UPDATE ... WHERE metadata @> $4  (jsonb containment)
  --     بدون GIN → Seq Scan كامل على جدول الإشعارات
  -- --------------------------------------------------------------------------
  CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin
    ON public.notifications USING GIN (metadata jsonb_path_ops);

  -- --------------------------------------------------------------------------
  -- 5.6 مؤشر COVERING لـ get_unread_notification_counts
  --     (user_id, is_read, type) → COUNT FILTER بدون زيارة Heap
  -- --------------------------------------------------------------------------
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read_type_covering
    ON public.notifications (user_id, is_read, type);

  -- --------------------------------------------------------------------------
  -- 5.7 مؤشر لجدول net._http_response — أصل مشكلة الحذف ب 1.5 ثانية لكل استدعاء
  --     الاستعلام: DELETE ... WHERE created < now() - $1 ORDER BY created LIMIT $2
  --     بدون مؤشر → Seq Scan ثم Sort على كامل الجدول (يحتوي على آلاف السجلات)
  --
  --     ⚠️ ملاحظة الأمان: الجدول net._http_response مملوك لدور امتداد pg_net
  --        وليس لملك قاعدة البيانات العادي. نحاول إنشاء المؤشر أولاً، وإذا فشل
  --        بسبب lack of ownership (خطأ 42501) — نتجاهل الخطأ بأمان عبر
  --        EXCEPTION block ولا يفشل باقي الـ Migration (الأهم جداً).
  --        إذا احتجت فعلاً للمؤشر: شغّله يدوياً عبر postgres role أو عبر
  --        مخصص Extension update script.
  -- --------------------------------------------------------------------------
  DO $$
  DECLARE
    v_table_exists boolean;
  BEGIN
    -- 1) التحقق من وجود الجدول أولاً
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'net' AND table_name = '_http_response'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
      RAISE NOTICE '[Migration 5.7] جدول net._http_response غير موجود — يتم تخطي إنشاء المؤشر';
      RETURN;
    END IF;

    -- 2) محاولة إنشاء المؤشر داخل block مستقل لالتقاط خطأ insufficient_privilege
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_net_http_response_created
        ON net._http_response (created);
      RAISE NOTICE '[Migration 5.7] تم إنشاء المؤشر idx_net_http_response_created بنجاح';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '[Migration 5.7] تم تخطي مؤشر net._http_response — insufficient privilege (جدول مملوك لامتداد pg_net). الخطأ: %', SQLERRM;
      WHEN undefined_table THEN
        RAISE NOTICE '[Migration 5.7] تم تخطي مؤشر net._http_response — الجدول اختفى أثناء المحاولة';
      WHEN OTHERS THEN
        RAISE NOTICE '[Migration 5.7] تم تخطي مؤشر net._http_response لسبب غير متوقع — %: %', SQLSTATE, SQLERRM;
    END;
  END $$;

  -- ==============================================================================
  -- القسم 6 — إعادة كتابة get_fees_summary لتكون SQL STABLE بـ covering indexes
  --
  -- التغييرات الرئيسية:
  --   • لغة SQL بدلاً من PLpgSQL → Planner يدمج الاستعلام في الاستعلام الخارجي
  --   • إزالة الـ JOIN الزائد لـ school_id في fees (فيلتر fees.school_id وحده يكفي
  --     لأنه موجود في الـ Covering Index + FK يضمن الصحة)
  --   • إرجاع صف واحد باستخدام SELECT دون استدعاءات منفصلة
  -- ==============================================================================
  CREATE OR REPLACE FUNCTION public.get_fees_summary(
      p_school_id uuid,
      p_class_id  text DEFAULT NULL::text,
      p_term      text DEFAULT ''::text
  )
  RETURNS TABLE (
      total_due  numeric,
      total_paid numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_catalog
  AS $$
      WITH
      v_params AS (
          SELECT
              p_school_id                                   AS v_school_id,
              NULLIF(BTRIM(COALESCE(p_class_id, '')), '')  AS v_class_id,
              COALESCE(NULLIF(BTRIM(p_term), ''), '')      AS v_term
      ),
      due_calc AS (
          SELECT COALESCE(SUM(COALESCE(s.monthly_fee, 0)), 0)::numeric AS n
          FROM public.students s, v_params p
          WHERE s.school_id = p.v_school_id
            AND (p.v_class_id IS NULL OR s.class_id = p.v_class_id)
      ),
      paid_calc AS (
          SELECT COALESCE(SUM(COALESCE(f.amount_paid, 0)), 0)::numeric AS n
          FROM public.fees f
          JOIN public.students s ON s.id = f.student_id
          CROSS JOIN v_params p
          WHERE f.school_id = p.v_school_id
            AND (p.v_class_id IS NULL OR s.class_id = p.v_class_id)
            AND (p.v_term = '' OR f.term = p.v_term)
      )
      SELECT COALESCE(d.n, 0), COALESCE(pc.n, 0)
      FROM due_calc d CROSS JOIN paid_calc pc;
  $$;

  REVOKE ALL    ON FUNCTION public.get_fees_summary(uuid, text, text) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) TO authenticated, service_role;

  -- ==============================================================================
  -- القسم 7 — إعادة كتابة get_dashboard_stats لحل مشكلة (OR p_is_super_admin)
  --
  -- السبب الرئيسي للبطء: الاستخدام `WHERE p_is_super_admin OR school_id = p_school_id`
  --   داخل CTE واحد يعطل استخدام مؤشر school_id تماماً → Seq Scan لكل الجداول!
  --
  -- الحل: استخدام PLpgSQL مع IF / ELSE لإنشاء مسارين مختلفين:
  --   • مسار Super Admin: COUNT بدون فلتر → يستخدم PK/idx كراسٍ
  --   • مسار Admin العادي: COUNT مع فلتر school_id → يستخدم covering indexes
  -- ==============================================================================
  CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
      p_school_id      UUID,
      p_is_super_admin BOOLEAN
  )
  RETURNS JSONB
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
      v_students      bigint;
      v_classes       bigint;
      v_teachers      bigint;
      v_parents       bigint;
      v_total_due     numeric := 0;
      v_total_paid    numeric := 0;
      v_present       bigint := 0;
      v_absent        bigint := 0;
  BEGIN
      IF p_is_super_admin THEN
          -- Super Admin: عدّ كل المدارس بدون فلتر (يستخدم PK / Seq السريع)
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
          -- Admin / Teacher / Parent: فلتر محدد بـ school_id → يستخدم Covering Indexes!
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
          'students',       v_students,
          'teachers',       COALESCE(v_teachers, 0),
          'parents',        COALESCE(v_parents, 0),
          'classes',        v_classes,
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

  REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN) FROM public, anon;
  GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN) TO authenticated, service_role;

  -- ==============================================================================
  -- القسم 8 — إعادة تحميل كاش PostgREST بعد إضافة المؤشرات وإعادة كتابة الـ RPCs
  -- ==============================================================================
  NOTIFY pgrst, 'reload schema';
  ANALYZE public.students;
  ANALYZE public.fees;
  ANALYZE public.attendance;
  ANALYZE public.user_roles;
  ANALYZE public.notifications;
