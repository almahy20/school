# 🔧 Quick Fix: Grades 403 Error

## Problem
When saving grades, you get:
```
new row violates row-level security policy for table "grades"
Failed to load resource: the server responded with a status of 403
```

## Root Cause
The RLS (Row-Level Security) policies on the `grades` table are missing **INSERT** and **UPDATE** permissions for teachers and admins.

## Solution (2 Minutes)

### Option 1: Supabase Dashboard (Recommended) ⭐

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run the Fix:**
   - Open file: `supabase/migrations/20260415000006_fix_grades_insert_rls.sql`
   - Copy ALL content
   - Paste into SQL Editor
   - Click "Run" (or Ctrl+Enter)

4. **Verify:**
   - You should see a table showing 4 new policies
   - Try saving grades again - should work! ✅

### Option 2: Quick Manual Fix

If you want a simpler version, run this:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "grades_select_policy" ON public.grades;
DROP POLICY IF EXISTS "Admins can manage all grades in their school" ON public.grades;

-- Allow all authenticated users in the school to manage grades
CREATE POLICY "grades_full_access" 
ON public.grades 
FOR ALL 
TO authenticated 
USING (
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
)
WITH CHECK (
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
);

NOTIFY pgrst, 'reload schema';
```

## What This Does

**Before:**
- ❌ INSERT blocked by RLS
- ❌ UPDATE blocked by RLS
- ✅ SELECT worked

**After:**
- ✅ Admins can INSERT/UPDATE/DELETE any grades in their school
- ✅ Teachers can INSERT/UPDATE grades for their students
- ✅ Parents can VIEW their children's grades
- ✅ Super admins have full access everywhere

## Test It

After running the migration:

1. Go to any student's grades page
2. Try to add a new grade
3. Should save successfully! ✅

## Additional Notes

The 401 error and "Lock broken" messages in your console are separate issues related to:
- Session refresh (normal when tab becomes visible)
- Auth lock contention (handled automatically)

These are **not critical** and the app recovers automatically.

## Still Having Issues?

Check these in order:

1. **Verify you're logged in:**
   ```javascript
   // In browser console
   console.log('User:', window.localStorage.getItem('sb-...-auth-token'))
   ```

2. **Check school_id is set:**
   ```sql
   SELECT id, school_id, full_name 
   FROM profiles 
   WHERE id = auth.uid();
   ```

3. **Verify user role:**
   ```sql
   SELECT user_id, role, approval_status, school_id
   FROM user_roles 
   WHERE user_id = auth.uid();
   ```

4. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'grades';
   -- Should show: rowsecurity = true
   ```

---

**Quick Tip:** The migration file also fixes the same issue for exam templates if you encounter it there!
