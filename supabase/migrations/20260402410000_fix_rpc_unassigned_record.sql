-- Fix for RPC crash: record "v_school" is not assigned yet
-- Migration: 20260402410000_fix_rpc_unassigned_record

CREATE OR REPLACE FUNCTION public.get_complete_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile jsonb;
    v_role jsonb;
    v_school jsonb;
BEGIN
    -- 1. Get Profile
    SELECT to_jsonb(p) INTO v_profile FROM public.profiles p WHERE id = p_user_id;
    
    -- 2. Get Role
    SELECT to_jsonb(r) INTO v_role FROM public.user_roles r WHERE user_id = p_user_id;
    
    -- 3. Get School
    IF v_profile IS NOT NULL AND (v_profile->>'school_id') IS NOT NULL THEN
        SELECT to_jsonb(s) INTO v_school FROM public.schools s WHERE id = (v_profile->>'school_id')::uuid;
    ELSE
        v_school := null;
    END IF;

    -- Return structured JSON
    RETURN jsonb_build_object(
        'profile', v_profile,
        'role', v_role,
        'school', v_school
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO anon;

NOTIFY pgrst, 'reload schema';
