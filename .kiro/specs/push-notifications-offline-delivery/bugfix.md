# Bugfix Requirements Document

## Introduction

الإشعارات الفورية (Push Notifications) لا تصل للمستخدمين بشكل موثوق عندما يكون التطبيق مغلقاً أو في الخلفية. تتضمن المشكلة خمسة محاور مترابطة:

1. **Prompt يظهر مرة واحدة فقط** — إذا رفض المستخدم أو أغلق الـ prompt لا توجد طريقة لإعادة التفعيل، والـ component يحفظ الرفض في `sessionStorage` فقط (مؤقت) لكن لا توجد صفحة إعدادات دائمة.
2. **iOS Safari بدون PWA mode** — Web Push لا يعمل على iOS إلا إذا أُضيف التطبيق للشاشة الرئيسية، ولا يوجد توجيه للمستخدم لذلك.
3. **Android Doze Mode / Battery Optimization** — الأجهزة الصينية (Xiaomi, Huawei, Samsung) تمنع توصيل الإشعارات لساعات، ولا يوجد إرشاد للمستخدم لاستثناء التطبيق.
4. **غياب تشخيص التوصيل للمدير/المعلم** — عند إرسال رسالة لا يُعرض delivery status في الـ UI رغم أن الـ Edge Function ترجعه.
5. **Subscription منتهية الصلاحية** — لا توجد إعادة تسجيل تلقائية proactive عند انتهاء الـ subscription أو تغيير VAPID keys (الكود الموجود يعالجها reactive فقط عند checkSubscription).

---

## Glossary

| المصطلح | التعريف |
|---------|---------|
| **Push Subscription** | كائن يحتوي على endpoint URL ومفاتيح تشفير يصدره المتصفح عند تفعيل الإشعارات، يُخزَّن في جدول `push_subscriptions` |
| **VAPID Keys** | زوج مفاتيح عام/خاص يُستخدم للتحقق من هوية خادم الإشعارات مع خوادم FCM/APNS |
| **Service Worker (SW)** | ملف `sw.js` يعمل في الخلفية ويستقبل push events حتى عند إغلاق التطبيق |
| **PWA mode** | وضع تشغيل التطبيق من الشاشة الرئيسية على iOS (ليس من متصفح Safari مباشرة) |
| **Doze Mode** | وضع توفير الطاقة على Android يؤجّل المهام الخلفية ويقيّد FCM |
| **Battery Optimization** | إعداد Android يحدّ من نشاط التطبيق في الخلفية، يؤثر مباشرة على استقبال Push |
| **410 Gone** | كود HTTP يرجعه push service يعني أن الـ subscription انتهت صلاحيتها بشكل دائم |
| **3-strike rule** | قاعدة في Edge Function تحتفظ بـ subscription عند فشل مؤقت (403) وتحذفها بعد 3 إخفاقات متتالية |
| **delivery status** | نتيجة محاولة إرسال الإشعار: `{ sent, total, has_active_subscription, no_device_registered }` |
| **Urgency header** | رأس HTTP في بروتوكول Web Push يخبر خادم FCM/APNS بأولوية الإشعار (`high` / `normal`) |

---

## Bug Analysis

### Current Behavior (Defect)

**المحور 1: إدارة الـ Prompt والإعدادات**

1.1 WHEN يرفض المستخدم الـ prompt أو يضغط "ليس الآن" THEN يُحفظ الرفض في `sessionStorage` فقط ويختفي الـ prompt، ولا توجد طريقة لإعادة تفعيل الإشعارات من أي مكان في التطبيق

1.2 WHEN يفتح المستخدم التطبيق في جلسة جديدة بعد رفض الـ prompt THEN يظهر الـ prompt مجدداً لأن `sessionStorage` يُمسح عند إغلاق نافذة المتصفح، بينما لو استمر نفس tab مفتوحاً يبقى مخفياً — هذا سلوك غير متسق وغير متوقع

1.3 WHEN يريد المستخدم مراجعة حالة الإشعارات أو تغييرها THEN لا توجد صفحة إعدادات تعرض الحالة الحالية (مفعّل / معطّل / محظور) أو تتيح التفعيل/التعطيل

1.4 WHEN تكون حالة `Notification.permission` هي `'denied'` THEN يتوقف `PushNotificationPrompt` عن الظهور تلقائياً (الشرط `permission === 'default'`)، لكن لا يُعرض أي إشعار للمستخدم بأن الإشعارات محظورة ولا كيفية إلغاء الحظر

**المحور 2: iOS Safari بدون PWA**

1.5 WHEN يفتح مستخدم iOS التطبيق من Safari مباشرة (ليس PWA) ويحاول تفعيل الإشعارات THEN يفشل `registration.pushManager.subscribe()` بـ `AbortError` أو لا يُكمَل الطلب، دون أي رسالة توجيهية بأن الحل هو Add to Home Screen

1.6 WHEN يُرسَل إشعار لمستخدم iOS يستخدم Safari (غير PWA) THEN يُحذف الـ endpoint أو لا يوجد أصلاً، والـ Edge Function ترجع `{ sent: 0 }` دون أي تمييز بأن السبب هو عدم دعم iOS Safari للـ Push

**المحور 3: Android Doze / Battery Optimization**

1.7 WHEN يُفعَّل المستخدم الإشعارات بنجاح على Android THEN لا يُقدَّم له أي توجيه لاستثناء التطبيق من Battery Optimization، مما يسبب تأخير أو فقدان الإشعارات في حالة Doze

1.8 WHEN تُرسَل push notification عبر Edge Function وتعاني من تأخير بسبب Doze THEN لا يعرف المستخدم سبب التأخير ولا يوجد توجيه لحل المشكلة

**المحور 4: غياب تشخيص التوصيل**

1.9 WHEN يرسل المدير أو المعلم رسالة تُطلق trigger الإشعار THEN لا يُعرض في الـ UI أي معلومة عن حالة التوصيل، رغم أن الـ Edge Function ترجع `{ sent, total, has_active_subscription, no_device_registered }` في الـ response body

1.10 WHEN تُنفَّذ `net.http_post` من trigger قاعدة البيانات THEN لا يُخزَّن الـ response في أي جدول ولا يُمكن مراجعته لاحقاً، مما يجعل تشخيص مشاكل التوصيل صعباً

**المحور 5: Subscription منتهية الصلاحية**

1.11 WHEN يفتح المستخدم التطبيق وتكون subscription الـ active لديه قد انتهت (push service ردّ بـ 410 في آخر محاولة إرسال وحُذفت من DB) THEN `checkSubscription` تجد `subscription = null` وتضع `isSubscribed = false` فقط، ولا تحاول إعادة التسجيل رغم أن `Notification.permission === 'granted'`

1.12 WHEN تُحذف subscription من قاعدة البيانات بسبب 410 THEN لا يُوجَد flag في قاعدة البيانات يشير إلى أن المستخدم كان مشتركاً ويحتاج إعادة تسجيل، فيبدو وكأنه لم يفعّل الإشعارات أصلاً

---

### Expected Behavior (Correct)

**المحور 1: إدارة الـ Prompt والإعدادات**

2.1 WHEN يرفض المستخدم الـ prompt أو يضغط "ليس الآن" THEN يجب أن يُحفظ الرفض في `localStorage` بـ key ثابت (مثل `push_prompt_dismissed_v1`) بحيث يستمر عبر الجلسات، ولا يُعرض الـ prompt مجدداً تلقائياً لكن يبقى التفعيل متاحاً من صفحة الإعدادات

2.2 WHEN يفتح المستخدم صفحة الإعدادات أو قسم "الإشعارات" THEN يجب أن تُعرض حالة الإشعارات الحالية بوضوح:
- `granted` + `isSubscribed = true` → "الإشعارات مفعّلة ✓" مع زر "تعطيل"
- `granted` + `isSubscribed = false` → "يجب إعادة التسجيل" مع زر "تفعيل"
- `default` → "الإشعارات غير مفعّلة" مع زر "تفعيل الآن"
- `denied` → "الإشعارات محظورة من المتصفح" مع تعليمات لإلغاء الحظر يدوياً

2.3 IF `Notification.permission === 'denied'` THEN يجب أن تُعرض تعليمات واضحة ومحددة حسب المتصفح (Chrome / Safari / Firefox) لكيفية إلغاء الحظر من إعدادات الموقع

**المحور 2: iOS Safari بدون PWA**

2.4 WHEN يكون المستخدم على iOS Safari (يمكن الكشف عبر `navigator.userAgent.includes('Safari') && !window.matchMedia('(display-mode: standalone)').matches`) ويحاول تفعيل الإشعارات THEN يجب أن يظهر modal أو banner يشرح خطوات Add to Home Screen قبل أي محاولة تسجيل

2.5 WHEN يكون `window.matchMedia('(display-mode: standalone)').matches === true` على iOS THEN يجب أن تعمل الإشعارات بشكل طبيعي وأن يُعرض الـ prompt للتفعيل دون قيود إضافية

2.6 IF يكون `'PushManager' in window === false` وكان المتصفح Safari على iOS THEN يجب أن يُعرض رسالة واضحة "يتطلب إضافة التطبيق للشاشة الرئيسية" بدلاً من رسالة خطأ تقنية

**المحور 3: Android Doze / Battery Optimization**

2.7 WHEN يمنح المستخدم إذن الإشعارات بنجاح على Android (يمكن الكشف عبر `navigator.userAgent.toLowerCase().includes('android')`) THEN يجب أن يُعرض له sheet أو card قابل للإغلاق يشرح كيفية استثناء التطبيق من Battery Optimization مع إمكانية تخطيه

2.8 WHEN يضغط المستخدم على زر "لا تسألني مجدداً" أو يتجاوز الـ battery guidance THEN يجب أن يُحفظ هذا التفضيل في `localStorage` ولا يُعرض الـ sheet مرة أخرى

**المحور 4: تشخيص التوصيل**

2.9 WHEN ترجع الـ Edge Function نتيجة إرسال الإشعار THEN يجب أن تُخزَّن النتيجة في عمود `notification_delivery_status` في جدول `notifications` أو في جدول منفصل `notification_delivery_logs` يحتوي على: `notification_id`, `sent_count`, `total_subscriptions`, `has_active_subscription`, `delivered_at`

2.10 IF كانت `sent = 0` و `has_active_subscription = false` عند إرسال إشعار لمستخدم THEN يجب أن يُعرض للمُرسِل (المدير/المعلم) badge أو tooltip صغير بجوار الرسالة يشير إلى "لم يفعّل المستلم الإشعارات" — دون عرق هذا للمستخدمين العاديين

2.11 IF كانت `sent = 0` و `temporary_outage = true` THEN لا يُعرض تحذير للمُرسِل (الفشل مؤقت والـ push service سيعيد المحاولة)

**المحور 5: Subscription منتهية الصلاحية**

2.12 WHEN يفتح المستخدم التطبيق وتكون `Notification.permission === 'granted'` لكن `pushManager.getSubscription()` يرجع `null` THEN يجب أن تحاول `checkSubscription` إعادة التسجيل تلقائياً بنفس VAPID key الحالي دون إظهار أي prompt للمستخدم

2.13 WHEN تنجح إعادة التسجيل التلقائية بعد 410 THEN يجب أن يُحدَّث الـ endpoint في قاعدة البيانات وتُضبط `isSubscribed = true` و يُسجَّل حدث في console للتشخيص

2.14 IF فشلت إعادة التسجيل التلقائية (مثلاً لأن المستخدم ألغى الإذن بعدها) THEN لا يجب أن يُعرض أي error للمستخدم، فقط يُضبط `isSubscribed = false` ويُترك التفعيل اليدوي من الإعدادات

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN يمنح المستخدم إذن الإشعارات وتكون VAPID keys صحيحة THEN يجب أن تستمر عملية التسجيل في `push_subscriptions` تعمل بنفس الطريقة الحالية

3.2 WHEN يتلقى الـ Service Worker push event THEN يجب أن يستمر في عرض الإشعار بنفس الخيارات الحالية (RTL, urgency, requireInteraction, vibrate)

3.3 WHEN يحدث VAPID key mismatch عند `checkSubscription` THEN يجب أن يستمر في إعادة التسجيل التلقائي بالمفتاح الجديد كما هو مُطبَّق حالياً

3.4 WHEN يرجع push service كود 410 لـ endpoint مُخزَّن THEN يجب أن يستمر في حذف الـ subscription الميتة من قاعدة البيانات فور اكتشافها

3.5 WHEN يكون المستخدم مُسجَّلاً فعلاً ولديه subscription سليمة THEN يجب أن تستمر الإشعارات في الوصول إليه عند إغلاق التطبيق أو وضعه في الخلفية

3.6 WHEN يُرسَل إشعار لمستخدم لديه subscription تعاني من failure مؤقت THEN يجب أن يستمر في الاحتفاظ بالـ subscription وعدم حذفها (3-strike rule) كما هو مُطبَّق حالياً

3.7 WHEN يكون التطبيق مفتوحاً في الواجهة THEN يجب أن يستمر في عرض الإشعارات الـ in-app عبر `RealtimeNotificationsManager` دون تأثر

---

## ملاحق: صياغة شرط الخطأ (Bug Condition)

```pascal
// Bug Condition Function C(X)
FUNCTION isBugCondition(X)
  INPUT: X of type PushNotificationContext
  OUTPUT: boolean

  RETURN (
    // المحور 1: رفض غير دائم + لا توجد صفحة إعدادات
    (X.userDismissedPrompt = true AND X.dismissalStoredInLocalStorage = false)
    OR (X.userWantsToChangeSettings = true AND X.settingsPageExists = false)
    OR
    // المحور 2: iOS Safari بدون PWA guidance
    (X.platform = iOS AND X.displayMode = browser AND X.pwaGuidanceShown = false AND X.userAttemptedSubscription = true)
    OR
    // المحور 3: لا توجد battery optimization guidance على Android
    (X.platform = Android AND X.permissionJustGranted = true AND X.batteryGuidanceShown = false)
    OR
    // المحور 4: delivery status غير مرئي للمُرسِل
    (X.notificationSent = true AND X.sentCount = 0 AND X.hasActiveSubscription = false AND X.deliveryStatusDisplayedToSender = false)
    OR
    // المحور 5: لا إعادة تسجيل proactive عند subscription = null مع permission = granted
    (X.permissionStatus = 'granted' AND X.browserSubscription = null AND X.autoResubscribeAttempted = false)
  )
END FUNCTION

// Property: Fix Checking — بعد تطبيق الإصلاح
FOR ALL X WHERE isBugCondition(X) DO
  result ← handlePushNotification_fixed(X)
  ASSERT (
    // المحور 1
    (X.userDismissedPrompt → result.dismissalStoredInLocalStorage = true)
    AND (X.userWantsToChangeSettings → result.settingsPageRendered = true)
    AND
    // المحور 2
    (X.platform = iOS AND X.displayMode = browser AND X.userAttemptedSubscription →
      result.pwaGuidanceShown = true AND result.subscriptionAborted = true)
    AND
    // المحور 3
    (X.platform = Android AND X.permissionJustGranted →
      result.batteryOptimizationGuidanceShown = true)
    AND
    // المحور 4
    (X.notificationSent AND X.sentCount = 0 AND NOT X.hasActiveSubscription →
      result.senderNotifiedOfNoSubscription = true)
    AND
    // المحور 5
    (X.permissionStatus = 'granted' AND X.browserSubscription = null →
      result.autoResubscribeAttempted = true)
  )
END FOR

// Property: Preservation Checking — السلوك الصحيح الحالي لا يتأثر
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handlePushNotification(X) = handlePushNotification_fixed(X)
  // خصوصاً:
  // - 3-strike rule لا تتغير
  // - VAPID key mismatch detection لا تتغير
  // - SW push event handling لا يتغير
  // - in-app realtime notifications لا تتأثر
END FOR
```
