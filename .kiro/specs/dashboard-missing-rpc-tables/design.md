# Dashboard Missing RPC Tables — Bugfix Design

## Overview

عند تحميل لوحة التحكم (Dashboard)، يرفض PostgREST طلبات RPC وطلبات الجداول لأن **schema cache** القديم لا يرى الكيانات التي أُضيفت في آخر migrations. الدوال والأعمدة موجودة فعلياً في قاعدة البيانات، لكن PostgREST يخدم cache تقنية قديمة.

**استراتيجية الإصلاح:** migration جديدة واحدة (`20260904000000_force_schema_cache_reload.sql`) تُعيد تسجيل الدوال الأربع بـ `CREATE OR REPLACE`، وتضمن وجود الأعمدة المفقودة بـ `ADD COLUMN IF NOT EXISTS`، ثم تُرسل `NOTIFY pgrst, 'reload schema'` لإجبار PostgREST على إعادة بناء cache. لا يوجد أي تغيير في كود TypeScript لأن الـ fallback موجود بالفعل.

---

## Glossary

- **Bug_Condition (C)**: الحالة التي يُعيد فيها PostgREST خطأ 404/400 بسبب أن الكيان (دالة أو عمود) غير مرئي في schema cache رغم وجوده في DB
- **Property (P)**: السلوك الصحيح — PostgREST يُعيد الاستجابة المطلوبة (بيانات أو عدد صفوف) بدون خطأ
- **Preservation**: جميع الدوال والجداول والـ RLS policies الموجودة مسبقاً يجب أن تبقى تعمل بنفس الطريقة
- **schema cache**: ذاكرة التخزين المؤقت التي يبنيها PostgREST عند البدء أو عند استقبال `NOTIFY pgrst, 'reload schema'`
- **PGRST202**: كود خطأ PostgREST يعني "الدالة غير موجودة في schema cache"
- **SECURITY DEFINER**: صلاحية تشغيل الدالة بصلاحيات مُنشئها، مطلوبة لتجاوز RLS في دوال الإحصاءات
- **get_dashboard_stats**: دالة في `20260903100000_fix_slow_rpc_functions.sql` تُعيد إحصاءات الداشبورد
- **get_admin_dashboard_activities**: دالة في نفس الملف تُعيد آخر الأنشطة (شكاوى + انضمامات + مدفوعات)
- **get_unread_notification_counts**: دالة في نفس الملف تُعيد عدد الإشعارات غير المقروءة
- **get_fees_summary**: دالة في `20260807000000_create_get_fees_summary_rpc.sql` تُعيد إجمالي الرسوم
- **notification_prefs**: عمود JSONB في جدول `profiles` أُضيف في migration `20260404900001`
- **unread_by_parent**: عمود INT في جدول `conversations` أُضيف في `20260821000000_create_conversations_system.sql`

---

## Bug Details

### Bug Condition

يتجلى الخطأ عند أي استدعاء من `useStats.ts` أو `useNotifications.ts` أو `useProfile.ts` أو `useConversations.ts` يستهدف كياناً غير مرئي في PostgREST schema cache. الدالة `isBugCondition` تتحقق مما إذا كان الكيان المستهدف موجوداً في DB لكن مفقوداً من schema cache.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type PostgREST_Request
  OUTPUT: boolean

  -- الكيان موجود في قاعدة البيانات فعلاً
  entity_exists_in_db := (
    request.target IN [
      'get_dashboard_stats(p_school_id, p_is_super_admin)',
      'get_admin_dashboard_activities(p_school_id)',
      'get_unread_notification_counts(p_user_id)',
      'get_fees_summary(p_school_id)',
      'notifications table',
      'conversations.unread_by_parent',
      'profiles.notification_prefs'
    ]
  )

  -- لكن PostgREST يُعيد خطأ 404 أو 400
  postgrest_returns_error := (
    request.response.status IN [400, 404]
    AND request.response.code IN ['PGRST202', 'PGRST204']
  )

  RETURN entity_exists_in_db AND postgrest_returns_error
END FUNCTION
```

### Examples

- **مثال 1:** `useStats.ts` يستدعي `supabase.rpc('get_dashboard_stats', ...)` → يُعيد `PGRST202: Could not find the function public.get_dashboard_stats(p_is_super_admin, p_school_id) in the schema cache` بينما الدالة موجودة في migration `20260903100000`
- **مثال 2:** `useNotifications.ts` يستعلم على جدول `notifications` → يُعيد 404 رغم وجود الجدول في DB
- **مثال 3:** `useProfile.ts` يستعلم `profiles?select=notification_prefs` → يُعيد `400 Bad Request` رغم وجود العمود بعد migration `20260404900001`
- **مثال 4 (Edge Case):** `useStats.ts` يستدعي `get_fees_summary` كـ fallback بعد فشل `get_dashboard_stats` → يفشل هو الآخر بـ 404، مما يُعيد صفراً في كل الإحصاءات

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- دوال RPC الأخرى (`get_child_full_details`, `get_parent_dashboard_summary`, `get_teacher_dashboard_stats`) يجب أن تستمر في إعادة نتائج صحيحة بدون تغيير
- بقية أعمدة جدول `profiles` (`id`, `full_name`, `phone`, `school_id`, `created_at`) يجب أن تستمر في العمل
- استعلامات ولي الأمر على `conversations` يجب أن تستمر في إعادة قائمة المحادثات
- Realtime subscriptions على `conversations` و`conversation_messages` يجب ألا تنقطع
- migrations القديمة يجب أن تستمر في التطبيق الصحيح على بيئة نظيفة
- سياسات RLS يجب أن تستمر في حماية البيانات بين المدارس (multi-tenant isolation)

**Scope:**
جميع الطلبات التي لا تستهدف الكيانات السبعة المذكورة في `isBugCondition` يجب أن تبقى غير متأثرة بالمطلق بهذا الإصلاح. الإصلاح يقتصر على:
- إعادة تسجيل 4 دوال RPC
- ضمان وجود عمودين (`notification_prefs`, `unread_by_parent`)
- إرسال إشعار reload لـ PostgREST

---

## Hypothesized Root Cause

بناءً على وصف الخطأ، الأسباب المرجحة مرتبةً تنازلياً:

1. **Schema Cache لم يتحدث بعد آخر migrations**: الدوال والأعمدة أُضيفت في migrations لاحقة، لكن `NOTIFY pgrst, 'reload schema'` في نهاية تلك الـ migrations لم يُجبر PostgREST على إعادة بناء الـ cache في بيئة الإنتاج. قد يكون الـ notify وصل قبل اكتمال transaction.

2. **الدوال غير مُعرَّفة أصلاً في البيئة الحالية**: إذا طُبِّقت migrations بشكل جزئي، أو إذا كان هناك error صامت أثناء تطبيق `20260903100000_fix_slow_rpc_functions.sql`، فقد لا تكون الدوال موجودة في DB أصلاً.

3. **مشكلة في ترتيب تطبيق migrations**: إذا طُبِّقت migration أحدث بدون تطبيق سابقتها (لعدم وجود dependency tracking)، قد تُخفق.

4. **الأعمدة مفقودة من الجداول**: إذا طُبِّقت `20260404900001_add_notification_prefs.sql` و`20260821000000_create_conversations_system.sql` في بيئة دون إعادة تحديث الـ cache، يبدو الخطأ كـ 400 بدلاً من 404.

---

## Correctness Properties

Property 1: Bug Condition — استجابة RPC والجداول بدون أخطاء

_For any_ طلب PostgREST حيث تتحقق `isBugCondition(request)` (الكيان موجود في DB والـ cache لا يراه)، يجب أن يُعيد النظام بعد تطبيق الإصلاح استجابة HTTP ناجحة (2xx) تحتوي على البيانات المطلوبة، وليس خطأ 404/400.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation — عدم تأثر الكيانات الأخرى

_For any_ طلب PostgREST حيث لا تتحقق `isBugCondition(request)` (الكيانات الموجودة مسبقاً وتعمل)، يجب أن يُعيد النظام بعد تطبيق الإصلاح نفس الاستجابة التي كان يُعيدها قبل الإصلاح، محافظاً على الوظائف القائمة لجميع المستخدمين.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Changes Required

**File:** `supabase/migrations/20260904000000_force_schema_cache_reload.sql`

**Strategy:** migration جديدة تُعيد تسجيل الكيانات في schema cache بدون تغيير في منطق الأعمال.

**Specific Changes:**

1. **إعادة تسجيل `get_dashboard_stats`**:
   - `CREATE OR REPLACE FUNCTION` بنفس signature وبنفس منطق `20260903100000`
   - الهدف: إجبار PostgREST على رؤية الدالة في cache

2. **إعادة تسجيل `get_admin_dashboard_activities`**:
   - `CREATE OR REPLACE FUNCTION` بنفس signature
   - الهدف: نفسه

3. **إعادة تسجيل `get_unread_notification_counts`**:
   - `CREATE OR REPLACE FUNCTION` بنفس signature
   - الهدف: نفسه

4. **إعادة تسجيل `get_fees_summary`**:
   - `CREATE OR REPLACE FUNCTION` بنفس signature من `20260807000000`
   - الهدف: نفسه

5. **ضمان وجود `profiles.notification_prefs`**:
   ```sql
   ALTER TABLE public.profiles
     ADD COLUMN IF NOT EXISTS notification_prefs JSONB;
   ```

6. **ضمان وجود `conversations.unread_by_parent`**:
   ```sql
   ALTER TABLE public.conversations
     ADD COLUMN IF NOT EXISTS unread_by_parent INT NOT NULL DEFAULT 0;
   ```

7. **إعادة منح الصلاحيات**:
   - `REVOKE` / `GRANT EXECUTE` لكل دالة للـ `authenticated` و`service_role`

8. **ثلاث استدعاءات `NOTIFY`**:
   - `NOTIFY pgrst, 'reload schema'` في بداية ونهاية المهاجرة
   - تأخير اصطناعي (`pg_sleep(0.1)`) بين الاستدعاءات لضمان وصول الـ notification

---

## Testing Strategy

### Validation Approach

التحقق يتبع نهجاً ثنائياً: أولاً استكشاف الخطأ على الكود غير المُصلح لتأكيد السبب الجذري، ثم التحقق من الإصلاح وعدم حدوث regression.

### Exploratory Bug Condition Checking

**Goal**: إثبات وجود الخطأ قبل الإصلاح — تأكيد أن schema cache لا يرى الدوال رغم وجودها في DB.

**Test Plan**: استدعاء كل دالة مباشرةً عبر Supabase client والتحقق من الاستجابة قبل تطبيق المهاجرة الجديدة.

**Test Cases**:
1. **RPC get_dashboard_stats Test**: استدعاء `supabase.rpc('get_dashboard_stats', {...})` والتحقق من أنه يُعيد `PGRST202` (سيفشل على الكود غير المُصلح)
2. **RPC get_admin_dashboard_activities Test**: استدعاء `supabase.rpc('get_admin_dashboard_activities', {...})` والتحقق من 404 (سيفشل على الكود غير المُصلح)
3. **Table notifications Test**: `supabase.from('notifications').select('*').limit(1)` والتحقق من 404
4. **Column notification_prefs Test**: `supabase.from('profiles').select('notification_prefs').eq('id', userId)` والتحقق من 400
5. **Column unread_by_parent Test**: `supabase.from('conversations').select('unread_by_parent').limit(1)` والتحقق من 404

**Expected Counterexamples**:
- الاستدعاءات تُعيد 404/400 بكود PGRST202/PGRST204
- السبب المحتمل: schema cache لم يُحدَّث بعد آخر migrations، أو الدوال لم تُطبَّق أصلاً

### Fix Checking

**Goal**: التحقق من أن الكيانات السبعة تستجيب بشكل صحيح بعد تطبيق migration الإصلاح.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  -- تطبيق migration الإصلاح
  result := postgrest_request_after_fix(request)
  ASSERT result.status IN [200, 206]
  ASSERT result.body IS NOT NULL
  ASSERT result.body NOT CONTAINS 'PGRST202'
  ASSERT result.body NOT CONTAINS 'PGRST204'
END FOR
```

### Preservation Checking

**Goal**: التحقق من أن الكيانات الأخرى لم تتأثر بتطبيق migration الإصلاح.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  result_before := postgrest_request_before_fix(request)
  result_after  := postgrest_request_after_fix(request)
  ASSERT result_before.status = result_after.status
  ASSERT result_before.body   = result_after.body  -- semantically equal
END FOR
```

**Testing Approach**: Property-based testing مناسب هنا لأنه يُولّد حالات اختبار عشوائية عبر نطاق واسع من المدارس والمستخدمين، يكشف edge cases لا تشملها الاختبارات اليدوية، ويُعطي ضماناً قوياً بأن الـ multi-tenant isolation لم يُكسر.

**Test Plan**: ملاحظة استجابات الكيانات غير المتأثرة قبل الإصلاح، ثم كتابة property-based tests للتحقق من بقائها دون تغيير.

**Test Cases**:
1. **get_child_full_details Preservation**: التحقق من أن الدالة تُعيد نفس البيانات قبل وبعد الإصلاح
2. **get_parent_dashboard_summary Preservation**: نفس التحقق
3. **profiles base columns Preservation**: التحقق من أن `id`, `full_name`, `phone`, `school_id` لا تزال تُعيد بيانات صحيحة
4. **RLS multi-tenant Preservation**: التحقق من أن مدرسة A لا تستطيع رؤية بيانات مدرسة B
5. **Realtime Preservation**: التحقق من أن Realtime subscriptions على `conversations` لا تزال تعمل

### Unit Tests

- اختبار كل دالة RPC بعد الإصلاح مع مدخلات صالحة وغير صالحة
- اختبار حالة `p_school_id = NULL` في `get_fees_summary` (يجب إعادة 0، لا crash)
- اختبار أن `notification_prefs` يقبل NULL وأنواع JSONB مختلفة
- اختبار حالة عدم وجود صفوف في `notifications` لمستخدم (يجب إعادة `{unread: 0, complaints: 0}`)

### Property-Based Tests

- توليد `school_id` عشوائي والتحقق من أن `get_dashboard_stats` يُعيد دائماً JSONB مع المفاتيح المطلوبة (`students`, `teachers`, `parents`, إلخ)
- توليد `user_id` عشوائي والتحقق من أن `get_unread_notification_counts` يُعيد دائماً أعداداً غير سالبة
- التحقق من أن تطبيق الـ migration لا يُغير قيم الأعمدة الموجودة (idempotency)

### Integration Tests

- تدفق كامل: تحميل الداشبورد لمدير مدرسة والتحقق من ظهور جميع الإحصاءات بدون أخطاء في Console
- تدفق كامل: فتح صفحة الإشعارات والتحقق من تحميل العدد الصحيح
- تدفق كامل: فتح صفحة البروفايل والتحقق من تحميل `notification_prefs` بدون 400
- تدفق كامل: فتح قائمة المحادثات لولي أمر والتحقق من ظهور `unread_by_parent` بشكل صحيح
