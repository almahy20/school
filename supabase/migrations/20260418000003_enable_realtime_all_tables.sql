-- ==========================================
-- FIX: Enable Realtime for ALL Core Tables
-- ==========================================
-- This migration ensures that ALL tables used by the app
-- are subscribed to Supabase Realtime publications.
-- Without this, changes to these tables won't trigger UI updates.
-- ==========================================

-- Enable Realtime for profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully if publication doesn't exist
END $$;

-- Enable Realtime for user_roles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for teachers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'teachers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teachers;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for classes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'classes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for student_parents table (guardian-student links)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'student_parents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_parents;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for grades table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'grades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grades;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for attendance table (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for fees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'fees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fees;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for complaints table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'complaints'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Enable Realtime for curriculum_subjects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'curriculum_subjects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.curriculum_subjects;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
