-- ═══════════════════════════════════════════════════
-- تشخيص مشكلة تحميل بيانات الأبناء لأولياء الأمور
-- ═══════════════════════════════════════════════════

-- الخطوة 1: التحقق من وجود دالة RPC
SELECT 
  'STEP 1: Check if RPC function exists' as step,
  routine_name,
  routine_type,
  created
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_parent_dashboard_summary';

-- الخطوة 2: اختبار ربط ولي الأمر بأبنائه
-- ⚠️ استبدل 'PHONE_NUMBER' برقم هاتف ولي الأمر الفعلي
SELECT 
  'STEP 2: Check parent-student linking' as step,
  p.id as parent_id,
  p.full_name as parent_name,
  p.phone as parent_phone,
  sp.student_id,
  s.name as student_name,
  s.class_id,
  c.name as class_name,
  sp.school_id
FROM profiles p
LEFT JOIN student_parents sp ON sp.parent_id = p.id
LEFT JOIN students s ON s.id = sp.student_id
LEFT JOIN classes c ON c.id = s.class_id
WHERE p.phone = 'PHONE_NUMBER'  -- ⚠️ ضع رقم الهاتف هنا
   OR p.id = 'PARENT_UUID';     -- ⚠️ أو ضع UUID ولي الأمر هنا

-- الخطوة 3: التحقق من رتبة ولي الأمر
SELECT 
  'STEP 3: Check parent role and approval' as step,
  p.id as user_id,
  p.full_name,
  p.phone,
  ur.role,
  ur.approval_status,
  ur.school_id,
  sch.name as school_name
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN schools sch ON sch.id = ur.school_id
WHERE p.phone = 'PHONE_NUMBER';  -- ⚠️ ضع رقم الهاتف هنا

-- الخطوة 4: اختبار دالة RPC مباشرة
-- ⚠️ استبدل القيم بالقيم الفعلية
SELECT public.get_parent_dashboard_summary(
  'PARENT_UUID'::uuid,  -- ⚠️ UUID ولي الأمر
  'SCHOOL_UUID'::uuid   -- ⚠️ UUID المدرسة
) as result;

-- الخطوة 5: التحقق من RLS policies على student_parents
SELECT 
  'STEP 5: Check RLS policies on student_parents' as step,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'student_parents';

-- الخطوة 6: التحقق من الأخطاء الشائعة
SELECT 
  'STEP 6: Common issues checklist' as step,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'get_parent_dashboard_summary'
    ) THEN '❌ RPC function does not exist - Run migration 20260424000001'
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'student_parents'
    ) THEN '❌ No RLS policies on student_parents'
    WHEN EXISTS (
      SELECT 1 FROM student_parents sp
      WHERE NOT EXISTS (
        SELECT 1 FROM students s WHERE s.id = sp.student_id
      )
    ) THEN '❌ Orphaned student_parents records found'
    ELSE '✅ All checks passed'
  END as status;
