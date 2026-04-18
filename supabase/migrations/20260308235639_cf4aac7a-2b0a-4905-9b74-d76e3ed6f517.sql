
-- Add parent_phone to students so admin can register pending parent phones
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone text;

-- Ensure unique constraint on student_parents to allow ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_parents_student_id_parent_id_key'
  ) THEN
    ALTER TABLE public.student_parents 
      ADD CONSTRAINT student_parents_student_id_parent_id_key UNIQUE (student_id, parent_id);
  END IF;
END $$;

-- Update handle_new_user: auto-link students whose parent_phone matches when parent registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_phone text;
BEGIN
  normalized_phone := NULLIF(
    regexp_replace(
      COALESCE(NEW.raw_user_meta_data->>'phone', split_part(COALESCE(NEW.email, ''), '@', 1)),
      '\D', '', 'g'
    ),
    ''
  );

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN NEW.email ILIKE '%@school.local' THEN NULL
      ELSE NEW.email
    END,
    normalized_phone
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'parent')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Auto-link students whose parent_phone matches this phone (instant children visibility)
  IF normalized_phone IS NOT NULL THEN
    INSERT INTO public.student_parents (student_id, parent_id)
    SELECT id, NEW.id
    FROM public.students
    WHERE parent_phone = normalized_phone
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Function to also auto-link when an existing parent updates their phone
CREATE OR REPLACE FUNCTION public.handle_profile_phone_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND (OLD.phone IS NULL OR OLD.phone <> NEW.phone) THEN
    INSERT INTO public.student_parents (student_id, parent_id)
    SELECT id, NEW.id
    FROM public.students
    WHERE parent_phone = NEW.phone
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on profiles: fire when phone is set or updated
DROP TRIGGER IF EXISTS on_profile_phone_update ON public.profiles;
CREATE TRIGGER on_profile_phone_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_phone_update();
