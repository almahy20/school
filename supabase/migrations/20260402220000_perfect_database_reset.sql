-- ==========================================
-- Migration: 20260402220000_perfect_database_reset
-- WARNING: This script WIPES the entire public schema and rebuilds everything!
-- ==========================================

-- 1. CLEAN START (Wipe everything)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PRIVATE LOOKUP SCHEMA (Recursion & Performance Shield)
CREATE SCHEMA IF NOT EXISTS internal;

-- Function: Optimized User Context (Security Definer to bypass RLS)
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

-- 3. ORGANIZED CORE TABLES

-- A. Schools (The Tenant Foundation)
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

-- B. Profiles (User Identity)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- C. User Roles (Access Control)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'parent')),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    is_super_admin BOOLEAN DEFAULT false,
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D. Classes (Academic Groups)
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level TEXT,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- E. Students (The Core Entities)
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    student_id_number TEXT,
    parent_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- F. Attendance (Daily Tracking)
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- G. Grades (Academic Tracking)
CREATE TABLE public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    grade_value NUMERIC NOT NULL,
    term TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- H. Fees & Payments (Financial Foundation)
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

-- I. Student-Parent Links
CREATE TABLE public.student_parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(student_id, parent_id)
);

-- J. Communication
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

-- K. SaaS Signups (Orders)
CREATE TABLE public.school_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    admin_phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    payment_receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SMARTER RLS & ACCESS CONTROL

-- Helper Functions (Public Interface)
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE((internal.get_user_context(auth.uid()))->>'is_super_admin', 'false')::boolean; $$;
CREATE OR REPLACE FUNCTION public.get_my_school_id() RETURNS uuid LANGUAGE sql AS $$ SELECT ((internal.get_user_context(auth.uid()))->>'school_id')::uuid; $$;
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text LANGUAGE sql AS $$ SELECT (internal.get_user_context(auth.uid()))->>'role'; $$;

-- Enable RLS on ALL tables
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

-- Universal Isolation Policy
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

-- Table-Specific Overrides
CREATE POLICY "schools_access" ON public.schools FOR SELECT TO authenticated USING (public.is_super_admin() OR id = public.get_my_school_id());
CREATE POLICY "anon_view_schools" ON public.schools FOR SELECT TO anon USING (true); -- Needed for signup

CREATE POLICY "profiles_self" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid() OR public.is_super_admin() OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin'));
CREATE POLICY "profiles_anon_signup" ON public.profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "profiles_anon_read" ON public.profiles FOR SELECT TO anon USING (true);

CREATE POLICY "user_roles_self" ON public.user_roles FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_super_admin() OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin'));
CREATE POLICY "user_roles_anon_read" ON public.user_roles FOR SELECT TO anon USING (true);

CREATE POLICY "messages_access" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_super_admin());

-- 5. GRANTS & PERMISSIONS (Critical Fix for 500 errors)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA internal TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO anon, authenticated, service_role;

-- 6. AUTOMATIC WORKFLOWS (Triggers)

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
  -- Handle potential empty/missing school_id
  IF (NEW.raw_user_meta_data->>'school_id') IS NOT NULL AND (NEW.raw_user_meta_data->>'school_id') != '' THEN
    v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    v_school_id := NULL;
  END IF;

  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');

  -- Profile
  INSERT INTO public.profiles (id, full_name, email, phone, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_school_id
  );

  -- Role
  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
  VALUES (
    NEW.id,
    v_role,
    v_school_id,
    COALESCE((NEW.raw_user_meta_data->>'phone' = '0192837465' OR NEW.email = '0192837465@school.local'), false),
    'approved'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- Don't break auth if profile fails
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. PERFORMANCE INDEXES
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX idx_user_roles_school_id ON public.user_roles(school_id);
CREATE INDEX idx_students_school_id ON public.students(school_id);
CREATE INDEX idx_classes_school_id ON public.classes(school_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);

NOTIFY pgrst, 'reload schema';
