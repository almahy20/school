-- ==========================================================================
-- Migration: 20260807160000_fix_get_fees_summary_security
-- Severity : 🔴 CRITICAL (Security Vulnerability)
-- Issue    : `get_fees_summary` used SECURITY DEFINER but did NOT verify that
--            the CALLING USER is actually authorized for the requested
--            `p_school_id`. This allowed any authenticated user to pass a
--            different school's UUID and leak aggregated financial data
--            across tenant boundaries (IDOR + RLS bypass via SECURITY DEFINER).
-- Fix      : 1) Add an explicit authorization check inside the function that
--               validates auth.uid() against user_roles / student_parents for
--               the requested p_school_id BEFORE running any queries.
--            2) Keep SECURITY DEFINER only to bypass RLS on raw rows so the
--               aggregates still work (RLS hides rows the caller doesn't own),
--               but now the function itself enforces tenant isolation.
-- ==========================================================================

DROP FUNCTION IF EXISTS public.get_fees_summary(p_school_id uuid, p_class_id text, p_term text);

CREATE OR REPLACE FUNCTION public.get_fees_summary(
    p_school_id uuid,
    p_class_id  text DEFAULT NULL::text,
    p_term      text DEFAULT ''::text
)
RETURNS TABLE (
    total_due  numeric,
    total_paid numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
DECLARE
    v_class_id     text;
    v_term         text;
    v_caller_uid   uuid;
    v_is_allowed   boolean;
BEGIN
    -- ── 0. Short-circuit NULL school (defense in depth) ──────────────────
    IF p_school_id IS NULL THEN
        total_due  := 0;
        total_paid := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    v_caller_uid := auth.uid();

    -- If no authenticated user at all, return zeros instead of leaking.
    IF v_caller_uid IS NULL THEN
        total_due  := 0;
        total_paid := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- ── 1. 🔒 AUTHORIZATION CHECK (the actual security fix) ─────────────
    -- We must NEVER trust p_school_id blindly, even though this is a
    -- SECURITY DEFINER function.
    --
    -- The caller is allowed to see the summary of p_school_id ONLY if:
    --   a) caller is a SUPER ADMIN (cross-tenant access allowed), OR
    --   b) caller has a user_roles row (admin / teacher) for p_school_id, OR
    --   c) caller is a PARENT who has at least one child in p_school_id
    --      (they need the summary to see fees dashboard).
    SELECT EXISTS (
        -- Super admin
        SELECT 1
          FROM public.user_roles ur
         WHERE ur.user_id       = v_caller_uid
           AND ur.is_super_admin = TRUE

        UNION ALL

        -- Admin / Teacher for the requested school
        SELECT 1
          FROM public.user_roles ur
         WHERE ur.user_id    = v_caller_uid
           AND ur.school_id  = p_school_id
           AND ur.role       IN ('admin', 'teacher')

        UNION ALL

        -- Parent with children enrolled in the requested school
        SELECT 1
          FROM public.student_parents sp
         WHERE sp.parent_id = v_caller_uid
           AND sp.school_id = p_school_id
    ) INTO v_is_allowed;

    IF v_is_allowed IS NOT TRUE THEN
        -- ⚠️ Unauthorized: return zeros silently instead of an error so that
        -- attackers cannot "scan" for valid school UUIDs by distinguishing
        -- "forbidden" from "invalid id" responses (security = obscurity layer
        -- on top of the strict check above).
        total_due  := 0;
        total_paid := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- ── 2. Normalize optional parameters ────────────────────────────────
    v_class_id := NULLIF(BTRIM(COALESCE(p_class_id, '')), '');
    v_term     := COALESCE(NULLIF(BTRIM(p_term), ''), '');

    -- ── 3. Compute total_due = SUM(students.monthly_fee) ────────────────
    SELECT COALESCE(SUM(COALESCE(s.monthly_fee, 0)), 0)::numeric
      INTO total_due
      FROM public.students s
     WHERE s.school_id = p_school_id
       AND (v_class_id IS NULL OR s.class_id::text = v_class_id);

    -- ── 4. Compute total_paid = SUM(fees.amount_paid) ───────────────────
    IF v_term = '' THEN
        SELECT COALESCE(SUM(COALESCE(f.amount_paid, 0)), 0)::numeric
          INTO total_paid
          FROM public.fees f
          JOIN public.students s
            ON s.id = f.student_id
         WHERE f.school_id = p_school_id
           AND s.school_id = p_school_id
           AND (v_class_id IS NULL OR s.class_id::text = v_class_id);
    ELSE
        SELECT COALESCE(SUM(COALESCE(f.amount_paid, 0)), 0)::numeric
          INTO total_paid
          FROM public.fees f
          JOIN public.students s
            ON s.id = f.student_id
         WHERE f.school_id = p_school_id
           AND s.school_id = p_school_id
           AND f.term      = v_term
           AND (v_class_id IS NULL OR s.class_id::text = v_class_id);
    END IF;

    RETURN NEXT;
END;
$$;

-- Lock execution down to authenticated users (the function itself now
-- performs a finer-grained authorization check internally).
REVOKE ALL ON FUNCTION public.get_fees_summary(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.get_fees_summary(uuid, text, text)
IS '[SECURE] Aggregate fees summary for a school (optional class / term).
    SECURITY FIX: Caller authorization (super_admin / school admin/teacher /
    enrolled parent) is verified BEFORE computing aggregates, so this
    SECURITY DEFINER function cannot leak cross-school data any more.
    total_due  = SUM(students.monthly_fee)
    total_paid = SUM(fees.amount_paid)';
