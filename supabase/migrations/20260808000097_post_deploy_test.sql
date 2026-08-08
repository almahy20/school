-- ==========================================================================
-- 20260808000097_post_deploy_test.sql
-- This runs AFTER the new Edge Function has been deployed successfully.
-- Step 1: Clean old TEST entries so results are unambiguous.
-- Step 2: Insert 2 NEW test notifications into the pipeline
--         → triggers fire → net.http_post → **NEW** Edge Function (3-strike!)
-- After running: wait ~20 seconds, then run the "AFTER" queries in the
-- comments at the very bottom of this file in SQL Editor.
-- ==========================================================================

-- (1) Cleanup prior TEST data so we can see EXACTLY what this run produces
DELETE FROM public.push_delivery_log
 WHERE notification_id IN (
         SELECT id FROM public.notifications
          WHERE metadata->>'source' = 'e2e_test_migration_20260808'
             OR type = 'system_test'
       );

DELETE FROM public.push_trigger_errors
 WHERE notification_id IN (
         SELECT id FROM public.notifications
          WHERE metadata->>'source' = 'e2e_test_migration_20260808'
             OR type = 'system_test'
       );

DELETE FROM public.notifications
 WHERE metadata->>'source' = 'e2e_test_migration_20260808'
    OR type = 'system_test';

-- (2) Pick a valid user & school that actually has real push_subscriptions
--     so the test actually reaches webpush.sendNotification (not just 0 rows sent)
DO $body$
DECLARE
    v_best_user_id  UUID;
    v_best_school_id UUID;
    v_user_cnt      INTEGER;
    v_sub_cnt       INTEGER;
    v_n1            UUID := gen_random_uuid();
    v_n2            UUID := gen_random_uuid();
BEGIN
    -- Strategy: pick the user_id with the MOST push_subscriptions so the
    -- test path actually exercises send-notification code with real rows.
    SELECT ps.user_id,
           COALESCE(n.school_id, (SELECT school_id FROM public.profiles p WHERE p.id = ps.user_id LIMIT 1)),
           COUNT(*)
      INTO v_best_user_id, v_best_school_id, v_sub_cnt
      FROM public.push_subscriptions ps
      LEFT JOIN public.notifications n ON n.user_id = ps.user_id
     GROUP BY 1, 2
     ORDER BY COUNT(*) DESC
     LIMIT 1;

    IF v_best_user_id IS NULL THEN
        RAISE WARNING '============================================================';
        RAISE WARNING 'NO push_subscriptions ROWS FOUND IN DB AT ALL.';
        RAISE WARNING 'This means you do NOT have any client-side subscription yet.';
        RAISE WARNING 'FIX: Open the PWA on an Android phone, log in as ANY user,';
        RAISE WARNING '     tap "Enable Notifications" / "Allow Notifications" and let';
        RAISE WARNING '     the client call the /subscribe endpoint. Then re-run this test.';
        RAISE WARNING '============================================================';

        -- Fallback: use any user so the trigger still gets tested (just 0 sent)
        SELECT id INTO v_best_user_id FROM public.profiles LIMIT 1;
        SELECT id INTO v_best_school_id FROM public.schools LIMIT 1;
        v_sub_cnt := 0;
    END IF;

    -- Count users (sanity)
    SELECT COUNT(*) INTO v_user_cnt FROM public.profiles;

    RAISE WARNING '============================================================';
    RAISE WARNING 'POST-DEPLOY PIPELINE TEST (2 notifications — AFTER new EF deploy)';
    RAISE WARNING '============================================================';
    RAISE WARNING 'Selected user_id   = %', v_best_user_id;
    RAISE WARNING 'Selected school_id = %', v_best_school_id;
    RAISE WARNING 'Subscriptions for this user = %', v_sub_cnt;
    RAISE WARNING 'Total profiles in system    = %', v_user_cnt;

    -- Notification 1: normal priority, no URL override
    INSERT INTO public.notifications
        (id, user_id, school_id, type, title, message, metadata, created_at)
    VALUES
        (v_n1,
         v_best_user_id,
         v_best_school_id,
         'system_test',
         '[Pipeline OK 1/2] First test post-deploy',
         'This is notification #1. If delivered, trigger + pg_net + new EF + 3-strike ALL work.',
         jsonb_build_object('is_test', true,
                            'source',  'post_deploy_test_20260808_run',
                            'run_seq', 1,
                            'url',     '/notifications'),
         NOW());

    -- Notification 2: explicitly a different URL type, to test routing too
    INSERT INTO public.notifications
        (id, user_id, school_id, type, title, message, metadata, created_at)
    VALUES
        (v_n2,
         v_best_user_id,
         v_best_school_id,
         'teacher_message',
         '[Pipeline OK 2/2] MSG TYPE = teacher_message',
         'Second test (teacher_message). Ensures trigger URL-routing + url-in-json payload path is OK too.',
         jsonb_build_object('is_test', true,
                            'source',  'post_deploy_test_20260808_run',
                            'run_seq', 2),
         NOW());

    RAISE WARNING '✅ 2 notifications inserted.';
    RAISE WARNING '   notification 1 id = %', v_n1;
    RAISE WARNING '   notification 2 id = %', v_n2;
    RAISE WARNING '';
    RAISE WARNING '⏳  WAIT AT LEAST 20 SECONDS BEFORE RUNNING THE QUERIES BELOW';
    RAISE WARNING '    (pg_net runs HTTP POST async AFTER transaction commits;';
    RAISE WARNING '     Supabase hosted EF ~1s cold start + webpush round-trip ~3s)';
    RAISE WARNING '';
    RAISE WARNING '👉 AFTER WAITING 20 SEC, RUN THESE IN SQL EDITOR:';
    RAISE WARNING '';
    RAISE WARNING '  Step A — Did the vault guard-clause fire? (must return 0 rows)';
    RAISE WARNING '  SELECT error_code, error_message, created_at FROM public.push_trigger_errors ORDER BY created_at DESC LIMIT 10;';
    RAISE WARNING '';
    RAISE WARNING '  Step B — Did trigger capture pg_net request_id? (must return 2 rows)';
    RAISE WARNING '  SELECT id, notification_id, pg_net_request_id, queued_at FROM public.push_delivery_log ORDER BY queued_at DESC LIMIT 10;';
    RAISE WARNING '';
    RAISE WARNING '  Step C — FULL JOIN: HTTP status + EF response body (the big one!)';
    RAISE WARNING '  SELECT log_id, notification_id, status_code, error_msg, response_body_preview';
    RAISE WARNING '    FROM public.push_delivery_with_response ORDER BY queued_at DESC LIMIT 10;';
    RAISE WARNING '';
    RAISE WARNING '  Step D — Did the EF correctly use failure_count? (sanity check 3-strike)';
    RAISE WARNING '  SELECT id, user_id, failure_count, last_failure_code, last_failure_at, endpoint';
    RAISE WARNING '    FROM public.push_subscriptions WHERE user_id = % ORDER BY failure_count DESC;', v_best_user_id;
    RAISE WARNING '';
    RAISE WARNING '  Step E — CLEANUP AFTER TEST:';
    RAISE WARNING '  DELETE FROM public.notifications WHERE id IN (% , %);', v_n1, v_n2;
    RAISE WARNING '  DELETE FROM public.push_delivery_log WHERE notification_id IN (% , %);', v_n1, v_n2;
END $body$;
