-- Update handle_new_user to use school_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_phone text;
  target_role text;
  v_school_id uuid;
BEGIN
  BEGIN
    normalized_phone := NULLIF(
      regexp_replace(
        COALESCE(NEW.raw_user_meta_data->>'phone', split_part(COALESCE(NEW.email, ''), '@', 1)),
        '\D', '', 'g'
      ),
      ''
    );

    target_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
    
    -- Extract school_id from metadata if provided
    IF NEW.raw_user_meta_data->>'school_id' IS NOT NULL THEN
      v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
    END IF;

    -- Sync Profile
    INSERT INTO public.profiles (id, full_name, email, phone, school_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      CASE WHEN NEW.email ILIKE '%@school.local' THEN NULL ELSE NEW.email END,
      normalized_phone,
      v_school_id
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      school_id = COALESCE(EXCLUDED.school_id, public.profiles.school_id);

    -- Sync User Role
    INSERT INTO public.user_roles (user_id, role, school_id)
    VALUES (NEW.id, target_role, v_school_id)
    ON CONFLICT (user_id) DO UPDATE SET 
      role = EXCLUDED.role,
      school_id = COALESCE(EXCLUDED.school_id, public.user_roles.school_id);

    -- Auto-link parent
    IF target_role = 'parent' AND normalized_phone IS NOT NULL THEN
      INSERT INTO public.student_parents (student_id, parent_id, school_id)
      SELECT id, NEW.id, school_id
      FROM public.students
      WHERE parent_phone = normalized_phone
      ON CONFLICT (student_id, parent_id) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
