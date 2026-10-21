-- ==============================================================================
-- Migration: 20261021190000_fix_student_exam_questions_view_security.sql
-- Purpose  : حل خطأ الفحص الأمني 0010 (security_definer_view)
--
-- الخلفية:
--   كان وصول ولي الأمر لأسئلة الاختبار يتم عبر View
--   public.student_exam_questions. ولتجاوز خطأ 401 (permission denied)
--   كان لا بد من ضبط الـ View على security_invoker = false، أي أن يعمل
--   بصلاحيات مالكه (SECURITY DEFINER) — وهو ما يرفضه الفحص الأمني 0010.
--
--   لا يمكن استخدام security_invoker = true لأن جدول exam_questions محمي
--   بسياسة RLS تسمح للمعلمين والإدارة فقط، وإضافة سياسة لأولياء الأمور على
--   الجدول نفسه ستكشف عمود correct_answer (RLS تعمل على مستوى الصف لا العمود).
--
--   الحل: نقل نفس منطق الحماية بالحرف إلى دالة RPC بنمط SECURITY DEFINER
--   (وهو النمط الموصى به من Supabase بدلاً من الـ Views) ثم حذف الـ View.
--
-- الأمان: لم يتغير أي شرط في التحكم بالوصول — نفس قيد الفصل عبر student_parents
--   ونفس مطابقة الهاتف phones_match ونفس اشتراط status = 'published'،
--   مع استبعاد عمود correct_answer نهائياً من الأعمدة المُرجَعة.
--
-- ملاحظة: idempotent — يمكن تشغيله أكثر من مرة بأمان.
-- ==============================================================================

SET search_path TO public;

-- ── 1) دالة آمنة لجلب أسئلة الاختبارات بدون correct_answer ───────────────────
CREATE OR REPLACE FUNCTION public.get_student_exam_questions(p_exam_ids UUID[])
RETURNS TABLE (
  id            UUID,
  exam_id       UUID,
  school_id     UUID,
  question_type TEXT,
  question_text TEXT,
  options       JSONB,
  order_index   INTEGER,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.exam_id,
    q.school_id,
    q.question_type,
    q.question_text,
    q.options,
    q.order_index,
    q.created_at
  FROM public.exam_questions q
  JOIN public.electronic_exams ee ON ee.id = q.exam_id
  WHERE q.exam_id = ANY(p_exam_ids)
    AND (
      public.get_auth_is_super_admin()
      OR (
        ee.status = 'published'
        AND (
          public.get_auth_role() IN ('admin', 'teacher')
          OR q.school_id = public.get_auth_school_id()
          OR EXISTS (
            SELECT 1
            FROM public.student_parents sp
            JOIN public.students s ON s.id = sp.student_id
            WHERE sp.parent_id = auth.uid()
              AND s.class_id = ee.class_id
          )
          OR EXISTS (
            SELECT 1
            FROM public.students s
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE s.class_id = ee.class_id
              AND public.phones_match(s.parent_phone, p.phone)
          )
        )
      )
    )
  ORDER BY q.exam_id, q.order_index;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_exam_questions(UUID[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_student_exam_questions(UUID[]) TO authenticated, service_role;

-- ── 2) حذف الـ View القديم بعد نقل مستهلكيه إلى الدالة ────────────────────────
--   كان الـ View يعمل بـ SECURITY DEFINER وهو المصدر الوحيد لخطأ الفحص 0010.
DROP VIEW IF EXISTS public.student_exam_questions;

-- ── 3) تأمين صلاحيات غرف ورسائل شات الفصول لأولياء الأمور والمعلمين والإدارة ──
GRANT ALL ON public.class_chat_rooms TO authenticated, service_role;
GRANT ALL ON public.class_chat_messages TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
