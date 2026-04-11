-- Migration: 20260410000000_smart_data_retention_system.sql
-- Goal: Implement smart data retention to keep database size optimal (~500MB)
-- Strategy: Auto-cleanup old data + keep important data forever + create summary views

-- ==========================================
-- PART 1: DATA RETENTION POLICIES TABLE
-- ==========================================
-- Store retention settings so admins can customize

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    retention_period INTERVAL NOT NULL,
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default policies
-- FIX: Use very long period instead of NULL for permanent data
INSERT INTO public.data_retention_policies (table_name, retention_period, description) VALUES
    ('notifications', INTERVAL '90 days', 'Keep notifications for 3 months only'),
    ('messages', INTERVAL '365 days', 'Keep messages for 1 year'),
    ('attendance', INTERVAL '730 days', 'Keep daily attendance for 2 years'),
    ('complaints', INTERVAL '1825 days', 'Keep complaints for 5 years'),
    ('grades', INTERVAL '999999 days', 'Keep grades forever - academic record'),
    ('fees', INTERVAL '999999 days', 'Keep fees forever - financial record'),
    ('fee_payments', INTERVAL '999999 days', 'Keep payments forever - financial record')
ON CONFLICT (table_name) DO NOTHING;

-- ==========================================
-- PART 2: AUTOMATIC CLEANUP FUNCTION
-- ==========================================
-- This function deletes old data based on retention policies

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS TABLE(table_name TEXT, deleted_count BIGINT, cutoff_date TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
    policy RECORD;
    cutoff TIMESTAMP WITH TIME ZONE;
    delete_query TEXT;
    count_result BIGINT;
BEGIN
    FOR policy IN 
        SELECT * FROM public.data_retention_policies 
        WHERE enabled = true AND retention_period IS NOT NULL
    LOOP
        -- Calculate cutoff date
        cutoff := NOW() - policy.retention_period;
        
        -- Build dynamic DELETE query
        delete_query := format(
            'DELETE FROM public.%I WHERE created_at < $1 RETURNING id',
            policy.table_name
        );
        
        -- Count rows before delete
        EXECUTE format(
            'SELECT COUNT(*) FROM public.%I WHERE created_at < $1',
            policy.table_name
        ) USING cutoff INTO count_result;
        
        -- Execute delete
        IF count_result > 0 THEN
            EXECUTE delete_query USING cutoff;
            
            -- Return results
            table_name := policy.table_name;
            deleted_count := count_result;
            cutoff_date := cutoff;
            RETURN NEXT;
            
            RAISE NOTICE 'Cleaned up %: deleted % rows older than %', 
                policy.table_name, count_result, cutoff;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 3: SPECIAL ATTENDANCE CLEANUP
-- ==========================================
-- Attendance uses 'date' column, not 'created_at'

CREATE OR REPLACE FUNCTION public.cleanup_old_attendance()
RETURNS TABLE(deleted_count BIGINT, cutoff_date DATE) AS $$
DECLARE
    policy RECORD;
    cutoff DATE;
    count_result BIGINT;
BEGIN
    -- Get retention policy
    SELECT retention_period INTO policy
    FROM public.data_retention_policies
    WHERE table_name = 'attendance' AND enabled = true;
    
    IF policy.retention_period IS NOT NULL THEN
        cutoff := CURRENT_DATE - policy.retention_period;
        
        -- Count rows
        SELECT COUNT(*) INTO count_result
        FROM public.attendance
        WHERE date < cutoff;
        
        -- Delete old attendance
        IF count_result > 0 THEN
            DELETE FROM public.attendance
            WHERE date < cutoff;
            
            deleted_count := count_result;
            cutoff_date := cutoff;
            RETURN NEXT;
            
            RAISE NOTICE 'Cleaned up attendance: deleted % records older than %', 
                count_result, cutoff;
        END IF;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 4: HISTORICAL SUMMARY VIEWS
-- ==========================================
-- These views calculate statistics on-demand (ZERO storage cost!)

-- 4A. Student Attendance History (Yearly Summary)
CREATE OR REPLACE VIEW public.student_attendance_history AS
SELECT 
    a.student_id,
    s.name as student_name,
    s.school_id,
    EXTRACT(YEAR FROM a.date) as academic_year,
    COUNT(*) as total_days,
    COUNT(*) FILTER (WHERE a.status = 'present') as present_days,
    COUNT(*) FILTER (WHERE a.status = 'absent') as absent_days,
    COUNT(*) FILTER (WHERE a.status = 'late') as late_days,
    ROUND(
        COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 
        2
    ) as attendance_percentage
FROM public.attendance a
JOIN public.students s ON a.student_id = s.id
GROUP BY a.student_id, s.name, s.school_id, EXTRACT(YEAR FROM a.date)
ORDER BY academic_year DESC;

-- 4B. Student Grade History (Summary by Subject & Term)
-- FIX: Use score instead of grade_value, handle TEXT type with casting
CREATE OR REPLACE VIEW public.student_grade_history AS
SELECT 
    g.student_id,
    s.name as student_name,
    s.school_id,
    g.subject,
    g.term,
    COUNT(*) as grades_count,
    -- Handle TEXT score by casting to numeric for calculations
    AVG(CASE WHEN g.score ~ '^[0-9]+(\.[0-9]+)?$' THEN g.score::NUMERIC ELSE NULL END) as average_grade,
    MIN(CASE WHEN g.score ~ '^[0-9]+(\.[0-9]+)?$' THEN g.score::NUMERIC ELSE NULL END) as min_grade,
    MAX(CASE WHEN g.score ~ '^[0-9]+(\.[0-9]+)?$' THEN g.score::NUMERIC ELSE NULL END) as max_grade,
    EXTRACT(YEAR FROM g.created_at) as academic_year
FROM public.grades g
JOIN public.students s ON g.student_id = s.id
GROUP BY g.student_id, s.name, s.school_id, g.subject, g.term, EXTRACT(YEAR FROM g.created_at)
ORDER BY academic_year DESC, g.subject;

-- 4C. School-Wide Attendance Statistics
CREATE OR REPLACE VIEW public.school_attendance_stats AS
SELECT 
    a.school_id,
    sc.name as school_name,
    EXTRACT(YEAR FROM a.date) as year,
    EXTRACT(MONTH FROM a.date) as month,
    COUNT(DISTINCT a.student_id) as active_students,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE a.status = 'present') as present_count,
    COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
    COUNT(*) FILTER (WHERE a.status = 'late') as late_count,
    ROUND(
        COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 
        2
    ) as school_attendance_rate
FROM public.attendance a
LEFT JOIN public.schools sc ON a.school_id = sc.id
GROUP BY a.school_id, sc.name, EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date)
ORDER BY year DESC, month DESC;

-- 4D. Notification Statistics (for monitoring)
CREATE OR REPLACE VIEW public.notification_stats AS
SELECT 
    n.school_id,
    n.type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE n.is_read = true) as read_count,
    COUNT(*) FILTER (WHERE n.is_read = false) as unread_count,
    MIN(n.created_at) as oldest_notification,
    MAX(n.created_at) as newest_notification,
    ROUND(
        COUNT(*) FILTER (WHERE n.is_read = true) * 100.0 / NULLIF(COUNT(*), 0), 
        2
    ) as read_rate
FROM public.notifications n
GROUP BY n.school_id, n.type
ORDER BY total_count DESC;

-- 4E. Database Size Monitoring View
CREATE OR REPLACE VIEW public.database_size_info AS
SELECT 
    'notifications' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('notifications')) as size,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM public.notifications

UNION ALL

SELECT 
    'attendance' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('attendance')) as size,
    MIN(date) as oldest_record,
    MAX(date) as newest_record
FROM public.attendance

UNION ALL

SELECT 
    'messages' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('messages')) as size,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM public.messages

UNION ALL

SELECT 
    'grades' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('grades')) as size,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM public.grades

UNION ALL

SELECT 
    'fees' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('fees')) as size,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM public.fees;

-- ==========================================
-- PART 5: MANUAL CLEANUP FUNCTION
-- ==========================================
-- Admin can trigger cleanup manually

CREATE OR REPLACE FUNCTION public.trigger_data_cleanup()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    cleanup_record RECORD;
    total_deleted BIGINT := 0;
    tables_cleaned INT := 0;
    details JSONB := '[]'::jsonb;
BEGIN
    -- Run general cleanup
    FOR cleanup_record IN 
        SELECT * FROM public.cleanup_old_data()
    LOOP
        total_deleted := total_deleted + cleanup_record.deleted_count;
        tables_cleaned := tables_cleaned + 1;
        details := details || jsonb_build_object(
            'table', cleanup_record.table_name,
            'deleted', cleanup_record.deleted_count,
            'cutoff', cleanup_record.cutoff_date
        );
    END LOOP;
    
    -- Run attendance cleanup
    FOR cleanup_record IN 
        SELECT * FROM public.cleanup_old_attendance()
    LOOP
        total_deleted := total_deleted + cleanup_record.deleted_count;
        tables_cleaned := tables_cleaned + 1;
        details := details || jsonb_build_object(
            'table', 'attendance',
            'deleted', cleanup_record.deleted_count,
            'cutoff', cleanup_record.cutoff_date
        );
    END LOOP;
    
    result := jsonb_build_object(
        'success', true,
        'tables_cleaned', tables_cleaned,
        'total_deleted', total_deleted,
        'details', details,
        'executed_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 6: PERMISSIONS
-- ==========================================

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_old_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_data_cleanup() TO authenticated;

-- Allow admins to view retention policies
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view retention policies" ON public.data_retention_policies;
CREATE POLICY "Admins can view retention policies" 
ON public.data_retention_policies FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

DROP POLICY IF EXISTS "Admins can update retention policies" ON public.data_retention_policies;
CREATE POLICY "Admins can update retention policies" 
ON public.data_retention_policies FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

-- Allow all authenticated users to view summary views
GRANT SELECT ON public.student_attendance_history TO authenticated;
GRANT SELECT ON public.student_grade_history TO authenticated;
GRANT SELECT ON public.school_attendance_stats TO authenticated;
GRANT SELECT ON public.notification_stats TO authenticated;
GRANT SELECT ON public.database_size_info TO authenticated;

-- ==========================================
-- PART 7: COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON TABLE public.data_retention_policies IS 'Stores data retention policies for automatic cleanup';
COMMENT ON FUNCTION public.cleanup_old_data() IS 'Automatically deletes old data based on retention policies';
COMMENT ON FUNCTION public.cleanup_old_attendance() IS 'Special cleanup for attendance table (uses date column)';
COMMENT ON FUNCTION public.trigger_data_cleanup() IS 'Manual trigger for data cleanup - returns summary';
COMMENT ON VIEW public.student_attendance_history IS 'Yearly attendance summary per student (computed on-demand)';
COMMENT ON VIEW public.student_grade_history IS 'Grade history summary by subject and term (computed on-demand)';
COMMENT ON VIEW public.school_attendance_stats IS 'School-wide monthly attendance statistics';
COMMENT ON VIEW public.notification_stats IS 'Notification statistics by type and school';
COMMENT ON VIEW public.database_size_info IS 'Real-time database size monitoring for all tables';

-- ==========================================
-- NOTIFICATION
-- ==========================================

NOTIFY pgrst, 'reload schema';

-- Show success message
DO $$
BEGIN
    RAISE NOTICE '✅ Smart Data Retention System Installed Successfully!';
    RAISE NOTICE '📊 Summary Views Created: 5';
    RAISE NOTICE '🧹 Cleanup Functions Created: 3';
    RAISE NOTICE '⚙️ Default Retention Policies:';
    RAISE NOTICE '   - Notifications: 90 days';
    RAISE NOTICE '   - Messages: 1 year';
    RAISE NOTICE '   - Attendance: 2 years';
    RAISE NOTICE '   - Grades: Forever (academic record)';
    RAISE NOTICE '   - Fees: Forever (financial record)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next Steps:';
    RAISE NOTICE '   1. Run cleanup manually: SELECT public.trigger_data_cleanup();';
    RAISE NOTICE '   2. Set up pg_cron for automatic cleanup';
    RAISE NOTICE '   3. Monitor database size: SELECT * FROM public.database_size_info;';
END $$;
