-- RE-APPLY EMERGENCY FIX: handle_new_user with better error handling

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_phone text;
  target_role text;
BEGIN
  -- We wrap everything in an EXCEPTION block to avoid 500 errors if something fails
  BEGIN
    -- 1. Normalize phone
    normalized_phone := NULLIF(
      regexp_replace(
        COALESCE(NEW.raw_user_meta_data->>'phone', split_part(COALESCE(NEW.email, ''), '@', 1)),
        '\D', '', 'g'
      ),
      ''
    );

    -- 2. Determine role from metadata
    target_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');

    -- 3. Sync Profile
    INSERT INTO public.profiles (id, full_name, email, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      CASE WHEN NEW.email ILIKE '%@school.local' THEN NULL ELSE NEW.email END,
      normalized_phone
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone;

    -- 4. Sync User Role (Force update)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, target_role)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

    -- 5. Auto-link parent
    IF target_role = 'parent' AND normalized_phone IS NOT NULL THEN
      INSERT INTO public.student_parents (student_id, parent_id)
      SELECT id, NEW.id
      FROM public.students
      WHERE parent_phone = normalized_phone
      ON CONFLICT (student_id, parent_id) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Prevent 500 by just logging the warning
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
