-- Migration: 20260915000000_fix_rls_references_user_metadata.sql
-- Goal: Fix Supabase Linter ERROR 0015_rls_references_user_metadata
-- Drops insecure user_roles_admin_read_fallback policy referencing user_metadata
-- and ensures user_roles_admin_read uses app_metadata with secure SECURITY DEFINER fallback.

DO $$
BEGIN
    -- 1. Drop the insecure fallback policy flagged by the database linter
    DROP POLICY IF EXISTS "user_roles_admin_read_fallback" ON public.user_roles;
    DROP POLICY IF EXISTS "user_roles_metadata_fallback"   ON public.user_roles;

    -- 2. Drop existing user_roles_admin_read to update it cleanly
    DROP POLICY IF EXISTS "user_roles_admin_read" ON public.user_roles;

    -- 3. Recreate user_roles_admin_read securely:
    -- - Primary: app_metadata (set by custom_access_token_hook / Supabase Auth Admin)
    -- - Fallback: SECURITY DEFINER helper functions (is_super_admin / is_school_admin)
    -- NEVER references user_metadata, which end-users could edit.
    CREATE POLICY "user_roles_admin_read"
        ON public.user_roles
        FOR SELECT
        TO authenticated
        USING (
            -- A. Super admin check via secure app_metadata OR SECURITY DEFINER function
            COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) = true
            OR public.is_super_admin()
            OR
            -- B. School admin check via secure app_metadata
            (
                (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
                AND (auth.jwt() -> 'app_metadata' ->> 'school_id') IS NOT NULL
                AND school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
            )
            OR
            -- C. Fallback when app_metadata hook is not enabled: secure database check via SECURITY DEFINER
            (
                (auth.jwt() -> 'app_metadata' ->> 'role') IS NULL
                AND public.is_school_admin(school_id)
            )
        );
END $$;
