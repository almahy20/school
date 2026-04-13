-- =========================================================================
-- SUPERIOR DATABASE FIXES: CASCADE DELETES & MULTIPLE TEACHERS
-- =========================================================================

-- 1. FIX CASCADE DELETIONS (Ensure deleting a class/student cleans up data)
-- This fixes the issue where you cannot delete a class because of relations.

-- For students -> classes relation
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
ALTER TABLE students ADD CONSTRAINT students_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- For grades -> students
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_student_id_fkey;
ALTER TABLE grades ADD CONSTRAINT grades_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- For attendance -> students
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- For student_parents -> students
ALTER TABLE student_parents DROP CONSTRAINT IF EXISTS student_parents_student_id_fkey;
ALTER TABLE student_parents ADD CONSTRAINT student_parents_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- For student_parents -> parents
ALTER TABLE student_parents DROP CONSTRAINT IF EXISTS student_parents_parent_id_fkey;
ALTER TABLE student_parents ADD CONSTRAINT student_parents_parent_id_fkey 
  FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. CREATE MULTIPLE TEACHERS SUPPORT FOR CLASSES
-- This junction table allows assigning multiple teachers to the same class
CREATE TABLE IF NOT EXISTS class_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, teacher_id) -- Prevent duplicate assignments
);

-- Enable RLS for class_teachers
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Profiles can read class_teachers" ON class_teachers
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage class_teachers" ON class_teachers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roles WHERE roles.id = auth.uid() AND roles.role = 'admin')
  );

-- Function to safely delete a class without foreign key issues
CREATE OR REPLACE FUNCTION delete_class_safely(class_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We rely on ON DELETE CASCADE for students, class_teachers, and exams
  DELETE FROM classes WHERE id = class_id_param;
END;
$$;
