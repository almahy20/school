-- Add student_id column to messages table for teacher-parent messaging context

-- Add student_id column if it doesn't exist
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

-- Also ensure school_id exists (add if missing)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_student_id ON public.messages(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON public.messages(school_id);

NOTIFY pgrst, 'reload schema';
