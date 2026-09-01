# ESLint Violations Fix — Bugfix Design

## Overview

يحتوي مشروع school-master على 42 انتهاكاً لـ ESLint موزعة على 14 ملفاً في ثلاث فئات:

1. **`no-empty`** (24 موقع): كتل `catch` خالية تماماً أو تحتوي فقط على `void err` بدون تعليق، مما يجعل ESLint يرفضها.
2. **`react-hooks/exhaustive-deps`** (17 موقع): `useEffect`/`useCallback`/`useMemo` تستخدم قيماً من النطاق الخارجي دون إدراجها في مصفوفة التبعيات.
3. **`prefer-const`** (1 موقع): متغير `profilesMap` مُعرَّف بـ `let` رغم أنه لا يُعاد تعيينه.

الإصلاح مُصمَّم ليكون **صفري التأثير على السلوك الوظيفي**: لا تغيير في منطق التطبيق، فقط تصحيح القواعد الشكلية بأمان كامل.

---

## Glossary

- **Bug_Condition (C)**: الحالة التي تُخفق فيها قاعدة ESLint — أي: الكود الذي يُولّد تحذيراً أو خطأ من Linter.
- **Property (P)**: السلوك المطلوب بعد الإصلاح — كود يجتاز ESLint بدون أي انتهاكات.
- **Preservation**: السلوك الوظيفي للتطبيق الذي يجب أن يبقى مطابقاً للحالة الأصلية تماماً.
- **`no-empty`**: قاعدة ESLint تمنع كتل `catch` فارغة بدون محتوى أو تعليق توضيحي.
- **`react-hooks/exhaustive-deps`**: قاعدة ESLint تفرض إدراج جميع القيم المستخدمة داخل hooks في مصفوفة تبعياتها.
- **`prefer-const`**: قاعدة ESLint تفرض استخدام `const` للمتغيرات التي لا تُعاد إسناد قيمتها.
- **stale closure**: مشكلة React شائعة تحدث عندما يحتفظ `useEffect` بمرجع قديم لقيمة متغيرة.
- **stable reference**: قيمة لا يتغير مرجعها بين إعادات الرسم (كـ `setState` من `useState`).

---

## Bug Details

### Bug Condition

تنتشر الانتهاكات عبر ثلاث فئات متمايزة، لكنها تشترك في الصفة الجوهرية: **وجود كود يُخفق في تحقيق معايير ESLint المُهيَّأة** دون أن يؤثر ذلك بالضرورة على وظيفة التطبيق.

**الفئة الأولى — `no-empty`:**

الكود يحتوي على كتل `catch` يُعدّها ESLint فارغة. وهذا ينطبق على حالتين:
- `catch (_) {}` — فارغة تماماً بدون أي محتوى.
- `catch (err: unknown) { void err; }` — `void err` ليس تعليقاً وليس كوداً مفيداً، فيُفسِّرها ESLint كـ "no-op" بدون قصد واضح.

الإصلاح الآمن: إضافة **تعليق توضيحي** داخل الكتلة (`// intentional — ...`) ليدل على أن الكاتب قصد تجاهل الخطأ.

**الفئة الثانية — `react-hooks/exhaustive-deps`:**

`useEffect`/`useCallback`/`useMemo` تستخدم قيماً من النطاق الخارجي (`navigate`, `markRead`, `queryClient`, `setCustomOrder`, إلخ) دون إدراجها في مصفوفة التبعيات، مما يُسبّب stale closures محتملة أو تحذيرات Linter.

الإصلاح حسب نوع القيمة:
- **Stable references** (`setState`, `dispatch`, `queryClient`): إضافتها للمصفوفة آمنة — لن تُعيد تشغيل الـ effect.
- **Mutation objects** (`markRead.mutate`): يجب استخدام `.mutate` المستخرجة بشكل ثابت أو الاعتماد على التعليق `eslint-disable-next-line` مع مبرر واضح.
- **قيم `queryKey` المُعرَّفة خارج الـ effect**: إدراجها بعد التحقق من أنها مستقرة.
- **حالات الـ `// eslint-disable-next-line` المقصودة**: بعض الـ effects مُصمَّمة لتعمل مرة واحدة أو على تغيير قيمة محددة فقط — الإصلاح هنا بإعادة هيكلة التبعيات أو إبقاء تعليق الـ disable مع توثيق واضح للسبب.

**الفئة الثالثة — `prefer-const`:**

في `useParents.ts` داخل دالة `usePendingParents`، يُعرَّف `profilesMap` بـ `let` رغم أن قيمته لا تتغير بعد الإسناد الأولي. الإصلاح: تغيير `let` إلى `const`.

**Formal Specification:**

```
FUNCTION isBugCondition(codeLocation)
  INPUT: codeLocation — موقع في الكود (ملف + سطر)
  OUTPUT: boolean

  IF codeLocation.hasEmptyCatchBlock()
     AND NOT codeLocation.catchBlock.hasExplanatoryComment()
  THEN RETURN true  -- no-empty violation

  IF codeLocation.isHookCallback()
     AND codeLocation.usesExternalValues()
     AND NOT codeLocation.depsArray.includesAllExternalValues()
     AND NOT codeLocation.hasSuppressComment()
  THEN RETURN true  -- exhaustive-deps violation

  IF codeLocation.declaresVariable('let')
     AND NOT codeLocation.variableIsReassigned()
  THEN RETURN true  -- prefer-const violation

  RETURN false
END FUNCTION
```

### Examples

**no-empty violations:**

| الملف | السطر | الكود الحالي | المشكلة |
|-------|-------|-------------|---------|
| `ExamTakingView.tsx` | 120 | `catch { // sessionStorage unavailable or corrupted — start fresh }` | هذا تعليق ولكن يحتاج مراجعة — بعض المواضع `catch (_) {}` |
| `ExamTakingView.tsx` | 135, 152, 175, 222, 280, 285 | `catch { // sessionStorage unavailable — non-critical }` | بعض المواضع بدون تعليق |
| `supabase/client.ts` | 80, 104 | `catch { /* response body unreadable */ }` | تعليق `/* */` قد لا يكفي في بعض الإعدادات |
| `CreateExamWizard.tsx` | 132 | `catch (_) { setIsPublishing(false); }` | غير فارغة لكن `_` بدون تعليق في سياقات أخرى |
| `CreateExamWizard.tsx` | 197 | `catch (_) {}` | فارغة تماماً |
| `ElectronicExamsView.tsx` | 43 | `catch (err: unknown) { void err; }` | `void err` لا يُعدّ تعليقاً |
| `AdminClassChatRoomPage.tsx` | 50 | `catch (err: unknown) { void err; }` | نفس المشكلة |
| `AdminConversationsPage.tsx` | 416 | `catch (err: unknown) { void err; }` | نفس المشكلة |
| `AdminConversationDetailPage.tsx` | 146 | `catch (err: unknown) { void err; }` | نفس المشكلة |
| `ClassChatRoomPage.tsx` | 100 | `catch (err: unknown) { void err; }` | نفس المشكلة |
| `ParentConversationsPage.tsx` | 156, 342 | `catch (err: unknown) { void err; }` | نفس المشكلة |
| `StudentsPage.tsx` | 458 | `catch (err: unknown) { void err; }` | نفس المشكلة |
| `useStudents.ts` | 313 | `catch { // audit log is non-critical }` | قد يكون هذا صحيحاً بالفعل — يحتاج تحقق |

**exhaustive-deps violations (أمثلة مختارة):**

| الملف | السطر | التبعية الناقصة | الخطر |
|-------|-------|----------------|-------|
| `GlobalAnnouncement.tsx` | 156 | `senderProfiles` | الـ effect يبني queue باستخدام `senderProfiles` لكن لا يتفاعل مع تغيّره |
| `QueryStateHandler.tsx` | 66 | `error` | الـ watchdog لا يُعيد الحساب عند تغيير `error` |
| `ClassChatRoomPage.tsx` | 80, 85 | `navigate`, `markRead.mutate` | stale closure محتملة |
| `AdminConversationDetailPage.tsx` | 129, 135 | `queryClient`, `markRead.mutate` | stale closure محتملة |
| `useClassChat.ts` | 57, 136, 209, 304 | `queryKey` | الـ subscription تستخدم queryKey قديمة |
| `ClassExamsView.tsx` | 162, 177 | `setCustomOrder` | stable ref — آمن للإضافة |

**prefer-const violation:**

| الملف | السطر | الكود الحالي | الإصلاح |
|-------|-------|-------------|---------|
| `useParents.ts` | 174 | `let profilesMap = new Map<string, any>();` | `const profilesMap = new Map<string, any>();` |

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- كل عمليات `sessionStorage` في `ExamTakingView.tsx` يجب أن تستمر في الامتصاص الصامت للأخطاء دون تعطيل تجربة الاختبار.
- كل mutations من نوع toast-on-error (مثل إرسال الرسائل، حفظ الأسئلة، فتح الغرف) يجب أن تستمر في إظهار الـ toast عبر `onError` الخاص بكل mutation دون تغيير.
- سلوك إعادة تسجيل الـ realtime subscriptions في hooks (`useClassChat.ts`, `useConversations.ts`, `useElectronicExams.ts`) يجب أن يبقى مقيداً بتغيير القيم الفعلية (`schoolId`, `userId`, `roomId`).
- سلوك تعليم الرسائل كمقروءة في `ClassChatRoomPage.tsx` و`AdminConversationDetailPage.tsx` يجب أن يستمر يعمل عند فتح الصفحة بنفس الطريقة الحالية.
- إدارة الترتيب المخصص في `ClassExamsView.tsx` (`customOrder`) يجب أن تستمر في العمل بنفس الطريقة.
- بناء `profilesMap` في `useParents.ts` يجب أن يُنتج نفس النتائج بعد تغيير `let` إلى `const`.

**Scope:**

جميع التغييرات هي **إضافة تعليقات توضيحية** في كتل catch، **إضافة قيم للمصفوفات** التي هي stable references، أو **تغيير `let` إلى `const`**. لا يوجد تغيير في المنطق الوظيفي أو ترتيب تنفيذ الكود.

---

## Hypothesized Root Cause

### 1. كتل catch الفارغة (no-empty)

**السبب**: المطوّرون استخدموا أنماطاً مختلفة لتجاهل الأخطاء غير الحرجة:
- `catch (_) {}` — نمط شائع لكنه يُخفق في `no-empty`.
- `catch (err: unknown) { void err; }` — يُخفق أيضاً لأن `void expr` ليس تعليقاً بل expression statement فارغ الأثر.
- `catch { /* comment */ }` — هذا النمط الصحيح الذي يقبله ESLint، لكنه لم يُطبَّق بشكل متسق.

**الحل الصحيح**: جميع كتل catch المقصود تجاهلها يجب أن تحتوي على تعليق `//` توضيحي داخلها.

### 2. تبعيات hooks الناقصة (react-hooks/exhaustive-deps)

**السبب**: وجود `// eslint-disable-next-line react-hooks/exhaustive-deps` في أماكن كثيرة كحل مؤقت، بدلاً من الإصلاح الحقيقي. هذا النهج أدى إلى:
- عدم إدراج قيم stable مثل `setState` functions (آمن تماماً للإضافة).
- عدم إدراج `queryKey` المُعرَّفة خارج الـ effect (يحتاج تحقق من الاستقرار).
- عدم إدراج `navigate` من `react-router` (stable reference).
- عدم إدراج `.mutate` من TanStack Query (قد يتغير مرجعه — يحتاج معالجة خاصة).

### 3. prefer-const

**السبب**: `let profilesMap = new Map()` لم تُعاد إسنادها، تُبنى بـ `.set()` فقط — والـ `.set()` لا يُعدّ إعادة إسناد للمتغير. كان يجب استخدام `const` منذ البداية.

---

## Correctness Properties

Property 1: Bug Condition — ESLint Zero Violations

_For any_ code location where `isBugCondition` returns true (catch block without comment, hook with missing deps, or `let` that should be `const`), the fixed code SHALL produce zero ESLint violations for the rules `no-empty`, `react-hooks/exhaustive-deps`, and `prefer-const`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15**

Property 2: Preservation — Functional Behavior Unchanged

_For any_ runtime input where `isBugCondition` returns false (i.e., all actual application behavior), the fixed code SHALL produce exactly the same runtime behavior as the original code — including error handling, UI rendering, realtime subscriptions, state management, and data fetching.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

---

## Fix Implementation

### Changes Required

#### Category 1: `no-empty` — Add explanatory comments to empty catch blocks

**Pattern A** — `void err` كتل (الأكثر شيوعاً):

```typescript
// قبل:
catch (err: unknown) { void err; }

// بعد:
catch (err: unknown) {
  // intentional — error is shown via mutation onError toast
  void err;
}
```

**Pattern B** — كتل `catch (_) {}` الفارغة تماماً:

```typescript
// قبل:
catch (_) {}

// بعد:
catch (_) {
  // intentional — non-critical operation, failure is safe to ignore
}
```

**الملفات والأسطر:**

| الملف | الأسطر | النمط | التعليق المناسب |
|-------|-------|-------|----------------|
| `ExamTakingView.tsx` | 135, 152, 175, 222, 280, 285 | B | `// intentional — sessionStorage errors are non-fatal` |
| `supabase/client.ts` | 80, 104 | تعليق `/* */` → `//` | `// intentional — response body unreadable, skip auth failure detection` |
| `CreateExamWizard.tsx` | 197 | B | `// intentional — toast error already shown by mutation onError` |
| `ElectronicExamsView.tsx` | 43 | A | `// intentional — toast error already shown by mutation onError` |
| `AdminClassChatRoomPage.tsx` | 50 | A | `// intentional — toast error already shown by mutation onError` |
| `AdminConversationsPage.tsx` | 416 | A | `// intentional — toast error already shown by mutation onError` |
| `AdminConversationDetailPage.tsx` | 146 | A | `// intentional — toast error already shown by mutation onError` |
| `ClassChatRoomPage.tsx` | 100 | A | `// intentional — toast error already shown by mutation onError` |
| `ParentConversationsPage.tsx` | 156, 342 | A | `// intentional — toast error already shown by mutation onError` |
| `StudentsPage.tsx` | 458 | A | `// intentional — toast error already shown by mutation onError` |
| `useStudents.ts` | 313 | تحقق + تعليق | `// intentional — audit log is non-critical, ignore failures` |

> **ملاحظة:** `ExamTakingView.tsx` السطر 120 يحتوي بالفعل على تعليق داخله (`// sessionStorage unavailable or corrupted — start fresh`) — هذا صحيح ولا يحتاج تعديل.

---

#### Category 2: `react-hooks/exhaustive-deps` — Fix dependency arrays

**استراتيجية الإصلاح لكل نوع:**

**نوع 1 — Stable refs (setState, queryClient, dispatch):** إضافتها مباشرة — لن تُعيد تشغيل الـ effect:

```typescript
// مثال: GlobalAnnouncement.tsx
useEffect(() => {
  // ... uses senderProfiles
}, [unreadMessages, senderProfiles]); // أُضيف senderProfiles
```

**نوع 2 — navigate من react-router:** stable reference، آمن للإضافة:

```typescript
// ClassChatRoomPage.tsx
useEffect(() => {
  if (!roomId) { navigate('/conversations', { replace: true }); }
}, [roomId, navigate]); // أُضيف navigate
```

**نوع 3 — mutation objects (.mutate):** استخدام التبعية الصحيحة أو تعليق مبرَّر:

```typescript
// ClassChatRoomPage.tsx
useEffect(() => {
  if (resolvedRoomId) markRead.mutate(resolvedRoomId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [resolvedRoomId]); // markRead.mutate تتغير مرجعياً مع كل render — استخدام disable مع توثيق
```

**نوع 4 — queryKey في realtime hooks:** المصفوفة مُعرَّفة بالفعل كـ `const` خارج الـ effect — إضافتها مباشرة:

```typescript
// useClassChat.ts — useAdminClassChatRooms
useEffect(() => {
  // ... uses queryKey
  queryClient.invalidateQueries({ queryKey });
}, [user?.schoolId, queryClient, queryKey]); // أُضيف queryKey
```

**الملفات والأسطر:**

| الملف | الأسطر | التبعيات الناقصة | نوع الإصلاح |
|-------|-------|-----------------|------------|
| `GlobalAnnouncement.tsx` | 156 | `senderProfiles` | إضافة مباشرة (useMemo result — يُعاد حسابه عند تغيير profilesArray) |
| `QueryStateHandler.tsx` | 66 | `error` | إضافة مباشرة (prop قد يتغير) |
| `CreateExamWizard.tsx` | 101 | `existingQuestions` | إضافة `existingQuestions` بدل `.length` فقط — الـ effect يقرأ البيانات كاملة |
| `ClassExamsView.tsx` | 117 | `setCustomOrder` | stable ref من useSessionState — إضافة مباشرة |
| `ClassExamsView.tsx` | 162, 177 | `setCustomOrder` | stable ref — إضافة داخل useCallback |
| `ClassExamsView.tsx` | 188 | `setCustomOrder`, `studentGrades` | إضافة `studentGrades` |
| `ClassExamsView.tsx` | 194 | `studentGrades` | إضافة `studentGrades` |
| `GradesPage.tsx` | 81 | `setSelectedClassId` | stable ref — إضافة مباشرة |
| `GradesPage.tsx` | 99 | `setSelectedMonthFolder`, `monthFolderKeys` | إضافة مع التحقق من الأثر |
| `GradesPage.tsx` | 107 | deps expression | إصلاح التعبير المنطقي |
| `useClassChat.ts` | 57, 136, 209, 304 | `queryKey` | إضافة `queryKey` (مُعرَّفة كـ const خارج الـ effect) |
| `useConversations.ts` | 206 | `queryKey` | نفس النمط |
| `useElectronicExams.ts` | 382 | `queryKey` | نفس النمط |
| `ClassChatRoomPage.tsx` | 80 | `navigate` | إضافة مباشرة |
| `ClassChatRoomPage.tsx` | 85 | `markRead.mutate` | إبقاء disable مع توثيق |
| `AdminConversationDetailPage.tsx` | 129 | `queryClient`, `user?.id` | إضافة مباشرة |
| `AdminConversationDetailPage.tsx` | 135 | `markRead.mutate` | إبقاء disable مع توثيق |
| `ParentConversationsPage.tsx` | 138 | `markRead.mutate`, `conversation?.id` | إبقاء disable مع توثيق للـ mutate |
| `StudentDetailPage.tsx` | 54, 56 | تعابير منطقية | استخدام القيم المباشرة كتبعيات |
| `StudentsPage.tsx` | 442 | `student?.id`, etc. | إضافة التبعيات المحددة |

---

#### Category 3: `prefer-const`

**الملف:** `src/hooks/queries/useParents.ts`

**الدالة:** `usePendingParents`

```typescript
// قبل (سطر 174):
let profilesMap = new Map<string, any>();

// بعد:
const profilesMap = new Map<string, any>();
```

---

## Testing Strategy

### Validation Approach

الاستراتيجية ذات مرحلتين:
1. **Exploratory**: تشغيل ESLint على الكود الأصلي للتحقق من وجود الانتهاكات وتوثيق الأعداد الدقيقة.
2. **Fix Checking**: تطبيق التعديلات ثم إعادة تشغيل ESLint للتحقق من الوصول إلى صفر انتهاكات.
3. **Preservation**: بناء المشروع للتأكد من عدم وجود أخطاء TypeScript أو runtime errors مُحتملة.

### Exploratory Bug Condition Checking

**Goal**: التحقق من وجود الانتهاكات وتوثيق أعدادها الدقيقة قبل الإصلاح.

**Test Plan**: تشغيل `npx eslint src --ext .ts,.tsx --rule 'no-empty: error' --rule 'react-hooks/exhaustive-deps: error'` على الكود الأصلي.

**Test Cases:**
1. **no-empty scan**: فحص كل ملف من الـ 14 للتحقق من وجود كتل catch بدون تعليق (ستفشل على الكود الأصلي).
2. **exhaustive-deps scan**: فحص جميع الـ useEffect/useCallback/useMemo للتحقق من التبعيات الناقصة.
3. **prefer-const scan**: فحص `useParents.ts` للتحقق من `let profilesMap`.

**Expected Counterexamples:**
- `no-empty`: 24 كتلة catch بدون تعليق توضيحي كافٍ.
- `react-hooks/exhaustive-deps`: 17 hook مع تبعيات ناقصة.
- `prefer-const`: 1 متغير `let` يجب أن يكون `const`.

### Fix Checking

**Goal**: بعد تطبيق الإصلاحات، التحقق من وصول عدد انتهاكات ESLint إلى الصفر.

**Pseudocode:**
```
FOR ALL codeLocation WHERE isBugCondition(codeLocation) DO
  fixedCode := applyFix(codeLocation)
  eslintResult := runESLint(fixedCode)
  ASSERT eslintResult.violations == 0
END FOR
```

### Preservation Checking

**Goal**: التحقق من أن التعديلات لم تُغيّر أي سلوك وظيفي.

**Pseudocode:**
```
FOR ALL codeLocation WHERE NOT isBugCondition(codeLocation) DO
  ASSERT runtimeBehavior(original) == runtimeBehavior(fixed)
END FOR
```

**Testing Approach**: Property-based testing مُناسب هنا لأن:
- الإصلاحات تعمل فقط على Linter metadata (تعليقات) أو مصفوفات تبعيات (stable refs).
- أي تأثير جانبي غير متوقع يمكن اكتشافه عبر توليد حالات متعددة.

**Test Cases:**
1. **Build Preservation**: `npm run build` يجب أن ينجح بدون أخطاء TypeScript.
2. **No New TS Errors**: إضافة stable refs للـ dependency arrays لا يُولّد أخطاء نوع.
3. **catch block behavior**: التعليقات داخل catch لا تُغيّر سلوك try/catch — الـ runtime behavior مطابق.
4. **const vs let**: `const profilesMap` مع `.set()` يعمل بنفس طريقة `let profilesMap`.

### Unit Tests

- اختبار أن `profilesMap` في `usePendingParents` تُنتج نفس النتائج بعد تغيير `let` إلى `const`.
- اختبار أن hooks المُصلَّحة تُعيد نفس البيانات بنفس الإدخالات.
- اختبار أن الـ realtime subscriptions في hooks `useClassChat.ts` تُعاد تسجيلها بشكل صحيح عند تغيير `schoolId`.

### Property-Based Tests

- توليد حالات عشوائية من بيانات `sessionStorage` وتحقق من أن catch blocks المُعلَّقة لا تُغيّر السلوك.
- توليد تسلسلات عشوائية من تغييرات `queryKey` والتحقق من أن subscriptions تُعاد تسجيلها بشكل صحيح.
- توليد قوائم عشوائية من profiles والتحقق من أن `senderProfiles` map تُبنى بنفس الطريقة.

### Integration Tests

- تشغيل ESLint الكامل على المشروع بعد الإصلاح: `npx eslint src --ext .ts,.tsx`.
- بناء المشروع: `npm run build` بدون أخطاء.
- التحقق من أن عدد الانتهاكات انخفض من 42 إلى صفر للقواعد الثلاث المستهدفة.
