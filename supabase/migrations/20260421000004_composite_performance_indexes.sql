-- ═══════════════════════════════════════════════════
-- COMPOSITE INDEXES FOR ADVANCED MULTI-TENANCY PERFORMANCE
-- ═══════════════════════════════════════════════════

-- 1. Notifications: Frequent filtering by user, read status, and type
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_type 
ON public.notifications(user_id, is_read, type) 
WHERE is_read = false;

-- 2. Attendance: Frequent filtering by school, date, and class
CREATE INDEX IF NOT EXISTS idx_attendance_school_date_class 
ON public.attendance(school_id, date, class_id);

-- 3. Grades: Frequent filtering by school, student, and date
CREATE INDEX IF NOT EXISTS idx_grades_school_student_date 
ON public.grades(school_id, student_id, date DESC);

-- 4. Students: Filtering by school and class (for ClassesPage count)
CREATE INDEX IF NOT EXISTS idx_students_school_class 
ON public.students(school_id, class_id);

-- 5. Fees: Filtering by school and term
CREATE INDEX IF NOT EXISTS idx_fees_school_term 
ON public.fees(school_id, term);

-- 6. Messages: Filtering by school and receiver
CREATE INDEX IF NOT EXISTS idx_messages_school_receiver 
ON public.messages(school_id, receiver_id, created_at DESC);

-- 7. User Roles: Filtering by school and role (for Stats & Lists)
CREATE INDEX IF NOT EXISTS idx_user_roles_school_role 
ON public.user_roles(school_id, role, approval_status);
