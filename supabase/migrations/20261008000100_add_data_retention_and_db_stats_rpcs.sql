-- ============================================================
-- Migration: Add Data Retention System & Database Stats RPCs
-- Date: 2026-10-08
-- ============================================================

-- 1. Create get_database_row_counts RPC
CREATE OR REPLACE FUNCTION public.get_database_row_counts()
RETURNS TABLE(table_name text, row_count bigint, size_estimate text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.has_role((SELECT auth.uid()), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    c.relname::text AS table_name,
    c.reltuples::bigint AS row_count,
    pg_size_pretty(pg_total_relation_size(c.oid))::text AS size_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.reltuples DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_database_row_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_database_row_counts() TO authenticated;

-- 2. Create data_retention_policies table
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT UNIQUE NOT NULL,
    retention_period TEXT,
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_retention_policies_select" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_select"
ON public.data_retention_policies FOR SELECT
TO authenticated
USING (
    public.is_super_admin() OR public.has_role((SELECT auth.uid()), 'admin')
);

DROP POLICY IF EXISTS "data_retention_policies_update" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_update"
ON public.data_retention_policies FOR UPDATE
TO authenticated
USING (
    public.is_super_admin() OR public.has_role((SELECT auth.uid()), 'admin')
);

INSERT INTO public.data_retention_policies (table_name, retention_period, enabled, description)
VALUES
    ('attendance', '365 days', true, 'سجلات حضور وغياب الطلاب'),
    ('notifications', '90 days', true, 'إشعارات وتنبيهات النظام للمستخدمين'),
    ('notification_delivery_logs', '60 days', true, 'سجلات تسليم الإشعارات اليومية'),
    ('push_delivery_log', '30 days', true, 'سجلات إشعارات الويب Push'),
    ('audit_logs', '180 days', true, 'سجلات تدقيق العمليات والأنشطة'),
    ('push_trigger_errors', '30 days', true, 'سجلات أخطاء إرسال الإشعارات')
ON CONFLICT (table_name) DO NOTHING;

GRANT SELECT, UPDATE ON public.data_retention_policies TO authenticated;

-- 3. View: database_size_info
CREATE OR REPLACE VIEW public.database_size_info AS
SELECT 
    c.relname::text AS table_name,
    c.reltuples::bigint AS row_count,
    pg_size_pretty(pg_total_relation_size(c.oid))::text AS size,
    NULL::text AS oldest_record,
    NULL::text AS newest_record
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r';

GRANT SELECT ON public.database_size_info TO authenticated;

-- 4. RPC: trigger_data_cleanup
CREATE OR REPLACE FUNCTION public.trigger_data_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_policy RECORD;
    v_deleted INT;
    v_total_deleted INT := 0;
    v_tables_cleaned INT := 0;
    v_days INT;
    v_cutoff TIMESTAMPTZ;
    v_cutoff_date DATE;
    v_details JSONB := '[]'::jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.has_role((SELECT auth.uid()), 'admin')) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    FOR v_policy IN
        SELECT table_name, retention_period
        FROM public.data_retention_policies
        WHERE enabled = true AND retention_period IS NOT NULL
    LOOP
        v_days := split_part(v_policy.retention_period, ' ', 1)::INT;
        IF v_days IS NOT NULL AND v_days > 0 AND v_days < 36500 THEN
            v_cutoff := NOW() - (v_days || ' days')::INTERVAL;
            v_cutoff_date := CURRENT_DATE - v_days;
            v_deleted := 0;

            IF v_policy.table_name = 'attendance' THEN
                DELETE FROM public.attendance WHERE date < v_cutoff_date;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;
            ELSIF v_policy.table_name = 'notifications' THEN
                DELETE FROM public.notifications WHERE created_at < v_cutoff;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;
            ELSIF v_policy.table_name = 'notification_delivery_logs' THEN
                DELETE FROM public.notification_delivery_logs WHERE created_at < v_cutoff;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;
            ELSIF v_policy.table_name = 'push_delivery_log' THEN
                DELETE FROM public.push_delivery_log WHERE queued_at < v_cutoff;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;
            ELSIF v_policy.table_name = 'audit_logs' THEN
                DELETE FROM public.audit_logs WHERE created_at < v_cutoff;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;
            ELSIF v_policy.table_name = 'push_trigger_errors' THEN
                DELETE FROM public.push_trigger_errors WHERE created_at < v_cutoff;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;
            END IF;

            IF v_deleted > 0 THEN
                v_tables_cleaned := v_tables_cleaned + 1;
                v_total_deleted := v_total_deleted + v_deleted;
            END IF;

            v_details := v_details || jsonb_build_array(jsonb_build_object(
                'table', v_policy.table_name,
                'deleted', v_deleted,
                'cutoff', v_cutoff::text
            ));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'tables_cleaned', v_tables_cleaned,
        'total_deleted', v_total_deleted,
        'details', v_details,
        'executed_at', NOW()::text
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_data_cleanup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_data_cleanup() TO authenticated;
