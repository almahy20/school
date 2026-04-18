-- Migration: 20260417000002_fix_pending_parents_visibility
-- Goal: Fix pending parents not showing for admin + ensure signup works perfectly

-- 1. FIX RLS POLICIES for user_roles
-- المشكلة: الـ policies القديمة كانت معقدة وبتعتمد على JWT metadata اللي ممكن يكون قديم

-- نمسح الـ policies القديمة
DROP POLICY IF EXISTS "user_roles_self" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_enhanced_access" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_super_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_access" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_role_based_access" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public read for roles during login" ON public.user_roles;

-- نعمل policies جديدة بسيطة وواضحة
-- Policy 1: المستخدم يشوف بياناته هو بس
CREATE POLICY "user_roles_view_own" ON public.user_roles 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- Policy 2: الأدمن يشوف كل الأدوار في مدرسته (بما فيها pending)
CREATE POLICY "user_roles_admin_manage_school" ON public.user_roles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles current_user_role
      WHERE current_user_role.user_id = auth.uid()
      AND current_user_role.role = 'admin'
      AND current_user_role.approval_status = 'approved'
      AND current_user_role.school_id = user_roles.school_id
    )
  );

-- Policy 3: Super Admin يشوف كل حاجة
CREATE POLICY "user_roles_super_admin" ON public.user_roles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles current_user_role
      WHERE current_user_role.user_id = auth.uid()
      AND current_user_role.is_super_admin = true
    )
  );

-- Policy 4: السماح بـ INSERT للتسجيل الجديد (anonymous users)
CREATE POLICY "user_roles_insert_signup" ON public.user_roles 
  FOR INSERT TO anon 
  WITH CHECK (true);

-- Policy 5: السماح بـ SELECT للتسجيل/الدخول (anonymous users)
CREATE POLICY "user_roles_anon_read" ON public.user_roles 
  FOR SELECT TO anon 
  USING (true);

-- 2. FIX RLS POLICIES for profiles
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_signup" ON public.profiles;

-- Policy 1: المستخدم يشوف بروفايله هو
CREATE POLICY "profiles_view_own" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (id = auth.uid());

-- Policy 2: المستخدم يحدث بروفايله
CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE TO authenticated 
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3: الأدمن يشوف ويحدث كل البروفايلات في مدرسته
CREATE POLICY "profiles_admin_manage_school" ON public.profiles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles current_user_role
      WHERE current_user_role.user_id = auth.uid()
      AND current_user_role.role = 'admin'
      AND current_user_role.approval_status = 'approved'
      AND current_user_role.school_id = profiles.school_id
    )
  );

-- Policy 4: Super Admin يشوف ويحدث كل حاجة
CREATE POLICY "profiles_super_admin" ON public.profiles 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles current_user_role
      WHERE current_user_role.user_id = auth.uid()
      AND current_user_role.is_super_admin = true
    )
  );

-- Policy 5: السماح بـ INSERT للتسجيل الجديد
CREATE POLICY "profiles_insert_signup" ON public.profiles 
  FOR INSERT TO anon 
  WITH CHECK (true);

-- Policy 6: السماح بـ SELECT للدخول
CREATE POLICY "profiles_anon_read" ON public.profiles 
  FOR SELECT TO anon 
  USING (true);

-- 3. التأكد من وجود Trigger الإشعارات
-- نتأكد إن الـ trigger موجود وشغال
DROP TRIGGER IF EXISTS tr_notify_admin_new_parent_signup ON public.user_roles;
CREATE TRIGGER tr_notify_admin_new_parent_signup
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role = 'parent' AND NEW.approval_status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_parent_signup();

-- 4. إضافة دالة مساعدة للتأكد إن الأدمن قادر يشوف كل المستخدمين في مدرسته
CREATE OR REPLACE FUNCTION public.can_user_manage_school(p_user_id uuid, p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
    AND role = 'admin'
    AND approval_status = 'approved'
    AND school_id = p_school_id
  )
$$;

-- 5. التأكد من صلاحيات الإشعارات
DROP POLICY IF EXISTS "notifications_user_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_school" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_trigger" ON public.notifications;

CREATE POLICY "notifications_view_own" ON public.notifications 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "notifications_admin_view_school" ON public.notifications 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles current_user_role
      WHERE current_user_role.user_id = auth.uid()
      AND current_user_role.role = 'admin'
      AND current_user_role.approval_status = 'approved'
      AND current_user_role.school_id = notifications.school_id
    )
  );

CREATE POLICY "notifications_insert_by_trigger" ON public.notifications 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- 6. إصلاح أي مشكلة في الـ student_parents RLS
DROP POLICY IF EXISTS "student_parents_policy" ON public.student_parents;

CREATE POLICY "student_parents_parent_view" ON public.student_parents 
  FOR SELECT TO authenticated 
  USING (parent_id = auth.uid());

CREATE POLICY "student_parents_admin_manage" ON public.student_parents 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles current_user_role
      WHERE current_user_role.user_id = auth.uid()
      AND current_user_role.role = 'admin'
      AND current_user_role.approval_status = 'approved'
      AND current_user_role.school_id = student_parents.school_id
    )
  );

CREATE POLICY "student_parents_insert_trigger" ON public.student_parents 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- 7. GRANT permissions للتأكد
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT INSERT ON public.user_roles TO anon;
GRANT INSERT ON public.profiles TO anon;

-- 8. التأكد من إن الـ trigger الرئيسي موجود
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 9. إضافة index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_user_roles_school_approval ON public.user_roles(school_id, approval_status, role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);

-- إعادة تحميل schema
NOTIFY pgrst, 'reload schema';
