-- ==========================================
-- Migration: 20260402236000_get_complete_user_data
-- Goal: Provide a single RPC for fetching all user data to resolve Auth Lock conflicts
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_complete_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_role RECORD;
    v_school RECORD;
    v_result jsonb;
BEGIN
    -- 1. Get Profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    
    -- 2. Get Role
    SELECT * INTO v_role FROM public.user_roles WHERE user_id = p_user_id;
    
    -- 3. Get School if exists
    IF v_profile.school_id IS NOT NULL THEN
        SELECT * INTO v_school FROM public.schools WHERE id = v_profile.school_id;
    END IF;

    -- 4. Build result
    v_result := jsonb_build_object(
        'profile', to_jsonb(v_profile),
        'role', to_jsonb(v_role),
        'school', to_jsonb(v_school)
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO anon;
