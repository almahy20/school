# Teacher Attendance RLS Fix — Bugfix Design

## Overview

جدول `public.teacher_attendance` يُسبّب **39.1% من أخطاء قاعدة البيانات** في Supabase بسبب RLS policy تُشير إلى عمود `profiles.role` غير الموجود (PostgreSQL error `42703`). الـ policy المُعطَّلة هي `"Admins full access"` التي أُنشئت في migration `20260413000000`، ومحاولة الإصلاح في `20260413000001` تستخدم `DROP TABLE CASCADE` مما يُفقد البيانات الحية.

استراتيجية الإصلاح: إصدار migration جديد **يُسقط الـ policies القديمة فقط** ثم يُعيد إنشاءها باستخدام `public.user_roles` — النمط الصحيح المعتمد في باقي المشروع.

---

## Glossary

- **Bug_Condition (C)**: الشرط الذي يُطلق البق — وجود RLS policy تستعلم عن `profiles.role` بدلاً من `user_roles.role`
- **Property (P)**: السلوك الصحيح المطلوب — نجاح جميع عمليات `SELECT/INSERT/UPDATE/DELETE` على `teacher_attendance` بدون خطأ `42703`
- **Preservation**: باقي الـ policies والجداول والبيانات يجب أن تظل كما هي دون أي تغيير
- **`profiles.role`**: عمود غير موجود في جدول `public.profiles` — هذا هو مصدر الخطأ
- **`user_roles.role`**: العمود الصحيح في جدول `public.user_roles` — النمط المعتمد في المشروع
- **`is_school_admin(uuid)`**: دالة helper موجودة في `20260901000000` تُجري نفس التحقق بأمان وكفاءة
- **`DROP TABLE CASCADE`**: أمر يحذف الجدول وكل بياناته وكل الكائنات التابعة له — نهج خاطئ في هذا السياق

---

## Bug Details

### Bug Condition

البق يظهر عند أي عملية قاعدة بيانات (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) على جدول `public.teacher_attendance` من طرف مستخدم مُعرَّف كـ admin. الـ RLS policy `"Admins full access"` تُنفَّذ لكل عملية وتحاول قراءة `profiles.role` الذي لا يوجد في schema.

**Formal Specification:**
```
FUNCTION isBugCondition(query)
  INPUT: query of type DatabaseOperation
  OUTPUT: boolean

  RETURN query.table = 'public.teacher_attendance'
         AND EXISTS(
           policy "Admins full access"
           WHERE policy.condition REFERENCES 'profiles.role'
           AND column 'profiles.role' NOT IN schema(public.profiles)
         )
END FUNCTION
```

### Examples

| السيناريو | السلوك الحالي (مكسور) | السلوك المتوقع |
|-----------|----------------------|----------------|
| Admin يُحاول قراءة سجلات حضور المعلمين | `ERROR 42703: column profiles.role does not exist` | قائمة سجلات الحضور |
| Admin يُضيف سجل حضور جديد | `ERROR 42703: column profiles.role does not exist` | إدراج ناجح |
| Admin يُعدّل حالة الحضور | `ERROR 42703: column profiles.role does not exist` | تحديث ناجح |
| معلّم يعرض سجله الخاص (`Teachers view own`) | يعمل بشكل صحيح (policy مختلفة) | يعمل بشكل صحيح |

---

## Expected Behavior

### Preservation Requirements

**السلوكيات التي يجب أن تظل دون تغيير:**
- policy `"Teachers view own"` على `teacher_attendance` — تعمل حالياً وتبقى كما هي
- جميع بيانات `teacher_attendance` الموجودة — لا تُحذف ولا تتأثر
- جميع RLS policies على الجداول الأخرى (`profiles`, `user_roles`, `complaints`, إلخ)
- الـ indexes الموجودة على `teacher_attendance`
- دوال helper (`is_school_admin`, `is_super_admin`, `get_auth_school_id`)

**النطاق:**
كل العمليات التي لا تمر عبر policy `"Admins full access"` على `teacher_attendance` يجب أن تبقى غير متأثرة. هذا يشمل:
- عمليات المعلمين على سجلاتهم الخاصة
- كل العمليات على جداول أخرى
- أي policy تستعلم عن `user_roles` بالفعل

---

## Hypothesized Root Cause

بناءً على تحليل الـ migrations:

1. **مرجع خاطئ لجدول الأدوار**: migration `20260413000000` كُتب قبل اعتماد نمط `user_roles` ويفترض أن `profiles` يحتوي على عمود `role` — وهو كان صحيحاً في المراحل الأولى من المشروع لكن النظام تحوّل لاحقاً إلى جدول `user_roles` مستقل.

2. **migration إصلاح مُعيب (`20260413000001`)**: محاولة الإصلاح موجودة لكنها تستخدم `DROP TABLE IF EXISTS public.teacher_attendance CASCADE` مما يجعلها **خطرة** — إذا طُبِّقت على بيئة بها بيانات حقيقية ستحذف كل سجلات الحضور.

3. **عدم استخدام helper functions**: الـ policy المكسورة تُنفّذ subquery مباشرة بدل استخدام `is_school_admin(school_id)` المتاحة والمُحسَّنة.

4. **غياب migration بديل آمن**: لم يُصدر بعد migration يُصلح الـ policies فقط (بدون المساس بالجدول أو بياناته).

---

## Correctness Properties

Property 1: Bug Condition — RLS Policies Reference Valid Columns

_For any_ database operation on `public.teacher_attendance` where the executing user is an admin with `role = 'admin'` in `public.user_roles`, the fixed RLS policy SHALL evaluate successfully using `user_roles.user_id` and `user_roles.role` and `user_roles.school_id`, returning the correct authorization decision without raising error `42703`.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Existing Data and Policies Unaffected

_For any_ operation on `public.teacher_attendance` by non-admin users (teachers viewing their own records), or any operation on any other table, the fixed migration SHALL produce exactly the same behavior as before the fix — no data loss, no policy changes outside `teacher_attendance`, no altered indexes or triggers.

**Validates: Requirements 3.1, 3.2, 3.3**

---

## Fix Implementation

### Changes Required

**النهج الآمن: migration جديد يُسقط الـ policies فقط ثم يُعيد بناءها**

**File**: `supabase/migrations/20260902000000_fix_teacher_attendance_rls_safe.sql`

**Specific Changes**:

1. **إسقاط الـ policies المكسورة فقط** (بدون المساس بالجدول أو بياناته):
   ```sql
   DROP POLICY IF EXISTS "Admins full access" ON public.teacher_attendance;
   DROP POLICY IF EXISTS "Admins can manage teacher attendance" ON public.teacher_attendance;
   ```

2. **إعادة إنشاء policy الـ admin باستخدام `user_roles`** (النمط الصحيح):
   ```sql
   CREATE POLICY "Admins full access"
     ON public.teacher_attendance
     FOR ALL
     USING (
       EXISTS (
         SELECT 1 FROM public.user_roles
         WHERE user_roles.user_id = auth.uid()
           AND user_roles.role = 'admin'
           AND user_roles.approval_status = 'approved'
           AND user_roles.school_id = teacher_attendance.school_id
       )
     )
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM public.user_roles
         WHERE user_roles.user_id = auth.uid()
           AND user_roles.role = 'admin'
           AND user_roles.approval_status = 'approved'
           AND user_roles.school_id = teacher_attendance.school_id
       )
     );
   ```

3. **إبقاء policy المعلمين كما هي** — `"Teachers view own"` لا تحتاج تغييراً لأنها تعمل بشكل صحيح.

4. **تعطيل migration `20260413000001`** أو التأكد من عدم تطبيقه في بيئة الإنتاج — يتطلب تنسيقاً يدوياً مع فريق DevOps.

5. **إضافة `approval_status = 'approved'`** في الـ policy الجديدة لمطابقة النمط المعتمد في `is_school_admin()`.

---

## Testing Strategy

### Validation Approach

نهج اختبار ثنائي المرحلة: أولاً تأكيد البق على الكود الأصلي (توليد counterexamples)، ثم التحقق من صحة الإصلاح وسلامة الـ preservation.

---

### Exploratory Bug Condition Checking

**الهدف**: إثبات وجود الخطأ `42703` على الكود غير المُصلَح وتأكيد تحليل السبب الجذري.

**خطة الاختبار**: تشغيل استعلامات على `teacher_attendance` بصلاحيات admin وتسجيل الخطأ قبل تطبيق الإصلاح.

**Test Cases**:
1. **Admin SELECT Test**: استعلام `SELECT * FROM teacher_attendance` كـ admin — سيفشل بـ `42703` على الكود المكسور
2. **Admin INSERT Test**: إدراج سجل حضور كـ admin — سيفشل بـ `42703` على الكود المكسور
3. **Admin UPDATE Test**: تحديث حالة حضور كـ admin — سيفشل بـ `42703` على الكود المكسور
4. **Policy Inspection Test**: فحص نص الـ policy في `pg_policies` والتحقق من وجود `profiles.role` فيه

**Expected Counterexamples**:
- `ERROR: column profiles.role does not exist` عند أي عملية admin
- السبب المؤكد: `pg_policies.qual` يحتوي على `profiles.role` بدل `user_roles.role`

---

### Fix Checking

**الهدف**: التحقق من أن جميع عمليات admin تعمل بدون خطأ بعد الإصلاح.

**Pseudocode:**
```
FOR ALL operation WHERE isBugCondition(operation) DO
  result := execute_on_fixed_db(operation)
  ASSERT result.error IS NULL
  ASSERT result.error_code != '42703'
  ASSERT expectedBehavior(result)
END FOR
```

---

### Preservation Checking

**الهدف**: التحقق من أن الإصلاح لا يُغيّر أي سلوك خارج نطاق الـ policy المكسورة.

**Pseudocode:**
```
FOR ALL operation WHERE NOT isBugCondition(operation) DO
  ASSERT original_db(operation) = fixed_db(operation)
END FOR
```

**نهج الاختبار**: Property-based testing مُستحسن لأنه يُولّد سيناريوهات متعددة تلقائياً ويضمن عدم تأثر السلوكيات غير المستهدفة.

**Test Cases**:
1. **Teacher View Own Preservation**: تأكيد أن المعلم يرى سجلاته الخاصة قبل وبعد الإصلاح
2. **Data Integrity Check**: التحقق من عدد صفوف `teacher_attendance` يبقى ثابتاً بعد تطبيق migration الإصلاح
3. **Other Tables Unaffected**: التحقق من أن policies `complaints`, `fees`, `profiles` تعمل بنفس الطريقة
4. **Indexes Preservation**: التحقق من بقاء `idx_teacher_attendance_school/teacher/date` موجودة

---

### Unit Tests

- اختبار وجود `profiles.role` في نص الـ policy القديمة (استعلام `pg_policies`)
- اختبار غياب `profiles.role` في نص الـ policy الجديدة بعد الإصلاح
- اختبار وجود `user_roles.user_id` في نص الـ policy الجديدة
- اختبار أن عدد الـ policies على `teacher_attendance` يبقى 2 بعد الإصلاح

### Property-Based Tests

- توليد UUIDs عشوائية لـ admin users والتحقق من نجاح العمليات عليهم جميعاً
- توليد حالات حضور عشوائية (`present`, `absent`, `late`, `excused`) والتحقق من الإدراج
- التحقق من أن teacher غير admin لا يستطيع INSERT أو UPDATE أو DELETE بعد الإصلاح (preservation of security)

### Integration Tests

- تدفق كامل: admin يُنشئ سجل حضور ← يُعدّله ← يحذفه
- تدفق كامل: معلم يرى سجله الخاص فقط (لا يرى سجلات الآخرين)
- تدفق تبديل السياق: admin يتحول لـ teacher والعكس والتحقق من الصلاحيات
- التحقق من أن migration الإصلاح idempotent (يمكن تطبيقه مرتين بأمان بسبب `DROP POLICY IF EXISTS`)
