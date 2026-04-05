-- 20260401000000_strict_multi_tenancy.sql
-- نظام عزل المدارس الصارم (Strict Multi-Tenancy)

-- 1. تفعيل ميزة الأمان على كافة الجداول
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END $$;

-- 2. دوال مساعدة للأمان (Security Helper Functions)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- يتم التعرف على السوبر أدمن من رقم الهاتف الموحد أو علامة is_super_admin
  RETURN (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND (is_super_admin = true)
    ) OR 
    (SELECT phone FROM public.profiles WHERE id = auth.uid()) = '0192837465'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. إضافة school_id للجداول الناقصة لضمان العزل
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 4. سياسات العزل لكل جدول (Strict Isolation Policies)

-- A. المدارس (Schools)
DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
CREATE POLICY "Schools isolation" ON public.schools
FOR ALL USING (
    public.is_super_admin() OR 
    id = public.get_my_school_id()
);

-- B. الملفات الشخصية (Profiles)
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
CREATE POLICY "Profiles isolation" ON public.profiles
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- C. أدوار المستخدمين (User Roles)
DROP POLICY IF EXISTS "Roles isolation" ON public.user_roles;
CREATE POLICY "Roles isolation" ON public.user_roles
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- D. الطلاب (Students)
DROP POLICY IF EXISTS "Students isolation" ON public.students;
CREATE POLICY "Students isolation" ON public.students
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- E. الفصول (Classes)
DROP POLICY IF EXISTS "Classes isolation" ON public.classes;
CREATE POLICY "Classes isolation" ON public.classes
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- F. الحضور (Attendance)
DROP POLICY IF EXISTS "Attendance isolation" ON public.attendance;
CREATE POLICY "Attendance isolation" ON public.attendance
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- G. الدرجات (Grades)
DROP POLICY IF EXISTS "Grades isolation" ON public.grades;
CREATE POLICY "Grades isolation" ON public.grades
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- H. الشكاوى (Complaints)
DROP POLICY IF EXISTS "Complaints isolation" ON public.complaints;
CREATE POLICY "Complaints isolation" ON public.complaints
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- I. الرسوم والمصروفات (Fees & Payments)
DROP POLICY IF EXISTS "Fees isolation" ON public.fees;
CREATE POLICY "Fees isolation" ON public.fees
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Fee payments isolation" ON public.fee_payments;
CREATE POLICY "Fee payments isolation" ON public.fee_payments
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- J. الرسائل (Messages)
DROP POLICY IF EXISTS "Messages isolation" ON public.messages;
CREATE POLICY "Messages isolation" ON public.messages
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id() OR
    sender_id = auth.uid() OR
    receiver_id = auth.uid()
);

-- K. جداول الربط (Join Tables)
DROP POLICY IF EXISTS "Student parents isolation" ON public.student_parents;
CREATE POLICY "Student parents isolation" ON public.student_parents
FOR ALL USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

-- 5. إعادة تحميل النظام ليتعرف على التعديلات فوراً
NOTIFY pgrst, 'reload schema';
