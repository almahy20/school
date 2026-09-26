-- Migration: Drop deprecated complaints table and its triggers/functions
-- Reason: Feature superseded by conversations and conversation_messages system.

-- 1. Drop triggers on complaints table
DROP TRIGGER IF EXISTS tr_notify_admin_new_complaint ON public.complaints;
DROP TRIGGER IF EXISTS tr_notify_complaint_update ON public.complaints;

-- 2. Drop the trigger functions
DROP FUNCTION IF EXISTS public.notify_admin_new_complaint();
DROP FUNCTION IF EXISTS public.notify_complaint_update();

-- 3. Drop the complaints table
DROP TABLE IF EXISTS public.complaints CASCADE;
