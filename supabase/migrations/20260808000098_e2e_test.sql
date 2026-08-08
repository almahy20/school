-- ==========================================================================
-- 20260808000098_e2e_test.sql
-- End-to-end validation:
--   1) Checks if SUPABASE_SERVICE_ROLE_KEY exists in vault
--   2) Confirms correct trigger attached to notifications
--   3) Inserts 1 real TEST notification so the pipeline fires
--      → after 10 seconds you can SELECT from the 3 new diagnostic tables
-- All messages use dollar-quoting / plain ASCII to avoid escaping issues
-- with Arabic apostrophe characters. Safe to delete + run again.
-- ==========================================================================

DO $test$
DECLARE
    v_vault_key_exists INTEGER;
    v_vault_key_length INTEGER;
    v_vault_key_preview TEXT;
    v_notif_id         UUID    := gen_random_uuid();
    v_dummy_user_id    UUID;
    v_school_id        UUID;
    v_trigger_name     TEXT;
    v_trigger_cnt      INTEGER;
    v_created_ts       TEXT    := to_char(clock_timestamp(), 'DD/MM/YYYY HH24:MI:SS');
BEGIN
    -- ===== STEP 1: VAULT CHECK (THE #1 ROOT CAUSE OF ALL SILENT FAILURES) =====
    BEGIN
        SELECT COUNT(*),
               COALESCE(length(decrypted_secret), 0),
               left(COALESCE(decrypted_secret,''), 12) || '...' || right(COALESCE(decrypted_secret,''), 4)
          INTO v_vault_key_exists, v_vault_key_length, v_vault_key_preview
          FROM vault.decrypted_secrets
         WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
    EXCEPTION WHEN OTHERS THEN
        v_vault_key_exists  := -1;
        v_vault_key_length  := 0;
        v_vault_key_preview := 'EXCEPTION: ' || SQLERRM;
    END;

    RAISE WARNING '============================================================';
    RAISE WARNING '=== [1/3] VAULT CHECK — CRITICAL FOR PUSH TO WORK        ===';
    RAISE WARNING '============================================================';

    IF v_vault_key_exists = -1 THEN
        RAISE WARNING 'FAIL: vault table NOT READABLE: %', v_vault_key_preview;
    ELSIF v_vault_key_exists = 0 OR v_vault_key_length < 20 THEN
        RAISE WARNING 'FAIL: SUPABASE_SERVICE_ROLE_KEY MISSING OR EMPTY IN VAULT';
        RAISE WARNING 'FIX:  Dashboard -> Vault -> Secrets -> Add secret with:';
        RAISE WARNING '      Name = SUPABASE_SERVICE_ROLE_KEY';
        RAISE WARNING '      Val  = copy from Project Settings -> API -> service_role';
    ELSE
        RAISE WARNING 'PASS: SUPABASE_SERVICE_ROLE_KEY in vault (len=%, preview=%)',
                       v_vault_key_length, v_vault_key_preview;
    END IF;

    -- ===== STEP 2: TRIGGER CHECK =====
    SELECT COUNT(*), COALESCE(MAX(trigger_name), '<none>')
      INTO v_trigger_cnt, v_trigger_name
      FROM information_schema.triggers
     WHERE event_object_schema = 'public'
       AND event_object_table   = 'notifications';

    RAISE WARNING '============================================================';
    RAISE WARNING '=== [2/3] TRIGGER CHECK (notifications)                  ===';
    RAISE WARNING '============================================================';
    RAISE WARNING 'Expected: count=1,  name=tr_auto_push_on_notification';
    RAISE WARNING 'Actual  : count=%, name=%', v_trigger_cnt, v_trigger_name;

    IF v_trigger_cnt = 1 AND v_trigger_name = 'tr_auto_push_on_notification' THEN
        RAISE WARNING 'PASS: only one trigger attached and its name is correct';
    ELSE
        RAISE WARNING 'FAIL: unexpected trigger state — run Q1 verification query';
    END IF;

    -- ===== STEP 3: FIND A VALID USER & INSERT TEST NOTIFICATION =====
    BEGIN
        SELECT user_id, school_id
          INTO v_dummy_user_id, v_school_id
          FROM public.notifications
         ORDER BY created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_dummy_user_id := NULL;
        v_school_id    := NULL;
    END;

    IF v_dummy_user_id IS NULL THEN
        BEGIN
            SELECT id INTO STRICT v_dummy_user_id FROM public.profiles LIMIT 1;
            SELECT id INTO STRICT v_school_id    FROM public.schools  LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'WARN: no valid user_id found for test. SKIP insert.';
            RETURN;
        END;
    END IF;

    RAISE WARNING '============================================================';
    RAISE WARNING '=== [3/3] INSERT 1 TEST NOTIFICATION — pipeline firing!  ===';
    RAISE WARNING '============================================================';
    RAISE WARNING 'notification_id = %', v_notif_id;
    RAISE WARNING 'user_id         = %', v_dummy_user_id;
    RAISE WARNING 'school_id       = %', COALESCE(v_school_id::text, 'null');
    RAISE WARNING 'created at      = %', v_created_ts;

    INSERT INTO public.notifications
        (id, user_id, school_id, type, title, message, metadata, created_at)
    VALUES
        (v_notif_id,
         v_dummy_user_id,
         v_school_id,
         'system_test',
         '[TEST 123] Push Notification Pipeline Test',
         'If you can read this on the device, the whole system works! (sent at ' || v_created_ts || ')',
         jsonb_build_object('is_test', true, 'source', 'e2e_test_migration_20260808'),
         NOW());

    RAISE WARNING 'DONE: notification inserted! Wait 10-15 seconds for pg_net HTTP call.';
    RAISE WARNING '';
    RAISE WARNING '*** THEN RUN THESE 3 QUERIES IN SQL EDITOR ***';
    RAISE WARNING '';
    RAISE WARNING '  Qa) push_trigger_errors (vault / guard-clause log):';
    RAISE WARNING '      SELECT * FROM public.push_trigger_errors ORDER BY created_at DESC LIMIT 10;';
    RAISE WARNING '';
    RAISE WARNING '  Qb) push_delivery_log (pg_net request_id capture):';
    RAISE WARNING '      SELECT * FROM public.push_delivery_log ORDER BY queued_at DESC LIMIT 5;';
    RAISE WARNING '';
    RAISE WARNING '  Qc) push_delivery_with_response (JOIN to net._http_response):';
    RAISE WARNING '      SELECT * FROM public.push_delivery_with_response ORDER BY queued_at DESC LIMIT 5;';
    RAISE WARNING '';
    RAISE WARNING '  CLEANUP AFTER TEST:';
    RAISE WARNING '      DELETE FROM public.notifications WHERE id = %;', v_notif_id;
END $test$;
