-- ==========================================
-- Migration: 20260402240000_perfect_database_reset
-- Goal: Total wipe and reconstruction of the "إدارة عربية" schema (Zero Data)
-- ==========================================

-- 1. NUCLEAR WIPE
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Standard Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PRIVATE LOOKUP SCHEMA (Recursion Prevention)
CREATE SCHEMA IF NOT EXISTS internal;

-- Secure context fetcher (Bypasses RLS)
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

-- A. Schools
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

-- B. Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- C. User Roles
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
    grade_level TEXT, -- renamed for clarity
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- E. Students
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID,
    name TEXT NOT NULL, -- renamed for front-end consistency
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

-- H. Fees
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

-- I. Junctions
CREATE TABLE public.student_parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(student_id, parent_id)
);

-- J. Communications
CREATE TABLE public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID,
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

-- K. Platforms (SaaS Orders)
CREATE TABLE public.school_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    admin_phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    payment_receipt_url TEXT,
    school_slug TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SMART RLS (RECURSION-FREE)

-- Core Helpers
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE((internal.get_user_context(auth.uid()))->>'is_super_admin', 'false')::boolean; $$;
CREATE OR REPLACE FUNCTION public.get_my_school_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT ((internal.get_user_context(auth.uid()))->>'school_id')::uuid; $$;
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT (internal.get_user_context(auth.uid()))->>'role'; $$;

-- Enable RLS
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END $$;

-- UNIVERSAL POLICIES
-- A. Schools
CREATE POLICY "schools_access" ON public.schools FOR SELECT TO authenticated USING (public.is_super_admin() OR id = public.get_my_school_id());
CREATE POLICY "anon_view_schools" ON public.schools FOR SELECT TO anon USING (true); -- Signup lookup

-- B. Profiles & Roles
CREATE POLICY "profiles_access" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid() OR public.is_super_admin() OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin'));
CREATE POLICY "user_roles_access" ON public.user_roles FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_super_admin() OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin'));

-- C. Data Tables (Isolation)
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

-- 5. IDENTITY RPC (The Fix)
CREATE OR REPLACE FUNCTION public.get_complete_user_data(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_profile RECORD; v_role RECORD; v_school RECORD; v_result jsonb;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_role FROM public.user_roles WHERE user_id = p_user_id;
    IF v_profile.school_id IS NOT NULL THEN SELECT * INTO v_school FROM public.schools WHERE id = v_profile.school_id; END IF;
    v_result := jsonb_build_object('profile', to_jsonb(v_profile), 'role', to_jsonb(v_role), 'school', to_jsonb(v_school));
    RETURN v_result;
END;
$$;

-- 6. AUTOMATIC PROFILE SYNC
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_school_id uuid; v_role text; v_is_dev boolean;
BEGIN
  v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
  -- DEV AUTO-UPGRADE (Your number)
  v_is_dev := (COALESCE(NEW.raw_user_meta_data->>'phone', '') = '0192837465' OR NEW.email = '0192837465@school.local');
  
  INSERT INTO public.profiles (id, full_name, email, phone, school_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, COALESCE(NEW.raw_user_meta_data->>'phone', ''), v_school_id);

  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin)
  VALUES (NEW.id, CASE WHEN v_is_dev THEN 'admin' ELSE v_role END, v_school_id, v_is_dev);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- Explicit FK Markers (Naming for PostgREST)
ALTER TABLE public.complaints ADD CONSTRAINT complaints_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.student_parents ADD CONSTRAINT student_parents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
