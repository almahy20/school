-- ==============================================================================
-- Migration: 20261021190000_fix_student_exam_questions_view_security.sql
-- Purpose  : حل خطأ 401 (permission denied for view student_exam_questions)
--            بإلغاء security_invoker حتى تعمل الـ View بصلاحيات مالكها (postgres)
--            بينما تتولى شروط WHERE داخل الـ View حماية البيانات واقتصارها على فصل الطالب فقط
-- ==============================================================================

SET search_path TO public;

-- 1. إلغاء security_invoker لتجنب خطأ permission denied لأولياء الأمور
ALTER VIEW public.student_exam_questions SET (security_invoker = false);

-- 2. منح صلاحية القراءة للجميع
GRANT SELECT ON public.student_exam_questions TO authenticated, anon, service_role;

-- 3. تأمين صلاحيات غرف ورسائل شات الفصول لأولياء الأمور والمعلمين والإدارة
GRANT ALL ON public.class_chat_rooms TO authenticated, service_role;
GRANT ALL ON public.class_chat_messages TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
