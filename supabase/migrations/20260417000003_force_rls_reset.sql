-- Migration: 20260417000003_force_rls_reset
-- Goal: Force drop ALL old policies and create clean ones

-- 1. DROP ALL POLICIES on user_roles (whatever their names are)
DO $$ 
DECLARE 
    p record;
BEGIN
    FOR p IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_roles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles;', p.policyname);
        RAISE NOTICE 'Dropped policy: %', p.policyname;
    END LOOP;
END $$;

-- 2. DROP ALL POLICIES on profiles
DO $$ 
DECLARE 
    p record;
BEGIN
    FOR p IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', p.policyname);
        RAISE NOTICE 'Dropped policy: %', p.policyname;
    END LOOP;
END $$;

-- 3. DROP ALL POLICIES on notifications
DO $$ 
DECLARE 
    p record;
BEGIN
    FOR p IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'notifications' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications;', p.policyname);
        RAISE NOTICE 'Dropped policy: %', p.policyname;
    END LOOP;
END $$;

-- 4. CREATE CLEAN POLICIES for user_roles

-- 4a. Anonymous users can INSERT (for signup)
CREATE POLICY "user_roles_insert_anon" ON public.user_roles 
  FOR INSERT TO anon 
  WITH CHECK (true);

-- 4b. Anonymous users can SELECT (for login)
CREATE POLICY "user_roles_select_anon" ON public.user_roles 
  FOR SELECT TO anon 
  USING (true);

-- 4c. Users can view their own role
CREATE POLICY "user_roles_view_own" ON public.user_roles 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- 4d. Users can update their own profile (rarely needed)
CREATE POLICY "user_roles_update_own" ON public.user_roles 
  FOR UPDATE TO authenticated 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4e. Admins can manage ALL roles in their school (THIS IS THE KEY ONE!)
CREATE POLICY "user_roles_admin_full_access" ON public.user_roles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.approval_status = 'approved'
      AND admin_check.school_id = user_roles.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.approval_status = 'approved'
      AND admin_check.school_id = user_roles.school_id
    )
  );

-- 4f. Super Admin has full access to everything
CREATE POLICY "user_roles_super_admin_full" ON public.user_roles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_super_admin = true
    )
  );

-- 5. CREATE CLEAN POLICIES for profiles

-- 5a. Anonymous can INSERT (signup)
CREATE POLICY "profiles_insert_anon" ON public.profiles 
  FOR INSERT TO anon 
  WITH CHECK (true);

-- 5b. Anonymous can SELECT (login)
CREATE POLICY "profiles_select_anon" ON public.profiles 
  FOR SELECT TO anon 
  USING (true);

-- 5c. Users can view their own profile
CREATE POLICY "profiles_view_own" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (id = auth.uid());

-- 5d. Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE TO authenticated 
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5e. Admins can view/update all profiles in their school
CREATE POLICY "profiles_admin_full_access" ON public.profiles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.approval_status = 'approved'
      AND admin_check.school_id = profiles.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.approval_status = 'approved'
      AND admin_check.school_id = profiles.school_id
    )
  );

-- 5f. Super Admin full access
CREATE POLICY "profiles_super_admin_full" ON public.profiles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_super_admin = true
    )
  );

-- 6. CREATE CLEAN POLICIES for notifications

-- 6a. Users can view their own notifications
CREATE POLICY "notifications_view_own" ON public.notifications 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- 6b. Admins can view notifications in their school
CREATE POLICY "notifications_admin_view" ON public.notifications 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.approval_status = 'approved'
      AND admin_check.school_id = notifications.school_id
    )
  );

-- 6c. Allow insert (for triggers)
CREATE POLICY "notifications_insert_allow" ON public.notifications 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- 7. Verify what we created
DO $$ 
DECLARE 
    p record;
BEGIN
    RAISE NOTICE '=== POLICIES ON user_roles ===';
    FOR p IN 
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE tablename = 'user_roles' AND schemaname = 'public'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '  - % (%)', p.policyname, p.cmd;
    END LOOP;
    
    RAISE NOTICE '=== POLICIES ON profiles ===';
    FOR p IN 
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '  - % (%)', p.policyname, p.cmd;
    END LOOP;
END $$;

-- 8. Reload schema
NOTIFY pgrst, 'reload schema';
