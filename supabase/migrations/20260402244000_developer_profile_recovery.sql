-- ==========================================
-- Migration: 20260402244000_developer_profile_recovery
-- Goal: Restore the developer's profile and super admin status after the total wipe
-- ==========================================

DO $$ 
DECLARE 
    v_user_id uuid;
    v_phone text := '0192837465';
    v_email text := '0192837465@school.local';
BEGIN
    -- 1. Find the existing developer in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email OR (raw_user_meta_data->>'phone' = v_phone);

    IF v_user_id IS NOT NULL THEN
        -- 2. Restore Profile
        INSERT INTO public.profiles (id, full_name, email, phone)
        VALUES (v_user_id, 'المطور الماحي', v_email, v_phone)
        ON CONFLICT (id) DO UPDATE SET 
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone;

        -- 3. Restore User Role as Super Admin
        INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin)
        VALUES (v_user_id, 'admin', NULL, true)
        ON CONFLICT (user_id) DO UPDATE SET 
            is_super_admin = true,
            role = 'admin',
            school_id = NULL;
            
        RAISE NOTICE 'Developer profile and Super Admin status restored for UID: %', v_user_id;
    ELSE
        RAISE NOTICE 'Developer not found in auth.users. Please ensure you are logged in or have a user record.';
    END IF;
END $$;
