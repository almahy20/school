-- ==========================================
-- Migration: 20260402234000_repair_orphaned_accounts
-- Goal: Backfill profiles and roles for existing Auth users
-- Fixes: "User profile or role not found" (Manual 500 error in frontend)
-- ==========================================

DO $$ 
DECLARE 
    usr RECORD;
    meta_full_name TEXT;
    meta_phone TEXT;
    meta_role TEXT;
    meta_school_id UUID;
    is_developer BOOLEAN;
BEGIN
    FOR usr IN (SELECT * FROM auth.users) LOOP
        -- Extract Metadata safely
        meta_full_name := COALESCE(usr.raw_user_meta_data->>'full_name', usr.raw_user_meta_data->>'fullName', 'مستخدم مجهول');
        meta_phone := COALESCE(usr.raw_user_meta_data->>'phone', '');
        meta_role := COALESCE(usr.raw_user_meta_data->>'role', 'parent');
        
        -- Safe UUID Casting
        IF (usr.raw_user_meta_data->>'school_id') IS NOT NULL AND (usr.raw_user_meta_data->>'school_id') != '' THEN
            meta_school_id := (usr.raw_user_meta_data->>'school_id')::UUID;
        ELSE
            meta_school_id := NULL;
        END IF;
        
        -- Special Developer Logic
        is_developer := (meta_phone = '0192837465' OR usr.email = '0192837465@school.local');

        -- 1. Repair Profiles (with individual error handling for UNIQUE constraints like phone)
        BEGIN
            INSERT INTO public.profiles (id, full_name, phone, school_id, email)
            VALUES (usr.id, meta_full_name, meta_phone, meta_school_id, usr.email)
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                phone = EXCLUDED.phone,
                school_id = EXCLUDED.school_id,
                email = EXCLUDED.email;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Skipping profile update for user % due to conflict (possibly phone # already in use).', usr.id;
        END;

        -- 2. Repair User Roles
        BEGIN
            INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
            VALUES (
                usr.id, 
                CASE WHEN is_developer THEN 'admin' ELSE meta_role END, 
                meta_school_id, 
                is_developer, 
                'approved'
            )
            ON CONFLICT (user_id) DO UPDATE SET
                role = EXCLUDED.role,
                school_id = EXCLUDED.school_id,
                is_super_admin = EXCLUDED.is_super_admin,
                approval_status = EXCLUDED.approval_status;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Skipping role update for user %', usr.id;
        END;

        -- 3. Update Super Admin Status for specifically known developer
        IF is_developer THEN
            UPDATE public.user_roles 
            SET is_super_admin = true, role = 'admin', approval_status = 'approved' 
            WHERE user_id = usr.id;
        END IF;

    END LOOP;
END $$;

-- Ensure triggers exist for FUTURE signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Force schema reload
NOTIFY pgrst, 'reload schema';
