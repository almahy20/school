-- ==========================================================================
-- Migration: 20260901100000_clear_old_push_subscriptions.sql
-- Purpose  : حذف جميع الـ push subscriptions القديمة التي أُنشئت بالـ VAPID
--            public key القديم. هذا ضروري لأن:
--            1. تم تغيير الـ VAPID keys
--            2. الـ subscriptions القديمة ستُرفض من FCM/APNS بـ 410 Gone
--            3. المستخدمون سيُطلب منهم إعادة التفعيل تلقائياً عند فتح التطبيق
-- ==========================================================================

SET search_path TO public;

-- احذف جميع الـ subscriptions الموجودة
-- المستخدمون سيعيدون التسجيل تلقائياً عند فتح التطبيق
-- (checkSubscription في usePushNotifications يتحقق ويعيد الاشتراك تلقائياً)
TRUNCATE TABLE public.push_subscriptions;

-- احذف الـ delivery logs القديمة (أكثر من 30 يوم) لتنظيف البيانات
DELETE FROM public.notification_delivery_logs
WHERE created_at < NOW() - INTERVAL '30 days';

NOTIFY pgrst, 'reload schema';
