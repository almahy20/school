-- Migration: 20260819160000_resolve_linter_security_warnings.sql
-- Goal: Resolve critical security warnings reported by Supabase Database Linter

-- 1. pg_net extension cannot be moved because it does not support SET SCHEMA.
-- We will ignore the linter warning for it to avoid dropping the extension and losing queues.

-- 2. Revoke external access to the materialized view
REVOKE ALL ON TABLE public.school_dashboard_stats FROM anon, authenticated, PUBLIC;

-- 3. Strictly revoke execute on the sensitive vault function
REVOKE EXECUTE ON FUNCTION public.get_vault_secret(text) FROM PUBLIC, anon, authenticated;

-- 4. Dynamically set search_path = '' for all SECURITY DEFINER functions in the public schema
DO $$ 
DECLARE 
    func_record RECORD; 
    alter_query TEXT; 
BEGIN 
    FOR func_record IN 
        SELECT n.nspname AS schema_name, p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args 
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.prosecdef = true 
    LOOP 
        alter_query := format('ALTER FUNCTION %I.%I(%s) SET search_path = ''''', func_record.schema_name, func_record.function_name, func_record.args); 
        EXECUTE alter_query; 
    END LOOP; 
END $$;

NOTIFY pgrst, 'reload schema';