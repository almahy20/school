# 🔧 تطبيق Migration لإصلاح الدرجات النصية

## المشكلة:
- جدول `exam_templates` لا يحتوي على عمود `score_type`
- عند إنشاء اختبار نصي، لا يُحفظ نوع الدرجة
- عند رصد الدرجات، يظهر كرقمي دائماً

## الحل:
تم إنشاء migration يضيف عمود `score_type` للجدول

---

## 📋 خطوات التطبيق:

### **الطريقة 1: عبر Supabase CLI (موصى بها)**

```bash
# تأكد من أنك في المجلد الرئيسي
cd "d:\البرمجه\مشاريع\school-main\school-main"

# تطبيق جميع الـ migrations الجديدة
npx supabase db push
```

---

### **الطريقة 2: عبر Supabase Dashboard**

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. اذهب إلى **SQL Editor**
4. انسخ الكود من الملف:
   ```
   supabase/migrations/20260415000000_add_score_type_to_exam_templates.sql
   ```
5. الصقه في المحرر
6. اضغط **Run**

---

### **الطريقة 3: يدوياً في SQL Editor**

انسخ هذا الكود وشغله في Supabase SQL Editor:

```sql
-- إضافة عمود score_type
ALTER TABLE public.exam_templates 
ADD COLUMN IF NOT EXISTS score_type TEXT NOT NULL DEFAULT 'numeric' 
CHECK (score_type IN ('numeric', 'text'));

-- إضافة index
CREATE INDEX IF NOT EXISTS idx_exam_templates_score_type 
ON public.exam_templates(score_type);

-- تحديث schema cache
NOTIFY pgrst, 'reload schema';
```

---

## ✅ التحقق من النجاح:

### **1. عبر SQL Editor:**

```sql
-- التحقق من وجود العمود
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'exam_templates' 
AND column_name = 'score_type';
```

**النتيجة المتوقعة:**
```
column_name  | data_type | column_default
-------------|-----------|----------------
score_type   | text      | 'numeric'
```

---

### **2. اختبار عملي:**

1. أنشئ اختبار جديد
2. اختر **○ نصي**
3. احفظ
4. افتح صفحة رصد الدرجات
5. ✅ يجب أن يظهر:
   - Input نصي (ليس رقمي)
   - Placeholder: "أدخل التقدير"
   - لا يظهر `/ 100`
   - Header يقول: "تقدير نصي"

---

## 🔍 استكشاف المشاكل:

### **إذا لم يعمل:**

**1. تحقق من الـ migration:**
```sql
SELECT * FROM exam_templates LIMIT 1;
```
يجب أن يظهر عمود `score_type`

**2. إذا العمود موجود لكن لا يعمل:**

تحقق من أن الكود يرسل `score_type`:
- الملف: `src/components/dashboard/ClassExamsView.tsx`
- السطر 96: `score_type: newExam.score_type,`

**3. إذا الاختبارات القديمة لا تعمل:**

الاختبارات القديمة لن تحتوي على `score_type` (ستأخذ القيمة الافتراضية `'numeric'`)

لإصلاح اختبار قديم:
```sql
-- تحديث اختبار معين
UPDATE exam_templates 
SET score_type = 'text' 
WHERE title = 'اسم الاختبار';
```

---

## 📊 ما يحدث الآن:

### **قبل Migration:**
```
exam_templates table:
├── id
├── title
├── subject
├── max_score
└── ❌ score_type (غير موجود)
```

### **بعد Migration:**
```
exam_templates table:
├── id
├── title
├── subject
├── max_score
└── ✅ score_type ('numeric' | 'text')
```

---

## 🎯 النتيجة:

✅ الاختبارات الرقمية: Input رقمي + `/ 100`  
✅ الاختبارات النصية: Input نصي + "أدخل التقدير"  
✅ يتم حفظ النوع في قاعدة البيانات  
✅ يتم استرجاع النوع عند رصد الدرجات  

---

## 🚀 بعد التطبيق:

```bash
# إعادة تشغيل التطبيق
npm run dev

# أو إعادة البناء
npm run build
vercel --prod
```

---

**ملاحظة:** يجب تطبيق Migration **قبل** اختبار الميزة!
