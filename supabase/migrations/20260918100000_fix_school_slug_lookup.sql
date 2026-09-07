-- ==========================================================================
-- Migration: 20260918100000_fix_school_slug_lookup.sql
-- Purpose  : إصلاح البحث عن المدرسة بالـ slug
--
-- المشكلة: get_school_id_by_slug تستخدم exact match فقط
-- مثلاً: slug = "الجيل-الجديد" لكن المحفوظ = "الجيل الجديد" يفشل
--
-- الحل:
-- 1. تحديث get_school_id_by_slug لدعم ilike fallback (plpgsql)
-- 2. التأكد من أن slug المدرسة مطابق لاسمها بعد التنظيف
-- ==========================================================================

SET search_path TO public;

-- 1. تحديث get_school_id_by_slug لدعم البحث المرن
CREATE OR REPLACE FUNCTION public.get_school_id_by_slug(p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Attempt 1: exact match
  SELECT id INTO v_id FROM public.schools WHERE slug = p_slug LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Attempt 2: case-insensitive match
  SELECT id INTO v_id FROM public.schools WHERE slug ILIKE p_slug LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Attempt 3: replace hyphens with spaces (الجيل-الجديد → الجيل الجديد)
  SELECT id INTO v_id FROM public.schools WHERE slug = replace(p_slug, '-', ' ') LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Attempt 4: search by school name containing normalized slug text
  SELECT id INTO v_id FROM public.schools
    WHERE name ILIKE '%' || replace(replace(p_slug, '-', ' '), '_', ' ') || '%'
    LIMIT 1;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_id_by_slug TO anon, authenticated, service_role;

-- 2. إصلاح slug المدرسة: تحويل المسافات إلى hyphens
--    مثلاً: "الجيل الجديد" → "الجيل-الجديد"
UPDATE public.schools
SET slug = replace(slug, ' ', '-')
WHERE slug LIKE '% %';

-- 3. تأكيد أن صلاحيات القراءة متاحة لـ anon
DROP POLICY IF EXISTS "anon_read_schools_basic" ON public.schools;
CREATE POLICY "anon_read_schools_basic" ON public.schools
  FOR SELECT TO anon, authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
