
-- 1. Create exam_templates table for grading workflow
CREATE TABLE public.exam_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  exam_type text NOT NULL DEFAULT 'monthly', -- 'final', 'monthly', 'daily'
  max_score numeric NOT NULL DEFAULT 100,
  weight numeric NOT NULL DEFAULT 1, -- weight percentage
  term text NOT NULL DEFAULT 'الفصل الأول',
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

-- RLS for exam_templates
CREATE POLICY "Admins full access exam_templates"
  ON public.exam_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage their exam_templates"
  ON public.exam_templates FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Parents view exam_templates for children classes"
  ON public.exam_templates FOR SELECT TO authenticated
  USING (class_id IN (
    SELECT s.class_id FROM students s WHERE s.id IN (SELECT get_parent_student_ids(auth.uid()))
  ));

-- 2. Add exam_template_id to grades table (optional link)
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS exam_template_id uuid REFERENCES public.exam_templates(id) ON DELETE SET NULL;

-- 3. Update handle_new_user trigger to store phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'parent');
  
  RETURN NEW;
END;
$$;

-- 4. Add unique constraint on attendance for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_date_unique'
  ) THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_date_unique UNIQUE (student_id, date);
  END IF;
END $$;

-- 5. Enable realtime for attendance
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_templates;
