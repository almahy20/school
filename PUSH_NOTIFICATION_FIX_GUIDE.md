# دليل إصلاح خطأ 401 في Edge Function - send-push-notification

## 🔍 المشكلة

جميع محاولات استدعاء `send-push-notification` ترجع **401 Unauthorized**.

### السبب الجذري
1. الـ webhook يستخدم **anon key** الذي قد يكون منتهي الصلاحية أو غير صالح
2. الدالة لا تتحقق بشكل صحيح من الـ Authorization header
3. مفاتيح VAPID أو service_role غير مضبوطة في Secrets

---

## ✅ الحل الكامل

### أ) كود Edge Function المحدث

تم تحديث الملف: `supabase/functions/send-push-notification/index.ts`

#### المميزات الجديدة:
1. ✅ **تحقق متعدد المستويات من المصادقة:**
   - Service Role Key (لـ webhooks والاستدعاءات الداخلية)
   - User JWT Token (للاستدعاءات من Frontend)
   - Anon Key (كـ fallback)

2. ✅ **صلاحيات ذكية:**
   - المستخدمون العاديون: يمكنهم إرسال إشعارات لأنفسهم فقط
   - المعلمون والمديرين: يمكنهم إرسال إشعارات لأي مستخدم

3. ✅ **رسائل خطأ واضحة:**
   - 401: عند عدم وجود توكن أو عدم صلاحيته
   - 403: عند محاولة إرسال لمستخدم آخر (لغير المديرين)
   - 400: عند عدم وجود بيانات مطلوبة

---

## ب) إعداد Webhook بشكل صحيح

### الخطوة 1: تحديث قاعدة البيانات

قم بتشغيل ملف الـ migration:

```bash
supabase db push
```

أو يدوياً من Supabase Dashboard > SQL Editor:

```sql
-- انسخ محتوى ملف:
-- supabase/migrations/20260426000000_fix_push_notifications_auth.sql
```

### الخطوة 2: تخزين Service Role Key في Vault

**من Supabase Dashboard:**

1. اذهب إلى **Settings** > **API**
2. انسخ مفتاح **service_role** (secret)
3. اذهب إلى **SQL Editor**
4. شغّل الاستعلام التالي:

```sql
-- تفعيل vault
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- تخزين المفتاح بشكل آمن
INSERT INTO vault.secrets (name, secret)
VALUES (
  'SUPABASE_SERVICE_ROLE_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg3MjkwMSwiZXhwIjoyMDkwNDQ4OTAxfQ.YOUR_ACTUAL_KEY_HERE'
)
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

⚠️ **مهم:** استبدل `YOUR_ACTUAL_KEY_HERE` بمفتاحك الحقيقي!

### الخطوة 3: ضبط متغيرات Edge Function

**من Supabase Dashboard:**

1. اذهب إلى **Edge Functions**
2. اختر `send-push-notification`
3. اذهب إلى **Secrets** tab
4. أضف المتغيرات التالية:

```
SUPABASE_URL=https://mecutwhreywjwstirpka.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs... (نفس المفتاح من الخطوة 2)
VAPID_PUBLIC_KEY=BNx... (مفتاح VAPID العام)
VAPID_PRIVATE_KEY=abc... (مفتاح VAPID الخاص)
```

### الخطوة 4: نشر الدالة المحدثة

```bash
# من سطر الأوامر
supabase functions deploy send-push-notification
```

أو من Dashboard:
1. اذهب إلى **Edge Functions**
2. اختر `send-push-notification`
3. اضغط **Deploy**

---

## ج) أمثلة للاستدعاء من Frontend (PWA)

### الطريقة 1: استخدام Supabase Client (موصى بها)

```typescript
import { supabase } from '@/integrations/supabase/client';

// إرسال إشعار لمستخدم معين
export async function sendPushNotification({
  userId,
  title,
  body,
  url = '/'
}: {
  userId: string;
  title?: string;
  body: string;
  url?: string;
}) {
  try {
    // Supabase يضيف Authorization header تلقائياً
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title: title || 'إشعار جديد',
        body,
        url
      }
    });

    if (error) {
      console.error('Push notification failed:', error);
      throw error;
    }

    console.log('Push notification sent:', data);
    return data;
  } catch (error) {
    console.error('Error sending push:', error);
    throw error;
  }
}

// مثال للاستخدام
await sendPushNotification({
  userId: 'user-uuid-here',
  title: 'درجة جديدة',
  body: 'تم إضافة درجة جديدة للطالب أحمد',
  url: '/grades/123'
});
```

### الطريقة 2: استخدام Fetch API مباشرة

```typescript
// إرسال إشعار مع التوكن يدوياً
export async function sendPushNotificationWithFetch({
  userId,
  title,
  body,
  url = '/'
}: {
  userId: string;
  title?: string;
  body: string;
  url?: string;
}) {
  try {
    // الحصول على التوكن الحالي
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(
      'https://mecutwhreywjwstirpka.supabase.co/functions/v1/send-push-notification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          user_id: userId,
          title: title || 'إشعار جديد',
          body,
          url
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to send notification');
    }

    console.log('Push notification sent:', data);
    return data;
  } catch (error) {
    console.error('Error sending push:', error);
    throw error;
  }
}
```

### الطريقة 3: استدعاء من Webhook (Database Trigger)

يتم ذلك تلقائياً عبر الـ trigger. الكود المحدث موجود في الـ migration:

```sql
-- الـ trigger يستخدم service_role key من vault
-- لا حاجة لتعديل أي شيء هنا

CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_on_notification_insert();
```

عند إضافة إشعار جديد لجدول `notifications`:

```typescript
// هذا سيُشغّل الـ trigger تلقائياً
const { error } = await supabase
  .from('notifications')
  .insert({
    user_id: 'target-user-uuid',
    title: 'درجة جديدة',
    message: 'تم إضافة درجة جديدة',
    metadata: { url: '/grades/123' }
  });

// الـ trigger سيستدعي Edge Function تلقائياً
// باستخدام service_role key من vault
```

---

## 🧪 اختبار الدالة

### اختبار 1: من Console المتصفح

```javascript
// افتح Console في المتصفح وأنت مسجل الدخول
const { data, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    user_id: 'YOUR_USER_ID', // استبدل بـ UUID الخاص بك
    title: 'اختبار',
    body: 'هذا إشعار تجريبي',
    url: '/'
  }
});

console.log('Result:', data, error);
```

### اختبار 2: باستخدام cURL

```bash
# مع User JWT Token
curl -X POST https://mecutwhreywjwstirpka.supabase.co/functions/v1/send-push-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -d '{
    "user_id": "USER_UUID",
    "title": "اختبار",
    "body": "إشعار تجريبي",
    "url": "/"
  }'

# مع Service Role Key (للاختبار فقط)
curl -X POST https://mecutwhreywjwstirpka.supabase.co/functions/v1/send-push-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "user_id": "USER_UUID",
    "title": "اختبار",
    "body": "إشعار تجريبي",
    "url": "/"
  }'
```

### اختبار 3: من Database (Webhook Test)

```sql
-- إضافة إشعار يدوياً لاختبار الـ trigger
INSERT INTO public.notifications (
  user_id,
  title,
  message,
  metadata
) VALUES (
  'YOUR_USER_UUID',
  'اختبار Webhook',
  'هذا إشعار تجريبي من قاعدة البيانات',
  '{"url": "/test"}'
);

-- تحقق من Logs في Edge Function
```

---

## 🔍 استكشاف الأخطاء

### خطأ 401: Unauthorized

**الأسباب المحتملة:**
1. ❌ لا يوجد Authorization header
2. ❌ التوكن منتهي الصلاحية
3. ❌ استخدام anon key بدلاً من service_role في الـ webhook
4. ❌ service_role key غير مضبوط في Secrets

**الحل:**

```bash
# 1. تحقق من Logs
supabase functions logs send-push-notification

# 2. تأكد من المتغيرات
# Dashboard > Edge Functions > send-push-notification > Secrets
# يجب أن تحتوي على:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - VAPID_PUBLIC_KEY
# - VAPID_PRIVATE_KEY

# 3. تحقق من vault
SELECT name, LENGTH(secret) as key_length 
FROM vault.decrypted_secrets 
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
```

### خطأ 403: Forbidden

**السبب:** مستخدم عادي يحاول إرسال إشعار لمستخدم آخر

**الحل:**
- المستخدمون العاديون يمكنهم إرسال إشعارات لأنفسهم فقط
- فقط المعلمون والمديرين يمكنهم إرسال إشعارات للآخرين
- استخدم service_role key للاستدعاءات الداخلية

### خطأ 400: Bad Request

**السبب:** عدم وجود `user_id` أو `body`

**الحل:**
```json
{
  "user_id": "valid-uuid",  // مطلوب
  "body": "Notification text",  // مطلوب
  "title": "Optional title",  // اختياري
  "url": "/optional-url"  // اختياري
}
```

### خطأ: "No subscriptions found"

**السبب:** المستخدم لم يفعّل الإشعارات بعد

**الحل:**
```typescript
// من صفحة الإعدادات في التطبيق
import { usePushNotifications } from '@/hooks/usePushNotifications';

const { subscribeToNotifications } = usePushNotifications();

// استدعِ هذه الدالة عند ضغط المستخدم على زر "تفعيل الإشعارات"
await subscribeToNotifications();
```

---

## 📊 مراقبة الأداء

### عرض Logs

```bash
# Logs مباشرة
supabase functions logs send-push-notification

# Logs مع فلتر
supabase functions logs send-push-notification | grep "Push"
```

### من Dashboard

1. اذهب إلى **Edge Functions**
2. اختر `send-push-notification`
3. اضغط **Logs** tab

### استعلامات مفيدة

```sql
-- عدد الاشتراكات لكل مستخدم
SELECT user_id, COUNT(*) as subscription_count
FROM push_subscriptions
GROUP BY user_id
ORDER BY subscription_count DESC;

-- الاشتراكات القديمة (أكثر من 30 يوم)
SELECT user_id, endpoint, updated_at
FROM push_subscriptions
WHERE updated_at < NOW() - INTERVAL '30 days';

-- تنظيف الاشتراكات القديمة
SELECT cleanup_expired_subscriptions();
```

---

## 🔐 الأمان

### أفضل الممارسات

1. ✅ **لا تشارك مفاتيح service_role في الكود**
   - استخدم vault.secrets
   - لا تضعها في `.env` المُرفع لـ Git

2. ✅ **استخدم RLS policies**
   - تم إعدادها تلقائياً في الـ migration

3. ✅ **تحقق من الصلاحيات في Edge Function**
   - المستخدمون العاديون: أنفسهم فقط
   - المعلمون/المديرين: أي مستخدم

4. ✅ **استخدم HTTPS دائماً**
   - Supاباس توفر HTTPS تلقائياً

5. ✅ **جدد مفاتيح VAPID دورياً**
   ```bash
   npx web-push generate-vapid-keys
   ```

---

## 📝 خطوات النشر النهائية

```bash
# 1. تحديث قاعدة البيانات
supabase db push

# 2. ضبط المتغيرات في Dashboard
# Edge Functions > send-push-notification > Secrets
# أضف: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

# 3. تخزين service_role في vault
# انظر الخطوة 2 في دليل الإعداد

# 4. نشر الدالة
supabase functions deploy send-push-notification

# 5. اختبار الدالة
# انظر قسم "اختبار الدالة" أعلاه

# 6. مراقبة Logs
supabase functions logs send-push-notification
```

---

## 🎯 الخلاصة

### ما تم إصلاحه:

1. ✅ **Edge Function:**
   - إضافة تحقق متعدد المستويات من المصادقة
   - دعم service_role, JWT, و anon key
   - رسائل خطأ واضحة
   - صلاحيات ذكية

2. ✅ **Webhook:**
   - استخدام service_role من vault (آمن)
   - معالجة أخطاء محسنة
   - Logging أفضل

3. ✅ **قاعدة البيانات:**
   - جدول push_subscriptions مع RLS
   - Policies آمنة
   - Cleanup function

4. ✅ **Frontend:**
   - أمثلة واضحة للاستدعاء
   - دعم Supabase Client و Fetch API
   - معالجة أخطاء شاملة

### النتيجة:
- ❌ **قبل:** جميع الطلبات ترجع 401
- ✅ **بعد:** المصادقة تعمل بشكل صحيح مع جميع طرق الاستدعاء

---

**آخر تحديث:** 2026-04-26  
**الإصدار:** 3.0
