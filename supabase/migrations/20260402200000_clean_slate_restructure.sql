-- ==========================================
-- Migration: 20260402200000_clean_slate_restructure
-- WARNING: This script WIPES the public schema and recreates everything!
-- ==========================================

-- 1. CLEAN START
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Restore essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PRIVATE LOOKUP SCHEMA (Recursion prevention)
CREATE SCHEMA IF NOT EXISTS internal;

-- Function: Get user context without hitting RLS
-- Uses SECURITY DEFINER and executes as postgres (owner)
CREATE OR REPLACE FUNCTION internal.get_user_context(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_school_id uuid;
  v_is_super_admin boolean;
BEGIN
  SELECT 
    r.role::text, 
    r.school_id, 
    COALESCE(r.is_super_admin, false)
  INTO v_role, v_school_id, v_is_super_admin
  FROM public.user_roles r
  WHERE r.user_id = p_user_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'role', v_role,
    'school_id', v_school_id,
    'is_super_admin', v_is_super_admin
  );
END;
$$;

-- 3. CORE TABLES

-- A. Schools (The Tenant)
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    subscription_plan TEXT DEFAULT 'free',
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- B. Profiles (User Metadata)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- C. User Roles (Permissions)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'parent')),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    is_super_admin BOOLEAN DEFAULT false,
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D. Classes
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level TEXT,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- E. Students
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    student_id_number TEXT,
    parent_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- F. Attendance
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- G. Grades
CREATE TABLE public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    grade_value NUMERIC NOT NULL,
    term TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- H. Fees & Payments
CREATE TABLE public.fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'partial')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    fee_id UUID NOT NULL REFERENCES public.fees(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    receipt_url TEXT,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- I. Student-Parent Junction
CREATE TABLE public.student_parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(student_id, parent_id)
);

-- J. Messages & Complaints
CREATE TABLE public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    title TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved')),
    admin_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- K. School Orders (SaaS Onboarding)
CREATE TABLE public.school_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    admin_phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    payment_receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SMARTER RLS (RECURSION-FREE)

-- Core Helper Functions (Public)
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE((internal.get_user_context(auth.uid()))->>'is_super_admin', 'false')::boolean; $$;
CREATE OR REPLACE FUNCTION public.get_my_school_id() RETURNS uuid LANGUAGE sql AS $$ SELECT ((internal.get_user_context(auth.uid()))->>'school_id')::uuid; $$;
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text LANGUAGE sql AS $$ SELECT (internal.get_user_context(auth.uid()))->>'role'; $$;

-- Enable RLS on all tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_orders ENABLE ROW LEVEL SECURITY;

-- UNIVERSAL POLICIES (Simplified)

-- A. Schools: Super Admin or Member
CREATE POLICY "schools_access" ON public.schools FOR SELECT TO authenticated USING (public.is_super_admin() OR id = public.get_my_school_id());
CREATE POLICY "anon_view_schools" ON public.schools FOR SELECT TO anon USING (true); -- Necessary for signup

-- B. Profiles & Roles: Self, Super Admin, or School Admin
CREATE POLICY "profiles_access" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid() OR public.is_super_admin() OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin'));
CREATE POLICY "user_roles_access" ON public.user_roles FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_super_admin() OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin'));

-- C. DATA TABLES (Classes, Students, Attendance, etc.)
-- Standard isolation: Super Admin or My School
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name NOT IN ('schools', 'profiles', 'user_roles', 'school_orders')
    LOOP
        EXECUTE format('CREATE POLICY "isolation_policy" ON public.%I FOR ALL TO authenticated USING ( public.is_super_admin() OR school_id = public.get_my_school_id() );', t);
    END LOOP;
END $$;

-- D. Messages: Additional self access
CREATE POLICY "messages_personal_access" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- E. School Orders: Super Admin only (or self?)
CREATE POLICY "school_orders_access" ON public.school_orders FOR ALL TO authenticated USING (public.is_super_admin() OR admin_phone = (SELECT phone FROM public.profiles WHERE id = auth.uid()));

-- 5. AUTOMATIC SIGNUP SYNC (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_role text;
BEGIN
  v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');

  -- Create Profile
  INSERT INTO public.profiles (id, full_name, email, phone, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_school_id
  );

  -- Create Role
  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin)
  VALUES (
    NEW.id,
    v_role,
    v_school_id,
    COALESCE((NEW.raw_user_meta_data->>'phone' = '0192837465'), false)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- Ensure auth works even if trigger has hitch
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX idx_user_roles_school_id ON public.user_roles(school_id);
CREATE INDEX idx_classes_school_id ON public.classes(school_id);
CREATE INDEX idx_students_school_id ON public.students(school_id);
CREATE INDEX idx_attendance_school_id ON public.attendance(school_id);
CREATE INDEX idx_grades_school_id ON public.grades(school_id);
CREATE INDEX idx_fees_school_id ON public.fees(school_id);

NOTIFY pgrst, 'reload schema';
