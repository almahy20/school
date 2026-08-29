-- ==========================================================================
-- Migration: 20260830010000_performance_and_resource_optimization.sql
-- Purpose  : حل مشكلة استنزاف الموارد (Resource Exhaustion & CPU Spikes)
--            من خلال إضافة فهارس مركبة (Composite Indexes) وتحديث إحصائيات الجداول
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. فهارس جدول الإشعارات (Notifications) — الأكثر استهلاكاً للـ Queries
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created 
ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
ON public.notifications (user_id, type, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. فهارس دردشة الفصول (Class Chat)
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_class_chat_messages_room_order 
ON public.class_chat_messages (room_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_class_chat_rooms_school_class 
ON public.class_chat_rooms (school_id, class_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. فهارس الاختبارات الإلكترونية (Electronic Exams)
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_electronic_exams_query 
ON public.electronic_exams (school_id, class_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_lookup 
ON public.exam_attempts (exam_id, student_id, started_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. فهارس ربط أولياء الأمور والطلاب والمستخدمين
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_school 
ON public.student_parents (parent_id, school_id);

CREATE INDEX IF NOT EXISTS idx_student_parents_student_school 
ON public.student_parents (student_id, school_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_school_role 
ON public.user_roles (user_id, school_id, role);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. تنظيف سجلات الـ Push Delivery القديمة لتوفير المساحة وموارد القرص
-- ─────────────────────────────────────────────────────────────────────────
DELETE FROM public.push_delivery_log 
WHERE created_at < NOW() - INTERVAL '7 days';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. تحديث إحصائيات المحرك (Query Planner Optimizer)
-- ─────────────────────────────────────────────────────────────────────────
ANALYZE public.notifications;
ANALYZE public.class_chat_messages;
ANALYZE public.electronic_exams;
ANALYZE public.exam_attempts;
ANALYZE public.student_parents;
ANALYZE public.students;
ANALYZE public.user_roles;
ANALYZE public.profiles;

NOTIFY pgrst, 'reload schema';
