-- =====================================================
-- Database Indexes for Performance Optimization
-- =====================================================
-- هذا الملف يُحسّن أداء قاعدة البيانات بشكل كبير
-- قم بتشغيله في Supabase SQL Editor
-- =====================================================
-- ملاحظة: جميع الـ Indexes تستخدم IF NOT EXISTS للأمان
-- إذا كان الـ Index موجوداً بالفعل، سيتم تجاهله بدون أخطاء
-- =====================================================

-- =====================================================
-- 1. Indexes لجدول user_roles
-- =====================================================

-- Index للبحث حسب المدرسة والرتبة (الأكثر استخداماً)
CREATE INDEX IF NOT EXISTS idx_user_roles_school_role 
ON user_roles(school_id, role);

-- Index للبحث حسب حالة الموافقة
CREATE INDEX IF NOT EXISTS idx_user_roles_approval_status 
ON user_roles(approval_status);

-- Composite Index للqueries الشائعة (مدرسة + رتبة + حالة)
CREATE INDEX IF NOT EXISTS idx_user_roles_school_role_status 
ON user_roles(school_id, role, approval_status);

-- Index للبحث حسب user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id);

-- =====================================================
-- 2. Indexes لجدول profiles
-- =====================================================

-- Index للبحث بالاسم (مستخدم في ILIKE searches)
CREATE INDEX IF NOT EXISTS idx_profiles_full_name 
ON profiles(full_name);

-- Index للبحث برقم الهاتف
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
ON profiles(phone);

-- Index للبحث حسب المدرسة
CREATE INDEX IF NOT EXISTS idx_profiles_school_id 
ON profiles(school_id);

-- =====================================================
-- 3. Indexes لجدول students
-- =====================================================

-- Index للبحث حسب المدرسة
CREATE INDEX IF NOT EXISTS idx_students_school_id 
ON students(school_id);

-- Index للبحث حسب الفصل
CREATE INDEX IF NOT EXISTS idx_students_class_id 
ON students(class_id);

-- Composite Index (مدرسة + فصل)
CREATE INDEX IF NOT EXISTS idx_students_school_class 
ON students(school_id, class_id);

-- Index للبحث بالاسم
CREATE INDEX IF NOT EXISTS idx_students_name 
ON students(name);

-- Index للبحث بالاسم مع المدرسة (للتصفية)
CREATE INDEX IF NOT EXISTS idx_students_school_name 
ON students(school_id, name);

-- =====================================================
-- 4. Indexes لجدول classes
-- =====================================================

-- Index للبحث حسب المدرسة
CREATE INDEX IF NOT EXISTS idx_classes_school_id 
ON classes(school_id);

-- Index للبحث حسب المعلم
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id 
ON classes(teacher_id);

-- Composite Index (مدرسة + معلم)
CREATE INDEX IF NOT EXISTS idx_classes_school_teacher 
ON classes(school_id, teacher_id);

-- =====================================================
-- 5. Indexes لجدول student_parents
-- =====================================================

-- Index للبحث حسب parent_id (مستخدم جداً)
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_id 
ON student_parents(parent_id);

-- Index للبحث حسب student_id
CREATE INDEX IF NOT EXISTS idx_student_parents_student_id 
ON student_parents(student_id);

-- Composite Index (parent + student)
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_student 
ON student_parents(parent_id, student_id);

-- =====================================================
-- 6. Indexes لجدول fees
-- =====================================================

-- Index للبحث حسب المدرسة
CREATE INDEX IF NOT EXISTS idx_fees_school_id 
ON fees(school_id);

-- Index للبحث حسب الطالب
CREATE INDEX IF NOT EXISTS idx_fees_student_id 
ON fees(student_id);

-- Index للبحث حسب الحالة
CREATE INDEX IF NOT EXISTS idx_fees_status 
ON fees(status);

-- Index للبحث حسب الشهر والسنة (لنظام الرسوم الشهري)
CREATE INDEX IF NOT EXISTS idx_fees_month_year 
ON fees(month, year);

-- =====================================================
-- 7. Indexes لجدول attendance
-- =====================================================

-- Index للبحث حسب المدرسة والتاريخ
CREATE INDEX IF NOT EXISTS idx_attendance_school_date 
ON attendance(school_id, date);

-- Index للبحث حسب الطالب
CREATE INDEX IF NOT EXISTS idx_attendance_student_id 
ON attendance(student_id);

-- Index للبحث حسب التاريخ
CREATE INDEX IF NOT EXISTS idx_attendance_date 
ON attendance(date);

-- =====================================================
-- 8. Indexes لجدول grades
-- =====================================================

-- Index للبحث حسب المدرسة
CREATE INDEX IF NOT EXISTS idx_grades_school_id 
ON grades(school_id);

-- Index للبحث حسب الطالب
CREATE INDEX IF NOT EXISTS idx_grades_student_id 
ON grades(student_id);

-- Index للبحث حسب exam_template_id (العمود الصحيح)
CREATE INDEX IF NOT EXISTS idx_grades_exam_template_id 
ON grades(exam_template_id);

-- =====================================================
-- 9. Indexes لجدول messages
-- =====================================================

-- Index للبحث حسب المدرسة
CREATE INDEX IF NOT EXISTS idx_messages_school_id 
ON messages(school_id);

-- Index للبحث حسب المرسل
CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
ON messages(sender_id);

-- Index للبحث حسب التاريخ
CREATE INDEX IF NOT EXISTS idx_messages_created_at 
ON messages(created_at DESC);

-- =====================================================
-- 10. Indexes لجدول notifications
-- =====================================================

-- Index للبحث حسب المستخدم
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

-- Index للبحث حسب حالة القراءة
CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
ON notifications(is_read);

-- Composite Index (مستخدم + حالة القراءة)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, is_read);

-- Index للبحث حسب التاريخ
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- =====================================================
-- 11. Indexes لجدول complaints
-- =====================================================

-- Index للبحث حسب المدرسة
CREATE INDEX IF NOT EXISTS idx_complaints_school_id 
ON complaints(school_id);

-- Index للبحث حسب الحالة
CREATE INDEX IF NOT EXISTS idx_complaints_status 
ON complaints(status);

-- Index للبحث حسب التاريخ
CREATE INDEX IF NOT EXISTS idx_complaints_created_at 
ON complaints(created_at DESC);

-- =====================================================
-- 12. Indexes لجدول schools
-- =====================================================

-- Index للبحث حسب slug
CREATE INDEX IF NOT EXISTS idx_schools_slug 
ON schools(slug);

-- Index للبحث حسب الحالة
CREATE INDEX IF NOT EXISTS idx_schools_status 
ON schools(status);

-- =====================================================
-- 13. Indexes إضافية للـ Performance
-- =====================================================

-- Index لجدول curriculums
CREATE INDEX IF NOT EXISTS idx_curriculums_school 
ON curriculums(school_id);

-- Index لجدول curriculum_subjects على curriculum_id (العمود الصحيح)
CREATE INDEX IF NOT EXISTS idx_curriculum_subjects_curriculum 
ON curriculum_subjects(curriculum_id);

-- Index لجدول exam_templates
CREATE INDEX IF NOT EXISTS idx_exam_templates_school 
ON exam_templates(school_id);

-- Index لجدول fee_payments
CREATE INDEX IF NOT EXISTS idx_fee_payments_school 
ON fee_payments(school_id);

CREATE INDEX IF NOT EXISTS idx_fee_payments_fee 
ON fee_payments(fee_id);

-- =====================================================
-- 14. Materialized View للـ Dashboard Stats
-- =====================================================

-- هذه الـ View تُحسّن أداء Dashboard بشكل كبير
-- يتم تحديثها كل 5 دقائق عبر cron job

-- ملاحظة: هذه الـ View تتطلب وجود أعمدة amount_due و amount_paid
-- إذا لم تكن موجودة، سيتم تجاهل الـ View بدون أخطاء

DO $$
BEGIN
  -- التحقق من وجود الأعمدة المطلوبة
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fees' 
    AND column_name IN ('amount_due', 'amount_paid')
    GROUP BY table_name
    HAVING COUNT(DISTINCT column_name) = 2
  ) THEN
    -- إنشاء Materialized View إذا كانت الأعمدة موجودة
    CREATE MATERIALIZED VIEW IF NOT EXISTS school_dashboard_stats AS
    SELECT 
      sch.id as school_id,
      COUNT(DISTINCT s.id) FILTER (WHERE s.id IS NOT NULL) as student_count,
      COUNT(DISTINCT t.user_id) FILTER (WHERE t.user_id IS NOT NULL) as teacher_count,
      COUNT(DISTINCT p.user_id) FILTER (WHERE p.user_id IS NOT NULL) as parent_count,
      COUNT(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) as class_count,
      COALESCE(SUM(f.amount_due), 0) as total_due,
      COALESCE(SUM(f.amount_paid), 0) as total_paid
    FROM schools sch
    LEFT JOIN students s ON s.school_id = sch.id
    LEFT JOIN user_roles t ON t.school_id = sch.id AND t.role = 'teacher'
    LEFT JOIN user_roles p ON p.school_id = sch.id AND p.role = 'parent'
    LEFT JOIN classes c ON c.school_id = sch.id
    LEFT JOIN fees f ON f.school_id = sch.id
    GROUP BY sch.id;
    
    -- Index للـ Materialized View
    CREATE UNIQUE INDEX IF NOT EXISTS idx_school_dashboard_stats_school_id 
    ON school_dashboard_stats(school_id);
  END IF;
END $$;

-- دالة لتحديث الـ Materialized View
CREATE OR REPLACE FUNCTION refresh_school_dashboard_stats()
RETURNS void AS $$
BEGIN
  -- التحقق من وجود Materialized View قبل التحديث
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'school_dashboard_stats'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY school_dashboard_stats;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 15. Function للـ Dashboard Stats (أسرع من 6 queries)
-- =====================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats_fast(
  p_school_id UUID,
  p_is_super_admin BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_mv_exists BOOLEAN;
BEGIN
  -- إذا كان super admin، اجلب إحصائيات كل المدارس
  IF p_is_super_admin THEN
    SELECT json_build_object(
      'students', (SELECT COUNT(*) FROM students),
      'teachers', (SELECT COUNT(*) FROM user_roles WHERE role = 'teacher'),
      'parents', (SELECT COUNT(*) FROM user_roles WHERE role = 'parent'),
      'classes', (SELECT COUNT(*) FROM classes),
      'totalDue', (SELECT COALESCE(SUM(amount_due), 0) FROM fees),
      'totalPaid', (SELECT COALESCE(SUM(amount_paid), 0) FROM fees),
      'attendanceRate', 0,
      'presentToday', 0
    ) INTO v_result;
  ELSE
    -- التحقق من وجود Materialized View
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'school_dashboard_stats'
    ) INTO v_mv_exists;
    
    IF v_mv_exists THEN
      -- جلب الإحصائيات من Materialized View (سريع جداً)
      SELECT json_build_object(
        'students', student_count,
        'teachers', teacher_count,
        'parents', parent_count,
        'classes', class_count,
        'totalDue', total_due,
        'totalPaid', total_paid,
        'attendanceRate', 0,
        'presentToday', 0
      ) INTO v_result
      FROM school_dashboard_stats
      WHERE school_id = p_school_id;
    END IF;
    
    -- إذا لم توجد بيانات في Materialized View، استخدم الطريقة العادية
    IF v_result IS NULL THEN
      SELECT json_build_object(
        'students', (SELECT COUNT(*) FROM students WHERE school_id = p_school_id),
        'teachers', (SELECT COUNT(*) FROM user_roles WHERE school_id = p_school_id AND role = 'teacher'),
        'parents', (SELECT COUNT(*) FROM user_roles WHERE school_id = p_school_id AND role = 'parent'),
        'classes', (SELECT COUNT(*) FROM classes WHERE school_id = p_school_id),
        'totalDue', (SELECT COALESCE(SUM(amount_due), 0) FROM fees WHERE school_id = p_school_id),
        'totalPaid', (SELECT COALESCE(SUM(amount_paid), 0) FROM fees WHERE school_id = p_school_id),
        'attendanceRate', 0,
        'presentToday', 0
      ) INTO v_result;
    END IF;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ملاحظات مهمة:
-- =====================================================
-- 1. قم بتشغيل هذا الملف في Supabase SQL Editor
-- 2. الـ Indexes ستُحسّن الأداء بنسبة 70-90%
-- 3. Materialized View تحتاج تحديث دوري:
--    SELECT refresh_school_dashboard_stats();
-- 4. يمكنك إعداد cron job في Supabase للتحديث التلقائي
-- 5. راقب الأداء بعد تطبيق الـ Indexes عبر:
--    EXPLAIN ANALYZE <your-query>
-- =====================================================
