-- ==========================================================================
-- Migration: 20260901100000_clear_old_push_subscriptions.sql
-- Purpose  : حذف جميع الـ push subscriptions القديمة التي انشئت بالـ VAPID
--            public key القديم. هذا ضروري لان:
--            1. تم تغيير الـ VAPID keys
--            2. الـ subscriptions القديمة ستُرفض من FCM/APNS بـ 410 Gone
--            3. المستخدمون سيُطلب منهم إعادة التفعيل تلقائياً عند فتح التطبيق
-- ==========================================================================

SET search_path TO public;

-- احذف جميع الـ subscriptions الموجودة
TRUNCATE TABLE public.push_subscriptions;

-- احذف الـ delivery logs القديمة (اكثر من 30 يوم)
-- الجدول الصحيح: push_delivery_log وليس notification_delivery_logs
DELETE FROM public.push_delivery_log
WHERE queued_at < NOW() - INTERVAL '30 days';

NOTIFY pgrst, 'reload schema';
