-- Migration: 20260819161000_revert_search_path_fix.sql
-- Goal: Fix broken RPCs by setting search_path to public instead of empty.

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
        alter_query := format('ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp;', func_record.schema_name, func_record.function_name, func_record.args); 
        EXECUTE alter_query; 
    END LOOP; 
END $$;

NOTIFY pgrst, 'reload schema';