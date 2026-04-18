# إصلاحات مهمة - يجب تنفيذها يدوياً

## 1. إصلاح ربط الأبناء بولي الأمر (مهم جداً!)

### المشكلة:
- ولي الأمر مش شايف الابن اللي مربوط برقمه
- صفحة التفاصيل بتعرض "غير مسجل" في رقم الهاتف

### الحل:
قم بتنفيذ الـ migration التالي في Supabase Dashboard → SQL Editor:

**الملف:** `supabase/migrations/20260418000000_fix_parent_student_linking_v2.sql`

#### انسخ الكود التالي ونفذه في SQL Editor:

```sql
-- 1. Normalization function
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  RETURN regexp_replace(phone, '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Sync existing data
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT DISTINCT s.school_id, s.id, p.id
FROM public.students s
INNER JOIN public.profiles p
  ON public.normalize_phone(p.phone) = public.normalize_phone(s.parent_phone)
INNER JOIN public.user_roles r
  ON r.user_id = p.id AND r.role = 'parent'
WHERE s.parent_phone IS NOT NULL AND s.parent_phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp 
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 3. Triggers for future
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_parent_id uuid; v_norm_phone text;
BEGIN
  v_norm_phone := public.normalize_phone(NEW.parent_phone);
  IF v_norm_phone IS NULL OR v_norm_phone = '' THEN RETURN NEW; END IF;
  SELECT p.id INTO v_parent_id
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.id
  WHERE public.normalize_phone(p.phone) = v_norm_phone
    AND r.role = 'parent'
    AND (p.school_id = NEW.school_id OR p.school_id IS NULL)
  LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    VALUES (NEW.school_id, NEW.id, v_parent_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_student_parent_by_phone();

CREATE OR REPLACE FUNCTION public.sync_parent_students_by_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_norm_phone text;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.phone = NEW.phone) THEN RETURN NEW; END IF;
  v_norm_phone := public.normalize_phone(NEW.phone);
  IF v_norm_phone IS NULL OR v_norm_phone = '' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'parent') THEN RETURN NEW; END IF;
  INSERT INTO public.student_parents (school_id, student_id, parent_id)
  SELECT s.school_id, s.id, NEW.id
  FROM public.students s
  WHERE public.normalize_phone(s.parent_phone) = v_norm_phone
    AND (s.school_id = NEW.school_id OR NEW.school_id IS NULL)
  ON CONFLICT (student_id, parent_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_parent_students_by_phone ON public.profiles;
CREATE TRIGGER tr_sync_parent_students_by_phone
  AFTER INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_parent_students_by_phone();

NOTIFY pgrst, 'reload schema';
```

---

## 2. إصلاح نافذة تثبيت التطبيق (PWA)

✅ **تم الإصلاح تلقائياً في الكود**

تم إضافة component جديد: `PWAInstallPrompt`

### ملاحظات:
- النافذة ستظهر تلقائياً في المتصفحات التي تدعم PWA
- في Chrome/Edge على الكمبيوتر: ستظهر في الزاوية السفلية
- على الموبايل: استخدم "Add to Home Screen" من قائمة المتصفح
- إذا كانت مثبتة بالفعل: لن تظهر النافذة

### اختبار التثبيت:
1. افتح التطبيق في Chrome
2. اضغط على أيقونة التثبيت في شريط العنوان (إذا ظهرت)
3. أو انتظر نافذة التثبيت التلقائية

---

## 3. ملفات تم تعديلها

### تم إصلاحه:
- ✅ `useParents.ts` - إصلاح join الأبناء
- ✅ `App.tsx` - إضافة PWA prompt
- ✅ `PWAInstallPrompt.tsx` - component جديد

### تم إنشاؤه:
- ✅ `20260418000000_fix_parent_student_linking_v2.sql`

---

## خطوات التنفيذ:

1. **افتح Supabase Dashboard**
2. **اذهب إلى SQL Editor**
3. **انسخ الكود من القسم 1 وألصقه**
4. **اضغط Run**
5. **انتظر رسالة النجاح**
6. **حدث صفحة التطبيق (Ctrl+F5)**

---

## التحقق من الإصلاح:

### بعد تنفيذ الـ SQL:

1. **افتح صفحة ولي الأمر** (رقم 01005321773)
2. **يجب أن يظهر الابن في قسم الأبناء**
3. **يجب أن يظهر رقم الهاتف بشكل صحيح**
4. **ولّي الأمر عندما يسجل دخول، يجب أن يرى ابنه في الصفحة الرئيسية**

إذا لم يظهر:
- تأكد من أن الطالب عنده `parent_phone` = `01005321773`
- تأكد من أن ولي الأمر عنده `phone` = `01005321773`
- تحقق من جدول `student_parents` في Table Editor

---

## استعلام للتحقق:

```sql
SELECT 
  s.name as student_name,
  s.parent_phone,
  p.full_name as parent_name,
  p.phone as parent_phone_in_profile,
  sp.id as link_exists
FROM students s
LEFT JOIN profiles p ON normalize_phone(p.phone) = normalize_phone(s.parent_phone)
LEFT JOIN student_parents sp ON sp.student_id = s.id AND sp.parent_id = p.id
WHERE s.parent_phone = '01005321773';
```

هذا الاستعلام يجب أن يرجع:
- اسم الطالب ✅
- رقم ولي الأمر ✅
- اسم ولي الأمر ✅
- رقم الهاتف ✅
- link_exists = UUID (مش null) ✅
