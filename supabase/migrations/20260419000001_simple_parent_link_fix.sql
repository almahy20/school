-- Simple fix for parent-student linking
-- Run this in Supabase SQL Editor

-- 1. Enable RLS
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

-- 2. Drop old policies
DROP POLICY IF EXISTS "student_parents_policy" ON public.student_parents;
DROP POLICY IF EXISTS "isolation_policy" ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_admin_policy" ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_parent_view_policy" ON public.student_parents;

-- 3. Create admin policy
CREATE POLICY "student_parents_admin_policy" ON public.student_parents
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
      AND ur.school_id = student_parents.school_id
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
      AND ur.school_id = student_parents.school_id
    )
  );

-- 4. Create parent view policy
CREATE POLICY "student_parents_parent_view_policy" ON public.student_parents
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

-- 5. Fix linking for phone 01008777431
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT 
  s.school_id,
  s.id,
  p.id
FROM public.students s
INNER JOIN public.profiles p 
  ON public.normalize_phone(p.phone) = public.normalize_phone(s.parent_phone)
INNER JOIN public.user_roles r 
  ON r.user_id = p.id AND r.role = 'parent'
WHERE (s.parent_phone = '01008777431' 
   OR s.parent_phone = '+201008777431'
   OR s.parent_phone LIKE '%01008777431%')
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 6. Sync all unmatched parents/students
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT 
  s.school_id,
  s.id,
  p.id
FROM public.students s
INNER JOIN public.profiles p 
  ON public.normalize_phone(p.phone) = public.normalize_phone(s.parent_phone)
INNER JOIN public.user_roles r 
  ON r.user_id = p.id AND r.role = 'parent'
WHERE s.parent_phone IS NOT NULL
  AND s.parent_phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 7. Reload schema
NOTIFY pgrst, 'reload schema';
