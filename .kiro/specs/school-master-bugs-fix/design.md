# School Master Bugs Fix — Bugfix Design

## Overview

يغطي هذا المستند تصميم إصلاح أربع مشاكل مستقلة في مشروع school-master:

1. **تضارب Timestamps في Migrations** — ملفا migration يحملان نفس الـ timestamp `20260913000000`، يمنعان `supabase db push` من الاكتمال.
2. **ثغرة client-side Exam Scoring** — كود fallback في `useSubmitExamAttempt` يكشف `correct_answer` لكل أسئلة الاختبار في ذاكرة المتصفح قبل إرسال الإجابات.
3. **Unicode مكسور في AuthContext** — أربعة نصوص log تحتوي `â€"` بدلاً من em dash `—` بسبب خطأ في encoding الملف.
4. **متغير `schoolFilter` غير مستخدم في useStats** — المتغير مُعرَّف في `fetchStatsFallback` لكن غير مستخدم في أي query.

استراتيجية الإصلاح: تغييرات جراحية دقيقة — إعادة تسمية ملف، حذف كود fallback، تصحيح 4 نصوص، وحذف سطر واحد. لا يُمس أي منطق تشغيلي آخر.

---

## Glossary

- **Bug_Condition (C)**: الشرط الذي يُشغِّل الخطأ — مدخل معين يتسبب في سلوك مغلوط
- **Property (P)**: السلوك المطلوب عند تحقق Bug_Condition — ما يجب أن يحدث بعد الإصلاح
- **Preservation**: السلوك الموجود الذي يجب ألا يتأثر بالإصلاح
- **submit_exam_attempt RPC**: دالة Supabase RPC مسؤولة عن تصحيح الاختبار وحفظ النتيجة على السيرفر بشكل آمن
- **JWT expiry**: انتهاء صلاحية رمز المصادقة، يتطلب تجديد session قبل إعادة المحاولة
- **em dash (`—`)**: علامة الشَّرطة الطويلة في Unicode (U+2014)، ظهرت مشوهة `â€"` بسبب خطأ UTF-8 encoding
- **schoolFilter**: متغير وسيط في `fetchStatsFallback` كان يُفترض أن يحمل قيمة شرط الفلترة لكنه لم يُستخدم قط
- **useSubmitExamAttempt**: mutation hook في `src/hooks/queries/useElectronicExams.ts` يُرسل إجابات الطالب
- **fetchStatsFallback**: دالة مساعدة في `src/hooks/queries/useStats.ts` تُستدعى عند فشل الـ RPC الرئيسي

---

## Bug Details

### Bug 1 — تضارب Timestamps في Migrations

#### Bug Condition

التضارب يحدث لأن ملفَين مختلفَين يحملان نفس الـ timestamp في اسميهما:
- `supabase/migrations/20260913000000_fix_critical_issues.sql`
- `supabase/migrations/20260913000000_add_grades_upsert_unique_constraint.sql`

**Formal Specification:**
```
FUNCTION isBugCondition_1(migrationFiles)
  INPUT: migrationFiles — قائمة أسماء ملفات الـ migrations
  OUTPUT: boolean

  FOR EACH file IN migrationFiles DO
    timestamp := extractTimestamp(file)  -- أول 14 رقماً من اسم الملف
    IF count(files WHERE extractTimestamp(f) = timestamp) > 1 THEN
      RETURN true
    END IF
  END FOR
  RETURN false
END FUNCTION
```

#### Examples

- **مثال حالي (بعد الإصلاح غير موجود)**: تشغيل `supabase db push` → يفشل بخطأ timestamp conflict
- **الحالة المطلوبة**: إعادة تسمية الملف الثاني لـ `20260913000100_add_grades_upsert_unique_constraint.sql` → `supabase db push` ينجح

**ملاحظة**: الـ timestamp المقترح `20260913000100` آمن لأن الملف التالي الموجود هو `20260913000001_fix_pg_net_push_notifications.sql`، ولن تحدث مشكلة ordering لأن الملفين (`000001` و`000100`) مختلفان. لكن لضمان الترتيب المنطقي الصحيح (الـ fix_critical_issues يسبق add_grades_upsert)، سنستخدم `20260913000100` بدلاً من `20260913000001` لتجنب التضارب مع الملف الموجود.

---

### Bug 2 — Client-side Exam Scoring (ثغرة أمنية)

#### Bug Condition

الثغرة تحدث عند فشل RPC `submit_exam_attempt` لأي سبب غير JWT expiry:

**Formal Specification:**
```
FUNCTION isBugCondition_2(rpcError, rpcResult)
  INPUT: rpcError — خطأ عائد من RPC
         rpcResult — بيانات عائدة من RPC
  OUTPUT: boolean

  -- الخطأ موجود
  IF rpcError IS NOT NULL THEN
    -- وليس خطأ JWT (اللي يتم معالجته بـ retry)
    isJwtError := rpcError.message CONTAINS 'JWT'
                  OR rpcError.message CONTAINS 'expired'
                  OR rpcError.message CONTAINS 'token'
                  OR rpcError.code = 'PGRST301'
                  OR rpcError.status = 401
    IF NOT isJwtError THEN
      RETURN true  -- سيتم تفعيل الـ fallback الخطير
    END IF
  END IF

  -- أو الـ RPC نجح لكن لم يُعِد بيانات
  IF rpcError IS NULL AND rpcResult IS NULL THEN
    RETURN true
  END IF

  RETURN false
END FUNCTION
```

**التأثير**: عند `isBugCondition_2 = true`، يدخل الكود الـ fallback الذي:
1. يقرأ `q.correct_answer` من الـ `questions` parameter المُرسَل للـ mutation
2. يحسب الدرجة محلياً في المتصفح
3. يكتب النتيجة مباشرة في قاعدة البيانات عبر `.upsert`

وبما أن `questions` يتضمن `correct_answer` لكل سؤال قبل إرسال الإجابات (لعرض الأسئلة في واجهة الاختبار)، فإن الطالب يمكنه رؤية الإجابات الصحيحة في DevTools → Network أو Memory قبل الإرسال.

#### Examples

- **مثال تشغيل الثغرة**: يفشل `submit_exam_attempt` بخطأ "RPC function not found" → يُحسب score في المتصفح بقراءة `correct_answer` → الطالب يفتح DevTools ويرى الإجابات
- **الحالة المطلوبة**: أي فشل في الـ RPC غير JWT يرمي خطأ `'فشل إرسال الاختبار — يرجى المحاولة مرة أخرى'` مباشرة دون لمس `correct_answer`

---

### Bug 3 — Unicode مكسور في AuthContext

#### Bug Condition

أربعة نصوص في `src/contexts/AuthContext.tsx` تحتوي على تسلسل bytes يُقرأ بـ encoding خاطئ:

**Formal Specification:**
```
FUNCTION isBugCondition_3(logMessage)
  INPUT: logMessage — نص رسالة الـ log
  OUTPUT: boolean

  RETURN logMessage CONTAINS 'â€"'
END FUNCTION
```

**السطور المتأثرة في الملف** (بالنص الحالي المكسور):
1. `'[Auth] Skipping background RPC â€" no valid access token'` — دالة `applySession`
2. `'[Auth] Background RPC skipped â€" already loading for this user'` — دالة `applySession`
3. `'[Auth] Background RPC skipped â€" JWT complete + recently synced'` — دالة `applySession`
4. `'[Auth] SIGNED_OUT ignored â€" active session exists (token rotation)'` — داخل `onAuthStateChange`

**السبب الجذري**: تسلسل `â€"` هو ناتج قراءة bytes الـ UTF-8 لـ em dash (`—` = `0xE2 0x80 0x94`) بـ encoding Latin-1، مما يعطي `â` + `€` + `"` (أو ما يُشبهه). الملف نفسه قد يكون محفوظاً بـ UTF-8 بشكل صحيح لكن النص أُدخل بـ encoding خاطئ.

#### Examples

- **الحالة الحالية**: `logger.warn('[Auth] Skipping background RPC â€" no valid access token')`
- **الحالة المطلوبة**: `logger.warn('[Auth] Skipping background RPC — no valid access token')`

---

### Bug 4 — متغير `schoolFilter` غير مستخدم

#### Bug Condition

المتغير مُعرَّف لكنه لا يُستخدم:

**Formal Specification:**
```
FUNCTION isBugCondition_4(sourceCode)
  INPUT: sourceCode — محتوى fetchStatsFallback
  OUTPUT: boolean

  RETURN sourceCode CONTAINS 'const schoolFilter ='
         AND NOT (schoolFilter USED IN ANY QUERY AFTER DECLARATION)
END FUNCTION
```

**السطر المتأثر في `src/hooks/queries/useStats.ts`**:
```typescript
const schoolFilter = !user?.isSuperAdmin && user?.schoolId;
```

جميع الـ queries السبع بعده تستخدم `.eq('school_id', user.schoolId)` مباشرة، لا `schoolFilter`.

**التأثير**: تحذير TypeScript/ESLint وتشويش في قراءة الكود — يوحي بأن منطق تصفية superAdmin مُطبَّق لكنه غير موجود فعلياً.

---

## Expected Behavior

### Preservation Requirements

**الثابت عبر جميع الإصلاحات الأربعة:**

**Bug 1 — محتوى ملفات الـ migration لا يُمس:**
- SQL الموجود في الملفَين يبقى كما هو حرفاً بحرف
- الـ migrations التي طُبِّقت مسبقاً لا تُعاد ولا تُحذف
- البيانات الموجودة في قاعدة البيانات لا تتأثر

**Bug 2 — مسار النجاح الكامل يبقى كما هو:**
- عند نجاح الـ RPC: يُعاد `{ score, totalScore, questions: scoredQs, answers }` كما هو
- منطق JWT retry (الخطوة 3 في الكود) يبقى بالكامل دون أي تعديل
- الـ proactive session refresh (الخطوة 1) يبقى بالكامل
- `onSuccess` و `onError` callbacks يبقيان كما هما

**Bug 3 — وظيفة AuthContext لا تتغير:**
- جميع الـ logger calls المتأثرة تُصدر نفس الرسائل لكن بـ encoding صحيح
- لا يتغير أي منطق تشغيلي في الدالة `applySession` أو `onAuthStateChange`

**Bug 4 — إحصاءات لوحة التحكم لا تتغير:**
- `fetchStatsFallback` تُعيد نفس النتائج تماماً بعد حذف السطر
- جميع الـ queries تستمر تستخدم `user.schoolId` مباشرة كما هي الآن

**Scope:**
الإصلاحات الأربعة محاطة بسياج واضح — لا يوجد أي تغيير في منطق business أو تجربة المستخدم خارج حدود كل إصلاح.

---

## Hypothesized Root Cause

### Bug 1 — تضارب Timestamps
- **السبب الوحيد**: إنشاء ملفَي migration في نفس اللحظة (أو بشكل manual بنفس الـ timestamp) دون فحص التضارب

### Bug 2 — Client-side Fallback Scoring
1. **تصميم قديم**: الـ fallback كُتب في مرحلة تطوير مبكرة قبل أن يكون الـ RPC جاهزاً، كحل مؤقت
2. **عدم مراجعة الأمان**: الكود المؤقت بقي في الإنتاج دون مراجعة أمنية تُلاحظ أن `questions` تحمل `correct_answer`
3. **الـ RPC صار جاهزاً**: بعد نشر `submit_exam_attempt` على السيرفر، الـ fallback أصبح زائداً وخطيراً

### Bug 3 — Unicode مكسور
1. **نسخ النص من مصدر بـ encoding مختلف**: الأرجح أن نصوص em dash نُسخت من محرر أو أداة استخدمت Latin-1 عند اللصق
2. **أو**: الملف حُفظ مرة بـ encoding خاطئ ثم أُعيد حفظه بـ UTF-8 لكن النصوص المكسورة بقيت

### Bug 4 — متغير غير مستخدم
1. **بقايا refactoring**: الـ `schoolFilter` كان مستخدماً في نسخة سابقة من الـ queries
2. **تغيير في المنطق**: الـ queries تحولت لاستخدام `user.schoolId` مباشرة لكن تعريف المتغير نُسي

---

## Correctness Properties

Property 1: Bug Condition — Migration Timestamp Uniqueness

_For any_ مجموعة ملفات migration في المشروع، يجب أن يكون لكل ملف timestamp فريد في اسمه بحيث تُقبل جميع الملفات بنجاح عند تشغيل `supabase db push` دون أي خطأ تضارب في الأسماء.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Secure Server-side Exam Scoring

_For any_ حالة فشل لـ RPC `submit_exam_attempt` غير مرتبطة بـ JWT expiry، يجب أن تُرمى استثناء واضح `'فشل إرسال الاختبار — يرجى المحاولة مرة أخرى'` دون الوصول إلى `correct_answer` في أي قيمة `questions` أو كتابة أي بيانات في جدول `exam_attempts` عبر client.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition — Correct Unicode in Auth Logs

_For any_ استدعاء لدوال logging في `AuthContext.tsx`، يجب أن تُصدر النصوص الأربعة المتأثرة em dash صحيحاً (`—`) لا التسلسل المكسور (`â€"`).

**Validates: Requirements 2.6**

Property 4: Bug Condition — No Unused Variables in useStats

_For any_ تجميع لـ `src/hooks/queries/useStats.ts`، يجب ألا يحتوي الكود على المتغير `schoolFilter` المعرَّف وغير المستخدم في `fetchStatsFallback`.

**Validates: Requirements 2.7**

Property 5: Preservation — Successful RPC Path Unchanged

_For any_ استدعاء لـ `useSubmitExamAttempt` ينتهي بنجاح الـ RPC (يُعيد `rpcResult` بدون `rpcError`)، يجب أن تُعاد قيمة `{ score, totalScore, questions, answers }` المُبنية من بيانات السيرفر بالضبط كما كانت قبل الإصلاح.

**Validates: Requirements 3.3, 3.4**

Property 6: Preservation — fetchStatsFallback Results Unchanged

_For any_ استدعاء لـ `fetchStatsFallback` بأي `user` object، يجب أن يُعيد نفس الإحصاءات السبع (`students, teachers, parents, classes, totalDue, totalPaid, attendanceRate`) المبنية على `user.schoolId` كما كانت قبل حذف `schoolFilter`.

**Validates: Requirements 3.6**

---

## Fix Implementation

### Bug 1 — إعادة تسمية ملف Migration

**الملف الحالي**: `supabase/migrations/20260913000000_add_grades_upsert_unique_constraint.sql`

**الملف الجديد**: `supabase/migrations/20260913000100_add_grades_upsert_unique_constraint.sql`

**التغييرات المطلوبة**:
1. **إعادة تسمية الملف فقط** — اسم الملف يتغير من `...000000_add_grades...` إلى `...000100_add_grades...`
2. **لا تعديل في المحتوى** — SQL الموجود في الملف يبقى كما هو حرفاً بحرف

**ملاحظة الـ ordering**: الملف `20260913000001_fix_pg_net_push_notifications.sql` موجود. الـ timestamp الجديد `000100` يأتي بعده بمسافة آمنة ولا يتعارض مع أي ملف موجود. الترتيب المنطقي سيكون:
- `20260913000000_fix_critical_issues.sql`
- `20260913000001_fix_pg_net_push_notifications.sql`
- `20260913000100_add_grades_upsert_unique_constraint.sql`

---

### Bug 2 — حذف Client-side Fallback Scoring

**الملف**: `src/hooks/queries/useElectronicExams.ts`

**الدالة**: `useSubmitExamAttempt` (داخل `mutationFn`)

**موقع الكود المحذوف**: بعد الـ `if (!rpcError && rpcResult)` block مباشرة (من السطر الأول لـ `// Fallback: direct UPSERT...` حتى نهاية الـ `return { score, totalScore, questions, answers }`)

**الكود المحذوف** (كامل كود الـ fallback):
```typescript
// Fallback: direct UPSERT in database if RPC not deployed
logger.warn('[Exam] RPC not available or failed, falling back to direct upsert:', rpcError?.message);
let score = 0;
const totalScore = questions.length;
questions.forEach(q => {
  const given = (answers[q.id] || '').trim().toLowerCase();
  const correct = (q.correct_answer || '').trim().toLowerCase();
  if (given && correct && given === correct) score++;
});

let upsertRes = await db
  .from('exam_attempts')
  .upsert(
    {
      exam_id:              examId,
      student_id:           studentId,
      parent_id:            user.id,
      answers,
      score,
      total_score:          totalScore,
      time_spent_seconds:   timeSpentSeconds,
      tab_switches_count:   tabSwitchesCount,
      completed_at:         new Date().toISOString(),
    },
    { onConflict: 'exam_id,student_id' }
  )
  .select()
  .single();

// Retry direct upsert on JWT expired as well
if (
  upsertRes.error &&
  (upsertRes.error.message?.includes('JWT') ||
   upsertRes.error.message?.includes('expired') ||
   upsertRes.error.code === 'PGRST301')
) {
  await supabase.auth.refreshSession();
  upsertRes = await db
    .from('exam_attempts')
    .upsert(
      {
        exam_id:              examId,
        student_id:           studentId,
        parent_id:            user.id,
        answers,
        score,
        total_score:          totalScore,
        time_spent_seconds:   timeSpentSeconds,
        tab_switches_count:   tabSwitchesCount,
        completed_at:         new Date().toISOString(),
      },
      { onConflict: 'exam_id,student_id' }
    )
    .select()
    .single();
}

if (upsertRes.error) throw upsertRes.error;
return { score, totalScore, questions, answers };
```

**الكود البديل** (يحل محل كل ما سبق):
```typescript
// RPC failed — throw a user-friendly error. Never fall back to client-side scoring.
logger.error('[Exam] submit_exam_attempt RPC failed:', rpcError?.message);
throw new Error('فشل إرسال الاختبار — يرجى المحاولة مرة أخرى');
```

**ملاحظة**: الـ `questions` parameter يبقى في signature الدالة كما هو لأنه قد يُستخدم في أماكن أخرى (مثل العرض)، لكنه لن يُستخدم بعد الآن للتصحيح.

---

### Bug 3 — تصحيح Unicode في AuthContext

**الملف**: `src/contexts/AuthContext.tsx`

**التغييرات**: استبدال `â€"` بـ `—` في 4 سطور:

| السطر الحالي | السطر بعد الإصلاح |
|---|---|
| `logger.warn('[Auth] Skipping background RPC â€" no valid access token');` | `logger.warn('[Auth] Skipping background RPC — no valid access token');` |
| `logger.log('[Auth] Background RPC skipped â€" already loading for this user');` | `logger.log('[Auth] Background RPC skipped — already loading for this user');` |
| `logger.log('[Auth] Background RPC skipped â€" JWT complete + recently synced');` | `logger.log('[Auth] Background RPC skipped — JWT complete + recently synced');` |
| `logger.log('[Auth] SIGNED_OUT ignored â€" active session exists (token rotation)');` | `logger.log('[Auth] SIGNED_OUT ignored — active session exists (token rotation)');` |

**ملاحظة**: في الكود الفعلي السطر الأول يستخدم `logger.warn` والثاني والثالث يستخدمان `logger.log` والرابع داخل `onAuthStateChange` يستخدم `logger.log` — كل منهم يبقى بنفس مستوى الـ log، فقط النص يُصحَّح.

---

### Bug 4 — حذف `schoolFilter` غير المستخدم

**الملف**: `src/hooks/queries/useStats.ts`

**الدالة**: `fetchStatsFallback`

**السطر المحذوف**:
```typescript
const schoolFilter = !user?.isSuperAdmin && user?.schoolId;
```

لا يوجد أي تعديل آخر في الدالة — جميع الـ queries تبقى تستخدم `user.schoolId` مباشرة كما هي الآن.

---

## Testing Strategy

### Validation Approach

تتبع استراتيجية الاختبار نهجاً من مرحلتين:
1. **Exploratory**: التحقق من وجود المشكلة على الكود الحالي (قبل الإصلاح) لتأكيد التشخيص
2. **Fix + Preservation Checking**: التحقق من صحة الإصلاح وعدم تأثيره على السلوك الصحيح

---

### Exploratory Bug Condition Checking

**الهدف**: التأكد من وجود كل مشكلة قبل تطبيق الإصلاح.

**Bug 1 — Migration Conflict**:
- تشغيل `supabase db push --dry-run` على بيئة جديدة → يُتوقع ظهور خطأ تضارب timestamp

**Bug 2 — Client-side Scoring**:
- عزل كود الـ fallback في test وتشغيله مع `questions` تحتوي `correct_answer`
- التحقق من أن `correct_answer` يُقرأ في المتصفح خلال الـ fallback path

**Bug 3 — Unicode**:
- فتح الملف وعرض النصوص الأربعة → يُرى `â€"` بدلاً من `—`

**Bug 4 — Unused Variable**:
- تشغيل ESLint أو TypeScript compiler → يُتوقع تحذير `no-unused-vars` على `schoolFilter`

**Expected Counterexamples**:
- `supabase db push` يفشل بـ "duplicate migration name"
- الـ fallback code يصل لـ `q.correct_answer` بشكل موثَّق في tests
- النصوص المكسورة تظهر صريحةً في logs أو في الملف
- ESLint يُبلِّغ عن `schoolFilter`

---

### Fix Checking

**الهدف**: التحقق من أن الإصلاح يُزيل كل حالة Bug_Condition.

**Pseudocode عام:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedCode(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Bug 1**:
```
AFTER RENAME:
  migrationFiles := listMigrationFiles()
  timestamps := extractAllTimestamps(migrationFiles)
  ASSERT length(timestamps) = length(unique(timestamps))  -- لا تضارب
```

**Bug 2**:
```
GIVEN rpcError IS NOT NULL AND NOT isJwtError(rpcError)
WHEN  useSubmitExamAttempt({ examId, studentId, answers, questions })
THEN  throws Error('فشل إرسال الاختبار — يرجى المحاولة مرة أخرى')
AND   correct_answer NOT accessed during execution
AND   NO write to exam_attempts table
```

**Bug 3**:
```
FOR EACH logMessage IN affectedMessages DO
  ASSERT logMessage CONTAINS '—'
  ASSERT NOT (logMessage CONTAINS 'â€"')
END FOR
```

**Bug 4**:
```
sourceCode := readFile('src/hooks/queries/useStats.ts')
ASSERT NOT (sourceCode CONTAINS 'const schoolFilter =')
```

---

### Preservation Checking

**الهدف**: التحقق من أن السلوك الصحيح الموجود لم يتغير.

**Pseudocode عام:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalCode(input) = fixedCode(input)
END FOR
```

**Bug 2 — RPC Success Path:**
```
GIVEN rpcError IS NULL AND rpcResult IS { score: 8, total_score: 10, questions: [...] }
WHEN  useSubmitExamAttempt(...)
THEN  returns { score: 8, totalScore: 10, questions: scoredQs, answers }
```

**Bug 2 — JWT Retry Path:**
```
GIVEN first RPC fails with JWT error (status 401)
WHEN  session refresh succeeds
THEN  RPC retried once
AND   fallback client-side scoring NOT triggered
```

**Bug 4 — fetchStatsFallback results:**
```
GIVEN user = { schoolId: 'school-123', isSuperAdmin: false }
WHEN  fetchStatsFallback(user) called
THEN  all 7 queries use .eq('school_id', 'school-123') directly
AND   return value is identical to pre-fix behavior
```

**Testing Approach**: Property-based testing مناسب لـ Bug 2 لأنه يتحقق من:
- كل أنواع أخطاء الـ RPC (network, permission, not found, etc.) تُعامَل كـ non-JWT errors وترمي الخطأ الصحيح
- كل أنواع أخطاء JWT تُشغِّل الـ retry path وليس الـ fallback

---

### Unit Tests

**Bug 1**:
- اختبار أن قائمة ملفات الـ migrations لا تحتوي على timestamps مكررة بعد إعادة التسمية
- اختبار أن محتوى ملف `20260913000100_add_grades_upsert_unique_constraint.sql` لم يتغير

**Bug 2**:
- اختبار `mutationFn` مع RPC يُعيد خطأ "function not found" → يُتوقع رمي Error
- اختبار `mutationFn` مع RPC يُعيد خطأ "JWT expired" → يُتوقع retry ثم نجاح
- اختبار `mutationFn` مع RPC ناجح → يُتوقع إعادة بيانات السيرفر
- اختبار أن `correct_answer` لا يُقرأ خارج `if (!rpcError && rpcResult)` block

**Bug 3**:
- اختبار نصوص الـ log الأربعة أنها تحتوي `—` لا `â€"`

**Bug 4**:
- اختبار أن `fetchStatsFallback` لا تحتوي على `schoolFilter` في source code
- اختبار أن النتيجة المُعادة من `fetchStatsFallback` متطابقة مع النتيجة المتوقعة

---

### Property-Based Tests

- **Bug 2 — Non-JWT Errors**: توليد أخطاء عشوائية (message, code, status) غير مرتبطة بـ JWT والتحقق من أن كلاً منها يرمي `'فشل إرسال الاختبار — يرجى المحاولة مرة أخرى'`
- **Bug 2 — JWT Errors**: توليد أخطاء بـ messages/codes مختلفة تشير لـ JWT والتحقق من تفعيل الـ retry path
- **Bug 4 — Preservation**: توليد `user` objects مختلفة (بـ schoolId مختلفة، isSuperAdmin مختلف) والتحقق من أن queries تستخدم `user.schoolId` مباشرة

---

### Integration Tests

- **Bug 1**: محاكاة `supabase db push` على بيئة test والتحقق من نجاحه بعد إعادة التسمية
- **Bug 2**: اختبار كامل لتدفق تقديم الاختبار مع فشل RPC → يُرى للطالب رسالة خطأ واضحة لا نتيجة خاطئة
- **Bug 2**: اختبار كامل لتدفق تقديم الاختبار مع نجاح RPC → تُعرض النتيجة الصحيحة من السيرفر
- **Bug 3**: اختبار الـ AuthContext في بيئة test والتحقق من logs الصادرة
