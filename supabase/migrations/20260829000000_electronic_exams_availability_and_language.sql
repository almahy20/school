-- ==========================================================================
-- Migration: 20260829000000_electronic_exams_availability_and_language.sql
-- Purpose  : إضافة مدة إتاحة الاختبار (نافذة الفتح والإغلاق) ودعم اللغة
-- ==========================================================================

SET search_path TO public;

DO $$
BEGIN
    -- 1. إضافة موعد بدء إتاحة الاختبار
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'electronic_exams' 
          AND column_name = 'available_from'
    ) THEN
        ALTER TABLE public.electronic_exams 
        ADD COLUMN available_from TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- 2. إضافة موعد نهاية إتاحة الاختبار (Deadline)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'electronic_exams' 
          AND column_name = 'available_until'
    ) THEN
        ALTER TABLE public.electronic_exams 
        ADD COLUMN available_until TIMESTAMPTZ;
    END IF;

    -- 3. إضافة لغة الاختبار (ar / en)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'electronic_exams' 
          AND column_name = 'language'
    ) THEN
        ALTER TABLE public.electronic_exams 
        ADD COLUMN language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en'));
    END IF;
END $$;

-- تحديث كاش PostgREST
NOTIFY pgrst, 'reload schema';
