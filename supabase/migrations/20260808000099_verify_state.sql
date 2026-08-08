-- ==========================================================================
-- 20260808000099_verify_state.sql (TEMPORARY verification)
-- Runs Q1, Q2, Q3 checks and reports the result via RAISE WARNING so you
-- can see them in the apply-migration output.
-- Safe to DELETE after reading.
-- ==========================================================================

DO $$
DECLARE
    v_q1_cnt INTEGER;
    v_q1_name TEXT;
    v_q2_cnt INTEGER;
    v_q3_s INTEGER;  -- user_agent
    v_q3_f INTEGER;  -- failure_count
    v_q3_lfa INTEGER;-- last_failure_at
    v_q3_lfc INTEGER;-- last_failure_code
    v_q3_ua INTEGER; -- updated_at
    v_q3_te INTEGER; -- push_trigger_errors table exists
    v_q3_dl INTEGER; -- push_delivery_log table exists
    v_tot_subs INTEGER;
BEGIN
    -- =============== Q1 ===============
    SELECT COUNT(*), COALESCE(MAX(trigger_name), '(none)')
      INTO v_q1_cnt, v_q1_name
      FROM information_schema.triggers
     WHERE event_object_schema = 'public'
       AND event_object_table   = 'notifications';

    RAISE WARNING '============ Q1: Triggers on `notifications` table ============';
    RAISE WARNING 'Q1 EXPECTED: count=1  name=tr_auto_push_on_notification';
    RAISE WARNING 'Q1 ACTUAL  : count=%  name=%', v_q1_cnt, v_q1_name;
    IF v_q1_cnt = 1 AND v_q1_name = 'tr_auto_push_on_notification' THEN
        RAISE WARNING 'Q1 RESULT  : ✅ PASS';
    ELSE
        RAISE WARNING 'Q1 RESULT  : ❌ FAIL — investigate the attached triggers list';
    END IF;

    -- =============== Q2 ===============
    SELECT COUNT(*) INTO v_q2_cnt
      FROM information_schema.triggers
     WHERE event_object_schema = 'public'
       AND event_object_table IN ('attendance','grades','complaints','fees');

    RAISE WARNING '============ Q2: Feedstock triggers (attendance/grades/complaints/fees) ============';
    RAISE WARNING 'Q2 EXPECTED: count=4 (1 per table)';
    RAISE WARNING 'Q2 ACTUAL  : count=%', v_q2_cnt;
    IF v_q2_cnt = 4 THEN
        RAISE WARNING 'Q2 RESULT  : ✅ PASS';
    ELSE
        RAISE WARNING 'Q2 RESULT  : ❌ FAIL — expected 4 feedstock triggers';
    END IF;

    -- =============== Q3 ===============
    SELECT COUNT(*) INTO v_q3_s
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='user_agent';
    SELECT COUNT(*) INTO v_q3_f
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='failure_count';
    SELECT COUNT(*) INTO v_q3_lfa
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='last_failure_at';
    SELECT COUNT(*) INTO v_q3_lfc
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='last_failure_code';
    SELECT COUNT(*) INTO v_q3_ua
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='updated_at';
    SELECT COUNT(*) INTO v_q3_te
      FROM information_schema.tables
     WHERE table_schema='public' AND table_name='push_trigger_errors';
    SELECT COUNT(*) INTO v_q3_dl
      FROM information_schema.tables
     WHERE table_schema='public' AND table_name='push_delivery_log';
    SELECT COUNT(*) INTO v_tot_subs FROM public.push_subscriptions;

    RAISE WARNING '============ Q3: push_subscriptions new columns + new tables ============';
    RAISE WARNING 'Q3 — user_agent         : % (EXPECTED 1)', CASE WHEN v_q3_s=1 THEN '✅' ELSE '❌' END;
    RAISE WARNING 'Q3 — failure_count      : % (EXPECTED 1)', CASE WHEN v_q3_f=1 THEN '✅' ELSE '❌' END;
    RAISE WARNING 'Q3 — last_failure_at    : % (EXPECTED 1)', CASE WHEN v_q3_lfa=1 THEN '✅' ELSE '❌' END;
    RAISE WARNING 'Q3 — last_failure_code  : % (EXPECTED 1)', CASE WHEN v_q3_lfc=1 THEN '✅' ELSE '❌' END;
    RAISE WARNING 'Q3 — updated_at         : % (EXPECTED 1)', CASE WHEN v_q3_ua=1 THEN '✅' ELSE '❌' END;
    RAISE WARNING 'Q3 — push_trigger_errors table : % (EXPECTED 1)', CASE WHEN v_q3_te=1 THEN '✅' ELSE '❌' END;
    RAISE WARNING 'Q3 — push_delivery_log   table : % (EXPECTED 1)', CASE WHEN v_q3_dl=1 THEN '✅' ELSE '❌' END;
    RAISE WARNING 'Q3 — Existing subscriptions  : %', v_tot_subs;

    IF (v_q3_s+v_q3_f+v_q3_lfa+v_q3_lfc+v_q3_ua = 5) AND (v_q3_te+v_q3_dl = 2) THEN
        RAISE WARNING 'Q3 RESULT  : ✅ PASS (all columns + tables present)';
    ELSE
        RAISE WARNING 'Q3 RESULT  : ❌ FAIL — some columns or tables missing';
    END IF;

    RAISE WARNING '============ END VERIFICATION ============';
END $$;
