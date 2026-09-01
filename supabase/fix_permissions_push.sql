-- ==========================================================================
-- Diagnostic: fix_permissions_push.sql
-- Purpose  : تحقق من حالة الـ vault و push subscriptions
-- ==========================================================================

-- 1. عدد الـ subscriptions والمستخدمين الفريدين
SELECT 
  COUNT(*)                 AS total_subscriptions,
  COUNT(DISTINCT user_id)  AS unique_users
FROM public.push_subscriptions;

-- 2. تحقق من وجود الـ vault secrets المطلوبة للـ push notifications
SELECT
  name,
  CASE
    WHEN decrypted_secret IS NOT NULL AND decrypted_secret != ''
      THEN 'EXISTS'
    ELSE 'MISSING'
  END AS status
FROM vault.decrypted_secrets
WHERE name IN (
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'service_role_key',
  'SERVICE_ROLE_JWT',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY'
);

-- 3. تحقق من الـ triggers الموجودة على جدول notifications
SELECT
  trigger_name,
  event_manipulation,
  action_orientation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table  = 'notifications'
ORDER BY trigger_name;

-- 4. آخر 10 أخطاء في push_trigger_errors (لو الجدول موجود)
SELECT *
FROM public.push_trigger_errors
ORDER BY created_at DESC
LIMIT 10;
