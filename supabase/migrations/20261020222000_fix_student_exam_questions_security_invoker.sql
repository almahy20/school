-- ==============================================================================
-- Migration: 20261020222000_fix_student_exam_questions_security_invoker.sql
-- Purpose  : حل خطأ الفحص الأمني في Supabase (0010_security_definer_view)
--            بتحويل View public.student_exam_questions إلى security_invoker = true
-- ==============================================================================

SET search_path TO public;

-- تحويل الـ View إلى Security Invoker لكي يتم تقييد الاستعلامات بسياسات RLS للمستخدم المستعلم
ALTER VIEW public.student_exam_questions SET (security_invoker = true);

-- تأكيد صلاحيات القراءة للأدوار المصرح لها
GRANT SELECT ON public.student_exam_questions TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
