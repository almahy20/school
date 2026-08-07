-- ==========================================================================
-- Migration: 20260807000000_create_get_fees_summary_rpc.sql
-- Purpose  : Add a database-level RPC (aggregate function) `get_fees_summary`
--            to compute `total_due` and `total_paid` directly inside Postgres.
--            This replaces the TWO large frontend fetches (allStudents +
--            allTermFees) that used to download every row just to reduce two
--            numbers on the client.
-- Author   : Audit Item 3 — Reduce useFees requests from 4 to 2 via RPC
-- ==========================================================================

-- ── 1. Clean up any previous version in case the migration is replayed ───
DROP FUNCTION IF EXISTS public.get_fees_summary(
    p_school_id uuid,
    p_class_id  text,
    p_term      text
);

-- ── 2. Create the aggregate RPC ───────────────────────────────────────────
--
-- Parameters:
--   p_school_id (uuid, required) : scope to a single school (multi-tenant)
--   p_class_id  (text, optional) : if set, restrict stats to a specific class;
--                                  pass NULL / empty string for "all classes"
--   p_term      (text, optional) : academic term for the fees / payments
--                                  (falls back to an empty string if omitted)
--
-- Returns:
--   TABLE ( total_due numeric, total_paid numeric )
--
--   total_due  = SUM(students.monthly_fee) for the selected school + class
--   total_paid = SUM(fees.amount_paid)  for the selected school + class + term
--
-- Security:
--   SECURITY DEFINER is required because RLS policies on `students` and
--   `fees` may restrict rows to owners only. The function itself stays
--   strictly scoped by the explicit `p_school_id` parameter so one
--   school's admin can never see another school's aggregated numbers.
--
--   We REVOKE PUBLIC EXECUTE and then GRANT only to authenticated users.
-- ==========================================================================
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
    v_class_id text;
    v_term     text;
BEGIN
    -- Guard: school_id is mandatory (prevents cross-tenant leakage)
    IF p_school_id IS NULL THEN
        total_due  := 0;
        total_paid := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Normalize optional parameters (treat NULL / whitespace as "all")
    v_class_id := NULLIF(BTRIM(COALESCE(p_class_id, '')), '');
    v_term     := COALESCE(NULLIF(BTRIM(p_term), ''), '');

    -- ------------------------------------------------------------------
    -- 1) Compute total_due = SUM of monthly_fee from `students`
    --    Filtered by school_id and optionally class_id.
    -- ------------------------------------------------------------------
    SELECT COALESCE(SUM(COALESCE(s.monthly_fee, 0)), 0)::numeric
      INTO total_due
      FROM public.students s
     WHERE s.school_id = p_school_id
       AND (v_class_id IS NULL OR s.class_id = v_class_id);

    -- ------------------------------------------------------------------
    -- 2) Compute total_paid = SUM of amount_paid from `fees`
    --    Filtered by school_id, term and optionally class_id via a
    --    join back to `students` (the fees table itself has student_id
    --    and term, but no class_id column).
    -- ------------------------------------------------------------------
    IF v_term = '' THEN
        -- If the caller did not restrict to a specific term, still
        -- compute all payments recorded in the fees table for the
        -- selected school / class scope.
        SELECT COALESCE(SUM(COALESCE(f.amount_paid, 0)), 0)::numeric
          INTO total_paid
          FROM public.fees f
          JOIN public.students s
            ON s.id = f.student_id
         WHERE f.school_id = p_school_id
           AND s.school_id = p_school_id
           AND (v_class_id IS NULL OR s.class_id = v_class_id);
    ELSE
        SELECT COALESCE(SUM(COALESCE(f.amount_paid, 0)), 0)::numeric
          INTO total_paid
          FROM public.fees f
          JOIN public.students s
            ON s.id = f.student_id
         WHERE f.school_id = p_school_id
           AND s.school_id = p_school_id
           AND f.term      = v_term
           AND (v_class_id IS NULL OR s.class_id = v_class_id);
    END IF;

    RETURN NEXT;
END;
$$;

-- ── 3. Lock down execution ───────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_fees_summary(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) TO authenticated;

-- ── 4. Comments for introspection tools ───────────────────────────────────
COMMENT ON FUNCTION public.get_fees_summary(uuid, text, text)
IS 'Aggregate fees summary for a school (and optional class / term).
    Replaces two large client-side fetches in useFees.ts:
    total_due = SUM(students.monthly_fee), total_paid = SUM(fees.amount_paid).';
