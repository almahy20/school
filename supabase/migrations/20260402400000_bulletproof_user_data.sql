-- Bulletproof RPC for user data
-- Migration: 20260402400000_bulletproof_user_data

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
BEGIN
    -- 1. Get Profile (Atomic)
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    
    -- 2. Get Role (Atomic)
    -- We select into a record to ensure we get column names
    SELECT * INTO v_role FROM public.user_roles WHERE user_id = p_user_id;
    
    -- 3. Get School (if profile exists)
    IF v_profile.school_id IS NOT NULL THEN
        SELECT * INTO v_school FROM public.schools WHERE id = v_profile.school_id;
    END IF;

    -- Return structured JSON
    RETURN jsonb_build_object(
        'profile', (CASE WHEN v_profile.id IS NOT NULL THEN to_jsonb(v_profile) ELSE null END),
        'role', (CASE WHEN v_role.user_id IS NOT NULL THEN to_jsonb(v_role) ELSE null END),
        'school', (CASE WHEN v_school.id IS NOT NULL THEN to_jsonb(v_school) ELSE null END)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO anon;

NOTIFY pgrst, 'reload schema';
