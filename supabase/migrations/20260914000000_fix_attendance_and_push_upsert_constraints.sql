-- Migration: 20260914000000_fix_attendance_and_push_upsert_constraints.sql
-- Goal: Ensure unique constraints on attendance (student_id, date, school_id)
-- and push_subscriptions (endpoint) to support PostgREST atomic upserts without 400 errors.

DO $$
BEGIN
    -- ── 1. Fix ATTENDANCE unique constraint ─────────────────────────────────
    -- Remove any duplicate attendance records keeping latest by id
    DELETE FROM public.attendance a
    USING public.attendance b
    WHERE a.id < b.id
      AND a.student_id = b.student_id
      AND a.date = b.date
      AND a.school_id = b.school_id;

    -- Drop constraint or index if already exists to avoid 42P07 duplicate relation error
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_date_school_unique'
    ) THEN
        ALTER TABLE public.attendance DROP CONSTRAINT attendance_student_date_school_unique;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'attendance_student_date_school_unique' AND relkind = 'i'
    ) THEN
        DROP INDEX IF EXISTS public.attendance_student_date_school_unique;
    END IF;

    -- Add the clean unique constraint
    ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_student_date_school_unique UNIQUE (student_id, date, school_id);

    -- ── 2. Fix PUSH_SUBSCRIPTIONS column and unique constraint ──────────────
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
    ) THEN
        -- Ensure endpoint column exists
        ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;

        -- Populate endpoint from subscription JSON if empty
        UPDATE public.push_subscriptions 
        SET endpoint = (subscription->>'endpoint')
        WHERE endpoint IS NULL AND subscription IS NOT NULL;

        -- Remove duplicate endpoints
        DELETE FROM public.push_subscriptions a
        USING public.push_subscriptions b
        WHERE a.id < b.id
          AND a.endpoint IS NOT NULL
          AND a.endpoint = b.endpoint;

        -- Drop existing constraint or index if exists
        IF EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_unique'
        ) THEN
            ALTER TABLE public.push_subscriptions DROP CONSTRAINT push_subscriptions_endpoint_unique;
        END IF;

        IF EXISTS (
            SELECT 1 FROM pg_class WHERE relname = 'push_subscriptions_endpoint_unique' AND relkind = 'i'
        ) THEN
            DROP INDEX IF EXISTS public.push_subscriptions_endpoint_unique;
        END IF;

        -- Add unique constraint on endpoint column
        ALTER TABLE public.push_subscriptions
        ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);
    END IF;
END $$;
