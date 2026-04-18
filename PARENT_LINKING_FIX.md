# إصلاح ربط الأبناء بولي الأمر

## الطريقة:

1. افتح Supabase Dashboard
2. اضغط على SQL Editor من القائمة الجانبية
3. اضغط New Query
4. انسخ الكود من ملف:
   `supabase/migrations/20260418000000_fix_parent_student_linking_v2.sql`
5. ألصقه واضغط Run

## أو انسخ الكود مباشرة من هنا:

```sql
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  RETURN regexp_replace(phone, '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

## بعد التنفيذ:

✅ ولي الأمر هيشوف ابنه اللي مربوط برقمه
✅ صفحة التفاصيل هتعرض رقم الهاتف بشكل صحيح
✅ أي طالب جديد هيتربط تلقائياً بولي الأمر
