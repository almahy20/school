-- أضف هذا العمود إلى جدول grades لإصلاح دالة get_child_full_details
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS notes TEXT;
