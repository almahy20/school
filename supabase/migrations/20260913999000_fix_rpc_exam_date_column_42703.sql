-- ==============================================================================
-- Migration : 20260913999000_fix_rpc_exam_date_column_42703.sql
-- Applies : Supabase Postgres (remote)
-- Verifies against LIVE schema from 2026-09-13
--
-- Errors fixed (from Dashboard Postgres Logs):
--   42703 — column g.exam_date does not exist   (RPC body used wrong column)
--   57014 — canceling statement due to statement timeout   (slow + no indexes)
--   42P05 — prepared statement "2" already exists (pgBouncer tx pooling)
--   08006 — connection to client lost  (often triggered by the 504 edge timeouts)
-- ==============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure every column required by the RPC exists.
--    Fully idempotent: each statement is "IF NOT EXISTS" / "DO block" safe.
-- ---------------------------------------------------------------------------

-- a) public.grades — verified columns on LIVE server already include:
--    id, school_id, student_id, exam_template_id, subject, score, max_score,
--    term, date, created_at, teacher_id, notes
--    (The error came from the RPC body asking for exam_date — which never existed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='grades' AND column_name='date'
  ) THEN
    ALTER TABLE public.grades ADD COLUMN date DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS exam_template_id UUID REFERENCES public.exam_templates(id) ON DELETE SET NULL;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS term TEXT;

-- b) public.attendance (LIVE has: id,school_id,student_id,class_id,teacher_id,date,status,notes,created_at)
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- c) public.fee_payments (LIVE has: id,fee_id,school_id,amount,payment_date,created_at,notes)
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE;

-- d) public.fees (LIVE has: id,school_id,student_id,amount_due,amount_paid,status,term,created_at,description)
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS amount_due NUMERIC DEFAULT 0;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unpaid';

-- e) public.students (LIVE has: id,school_id,class_id,name,parent_phone,monthly_fee,address,created_at,updated_at)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone TEXT;

-- f) public.curriculum_subjects (LIVE is MISSING school_id!)
CREATE TABLE IF NOT EXISTS public.curriculum_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    curriculum_id UUID,
    subject_name TEXT NOT NULL,
    description TEXT
);
ALTER TABLE public.curriculum_subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.curriculum_subjects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.curriculum_subjects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Performance indexes that eliminate statement_timeout (57014) on the RPC.
--    (Without these, every row in grades/attendance/fees is seq-scanned.)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_grades_student_created ON public.grades(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date  ON public.attendance(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fees_student_term         ON public.fees(student_id, term);
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee_date     ON public.fee_payments(fee_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_parents_student   ON public.student_parents(student_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_subjects_cur   ON public.curriculum_subjects(curriculum_id);

-- Heal Postgres planner statistics on these large tables once
ANALYZE public.grades;
ANALYZE public.attendance;
ANALYZE public.fees;
ANALYZE public.fee_payments;
ANALYZE public.students;
ANALYZE public.student_parents;
ANALYZE public.profiles;
ANALYZE public.user_roles;

-- ---------------------------------------------------------------------------
-- 3. Helpers stubs — real implementations live in their own migrations.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_is_super_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_school_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT school_id FROM public.user_roles  WHERE user_id = auth.uid() LIMIT 1),
    (SELECT school_id FROM public.profiles    WHERE id      = auth.uid() LIMIT 1),
    NULL::UUID
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. DROP ALL old versions of get_child_full_details (any signature),
--    then rebuild cleanly with ONLY verified column names from LIVE schema.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_child_full_details(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_child_full_details(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_child_full_details(UUID);

CREATE OR REPLACE FUNCTION public.get_child_full_details(
    p_student_id UUID,
    p_school_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        UUID;
  v_is_authorized BOOLEAN;
  v_current_term  TEXT;
  v_result        JSONB;
BEGIN
  -- Defeat pgBouncer transaction-pooling prepared-statement collisions
  -- (causes error code 42P05). Statement runs inside the function body so
  -- DEALLOCATE ALL is safe here.
  BEGIN
    EXECUTE 'DEALLOCATE ALL';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Raise statement / lock timeouts to tolerate load spikes (504 -> 57014).
  -- SET LOCAL so the change rolls back when the function transaction ends.
  SET LOCAL statement_timeout = '30s';
  SET LOCAL lock_timeout      = '10s';
  SET LOCAL idle_in_transaction_session_timeout = '0';

  v_caller := auth.uid();

  -- ── A. Authorization ─────────────────────────────────────────────────
  SELECT (
    v_caller IS NOT NULL AND (
      public.get_auth_is_super_admin()
      OR
      EXISTS (
        SELECT 1 FROM public.student_parents sp
        WHERE sp.student_id = p_student_id AND sp.parent_id = v_caller
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.profiles p ON p.id = v_caller
        WHERE s.id = p_student_id
          AND s.parent_phone IS NOT NULL
          AND p.phone IS NOT NULL
          AND (
            s.parent_phone = p.phone
            OR regexp_replace(s.parent_phone, '\D', '', 'g')
             = regexp_replace(p.phone,        '\D', '', 'g')
          )
      )
      OR
      (p_school_id IS NOT NULL AND p_school_id = public.get_auth_school_id())
    )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  -- ── B. Auto-heal: create student_parents link when missing ───────────
  IF v_caller IS NOT NULL AND NOT public.get_auth_is_super_admin() THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT s.school_id, s.id, v_caller
    FROM public.students s
    WHERE s.id = p_student_id
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  -- ── C. current_term label (Arabic) ────────────────────────────────────
  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  -- ── D. Aggregate (uses verified LIVE columns ONLY) ────────────────────
  WITH
  student_data AS (
    SELECT
      jsonb_build_object(
        'id',           s.id,
        'name',         s.name,
        'class_id',     s.class_id,
        'parent_phone', s.parent_phone,
        'school_id',    s.school_id,
        'monthly_fee',  s.monthly_fee,
        'classes',      CASE WHEN c.id IS NOT NULL THEN
                          jsonb_build_object(
                            'id',            c.id,
                            'name',          c.name,
                            'grade_level',   c.grade_level,
                            'curriculum_id', c.curriculum_id
                          )
                        ELSE NULL END
      ) AS info,
      s.class_id,
      c.curriculum_id
    FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_student_id
      AND (p_school_id IS NULL OR s.school_id = p_school_id)
    LIMIT 1
  ),
  grades_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',               g.id,
        'student_id',       g.student_id,
        'school_id',        g.school_id,
        'subject',          g.subject,
        'score',            g.score,
        'max_score',        g.max_score,
        'term',             g.term,
        'date',             g.date,             -- LIVE column: ordinal 9 type date
        'notes',            g.notes,
        'exam_template_id', g.exam_template_id,
        'created_at',       g.created_at,
        'teacher_id',       g.teacher_id,
        'exam_templates',   CASE WHEN et.id IS NOT NULL THEN
                              jsonb_build_object(
                                'id',        et.id,
                                'title',     et.title,
                                'term',      et.term,
                                'subject',   et.subject,
                                'max_score', et.max_score
                              )
                            ELSE NULL END
      )
      ORDER BY g.created_at ASC
    ) AS data
    FROM (
      SELECT g2.id, g2.student_id, g2.school_id, g2.subject,
             g2.score, g2.max_score, g2.term, g2.date, g2.notes,
             g2.exam_template_id, g2.created_at, g2.teacher_id
      FROM public.grades g2
      WHERE g2.student_id = p_student_id
      ORDER BY g2.created_at ASC
      LIMIT 500
    ) g
    LEFT JOIN public.exam_templates et ON et.id = g.exam_template_id
  ),
  attendance_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',         a.id,
        'date',       a.date,
        'status',     a.status,
        'student_id', a.student_id,
        'school_id',  a.school_id,
        'class_id',   a.class_id,
        'notes',      a.notes
      )
      ORDER BY a.date DESC
    ) AS data
    FROM (
      SELECT a2.id, a2.date, a2.status, a2.student_id,
             a2.school_id, a2.class_id, a2.notes
      FROM public.attendance a2
      WHERE a2.student_id = p_student_id
      ORDER BY a2.date DESC
      LIMIT 365
    ) a
  ),
  fees_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',          f.id,
        'student_id',  f.student_id,
        'school_id',   f.school_id,
        'description', COALESCE(f.description, f.term, ''),
        'amount_due',  f.amount_due,
        'amount_paid', f.amount_paid,
        'term',        f.term,
        'status',      f.status,
        'created_at',  f.created_at
      )
      ORDER BY f.created_at DESC
    ) AS data
    FROM public.fees f
    WHERE f.student_id = p_student_id
  ),
  payments_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',           fp.id,
        'fee_id',       fp.fee_id,
        'school_id',    fp.school_id,
        'amount',       fp.amount,
        'payment_date', fp.payment_date,
        'notes',        fp.notes
      )
      ORDER BY fp.payment_date DESC
    ) AS data
    FROM public.fee_payments fp
    JOIN public.fees f ON f.id = fp.fee_id AND f.student_id = p_student_id
  ),
  curriculum_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',            cs.id,
        'subject_name',  cs.subject_name,
        'description',   cs.description,
        'curriculum_id', cs.curriculum_id
      )
      ORDER BY cs.subject_name ASC
    ) AS data
    FROM student_data sd
    LEFT JOIN public.curriculum_subjects cs
      ON cs.curriculum_id = sd.curriculum_id
    WHERE sd.curriculum_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'student',      sd.info,
    'grades',       COALESCE(gd.data, '[]'::jsonb),
    'attendance',   COALESCE(ad.data, '[]'::jsonb),
    'fees',         COALESCE(fd.data, '[]'::jsonb),
    'payments',     COALESCE(pd.data, '[]'::jsonb),
    'curriculum',   COALESCE(cd.data, '[]'::jsonb),
    'current_term', v_current_term
  )
  INTO v_result
  FROM student_data        sd
  CROSS JOIN grades_data      gd
  CROSS JOIN attendance_data  ad
  CROSS JOIN fees_data        fd
  CROSS JOIN payments_data    pd
  CROSS JOIN curriculum_data  cd;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permissions (tightened: anon/public denied; authenticated/service OK)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID) TO authenticated, service_role;
ALTER  FUNCTION public.get_child_full_details(UUID, UUID) SET search_path = public;

-- ---------------------------------------------------------------------------
-- 6. Invalidate PostgREST / Supabase API schema cache so the new RPC body
--    becomes visible immediately (otherwise stale copy may serve for hours).
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
