-- ==========================================================================
-- Migration: 20260911000000_fix_push_delivery_log_columns.sql
-- Purpose  : إضافة الأعمدة المفقودة في push_delivery_log التي تكتب إليها
--            Edge Function send-push-notification.
--
-- المشكلة:
--   الـ Edge Function تُدرج هذه الأعمدة:
--     notification_id, sent_count, total_subscriptions,
--     has_active_subscription, no_device_registered,
--     temporary_outage, raw_response
--
--   لكن migration 20260827700000 أنشأ الجدول بأعمدة مختلفة:
--     id, notification_id, user_id, queued_at, error_message,
--     pg_net_request_id, target_user_id
--
--   النتيجة: كل insert من Edge Function يفشل بـ "column does not exist"
--   — صامت لأنه مُلفَّف بـ try/catch لكنه يضيع كل بيانات التشخيص.
-- ==========================================================================

SET search_path TO public;

-- أضف الأعمدة المفقودة التي تكتبها الـ Edge Function
ALTER TABLE public.push_delivery_log
  ADD COLUMN IF NOT EXISTS sent_count             INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_subscriptions    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_active_subscription BOOLEAN    NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS no_device_registered   BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS temporary_outage       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raw_response           JSONB;

-- index مفيد للاستعلامات التشخيصية (مثلاً: اعرض كل الإشعارات التي لم تصل)
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_no_device
  ON public.push_delivery_log (no_device_registered)
  WHERE no_device_registered = TRUE;

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_temp_outage
  ON public.push_delivery_log (temporary_outage)
  WHERE temporary_outage = TRUE;

-- ضمان صلاحيات الكتابة
GRANT INSERT, SELECT ON public.push_delivery_log TO service_role;

NOTIFY pgrst, 'reload schema';
