-- ==========================================================================
-- Migration: 20260827700000_fix_push_delivery_log_schema.sql
-- Purpose  : إصلاح schema الـ push_delivery_log — بيضمن وجود كل الأعمدة
--            المطلوبة بصرف النظر عن أي migration اتشغلت أول
-- ==========================================================================

SET search_path TO public;

-- ضمان وجود الجدول بأي حال
CREATE TABLE IF NOT EXISTS public.push_delivery_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id  UUID        REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id          UUID,
  queued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message    TEXT
);

-- أضف الأعمدة المفقودة لو الجدول موجود بشكل قديم
ALTER TABLE public.push_delivery_log
  ADD COLUMN IF NOT EXISTS pg_net_request_id BIGINT,
  ADD COLUMN IF NOT EXISTS target_user_id    UUID,
  ADD COLUMN IF NOT EXISTS error_message     TEXT;

-- index للأداء
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_notification
  ON public.push_delivery_log (notification_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_user
  ON public.push_delivery_log (user_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_queued
  ON public.push_delivery_log (queued_at DESC);

-- RLS
ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

-- ضمان صلاحيات الكتابة من الـ trigger
GRANT INSERT ON public.push_delivery_log TO service_role;

NOTIFY pgrst, 'reload schema';
