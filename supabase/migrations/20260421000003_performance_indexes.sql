-- ═══════════════════════════════════════════════════
-- DATABASE INDEXES FOR MAXIMUM PERFORMANCE
-- ═══════════════════════════════════════════════════

-- 1. Optimize filtering by school_id (used in almost every query)
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_school_id ON public.grades(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON public.attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_school_id ON public.fees(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_id ON public.fee_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_complaints_school_id ON public.complaints(school_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_school_id ON public.user_roles(school_id);

-- 2. Optimize student data lookups (Dashboard & Details)
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON public.grades(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON public.fees(student_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_student_id ON public.student_parents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_id ON public.student_parents(parent_id);

-- 3. Optimize payment lookups
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee_id ON public.fee_payments(fee_id);

-- 4. Optimize sorting by date (Recent activities)
CREATE INDEX IF NOT EXISTS idx_grades_date ON public.grades(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_fee_payments_date ON public.fee_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_date ON public.complaints(created_at DESC);
