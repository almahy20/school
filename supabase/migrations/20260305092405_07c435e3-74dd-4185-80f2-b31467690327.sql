
-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grade_level TEXT,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table (admin-only creation)
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date DATE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table: student <-> parent (many-to-many)
CREATE TABLE public.student_parents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, parent_id)
);

-- Grades table
CREATE TABLE public.grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL DEFAULT 100,
  term TEXT NOT NULL DEFAULT 'الفصل الأول',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Enable RLS on all tables
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- CLASSES policies
CREATE POLICY "Admins full access classes" ON public.classes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view their classes" ON public.classes FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Parents can view classes of their children" ON public.classes FOR SELECT USING (
  id IN (SELECT class_id FROM public.students WHERE id IN (SELECT student_id FROM public.student_parents WHERE parent_id = auth.uid()))
);

-- STUDENTS policies
CREATE POLICY "Admins full access students" ON public.students FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view students in their classes" ON public.students FOR SELECT USING (
  class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
);
CREATE POLICY "Parents can view their linked children" ON public.students FOR SELECT USING (
  id IN (SELECT student_id FROM public.student_parents WHERE parent_id = auth.uid())
);

-- STUDENT_PARENTS policies
CREATE POLICY "Admins full access student_parents" ON public.student_parents FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parents can view their own links" ON public.student_parents FOR SELECT USING (parent_id = auth.uid());

-- GRADES policies
CREATE POLICY "Admins full access grades" ON public.grades FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage grades for their students" ON public.grades FOR ALL USING (
  student_id IN (SELECT s.id FROM public.students s JOIN public.classes c ON s.class_id = c.id WHERE c.teacher_id = auth.uid())
);
CREATE POLICY "Parents can view their children grades" ON public.grades FOR SELECT USING (
  student_id IN (SELECT student_id FROM public.student_parents WHERE parent_id = auth.uid())
);

-- ATTENDANCE policies
CREATE POLICY "Admins full access attendance" ON public.attendance FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage attendance for their students" ON public.attendance FOR ALL USING (
  student_id IN (SELECT s.id FROM public.students s JOIN public.classes c ON s.class_id = c.id WHERE c.teacher_id = auth.uid())
);
CREATE POLICY "Parents can view their children attendance" ON public.attendance FOR SELECT USING (
  student_id IN (SELECT student_id FROM public.student_parents WHERE parent_id = auth.uid())
);

-- Trigger for updated_at on students
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
