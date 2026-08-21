-- ════════════════════════════════════════════════════════════════════════
-- Migration: add_custom_jwt_hook
-- Goal: Embed school_id, role, and approval_status directly into the JWT
--       so the frontend can start dashboard queries immediately on login
--       without waiting for the get_complete_user_data RPC round-trip.
--
-- ⚠️  After running this migration you MUST activate the hook in the
--     Supabase Dashboard:
--     Authentication → Hooks → "Customize access token (JWT) claims"
--     → choose "Postgres function" → select public.custom_access_token_hook
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims        jsonb;
  user_id       uuid;
  v_school_id   uuid;
  v_role        text;
  v_is_super    boolean;
  v_approval    text;
BEGIN
  -- Extract the user id from the event
  user_id := (event->>'user_id')::uuid;

  -- Start from the existing claims
  claims := event->'claims';

  -- Fetch role data from user_roles (single row, indexed on user_id)
  SELECT
    ur.school_id,
    ur.role,
    ur.is_super_admin,
    ur.approval_status
  INTO
    v_school_id,
    v_role,
    v_is_super,
    v_approval
  FROM public.user_roles ur
  WHERE ur.user_id = user_id
  LIMIT 1;

  -- Only embed if found (new users without roles yet get plain JWT)
  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}') ||
      jsonb_build_object(
        'school_id',       v_school_id,
        'role',            v_role,
        'is_super_admin',  COALESCE(v_is_super, false),
        'approval_status', COALESCE(v_approval, 'approved')
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to the supabase_auth_admin role
-- (required for Supabase to be able to call this function as a hook)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for security — only auth admin should call it
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;

NOTIFY pgrst, 'reload schema';
