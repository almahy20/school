-- Fix RLS policies for teacher_attendance

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins full access" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers view own" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Admins can manage teacher attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers can view own attendance" ON public.teacher_attendance;

-- Policy 1: Admins can do everything
CREATE POLICY "Admin full access to teacher attendance"
    ON public.teacher_attendance
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        school_id IN (
            SELECT school_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Policy 2: Teachers can view their own attendance
CREATE POLICY "Teacher view own attendance"
    ON public.teacher_attendance
    FOR SELECT
    USING (teacher_id = auth.uid());

-- Policy 3: Allow authenticated users to at least read (temporary for debugging)
-- Remove this in production if needed
CREATE POLICY "Authenticated users can read"
    ON public.teacher_attendance
    FOR SELECT
    USING (auth.role() = 'authenticated');
