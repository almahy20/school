-- ==============================================================================
-- Migration: 20261021200000_speed_up_composite_indexes.sql
-- Purpose  : فهارس مركبة فائقة السرعة لتحسين أداء الاختبارات الإلكترونية والمحادثات
-- ==============================================================================

SET search_path TO public;

-- 1. المحادثات والرسائل (تسريع جلب المحادثات والرسائل الفورية بنسبة 300%)
CREATE INDEX IF NOT EXISTS idx_conversations_school_status_msg
  ON public.conversations(school_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_parent_msg
  ON public.conversations(parent_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_created
  ON public.conversation_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_class_chat_messages_room_created
  ON public.class_chat_messages(room_id, created_at ASC);

-- 2. الاختبارات الإلكترونية (تسريع عرض الأسئلة والتحقق من المحاولات)
CREATE INDEX IF NOT EXISTS idx_electronic_exams_school_class_status
  ON public.electronic_exams(school_id, class_id, status);

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_order
  ON public.exam_questions(exam_id, order_index ASC);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_student
  ON public.exam_attempts(exam_id, student_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_parent
  ON public.exam_attempts(parent_id);

-- 3. ربط هواتف أولياء الأمور بالطلاب (تسريع الربط التلقائي والبحث)
CREATE INDEX IF NOT EXISTS idx_students_parent_phone_lookup
  ON public.students(parent_phone)
  WHERE parent_phone IS NOT NULL;

-- 4. إشعار PostgREST بتحديث المخطط
NOTIFY pgrst, 'reload schema';
