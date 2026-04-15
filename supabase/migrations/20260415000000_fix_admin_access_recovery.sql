-- Migration: 20260415000001_robust_admin_fix
-- Goal: Fix Admin access for 01020805467 using multiple match strategies

DO $$ 
DECLARE 
    v_user_id UUID;
    v_found_by TEXT;
BEGIN
    -- Search Strategy 1: Phone directly in profiles
    SELECT id INTO v_user_id FROM public.profiles WHERE phone = '01020805467' LIMIT 1;
    v_found_by := 'Phone in Profiles';

    -- Search Strategy 2: Email in auth users (the email constructed by our logic)
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = '01020805467@edara.com' LIMIT 1;
        v_found_by := 'Email in Auth';
    END IF;

    -- Search Strategy 3: Auth Metadata phone field
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE raw_user_meta_data->>'phone' = '01020805467' LIMIT 1;
        v_found_by := 'Auth Metadata Phone';
    END IF;

    IF v_user_id IS NOT NULL THEN
        -- 1. Restore User Role
        INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
        VALUES (
            v_user_id, 
            'admin', 
            (SELECT school_id FROM public.profiles WHERE id = v_user_id), 
            false, 
            'approved'
        )
        ON CONFLICT (user_id) DO UPDATE SET 
            role = 'admin', 
            approval_status = 'approved',
            is_super_admin = false;

        -- 2. Force Auth Metadata sync (Primary role indicator)
        UPDATE auth.users 
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', 'admin', 'phone', '01020805467')
        WHERE id = v_user_id;
        
        -- 3. Ensure a valid Profile exists
        INSERT INTO public.profiles (id, full_name, phone, email, school_id)
        VALUES (v_user_id, 'المدير العام', '01020805467', '01020805467@edara.com', (SELECT school_id FROM public.user_roles WHERE user_id = v_user_id LIMIT 1))
        ON CONFLICT (id) DO UPDATE SET 
            phone = '01020805467',
            email = '01020805467@edara.com';

        RAISE NOTICE 'SUCCESS: Found user ID % via %. Admin permissions restored and locked.', v_user_id, v_found_by;
    ELSE
        RAISE WARNING 'CRITICAL: Account with identifier 01020805467 not found anywhere. Please ensure you have signed up first.';
    END IF;
END $$;
