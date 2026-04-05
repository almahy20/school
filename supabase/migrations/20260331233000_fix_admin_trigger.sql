-- EMERGENCY FIX: update handle_new_user with EXCEPTION handling to prevent 500 errors
-- This ensures that even if role assignment fails, the user is still created in Auth.

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
  BEGIN
    -- 1. Normalize phone
    normalized_phone := NULLIF(
      regexp_replace(
        COALESCE(NEW.raw_user_meta_data->>'phone', split_part(COALESCE(NEW.email, ''), '@', 1)),
        '\D', '', 'g'
      ),
      ''
    );

    -- 2. Determine role (default to 'parent')
    target_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');

    -- 3. Insert/Update Profile
    INSERT INTO public.profiles (id, full_name, email, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      CASE WHEN NEW.email ILIKE '%@school.local' THEN NULL ELSE NEW.email END,
      normalized_phone
    )
    ON CONFLICT (id) DO UPDATE
    SET
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = COALESCE(EXCLUDED.email, public.profiles.email),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

    -- 4. Insert/Update Role (Defensive approach)
    -- We first try to delete existing to ensure clean state if conflict persists
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, target_role);

    -- 5. Auto-link parent if applicable
    IF target_role = 'parent' AND normalized_phone IS NOT NULL THEN
      INSERT INTO public.student_parents (student_id, parent_id)
      SELECT id, NEW.id
      FROM public.students
      WHERE parent_phone = normalized_phone
      ON CONFLICT (student_id, parent_id) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Log error but DO NOT crash the transaction (Prevents 500 error)
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
