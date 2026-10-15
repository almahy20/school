# Bugfix Requirements Document

## Introduction

تم اكتشاف أربع مشاكل في مشروع school-master تؤثر على استقرار قاعدة البيانات، وأمان تصحيح الاختبارات الإلكترونية، وجودة الكود. هذا المستند يغطي متطلبات إصلاح هذه المشاكل مع الحفاظ التام على البيانات الموجودة وسلامة تجربة المستخدم.

المشاكل الأربع هي:
1. تضارب timestamps في ملفات الـ migrations يمنع تشغيل `supabase db push`
2. ثغرة أمنية تكشف إجابات الاختبارات في ذاكرة المتصفح عبر client-side fallback scoring
3. نصوص Unicode مكسورة في `AuthContext.tsx` ناتجة عن خطأ في encoding
4. متغير `schoolFilter` معرَّف لكن غير مستخدم في `useStats.ts`

---

## Bug Analysis

### Current Behavior (Defect)

**المشكلة 1 — تضارب Timestamps في الـ Migrations:**

1.1 WHEN يحاول المطور تشغيل `supabase db push` أو deploy على بيئة جديدة THEN النظام يفشل بسبب وجود ملفين بنفس الـ timestamp `20260913000000`: أحدهما `20260913000000_fix_critical_issues.sql` والآخر `20260913000000_add_grades_upsert_unique_constraint.sql`

1.2 WHEN يتم تطبيق الـ migrations على قاعدة بيانات جديدة THEN النظام قد يطبق أحد الملفين دون الآخر أو يفشل كلياً دون أن يُعرف أيهما تم تطبيقه أولاً

**المشكلة 2 — client-side Fallback Scoring في الاختبارات:**

1.3 WHEN يفشل RPC `submit_exam_attempt` لأي سبب غير JWT expiry THEN النظام يحسب الدرجة على الـ client بالوصول إلى `q.correct_answer` من كل سؤال في متغير `questions` المحلي

1.4 WHEN يستخدم النظام client-side fallback scoring THEN الـ `correct_answer` لكل أسئلة الاختبار يكون موجوداً في ذاكرة المتصفح قبل إرسال الإجابات، مما يتيح للطالب رؤيتها عبر DevTools

**المشكلة 3 — Unicode مكسور في AuthContext:**

1.5 WHEN يتم تشغيل الكود ومراجعة الـ logs THEN تظهر النصوص الأربعة التالية مشوهة بـ encoding خاطئ بدلاً من em dash (`—`):
- `'[Auth] Skipping background RPC â€" no valid access token'`
- `'[Auth] Background RPC skipped â€" already loading for this user'`
- `'[Auth] Background RPC skipped â€" JWT complete + recently synced'`
- `'[Auth] SIGNED_OUT ignored â€" active session exists (token rotation)'`

**المشكلة 4 — متغير غير مستخدم في useStats:**

1.6 WHEN يتم تجميع الكود THEN المتغير `schoolFilter` في دالة `fetchStatsFallback` يُعرَّف بقيمة `!user?.isSuperAdmin && user?.schoolId` لكنه لا يُستخدم في أي من الـ queries التي تلي تعريفه، وبدلاً منه يُستخدم `user.schoolId` مباشرة في جميع الـ queries

---

### Expected Behavior (Correct)

**المشكلة 1 — تضارب Timestamps:**

2.1 WHEN يحاول المطور تشغيل `supabase db push` THEN النظام يقبل جميع ملفات الـ migration دون أخطاء تضارب في الأسماء، وذلك بإعادة تسمية `20260913000000_add_grades_upsert_unique_constraint.sql` إلى `20260913000100_add_grades_upsert_unique_constraint.sql`

2.2 WHEN يتم تطبيق الـ migrations على بيئة جديدة THEN النظام يطبق كلا الملفين بترتيب واضح ومحدد دون حذف أي بيانات أو تغيير محتوى الملفات

**المشكلة 2 — إزالة client-side Fallback Scoring:**

2.3 WHEN يفشل RPC `submit_exam_attempt` لأي سبب غير JWT expiry THEN النظام SHALL يرمي خطأ واضحاً للمستخدم مثل `'فشل إرسال الاختبار — يرجى المحاولة مرة أخرى'` دون اللجوء إلى حساب الدرجة على الـ client

2.4 WHEN تُرسل إجابات الاختبار قبل اكتمال الـ RPC THEN النظام SHALL لا يكشف `correct_answer` في الـ client memory بأي شكل، إذ تبقى الإجابات الصحيحة محمية على السيرفر

2.5 WHEN يحدث JWT expiry أثناء الإرسال THEN النظام SHALL يجدد الـ session ويعيد المحاولة عبر نفس الـ RPC بدون client-side scoring كـ fallback

**المشكلة 3 — إصلاح Unicode:**

2.6 WHEN يتم تشغيل الكود ومراجعة الـ logs THEN النصوص الأربعة في `AuthContext.tsx` SHALL تظهر بـ em dash صحيح (`—`) بدلاً من `â€"` في جميع logger calls المتأثرة

**المشكلة 4 — تنظيف المتغير غير المستخدم:**

2.7 WHEN يتم تجميع الكود THEN المتغير `schoolFilter` في دالة `fetchStatsFallback` SHALL يُحذف لأن جميع الـ queries تستخدم `user.schoolId` مباشرة ولا حاجة للمتغير الوسيط

---

### Unchanged Behavior (Regression Prevention)

**المشكلة 1:**

3.1 WHEN يتم تطبيق أي migration تم تطبيقه سابقاً THEN النظام SHALL CONTINUE TO يحافظ على البيانات الموجودة دون أي حذف أو تعديل

3.2 WHEN يُغيَّر اسم ملف migration THEN النظام SHALL CONTINUE TO يُبقي محتوى الملف كما هو دون أي تعديل في SQL المكتوب

**المشكلة 2:**

3.3 WHEN يُرسل الطالب إجاباته بنجاح عبر RPC `submit_exam_attempt` THEN النظام SHALL CONTINUE TO يُرجع الدرجة والإجابات المصوَّبة من السيرفر ويعرضها للطالب بعد الانتهاء

3.4 WHEN تنتهي صلاحية JWT أثناء إرسال الاختبار THEN النظام SHALL CONTINUE TO يجدد الـ session ويعيد المحاولة عبر الـ RPC تماماً كما كان سلوكه السابق

**المشكلة 3:**

3.5 WHEN يعمل `AuthContext` ويُصدر logs THEN النظام SHALL CONTINUE TO يُصدر جميع رسائل الـ log المتأثرة كما كانت لكن بـ encoding صحيح فقط

**المشكلة 4:**

3.6 WHEN يتم استدعاء `fetchStatsFallback` THEN النظام SHALL CONTINUE TO يُرجع نفس إحصاءات لوحة التحكم بنفس منطق الـ filtering بناءً على `user.schoolId` مباشرة كما كان يفعل قبل الإصلاح
