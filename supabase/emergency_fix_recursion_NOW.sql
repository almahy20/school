-- ══════════════════════════════════════════════════════════════════════════
-- EMERGENCY FIX: infinite recursion in user_roles RLS
-- HOW TO APPLY:
--   1. افتح Supabase Dashboard
--   2. اذهب إلى SQL Editor
--   3. انسخ هذا الملف كله والصقه
--   4. اضغط Run
-- ══════════════════════════════════════════════════════════════════════════

-- ── الخطوة 1: احذف جميع policies على user_roles دفعة واحدة ───────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', r.policyname);
  END LOOP;
END;
$$;

-- ── الخطوة 2: أنشئ policies آمنة لا تستعلم عن user_roles نفسها ───────────

-- كل مستخدم يقرأ صفه الخاص
CREATE POLICY "user_roles_own_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- anon يقرأ (لازم للـ signup flow)
CREATE POLICY "user_roles_anon_select"
  ON public.user_roles FOR SELECT TO anon
  USING (true);

-- Admin يقرأ مدرسته (من JWT — لا recursion)
CREATE POLICY "user_roles_admin_read"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_super_admin')::boolean, false) = true
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'admin'
      AND (auth.jwt()->'app_metadata'->>'school_id') IS NOT NULL
      AND school_id = (auth.jwt()->'app_metadata'->>'school_id')::uuid
    )
  );

-- anon يُسجّل (signup)
CREATE POLICY "user_roles_signup_insert"
  ON public.user_roles FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated يضيف صفه أو الأدمن يضيف لمدرسته
CREATE POLICY "user_roles_admin_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR COALESCE((auth.jwt()->'app_metadata'->>'is_super_admin')::boolean, false) = true
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'admin'
      AND (auth.jwt()->'app_metadata'->>'school_id') IS NOT NULL
      AND school_id = (auth.jwt()->'app_metadata'->>'school_id')::uuid
    )
  );

-- Admin يعدّل
CREATE POLICY "user_roles_admin_update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_super_admin')::boolean, false) = true
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'admin'
      AND (auth.jwt()->'app_metadata'->>'school_id') IS NOT NULL
      AND school_id = (auth.jwt()->'app_metadata'->>'school_id')::uuid
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt()->'app_metadata'->>'is_super_admin')::boolean, false) = true
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'admin'
      AND (auth.jwt()->'app_metadata'->>'school_id') IS NOT NULL
      AND school_id = (auth.jwt()->'app_metadata'->>'school_id')::uuid
    )
  );

-- Admin يحذف
CREATE POLICY "user_roles_admin_delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_super_admin')::boolean, false) = true
    OR (
      (auth.jwt()->'app_metadata'->>'role') = 'admin'
      AND (auth.jwt()->'app_metadata'->>'school_id') IS NOT NULL
      AND school_id = (auth.jwt()->'app_metadata'->>'school_id')::uuid
    )
  );

-- ── الخطوة 3: تحقق من النتيجة ─────────────────────────────────────────────
-- يجب أن يُظهر 6 صفوف وبدون أي policy تذكر user_roles في الـ definition
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_roles'
ORDER BY policyname;

-- ── الخطوة 4: تأكد أن RLS مُفعّل ─────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
