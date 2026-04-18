-- ═══════════════════════════════════════════════════
-- SIMPLE DIAGNOSTIC - تشخيص بسيط وسريع
-- ═══════════════════════════════════════════════════

-- 1. ابحث عن ولي الأمر بالرقم
SELECT 
  p.id as parent_id,
  p.full_name,
  p.phone,
  r.role,
  r.approval_status
FROM profiles p
LEFT JOIN user_roles r ON r.user_id = p.id
WHERE p.phone = '01005321773'
   OR p.phone = '+201005321773'
   OR p.phone LIKE '%01005321773%';

-- 2. ابحث عن الطلاب بنفس الرقم
SELECT 
  s.id as student_id,
  s.name as student_name,
  s.parent_phone,
  s.school_id,
  s.class_id
FROM students s
WHERE s.parent_phone = '01005321773'
   OR s.parent_phone = '+201005321773'
   OR s.parent_phone LIKE '%01005321773%';

-- 3. تحقق من الروابط الموجودة
SELECT 
  sp.id as link_id,
  sp.student_id,
  sp.parent_id,
  sp.school_id,
  s.name as student_name,
  p.full_name as parent_name
FROM student_parents sp
JOIN students s ON s.id = sp.student_id
JOIN profiles p ON p.id = sp.parent_id
WHERE s.parent_phone = '01005321773'
   OR p.phone = '01005321773';

-- 4. جرب normalize_phone
SELECT 
  normalize_phone('01005321773') as test1,
  normalize_phone('+201005321773') as test2;
