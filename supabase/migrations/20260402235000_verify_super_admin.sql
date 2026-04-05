-- ==========================================
-- Migration: 20260402235000_verify_super_admin
-- Goal: Force-assign Super Admin rights to the developer
-- ==========================================

-- 1. IDENTIFY & FIX SUPER ADMIN
DO $$ 
DECLARE 
    usr RECORD;
BEGIN
    FOR usr IN (SELECT * FROM auth.users WHERE email = '0192837465@school.local' OR raw_user_meta_data->>'phone' = '0192837465') LOOP
        -- Upsert into user_roles
        INSERT INTO public.user_roles (user_id, role, is_super_admin, approval_status)
        VALUES (usr.id, 'admin', true, 'approved')
        ON CONFLICT (user_id) DO UPDATE SET
            role = 'admin',
            is_super_admin = true,
            approval_status = 'approved';
            
        -- Upsert into profiles
        INSERT INTO public.profiles (id, full_name, phone, email)
        VALUES (usr.id, 'المطور الماحي', '0192837465', usr.email)
        ON CONFLICT (id) DO UPDATE SET
            full_name = 'المطور الماحي',
            phone = '0192837465';
            
        RAISE NOTICE 'Verified Super Admin rights for %', usr.email;
    END LOOP;
END $$;

-- 2. ROBUST SUPER ADMIN CHECK
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    is_sa BOOLEAN;
BEGIN
    -- Directly check user_roles table with SECURITY DEFINER
    -- We use a raw query here to bypass any context issues
    SELECT is_super_admin INTO is_sa
    FROM public.user_roles
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    RETURN COALESCE(is_sa, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFRESH GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
NOTIFY pgrst, 'reload schema';
