# Bugfix Requirements Document

## Introduction

سياسة RLS المسماة `"Admins full access"` على جدول `public.teacher_attendance` تستعلم عن العمود `profiles.role` الذي لا يوجد في جدول `profiles`، مما يُسبّب خطأ `42703: column profiles.role does not exist` في كل عملية تحقق من صلاحية المدير. هذا الخطأ يُشكّل 39.1% من أخطاء قاعدة البيانات في Supabase ويُعطّل وصول المدراء إلى بيانات الحضور بالكامل.

الجذر: ملف migration `20260413000000_create_teacher_attendance.sql` يبحث عن `profiles.role` بينما بنية المشروع الفعلية تُخزّن الأدوار في جدول `user_roles` (الأعمدة: `user_id`, `role`, `school_id`).

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN يحاول أي مستخدم قراءة أو كتابة سجلات `teacher_attendance` THEN يقوم النظام بتنفيذ استعلام على `public.profiles` بحثًا عن عمود `role` غير موجود مما يُنتج خطأ `42703: column profiles.role does not exist`

1.2 WHEN يحاول مدير المدرسة (admin) إدراج أو تعديل أو حذف سجلات حضور المعلمين THEN يرفض النظام العملية بخطأ PostgreSQL بدلاً من التحقق من صلاحيته الفعلية في `user_roles`

1.3 WHEN تُنفَّذ سياسة `"Admins full access"` على `teacher_attendance` THEN يفشل تقييم الـ USING clause و WITH CHECK clause بسبب المرجع الخاطئ `profiles.role`

### Expected Behavior (Correct)

2.1 WHEN يحاول أي مستخدم الوصول إلى سجلات `teacher_attendance` THEN يجب أن يتحقق النظام من صلاحية المدير عبر جدول `user_roles` (`user_roles.user_id = auth.uid() AND user_roles.role = 'admin' AND user_roles.school_id = teacher_attendance.school_id`) دون أي خطأ

2.2 WHEN يملك المستخدم دور `admin` في `user_roles` لنفس `school_id` الخاص بسجل الحضور THEN يجب أن يسمح النظام له بتنفيذ جميع عمليات SELECT وINSERT وUPDATE وDELETE

2.3 WHEN لا يملك المستخدم دور `admin` في `user_roles` لمدرسة السجل المطلوب THEN يجب أن يرفض النظام الوصول بصمت (RLS denial) لا بخطأ قاعدة بيانات

### Unchanged Behavior (Regression Prevention)

3.1 WHEN يحاول المعلم قراءة سجلات حضوره الخاص (`teacher_id = auth.uid()`) THEN يجب أن يستمر النظام في السماح بعملية SELECT دون تغيير (سياسة `"Teachers view own"` لا تتأثر)

3.2 WHEN يحاول مستخدم غير مدير وغير المعلم المعني الوصول إلى `teacher_attendance` THEN يجب أن يستمر النظام في رفض الوصول

3.3 WHEN تُنفَّذ عمليات RLS على جداول أخرى في المشروع THEN يجب أن تستمر جميع سياساتها في العمل دون تأثر

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type RLS Policy Check on teacher_attendance
  OUTPUT: boolean

  // البق يحدث عند تنفيذ سياسة "Admins full access"
  // التي تستخدم profiles.role بدلاً من user_roles.role
  RETURN X.policy_name = "Admins full access"
     AND X.table = "teacher_attendance"
     AND X.references_column = "profiles.role"  -- العمود غير الموجود
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← evaluatePolicy'(X)  -- بعد التصحيح
  ASSERT result ≠ ERROR_42703
  ASSERT result IS boolean (true إذا admin، false إذا لا)
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT evaluatePolicy(X) = evaluatePolicy'(X)
END FOR
```
