-- Migration: add notification_delivery_logs table
-- Purpose: Store Edge Function delivery results for sender visibility

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id         uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  sent_count              integer NOT NULL DEFAULT 0,
  total_subscriptions     integer NOT NULL DEFAULT 0,
  has_active_subscription boolean NOT NULL DEFAULT false,
  no_device_registered    boolean NOT NULL DEFAULT false,
  temporary_outage        boolean NOT NULL DEFAULT false,
  delivered_at            timestamptz NOT NULL DEFAULT now(),
  raw_response            jsonb
);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Admins and teachers can read delivery logs for notifications they sent
CREATE POLICY "privileged_read_delivery_logs"
  ON public.notification_delivery_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.user_roles r ON r.user_id = auth.uid()
      WHERE n.id = notification_delivery_logs.notification_id
        AND r.role IN ('admin', 'teacher')
    )
  );

-- Only service_role can insert delivery logs (called from Edge Function)
CREATE POLICY "service_insert_delivery_logs"
  ON public.notification_delivery_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_delivery_logs_notification_id
  ON public.notification_delivery_logs(notification_id);
