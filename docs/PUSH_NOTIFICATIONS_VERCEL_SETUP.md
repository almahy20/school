# إعداد Push Notifications على Vercel (خطوة بخطوة)

## لماذا تعمل على localhost فقط؟

على localhost، الإشعارات تعمل عبر **Supabase Realtime WebSocket** (يعمل دائماً).  
على Vercel، الإشعارات عند إغلاق التطبيق تعتمد على **Web Push Protocol** الذي يحتاج:

```
المدير يرسل رسالة
       ↓
Supabase DB trigger يستدعي Edge Function
       ↓
Edge Function تستدعي خادم Push (Google/Mozilla)
       ↓
خادم Push يوصل الإشعار لجهاز ولي الأمر
       ↓
Service Worker (sw.js) يعرض الإشعار
       ↓
المستخدم ينقر → يفتح /messages
```

---

## الخطوات المطلوبة

### 1. تأكد من وجود VAPID Keys في `.env`

```env
VITE_VAPID_PUBLIC_KEY=BPndOXtbKvVwZxdKIlFK317EIPL_HBqGgIHLFgFl7SDPcsOB0i1yuW86x00jRSapSWW_opF8qZRx8wddQlnYqak
```

### 2. أضف Secrets في Supabase Dashboard

اذهب إلى: **Supabase Dashboard → Project Settings → Edge Functions → Secrets**

أضف هذه الـ secrets:

| الاسم | القيمة |
|-------|--------|
| `VAPID_PUBLIC_KEY` | نفس قيمة `VITE_VAPID_PUBLIC_KEY` في `.env` |
| `VAPID_PRIVATE_KEY` | المفتاح الخاص (لا تضعه في `.env` أبداً) |
| `VAPID_EMAIL` | `mailto:admin@yourschool.com` |

> لتوليد مفاتيح جديدة: `npx web-push generate-vapid-keys`

### 3. أضف Service Role Key في Supabase Vault

اذهب إلى: **Supabase Dashboard → Database → Vault**

أضف secret باسم: `SUPABASE_SERVICE_ROLE_KEY`  
القيمة: مفتاح الـ service role من **Project Settings → API**

> هذا يسمح لـ database trigger باستدعاء Edge Function بأمان بدون hardcode للمفاتيح.

### 4. انشر Edge Function

```bash
npx supabase functions deploy send-push-notification --project-ref mecutwhreywjwstirpka
```

### 5. شغّل Migration الجديد

```bash
npx supabase db push --project-ref mecutwhreywjwstirpka
```

أو من Supabase Dashboard → SQL Editor، شغّل محتوى:
`supabase/migrations/20260601000000_fix_push_notification_trigger.sql`

### 6. أضف Environment Variables في Vercel

اذهب إلى: **Vercel Dashboard → Project → Settings → Environment Variables**

أضف:
```
VITE_SUPABASE_URL=https://mecutwhreywjwstirpka.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BPnd...
```

---

## اختبار أن كل شيء يعمل

### اختبار 1: هل المستخدم مشترك في Push؟
في المتصفح (على Vercel):
1. افتح التطبيق
2. اذهب إلى الإعدادات
3. تأكد أن "تفعيل الإشعارات" مفعّل
4. في DevTools → Application → Service Workers → تأكد SW مسجّل

### اختبار 2: هل Edge Function تعمل؟
```bash
curl -X POST https://mecutwhreywjwstirpka.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "USER_UUID", "title": "اختبار", "body": "رسالة تجريبية", "url": "/messages"}'
```

### اختبار 3: هل الإشعار يفتح الصفحة الصحيحة؟
1. أرسل رسالة من المدير لولي الأمر
2. أغلق التطبيق على جهاز ولي الأمر
3. يجب أن يصل إشعار
4. عند النقر عليه → يجب أن يفتح `/messages`

---

## مشاكل شائعة

### "No subscriptions found"
ولي الأمر لم يسمح بالإشعارات. يجب أن يضغط "تفعيل الآن" في الـ prompt.

### الإشعار يصل لكن ينقر على `/` بدل `/messages`
تأكد أن Edge Function المحدّثة منشورة (`supabase functions deploy`).

### الإشعار لا يصل أصلاً
1. تحقق من Supabase Edge Function logs
2. تحقق من أن VAPID keys صحيحة
3. تحقق من أن `net.http_post` مفعّل في المشروع (Supabase → Database → Extensions → pg_net)

### خطأ CORS
Edge Function الجديدة تقبل `*` — لا يجب أن يكون هناك مشكلة CORS.

---

## كيف يعمل النظام بالكامل

```
1. المدير يكتب رسالة ويضغط إرسال
2. useSendMessage() يحفظ الرسالة في جدول messages
3. Database trigger (tr_notify_new_message) ينشئ notification في جدول notifications
4. Database trigger (tr_push_on_notification) يستدعي Edge Function
5. Edge Function تجلب push subscription من جدول push_subscriptions
6. Edge Function ترسل push عبر web-push library
7. خادم Google/Mozilla يوصل الإشعار لجهاز ولي الأمر
8. sw.js يستقبل push event ويعرض الإشعار
9. المستخدم ينقر → sw.js يفتح /messages
10. التطبيق يفتح وRealtimeNotificationsManager يحدّث الكاش
```
