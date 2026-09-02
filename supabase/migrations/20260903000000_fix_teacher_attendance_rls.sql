-- ==========================================================================
-- Migration: 20260903000000_fix_teacher_attendance_rls.sql
-- Purpose  : إعادة إنشاء جدول teacher_attendance إذا لم يكن موجوداً
--            وإصلاح RLS policies لتستخدم user_roles بدلاً من profiles.role
-- Root Cause: migration 20260413000001 استخدم DROP TABLE CASCADE فحذف الجدول
--             migration 20260413000000 استخدم profiles.role غير الموجود
-- Safety   : DO block + CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS (idempotent)
-- Fix      : يتحقق من وجود جدول schools قبل إنشاء teacher_attendance لتجنب
--            خطأ "relation does not exist" على بيئات حيث schools لم يُنشأ بعد
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. إعادة إنشاء الجدول إذا لم يكن موجوداً (idempotent)
--    نستخدم DO block لأن CREATE TABLE IF NOT EXISTS لا يزال يتحقق من الـ FK
--    حتى لو كان الجدول موجوداً مسبقاً في بعض إصدارات PostgreSQL
-- ==========================================================================

DO $$
BEGIN
    -- أنشئ الجدول فقط إذا لم يكن موجوداً وكانت جداول schools و profiles موجودة
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'teacher_attendance'
    ) THEN
        -- تحقق من وجود جدول schools قبل إنشاء FK
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'schools'
        ) THEN
            RAISE EXCEPTION
                'جدول schools غير موجود. يجب تشغيل migration الأساسي قبل هذه الـ migration.'
                USING HINT = 'شغّل migration 20260402240000_perfect_database_reset.sql أولاً';
        END IF;

        CREATE TABLE public.teacher_attendance (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id  UUID NOT NULL REFERENCES public.schools(id)   ON DELETE CASCADE,
            teacher_id UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
            date       DATE NOT NULL DEFAULT CURRENT_DATE,
            status     TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
            notes      TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(teacher_id, date, school_id)
        );

        RAISE NOTICE 'تم إنشاء جدول teacher_attendance بنجاح.';
    ELSE
        RAISE NOTICE 'جدول teacher_attendance موجود مسبقاً — تخطي الإنشاء.';
    END IF;
END;
$$;

-- فهارس الأداء (idempotent)
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school
    ON public.teacher_attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher
    ON public.teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date
    ON public.teacher_attendance(date);

-- ==========================================================================
-- 2. تفعيل RLS
-- ==========================================================================

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- 3. إسقاط جميع الـ policies القديمة/المكسورة (idempotent)
-- ==========================================================================

DROP POLICY IF EXISTS "Admins full access"                    ON public.teacher_attendance;
DROP POLICY IF EXISTS "Admins can manage teacher attendance"  ON public.teacher_attendance;
DROP POLICY IF EXISTS "Admin full access to teacher attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Authenticated users can read"          ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers view own"                     ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers can view own attendance"      ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teacher view own attendance"           ON public.teacher_attendance;

-- ==========================================================================
-- 4. إنشاء policies صحيحة باستخدام user_roles
-- ==========================================================================

-- Policy المدراء: وصول كامل عبر user_roles (النمط الصحيح المعتمد في المشروع)
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

-- Policy المعلمين: قراءة سجلاتهم الخاصة فقط
CREATE POLICY "Teachers view own"
    ON public.teacher_attendance
    FOR SELECT
    USING (teacher_id = auth.uid());

-- ==========================================================================
-- 5. صلاحيات الوصول
-- ==========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_attendance TO authenticated;
GRANT ALL ON public.teacher_attendance TO service_role;

-- ==========================================================================
-- 6. إعادة تحميل schema cache لـ PostgREST
-- ==========================================================================

NOTIFY pgrst, 'reload schema';
