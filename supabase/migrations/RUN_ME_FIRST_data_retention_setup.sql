-- Quick Setup Script for Smart Data Retention System
-- Run this in Supabase SQL Editor to get started immediately

-- Step 1: Verify installation
DO $$
BEGIN
    RAISE NOTICE '🔍 Checking system installation...';
END $$;

-- Check if tables exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data_retention_policies')
        THEN '✅ data_retention_policies table exists'
        ELSE '❌ data_retention_policies table NOT FOUND - Run migration first!'
    END as status;

-- Check if functions exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_data_cleanup')
        THEN '✅ trigger_data_cleanup function exists'
        ELSE '❌ trigger_data_cleanup function NOT FOUND - Run migration first!'
    END as status;

-- Check if views exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'database_size_info')
        THEN '✅ database_size_info view exists'
        ELSE '❌ database_size_info view NOT FOUND - Run migration first!'
    END as status;

-- Step 2: Show current database size
DO $$
BEGIN
    RAISE NOTICE '📊 Current Database Status:';
END $$;

SELECT 
    table_name,
    row_count,
    size,
    oldest_record,
    newest_record
FROM public.database_size_info
ORDER BY 
    CASE table_name
        WHEN 'attendance' THEN 1
        WHEN 'grades' THEN 2
        WHEN 'messages' THEN 3
        WHEN 'notifications' THEN 4
        WHEN 'fees' THEN 5
        ELSE 6
    END;

-- Step 3: Show retention policies
DO $$
BEGIN
    RAISE NOTICE '⚙️ Current Retention Policies:';
END $$;

SELECT 
    table_name,
    CASE 
        WHEN retention_period IS NULL THEN '∞ Forever'
        ELSE retention_period::text
    END as retention,
    CASE 
        WHEN enabled THEN '✅ Active'
        ELSE '❌ Disabled'
    END as status,
    description
FROM public.data_retention_policies
ORDER BY table_name;

-- Step 4: Estimate cleanup impact
DO $$
BEGIN
    RAISE NOTICE '🧹 Estimated Cleanup Impact:';
END $$;

SELECT 
    'notifications' as table_name,
    COUNT(*) as current_rows,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') as rows_to_delete,
    pg_size_pretty(pg_total_relation_size('notifications')) as current_size
FROM public.notifications

UNION ALL

SELECT 
    'messages' as table_name,
    COUNT(*) as current_rows,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '365 days') as rows_to_delete,
    pg_size_pretty(pg_total_relation_size('messages')) as current_size
FROM public.messages

UNION ALL

SELECT 
    'attendance' as table_name,
    COUNT(*) as current_rows,
    COUNT(*) FILTER (WHERE date < CURRENT_DATE - INTERVAL '730 days') as rows_to_delete,
    pg_size_pretty(pg_total_relation_size('attendance')) as current_size
FROM public.attendance;

-- Step 5: Instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '📋 NEXT STEPS:';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '1. Review the estimates above to see how much data will be cleaned';
    RAISE NOTICE '';
    RAISE NOTICE '2. Run cleanup manually:';
    RAISE NOTICE '   SELECT public.trigger_data_cleanup();';
    RAISE NOTICE '';
    RAISE NOTICE '3. Check results:';
    RAISE NOTICE '   SELECT * FROM public.database_size_info;';
    RAISE NOTICE '';
    RAISE NOTICE '4. Access the UI:';
    RAISE NOTICE '   Go to /data-retention in your app (Admin only)';
    RAISE NOTICE '';
    RAISE NOTICE '5. (Optional) Set up automatic cleanup with pg_cron:';
    RAISE NOTICE '   CREATE EXTENSION IF NOT EXISTS pg_cron;';
    RAISE NOTICE '   SELECT cron.schedule(''weekly-cleanup'', ''0 2 * * 0'', $$SELECT public.trigger_data_cleanup();$$);';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '✅ System is ready to use!';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;
