-- ═══════════════════════════════════════════════════
-- تشخيص سهل - يبحث تلقائياً عن أولياء الأمور
-- ═══════════════════════════════════════════════════

-- الخطوة 1: عرض جميع أولياء الأمور مع حالة الربط
SELECT 
  'STEP 1: All parents with their children count' as step,
  p.id as parent_id,
  p.full_name,
  p.phone,
  ur.role,
  ur.approval_status,
  ur.school_id,
  COUNT(DISTINCT sp.student_id) as children_count
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'parent'
LEFT JOIN student_parents sp ON sp.parent_id = p.id
WHERE ur.role = 'parent'
GROUP BY p.id, p.full_name, p.phone, ur.role, ur.approval_status, ur.school_id
ORDER BY children_count DESC, p.full_name;

-- الخطوة 2: عرض أولياء الأمور الذين ليس لديهم أبناء مربوطين
SELECT 
  'STEP 2: Parents WITHOUT any children linked' as step,
  p.id as parent_id,
  p.full_name,
  p.phone,
  ur.school_id,
  sch.name as school_name
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'parent'
LEFT JOIN student_parents sp ON sp.parent_id = p.id
LEFT JOIN schools sch ON sch.id = ur.school_id
WHERE sp.student_id IS NULL
  AND ur.approval_status = 'approved'
ORDER BY p.full_name;

-- الخطوة 3: التحقق من دالة RPC
SELECT 
  'STEP 3: Check RPC function' as step,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name = 'get_parent_dashboard_summary'
    ) THEN '✅ RPC function exists'
    ELSE '❌ RPC function MISSING - need to run migration'
  END as status;

-- الخطوة 4: عرض جميع الطلاب مع أولياء أمورهم
SELECT 
  'STEP 4: Students with their parents' as step,
  s.id as student_id,
  s.name as student_name,
  s.class_id,
  c.name as class_name,
  sp.parent_id,
  p.full_name as parent_name,
  p.phone as parent_phone,
  sp.school_id
FROM students s
LEFT JOIN student_parents sp ON sp.student_id = s.id
LEFT JOIN profiles p ON p.id = sp.parent_id
LEFT JOIN classes c ON c.id = s.class_id
ORDER BY s.name, p.full_name;

-- الخطوة 5: التحقق من RLS policies
SELECT 
  'STEP 5: RLS policies on student_parents' as step,
  policyname,
  cmd,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN '✅ Has SELECT policy'
    ELSE '❌ Missing policy'
  END as status
FROM pg_policies
WHERE tablename = 'student_parents';

-- الخطوة 6: إحصائيات عامة
SELECT 
  'STEP 6: General statistics' as step,
  (SELECT COUNT(*) FROM profiles p JOIN user_roles ur ON ur.user_id = p.id WHERE ur.role = 'parent') as total_parents,
  (SELECT COUNT(*) FROM user_roles WHERE role = 'parent' AND approval_status = 'approved') as approved_parents,
  (SELECT COUNT(*) FROM user_roles WHERE role = 'parent' AND approval_status = 'pending') as pending_parents,
  (SELECT COUNT(DISTINCT parent_id) FROM student_parents) as parents_with_children,
  (SELECT COUNT(*) FROM students) as total_students,
  (SELECT COUNT(*) FROM student_parents) as total_links;
