-- 1. إنشاء جدول المدارس
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    subscription_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج مدرسة افتراضية للحفاظ على البيانات القديمة إن وجدت
INSERT INTO public.schools (id, name, status) 
VALUES ('00000000-0000-0000-0000-000000000001', 'مدرسة النظام الافتراضية', 'active')
ON CONFLICT DO NOTHING;

-- 2. توفير دور مستخدم (Super Admin)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- 3. إضافة school_id إلى كافة الجداول (السماح بالفراغ مؤقتاً لتحديث البيانات)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.exam_templates ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_parents ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 4. تحديث البيانات القديمة لتنتمي للمدرسة الافتراضية
UPDATE public.profiles SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.students SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.classes SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.grades SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.attendance SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.complaints SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.fees SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.fee_payments SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.exam_templates SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.student_parents SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;
UPDATE public.user_roles SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 5. تفعيل القيود (NOT NULL) (اختياري، في بيئة الإنتاج يفضل تفعيلها)
ALTER TABLE public.profiles ALTER COLUMN school_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.user_roles ALTER COLUMN school_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- 6. دوال الأمان لتبسيط سياسات (RLS)
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- تفعيل الـ RLS على جدول schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins can view all schools" ON public.schools;
CREATE POLICY "Super Admins can view all schools" ON public.schools FOR ALL USING (public.is_super_admin() = true);

-- سياسة لأن يرى المستخدمون تفاصيل مدرستهم فقط
DROP POLICY IF EXISTS "Users can view their own school" ON public.schools;
CREATE POLICY "Users can view their own school" ON public.schools FOR SELECT USING (id = public.get_auth_school_id());

-- 7. تحديث بعض سياسات RLS الحالية لتأخذ الـ school_id في الاعتبار (كمثال, الـ profiles)
-- من الأفضل في التطبيق الأمامي (React) إرسال الـ school_id مع كل عملية إدخال (Insert).

