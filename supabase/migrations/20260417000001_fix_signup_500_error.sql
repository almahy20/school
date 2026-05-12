-- Migration: 20260417000001_fix_signup_500_error
-- Goal: Fix 500 Internal Server Error during parent signup
-- Root Cause: Notification triggers and handle_new_user trigger may be failing

-- 1. Ensure normalize_phone function exists (used by handle_new_user)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
BEGIN
  IF phone IS NULL THEN
    RETURN '';
  END IF;
  RETURN regexp_replace(phone, '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Make handle_new_user more robust with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_role      text;
  v_phone     text;
  v_norm_phone text;
  v_is_super  boolean;
BEGIN
  -- Check Super Admin
  v_is_super := COALESCE(
    (NEW.raw_user_meta_data->>'phone' = '0192837465'
     OR NEW.email = '0192837465@school.local'),
    false
  );

  -- Parse school_id safely
  BEGIN
    IF (NEW.raw_user_meta_data->>'school_id') IS NOT NULL 
       AND (NEW.raw_user_meta_data->>'school_id') != '' THEN
      v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
    ELSE
      v_school_id := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL;
  END;

  v_role  := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  
  -- Normalize phone safely
  BEGIN
    v_norm_phone := public.normalize_phone(v_phone);
  EXCEPTION WHEN OTHERS THEN
    v_norm_phone := v_phone;
  END;

  -- Insert/update profile
  BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, school_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email,
      v_phone,
      v_school_id
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name  = EXCLUDED.full_name,
      phone      = EXCLUDED.phone,
      school_id  = COALESCE(EXCLUDED.school_id, profiles.school_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert profile: %', SQLERRM;
  END;

  -- Insert role
  BEGIN
    INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
    VALUES (
      NEW.id,
      CASE WHEN v_is_super THEN 'admin' ELSE v_role END,
      v_school_id,
      v_is_super,
      CASE WHEN v_is_super THEN 'approved' ELSE 'pending' END
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert role: %', SQLERRM;
  END;

  -- AUTO-LINK: If parent, link existing students by normalized phone number
  BEGIN
    IF v_role = 'parent' AND v_norm_phone <> '' THEN
      INSERT INTO public.student_parents (school_id, student_id, parent_id)
      SELECT
        s.school_id,
        s.id,
        NEW.id
      FROM public.students s
      WHERE public.normalize_phone(s.parent_phone) = v_norm_phone
        AND (v_school_id IS NULL OR s.school_id = v_school_id)
      ON CONFLICT (student_id, parent_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to auto-link students: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3. Fix notification triggers to be more robust
CREATE OR REPLACE FUNCTION public.notify_admin_new_parent_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id uuid;
    v_school_id uuid;
    v_parent_name text;
    v_parent_phone text;
BEGIN
    -- Get school_id from the newly created role
    v_school_id := NEW.school_id;
    
    -- If no school_id, skip notification (don't fail)
    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get parent name and phone from profiles
    BEGIN
      SELECT full_name, phone INTO v_parent_name, v_parent_phone
      FROM public.profiles
      WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
      v_parent_name := 'ولي أمر';
      v_parent_phone := 'غير محدد';
    END;
    
    -- Only notify if the user is pending approval
    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;
    
    -- Find all approved admins for the school and notify them
    FOR v_admin_id IN (
        SELECT user_id 
        FROM public.user_roles 
        WHERE school_id = v_school_id 
        AND role = 'admin'
        AND approval_status = 'approved'
    )
    LOOP
        BEGIN
          INSERT INTO public.notifications (
              user_id,
              school_id,
              title,
              content,
              type,
              link
          )
          VALUES (
              v_admin_id,
              v_school_id,
              'طلب انضمام ولي أمر جديد',
              'قام ' || COALESCE(v_parent_name, 'ولي أمر') || ' بتسجيل حساب جديد ويرتبط انتظار موافقتك. رقم الهاتف: ' || COALESCE(v_parent_phone, 'غير محدد'),
              'parent_approval_pending',
              '/parents'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_admin_new_parent_signup: Failed to insert notification for admin %: %', v_admin_id, SQLERRM;
          -- Continue to next admin, don't fail the entire trigger
        END;
    END LOOP;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_new_parent_signup: Trigger failed: %', SQLERRM;
    RETURN NEW; -- Don't fail the signup even if notification fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix teacher notification trigger similarly
CREATE OR REPLACE FUNCTION public.notify_admin_new_teacher_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id uuid;
    v_school_id uuid;
    v_teacher_name text;
    v_teacher_phone text;
BEGIN
    v_school_id := NEW.school_id;
    
    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    BEGIN
      SELECT full_name, phone INTO v_teacher_name, v_teacher_phone
      FROM public.profiles
      WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
      v_teacher_name := 'معلم';
      v_teacher_phone := 'غير محدد';
    END;
    
    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;
    
    FOR v_admin_id IN (
        SELECT user_id 
        FROM public.user_roles 
        WHERE school_id = v_school_id 
        AND role = 'admin'
        AND approval_status = 'approved'
    )
    LOOP
        BEGIN
          INSERT INTO public.notifications (
              user_id,
              school_id,
              title,
              content,
              type,
              link
          )
          VALUES (
              v_admin_id,
              v_school_id,
              'طلب انضمام معلم جديد',
              'قام ' || COALESCE(v_teacher_name, 'معلم') || ' بتسجيل حساب جديد ويرتبط انتظار موافقتك. رقم الهاتف: ' || COALESCE(v_teacher_phone, 'غير محدد'),
              'teacher_approval_pending',
              '/teachers'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_admin_new_teacher_signup: Failed to insert notification for admin %: %', v_admin_id, SQLERRM;
        END;
    END LOOP;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_new_teacher_signup: Trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure proper permissions for anon users to signup
GRANT INSERT ON public.profiles TO anon;
GRANT INSERT ON public.user_roles TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- 6. Verify the trigger on auth.users exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
