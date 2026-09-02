# Bugfix Requirements Document

## Introduction

عند تحميل لوحة تحكم المدرسة (Dashboard)، تظهر في Console المتصفح أخطاء متعددة بسبب عدم قدرة PostgREST على إيجاد دوال RPC وأعمدة جداول مُعرَّفة في الـ migrations. المشكلة الجذرية هي أن PostgREST schema cache لم يُحدَّث بعد آخر migrations، مما يجعل الـ REST API يُعيد 404 على دوال موجودة فعلياً في قاعدة البيانات، و400 على أعمدة موجودة في الجداول.

الأخطاء المُشاهَدة:
- `PGRST202`: دوال RPC لا تُوجد في schema cache (`get_dashboard_stats`, `get_admin_dashboard_activities`, `get_unread_notification_counts`, `get_fees_summary`)
- `404` على جدول `notifications` و`conversations.unread_by_parent`
- `400 Bad Request` على استعلام `profiles` يتضمن عمود `notification_prefs`

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN يستدعي `useStats.ts` الدالة `get_dashboard_stats(p_school_id, p_is_super_admin)` عبر Supabase RPC THEN يُعيد النظام خطأ `PGRST202: Could not find the function public.get_dashboard_stats(p_is_super_admin, p_school_id) in the schema cache`

1.2 WHEN يستدعي `useStats.ts` الدالة `get_admin_dashboard_activities(p_school_id)` عبر Supabase RPC THEN يُعيد النظام خطأ 404 `Could not find the function public.get_admin_dashboard_activities(p_school_id) in the schema cache`

1.3 WHEN يستدعي `useNotifications.ts` الدالة `get_unread_notification_counts(p_user_id)` عبر Supabase RPC THEN يُعيد النظام خطأ 404 لأن الدالة غير مرئية في schema cache

1.4 WHEN يستدعي `useStats.ts` (fallback) الدالة `get_fees_summary(p_school_id)` عبر Supabase RPC THEN يُعيد النظام خطأ 404 لأن الدالة غير مرئية في schema cache

1.5 WHEN يستعلم `useNotifications.ts` على جدول `notifications` عبر PostgREST (`HEAD /notifications`) THEN يُعيد النظام 404 رغم وجود الجدول فعلياً في قاعدة البيانات

1.6 WHEN يستعلم `useConversations.ts` على عمود `unread_by_parent` في جدول `conversations` THEN يُعيد النظام خطأ 404 رغم وجود العمود في تعريف الجدول

1.7 WHEN يستعلم `useProfile.ts` على عمود `notification_prefs` من جدول `profiles` THEN يُعيد النظام `400 Bad Request` رغم وجود العمود المُضاف بـ migration `20260404900001`

### Expected Behavior (Correct)

2.1 WHEN يستدعي `useStats.ts` الدالة `get_dashboard_stats(p_school_id, p_is_super_admin)` THEN يجب أن يُعيد النظام JSON يحتوي على إحصائيات الداشبورد (`students`, `teachers`, `parents`, `classes`, `totalDue`, `totalPaid`, `presentToday`, `absentToday`, `attendanceRate`) بدون خطأ

2.2 WHEN يستدعي `useStats.ts` الدالة `get_admin_dashboard_activities(p_school_id)` THEN يجب أن يُعيد النظام مصفوفة JSONB بآخر الأنشطة (شكاوى + طلبات انضمام + مدفوعات) بدون خطأ

2.3 WHEN يستدعي `useNotifications.ts` الدالة `get_unread_notification_counts(p_user_id)` THEN يجب أن يُعيد النظام JSONB يحتوي على `unread` و`complaints` بدون خطأ

2.4 WHEN يستدعي `useStats.ts` (fallback) الدالة `get_fees_summary(p_school_id)` THEN يجب أن يُعيد النظام `total_due` و`total_paid` بدون خطأ

2.5 WHEN يستعلم `useNotifications.ts` على جدول `notifications` عبر PostgREST THEN يجب أن يُعيد النظام البيانات المطلوبة أو عدد الصفوف بنجاح

2.6 WHEN يستعلم `useConversations.ts` على `conversations.unread_by_parent` THEN يجب أن يُعيد النظام عدد المحادثات غير المقروءة بدون خطأ

2.7 WHEN يستعلم `useProfile.ts` على عمود `notification_prefs` من جدول `profiles` THEN يجب أن يُعيد النظام بيانات البروفايل بما فيها `notification_prefs` بدون خطأ 400

### Unchanged Behavior (Regression Prevention)

3.1 WHEN يستدعي مستخدم معتمد دوال RPC أخرى موجودة مسبقاً (`get_child_full_details`, `get_parent_dashboard_summary`, `get_teacher_dashboard_stats`) THEN يجب أن يستمر النظام في إعادة النتائج الصحيحة بدون تغيير

3.2 WHEN يستعلم المستخدم على بقية أعمدة جدول `profiles` (`id`, `full_name`, `phone`, `school_id`, `created_at`) THEN يجب أن يستمر النظام في إعادة البيانات بنجاح

3.3 WHEN يستعلم ولي الأمر على محادثاته عبر `useParentConversations()` THEN يجب أن يستمر النظام في إعادة قائمة المحادثات بنجاح

3.4 WHEN يُشغَّل Realtime subscription على جدولَي `conversations` و`conversation_messages` THEN يجب أن تستمر تحديثات الـ Realtime في العمل بدون انقطاع

3.5 WHEN تُشغَّل migrations القديمة على بيئة نظيفة THEN يجب أن يستمر ترتيب التطبيق الصحيح بدون كسر أي migration سابقة

3.6 WHEN يستدعي المستخدم دوال RLS-protected THEN يجب أن تستمر سياسات RLS في حماية البيانات بين المدارس المختلفة (multi-tenant isolation)
