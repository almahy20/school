-- Migration: 20260416001500_user_management_final_fixes
-- Goal: Fix user deletion and ensure role persistence via auth metadata

-- 1. Function to delete a user entirely (Auth + Public Data)
-- This allows deleted users to re-register with the same phone/email
CREATE OR REPLACE FUNCTION public.delete_user_entirely(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Check if the caller is an admin or super admin
    IF NOT (public.is_super_admin() OR public.get_my_role() = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can delete users entirely.';
    END IF;

    -- Delete from auth.users (Cascades to public.profiles, public.user_roles, etc. because of FKs)
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- 2. Trigger Function to sync public.user_roles changes back to auth.users metadata
-- This ensures that roles persist across sessions and logouts
CREATE OR REPLACE FUNCTION public.sync_role_to_auth_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    UPDATE auth.users 
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'role', NEW.role,
            'school_id', NEW.school_id,
            'is_super_admin', COALESCE(NEW.is_super_admin, false)
        )
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$;

-- Apply sync trigger to user_roles
DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OF role, school_id, is_super_admin ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_auth_metadata();

-- 3. Update existing users metadata to match their current roles (One-time sync)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT user_id, role, school_id, is_super_admin FROM public.user_roles LOOP
        UPDATE auth.users 
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'role', r.role,
                'school_id', r.school_id,
                'is_super_admin', r.is_super_admin
            )
        WHERE id = r.user_id;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
