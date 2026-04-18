-- ═══════════════════════════════════════════════════
-- DIAGNOSTIC QUERY - لتشخيص مشكلة ربط ولي الأمر
-- ═══════════════════════════════════════════════════

-- 1. ابحث عن ولي الأمر برقم الهاتف
SELECT 
  'STEP 1: البحث عن ولي الأمر' as step,
  p.id as parent_id,
  p.full_name,
  p.phone,
  r.role,
  r.approval_status,
  s.name as student_name,
  s.parent_phone as student_parent_phone
FROM profiles p
LEFT JOIN user_roles r ON r.user_id = p.id
LEFT JOIN students s ON s.parent_phone = p.phone OR s.parent_phone = REPLACE(p.phone, '-', '')
WHERE p.phone LIKE '%01005321773%'
   OR p.phone LIKE '%1005321773%';
