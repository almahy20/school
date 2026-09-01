# Bugfix Requirements Document

## Introduction

يحتوي مشروع school-master على 42 انتهاكاً لقواعد ESLint موزعة على 14 ملفاً، تُصنَّف في ثلاث فئات: كتل catch فارغة صامتة (`no-empty`)، تبعيات ناقصة في hooks (`react-hooks/exhaustive-deps`)، ومتغير يُعاد تعيينه لكنه لا يتغير (`prefer-const`). الهدف هو إصلاح هذه الانتهاكات بشكل آمن دون أي تغيير في السلوك الوظيفي للتطبيق.

---

## Bug Analysis

### Current Behavior (Defect)

**القسم الأول — كتل catch فارغة (no-empty)**

1.1 WHEN يحدث خطأ في عمليات `sessionStorage` داخل `ExamTakingView.tsx` (أسطر 120، 135، 152، 175، 222، 280، 285) THEN النظام يبتلع الخطأ صامتاً بكتلة `catch (_) {}` بدون أي محتوى، مما يُخفق في استيفاء قاعدة `no-empty`

1.2 WHEN يحدث خطأ في معالجة استجابات HTTP في `supabase/client.ts` (أسطر 80، 104) THEN النظام يستخدم كتل catch فارغة تماماً مما يجعل ESLint يرفض الكود

1.3 WHEN يحدث خطأ في حفظ بيانات الاختبار داخل `CreateExamWizard.tsx` (أسطر 132، 197) THEN كتل `catch (_) {}` الفارغة تُخفق في قاعدة `no-empty`

1.4 WHEN يحدث خطأ في `ElectronicExamsView.tsx` (سطر 43)، و`AdminClassChatRoomPage.tsx` (سطر 50)، و`AdminConversationsPage.tsx` (سطر 416)، و`AdminConversationDetailPage.tsx` (سطر 146)، و`ClassChatRoomPage.tsx` (سطر 100)، و`ParentConversationsPage.tsx` (أسطر 156، 342)، و`StudentsPage.tsx` (سطر 458)، و`useStudents.ts` (سطر 313) THEN كتل catch الفارغة تُخفق في قاعدة `no-empty`

**القسم الثاني — تبعيات ناقصة (react-hooks/exhaustive-deps)**

1.5 WHEN يُنفَّذ الـ `useEffect` في `GlobalAnnouncement.tsx` (سطر 156) الذي يستخدم `senderProfiles` THEN النظام لا يُدرج `senderProfiles` في مصفوفة التبعيات مما يجعل الـ effect يعمل بقيمة stale

1.6 WHEN يُنفَّذ الـ `useEffect` في `QueryStateHandler.tsx` (سطر 66) الذي يستخدم `error` THEN النظام لا يُدرج `error` في مصفوفة التبعيات

1.7 WHEN يُنفَّذ الـ `useEffect` في `CreateExamWizard.tsx` (سطر 101) الذي يعتمد على `existingQuestions` THEN النظام يستخدم `existingQuestions.length` فقط بدل المصفوفة كاملة مما يُخفق في `exhaustive-deps`

1.8 WHEN تُنفَّذ الـ `useEffect`/`useCallback` callbacks في `ClassExamsView.tsx` (أسطر 117، 162، 177، 188، 194) THEN النظام لا يُدرج `setCustomOrder` وتعابير منطقية أخرى في مصفوفة التبعيات

1.9 WHEN تُنفَّذ الـ `useEffect` callbacks في `GradesPage.tsx` (أسطر 81، 99، 107) THEN النظام لا يُدرج `setSelectedClassId`، `setSelectedMonthFolder`، وتعابير منطقية في مصفوفة التبعيات

1.10 WHEN تُسجَّل الـ `useEffect` subscriptions في `useClassChat.ts` (أسطر 57، 136، 209، 304) THEN النظام لا يُدرج `queryKey` في مصفوفة التبعيات مما يتسبب في استخدام قيمة stale للـ query key

1.11 WHEN تُسجَّل الـ `useEffect` subscriptions في `useConversations.ts` (سطر 206) و`useElectronicExams.ts` (سطر 382) THEN النظام لا يُدرج `queryKey` في مصفوفة التبعيات

1.12 WHEN تُنفَّذ الـ `useEffect` callbacks في `ClassChatRoomPage.tsx` (أسطر 80، 85) THEN النظام لا يُدرج `navigate` و`markRead` في مصفوفة التبعيات

1.13 WHEN تُنفَّذ الـ `useEffect` callbacks في `AdminConversationDetailPage.tsx` (أسطر 129، 135) THEN النظام لا يُدرج `queryClient` و`markRead` في مصفوفة التبعيات

1.14 WHEN يُنفَّذ الـ `useEffect` في `ParentConversationsPage.tsx` (سطر 138) THEN النظام لا يُدرج تبعيات متعددة في مصفوفة التبعيات

1.15 WHEN تُحسب الـ `useMemo` expressions في `StudentDetailPage.tsx` (أسطر 54، 56) THEN النظام يستخدم تعابير منطقية كتبعيات بدل القيم الأصلية

1.16 WHEN يُنفَّذ الـ `useEffect` في `StudentsPage.tsx` (سطر 442) الذي يستخدم `student` THEN النظام لا يُدرج `student` في مصفوفة التبعيات

**القسم الثالث — prefer-const**

1.17 WHEN يُعرَّف `profilesMap` في `useParents.ts` (سطر 174) بـ `let` THEN النظام يُخفق في قاعدة `prefer-const` لأن المتغير لا يُعاد تعيينه بعد التهيئة الأولى

---

### Expected Behavior (Correct)

**القسم الأول — كتل catch فارغة**

2.1 WHEN يحدث خطأ في عمليات `sessionStorage` داخل `ExamTakingView.tsx` (14 موقع) THEN النظام SHALL يُسكت الخطأ بشكل صريح عبر تعليق `// intentional — storage errors are non-fatal` داخل كتلة catch بدلاً من تركها فارغة

2.2 WHEN يحدث خطأ في معالجة استجابات HTTP في `supabase/client.ts` THEN النظام SHALL يُسكت الخطأ بشكل صريح عبر تعليق توضيحي داخل كتل catch

2.3 WHEN يحدث خطأ في `CreateExamWizard.tsx` و`ElectronicExamsView.tsx` وبقية الملفات THEN النظام SHALL يُسكت الخطأ بشكل صريح عبر تعليق توضيحي داخل كتل catch، أو يستخدم `_e` لتسمية المتغير الصامت حيث يناسب ذلك

**القسم الثاني — تبعيات ناقصة**

2.4 WHEN يُنفَّذ الـ `useEffect` في `GlobalAnnouncement.tsx` الذي يستخدم `senderProfiles` THEN النظام SHALL يُدرج `senderProfiles` في مصفوفة التبعيات أو يُفصل الـ effect بشكل صحيح

2.5 WHEN يُنفَّذ الـ `useEffect` في `QueryStateHandler.tsx` THEN النظام SHALL يُدرج `error` في مصفوفة التبعيات

2.6 WHEN يُنفَّذ الـ `useEffect` في `CreateExamWizard.tsx` THEN النظام SHALL يُدرج `existingQuestions` (المصفوفة) في مصفوفة التبعيات أو يستخدم `existingQuestions.length` مع تعليق `eslint-disable-line` إذا كان السلوك المقصود هو المراقبة على الطول فقط

2.7 WHEN تُنفَّذ الـ callbacks في `ClassExamsView.tsx` THEN النظام SHALL يُدرج `setCustomOrder` وبقية التبعيات الناقصة — ملاحظة: `setCustomOrder` و`setLocalGrades` من `useState`/`useSessionState` مستقرة مرجعياً وإدراجها آمن دون إعادة تشغيل غير ضرورية

2.8 WHEN تُنفَّذ الـ callbacks في `GradesPage.tsx` THEN النظام SHALL يُدرج `setSelectedClassId` و`setSelectedMonthFolder` والتعابير الأخرى في مصفوفة التبعيات

2.9 WHEN تُسجَّل الـ subscriptions في `useClassChat.ts` و`useConversations.ts` و`useElectronicExams.ts` THEN النظام SHALL يستخدم قيمة `queryKey` المستقرة (عبر `useMemo` أو التعريف خارج الـ effect) وإدراجها في مصفوفة التبعيات — أو استخدام `queryKey` المُعرَّفة بالفعل كـ `const` خارج الـ effect في نفس الـ hook

2.10 WHEN تُنفَّذ الـ callbacks في `ClassChatRoomPage.tsx` THEN النظام SHALL يُدرج `navigate` و`markRead.mutate` في مصفوفة التبعيات

2.11 WHEN تُنفَّذ الـ callbacks في `AdminConversationDetailPage.tsx` THEN النظام SHALL يُدرج `queryClient` و`markRead.mutate` في مصفوفة التبعيات

2.12 WHEN يُنفَّذ الـ `useEffect` في `ParentConversationsPage.tsx` THEN النظام SHALL يُدرج جميع التبعيات الناقصة في مصفوفة التبعيات

2.13 WHEN تُحسب الـ `useMemo` expressions في `StudentDetailPage.tsx` THEN النظام SHALL يستخدم القيم المباشرة (وليس التعابير المُركّبة) كتبعيات

2.14 WHEN يُنفَّذ الـ `useEffect` في `StudentsPage.tsx` THEN النظام SHALL يُدرج `student` في مصفوفة التبعيات

**القسم الثالث — prefer-const**

2.15 WHEN يُعرَّف `profilesMap` في `useParents.ts` THEN النظام SHALL يستخدم `const` بدلاً من `let` لأن المتغير لا يُعاد تعيينه

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN يحدث خطأ فعلي في عمليات `sessionStorage` أثناء اختبار الطالب THEN النظام SHALL CONTINUE TO امتصاص هذا الخطأ صامتاً دون إيقاف تجربة الاختبار (إضافة التعليق فقط، لا تغيير في منطق المعالجة)

3.2 WHEN يتحدث الـ `useEffect` الخاص بقائمة الإعلانات في `GlobalAnnouncement.tsx` THEN النظام SHALL CONTINUE TO عرض الإعلانات بنفس الترتيب وبدون رسائل مكررة

3.3 WHEN تُعاد تهيئة الـ `queryKey` في hooks الـ realtime (`useClassChat.ts`، `useConversations.ts`، `useElectronicExams.ts`) THEN النظام SHALL CONTINUE TO إعادة تسجيل الـ subscription فقط عند تغيير القيم الفعلية لمكونات الـ query key (مثل `user?.schoolId`، `user?.id`)

3.4 WHEN يفتح المستخدم غرفة دردشة الفصل (`ClassChatRoomPage.tsx`) THEN النظام SHALL CONTINUE TO تعليم الرسائل كمقروءة عند أول عرض وإعادة التوجيه في غياب `roomId`

3.5 WHEN يُغلق المدير صفحة تفاصيل المحادثة (`AdminConversationDetailPage.tsx`) THEN النظام SHALL CONTINUE TO تعليم الرسائل كمقروءة بنفس الطريقة الحالية

3.6 WHEN تُغيَّر بيانات الطالب في نموذج التعديل (`StudentsPage.tsx`) THEN النظام SHALL CONTINUE TO ملء الحقول بالبيانات الصحيحة عند فتح النموذج

3.7 WHEN يحمّل المدير قائمة الاختبارات الإلكترونية (`CreateExamWizard.tsx`) في وضع التعديل THEN النظام SHALL CONTINUE TO ملء نموذج الأسئلة بالأسئلة الموجودة مسبقاً

3.8 WHEN يُرتَّب الطلاب يدوياً في `ClassExamsView.tsx` THEN النظام SHALL CONTINUE TO حفظ الترتيب المخصص في الـ session state وتطبيقه عند تغيير المادة

3.9 WHEN يختار المعلم فصلاً أو مجلد شهر في `GradesPage.tsx` THEN النظام SHALL CONTINUE TO الاحتفاظ بالاختيار السابق في الـ session state

3.10 WHEN يُنشئ كود `useParents.ts` خريطة الملفات الشخصية للمستخدمين THEN النظام SHALL CONTINUE TO بناء الخريطة بنفس المنطق الحالي دون أي تغيير في البيانات المُعادة

3.11 WHEN تعمل أي عملية إلغاء جلسة Supabase أو تحديث JWT في `supabase/client.ts` THEN النظام SHALL CONTINUE TO معالجة حالات انتهاء صلاحية الرمز وفق المنطق الحالي دون تغيير

3.12 WHEN تُقدَّم صفحة التواصل للوالدين (`ParentConversationsPage.tsx`) THEN النظام SHALL CONTINUE TO تحميل المحادثات وعرض الأعداد غير المقروءة بالمنطق الحالي
