-- تحقق من وجود عمود score_type
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'exam_templates' 
AND column_name = 'score_type';

-- عرض جميع أعمدة الجدول
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'exam_templates' 
ORDER BY ordinal_position;

-- اختبار: إنشاء اختبار نصي تجريبي
INSERT INTO exam_templates (school_id, class_id, teacher_id, subject, exam_type, max_score, weight, term, title, score_type)
SELECT 
  (SELECT id FROM schools LIMIT 1),
  (SELECT id FROM classes LIMIT 1),
  auth.uid(),
  'اختبار تجريبي',
  'monthly',
  100,
  1,
  'الفصل الأول',
  'اختبار نصي تجريبي',
  'text'
WHERE EXISTS (SELECT 1 FROM schools LIMIT 1)
  AND EXISTS (SELECT 1 FROM classes LIMIT 1);

-- التحقق من الاختبار التجريبي
SELECT id, title, score_type, max_score 
FROM exam_templates 
WHERE title = 'اختبار نصي تجريبي';

-- تنظيف: حذف الاختبار التجريبي
DELETE FROM exam_templates 
WHERE title = 'اختبار نصي تجريبي';
