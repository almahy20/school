-- Teacher Attendance Table
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(teacher_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school ON public.teacher_attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON public.teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON public.teacher_attendance(date);

-- RLS Policies
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage teacher attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers can view own attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Admins full access" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers view own" ON public.teacher_attendance;

-- Admins: Full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins full access"
    ON public.teacher_attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
            AND profiles.school_id = teacher_attendance.school_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
            AND profiles.school_id = teacher_attendance.school_id
        )
    );

-- Teachers: Can view their own attendance
CREATE POLICY "Teachers view own"
    ON public.teacher_attendance
    FOR SELECT
    USING (teacher_id = auth.uid());
