-- Update attendance unique constraint to include school_id for multi-tenancy
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_student_id_date_unique;

ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_student_id_date_school_id_unique UNIQUE (student_id, date, school_id);

-- Update teacher_attendance unique constraint to include school_id for multi-tenancy
ALTER TABLE public.teacher_attendance 
DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_id_date_key;

ALTER TABLE public.teacher_attendance 
ADD CONSTRAINT teacher_attendance_teacher_id_date_school_id_unique UNIQUE (teacher_id, date, school_id);