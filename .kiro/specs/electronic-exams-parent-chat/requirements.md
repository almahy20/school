# Requirements Document

## Introduction

هذه الوثيقة تغطي فيتشرين متكاملين يُضافان إلى تطبيق إدارة المدرسة (school-master):

**الفيتشر الأول — نظام الاختبارات الإلكترونية (Electronic Exams):**
يتيح للمدير أو المعلم إنشاء اختبارات إلكترونية تفاعلية بأنواع أسئلة متعددة (صح/غلط، اختيار من متعدد، إكمال فراغ)، مع تحديد مدة زمنية، ومعاينة قبل النشر، وعرض درجات الطلاب بعد الانتهاء. من جهة ولي الأمر، يظهر الاختبار كـ كارت في قائمة مخصصة بالسايدبار، ويحل الابن الاختبار مع مؤقت زمني، وتُحفظ النتيجة وتُعرض فوراً.

**الفيتشر الثاني — شات أولياء الأمور (Parent Chat):**
يُضاف قسم الدردشة إلى صفحة التواصل الحالية، يشمل: محادثة خاصة مع إدارة المدرسة (موجودة جزئياً)، وغرف دردشة جماعية لكل فصل يتواجد فيه أبناء ولي الأمر. يتواصل أولياء الأمور في نفس الفصل فيما بينهم ضمن غرفة الفصل.

**المنصة التقنية:** React + TypeScript + Vite، Supabase (PostgreSQL + Realtime)، Tailwind CSS + shadcn/ui، دعم RTL كامل.

---

## Glossary

- **Exam_System**: نظام الاختبارات الإلكترونية
- **Exam**: اختبار إلكتروني منشور يحتوي على أسئلة ومدة زمنية وفصل مرتبط
- **Question**: سؤال في الاختبار له نوع (صح/غلط، اختيار متعدد، إكمال فراغ) وإجابة صحيحة
- **Exam_Attempt**: محاولة حل الاختبار من قِبل الطالب، تحمل الإجابات والنتيجة والوقت المستهلك
- **Admin**: مدير المدرسة أو المعلم المخوّل بإدارة الاختبارات
- **Parent**: ولي الأمر المرتبط بطالب واحد أو أكثر
- **Student**: الطالب المرتبط بولي الأمر وبفصل دراسي
- **Class**: الفصل الدراسي الذي يجمع طلاباً وأولياء أمورهم
- **Exam_Timer**: المؤقت الزمني التنازلي الذي يظهر للطالب أثناء الحل
- **Chat_System**: نظام الدردشة الجماعية والخاصة لأولياء الأمور
- **Class_Chat_Room**: غرفة دردشة جماعية تجمع أولياء الأمور في فصل واحد
- **Admin_Chat**: المحادثة الخاصة الثنائية بين ولي الأمر وإدارة المدرسة
- **School**: المدرسة — كيان متعدد المستأجرين (multi-tenant)
- **School_ID**: معرّف المدرسة المستخدم لعزل البيانات بين المدارس

---

## Requirements

### Requirement 1: إنشاء الاختبار الإلكتروني (Admin/Teacher)

**User Story:** بصفتي مدير أو معلم، أريد إنشاء اختبار إلكتروني بشكل احترافي وإضافة أسئلة متنوعة، حتى أتمكن من تقييم الطلاب رقمياً بدلاً من الورق.

#### Acceptance Criteria

1. WHEN يفتح Admin صفحة تفاصيل الفصل، THE Exam_System SHALL يعرض كارتاً للاختبارات الإلكترونية ضمن كروت الإجراءات (Action Cards) بجانب كارت رصد الحضور والتقييمات وإدارة المنهج.
2. WHEN يضغط Admin على كارت الاختبارات الإلكترونية، THE Exam_System SHALL يعرض قائمة الاختبارات المنشورة والمسودات الخاصة بهذا الفصل، مرتبةً بتاريخ الإنشاء تنازلياً (الأحدث أولاً).
3. WHEN يضغط Admin على "إنشاء اختبار جديد"، THE Exam_System SHALL يعرض نموذج إنشاء يحتوي على: عنوان الاختبار (مطلوب، حد أقصى 200 حرف)، المادة (مطلوب، حد أقصى 100 حرف)، المدة الزمنية بالدقائق (مطلوب)، وتعليمات اختيارية (حد أقصى 1000 حرف).
4. THE Exam_System SHALL يحفظ المدة الزمنية كعدد صحيح بالدقائق لا يقل عن 1 ولا يزيد عن 180.
5. WHEN يحفظ Admin بيانات الاختبار الأساسية، THE Exam_System SHALL ينتقل إلى واجهة إضافة الأسئلة.
6. IF أغفل Admin ملء أي حقل مطلوب عند الحفظ، THEN THE Exam_System SHALL يعرض رسالة خطأ مضمّنة أسفل كل حقل ناقص ويمنع الانتقال إلى واجهة الأسئلة.
7. IF فشل حفظ بيانات الاختبار بسبب خطأ في الشبكة أو قاعدة البيانات، THEN THE Exam_System SHALL يعرض رسالة خطأ واضحة للمستخدم ويُبقي النموذج مفتوحاً مع البيانات المدخلة.

---

### Requirement 2: إدارة أسئلة الاختبار

**User Story:** بصفتي مدير أو معلم، أريد إضافة أسئلة بأنواع مختلفة وتحديد الإجابة الصحيحة لكل سؤال، حتى يتمكن النظام من التصحيح التلقائي.

#### Acceptance Criteria

1. THE Exam_System SHALL يدعم ثلاثة أنواع من الأسئلة: صح وغلط (true_false)، اختيار من متعدد (multiple_choice)، وإكمال الفراغ (fill_blank).
2. WHEN يختار Admin نوع السؤال "صح وغلط"، THE Exam_System SHALL يعرض حقل نص السؤال (مطلوب، حد أقصى 500 حرف) وخيارَي الإجابة (صح / غلط) مع إلزامية تحديد الإجابة الصحيحة.
3. WHEN يختار Admin نوع السؤال "اختيار من متعدد"، THE Exam_System SHALL يعرض حقل نص السؤال (مطلوب، حد أقصى 500 حرف) وأربعة حقول للخيارات (أ، ب، ج، د) جميعها مطلوبة (حد أقصى 200 حرف لكل خيار) مع إلزامية تحديد الإجابة الصحيحة من بين الأربعة.
4. WHEN يختار Admin نوع السؤال "إكمال الفراغ"، THE Exam_System SHALL يعرض حقل نص السؤال (مطلوب، حد أقصى 500 حرف، يحتوي على `___` لتمثيل الفراغ) وحقلاً للإجابة الصحيحة (مطلوب، حد أقصى 200 حرف).
5. THE Exam_System SHALL يتيح للAdmin إضافة ما لا يقل عن سؤال واحد وما لا يزيد عن 50 سؤالاً في الاختبار الواحد.
6. WHEN يضغط Admin على "إضافة سؤال آخر"، THE Exam_System SHALL يضيف نموذج سؤال جديد أسفل القائمة دون إعادة تحميل الصفحة.
7. IF وصل عدد الأسئلة إلى 50، THEN THE Exam_System SHALL يُخفي زر "إضافة سؤال آخر" ويعرض رسالة توضح بلوغ الحد الأقصى.
8. THE Exam_System SHALL يتيح للAdmin حذف أي سؤال قبل نشر الاختبار مع عرض حوار تأكيد قبل الحذف.
9. THE Exam_System SHALL يتيح للAdmin إعادة ترتيب الأسئلة عبر أزرار الأعلى/الأسفل، مع تعطيل زر الأعلى للسؤال الأول وزر الأسفل للسؤال الأخير.

---

### Requirement 3: معاينة ونشر الاختبار

**User Story:** بصفتي مدير، أريد معاينة الاختبار كما سيراه الطالب قبل نشره، حتى أتحقق من صحة الأسئلة والإجابات.

#### Acceptance Criteria

1. WHEN يضغط Admin على "معاينة الاختبار"، THE Exam_System SHALL يعرض الاختبار بكامل أسئلته بشكل تفاعلي مطابق لواجهة الطالب، مع تمييز الإجابة الصحيحة لكل سؤال بأيقونة أو لون مميز.
2. WHILE يكون الاختبار في وضع المعاينة، THE Exam_System SHALL لا يحتسب أي مؤقت زمني ولا يحفظ أي إجابات في قاعدة البيانات.
3. WHEN يضغط Admin على "إغلاق المعاينة"، THE Exam_System SHALL يعود إلى واجهة تعديل الاختبار مع الحفاظ على كل الأسئلة المُدخَلة.
4. WHEN يضغط Admin على "نشر الاختبار"، THE Exam_System SHALL يتحقق من توفر: عنوان غير فارغ، أسئلة (سؤال واحد على الأقل)، ومدة زمنية صالحة قبل تغيير الحالة إلى "منشور".
5. IF لم يُضِف Admin أي سؤال أو كان العنوان أو المدة الزمنية مفقودة عند النشر، THEN THE Exam_System SHALL يعرض رسالة خطأ مضمّنة في واجهة المستخدم ويُبقي زر النشر معطّلاً.
6. WHEN يتم نشر الاختبار بنجاح، THE Exam_System SHALL يظهر الاختبار في قائمة اختبارات ولي الأمر المرتبط بطلاب هذا الفصل خلال 3 ثوانٍ من اكتمال عملية النشر.

---

### Requirement 4: عرض درجات الطلاب (Admin)

**User Story:** بصفتي مدير أو معلم، أريد رؤية درجة كل طالب بعد إتمامه الاختبار، حتى أتابع الأداء الأكاديمي.

#### Acceptance Criteria

1. WHEN يفتح Admin قائمة الاختبارات، THE Exam_System SHALL يعرض لكل اختبار منشور: عدد الطلاب الذين أتموا الاختبار، ومتوسط الدرجات (مُقرَّب لأقرب عدد صحيح)، وعدد الطلاب المُسجَّلين في الفصل الذين لم يؤدوه بعد.
2. WHEN يضغط Admin على اختبار منشور، THE Exam_System SHALL يعرض جدول درجات يحتوي على: اسم الطالب، الدرجة التي حصل عليها، الدرجة الكلية، النسبة المئوية (مُحسَبة كـ score/total_score × 100 مُقرَّبة لعدد صحيح)، والوقت المستهلك بالدقائق والثواني.
3. THE Exam_System SHALL يحسب درجة الطالب تلقائياً عبر مقارنة إجاباته المخزنة بالإجابات الصحيحة في جدول `exam_questions`، ويمنح درجة كاملة لكل سؤال صحيح ولا يُطبَّق أي خصم للإجابة الخاطئة.
4. WHERE يختار Admin تصدير النتائج، THE Exam_System SHALL يُنشئ ملف CSV يحتوي على أعمدة: اسم الطالب، الدرجة، الدرجة الكلية، النسبة المئوية، الوقت المستهلك، ويُشغِّل تنزيله مباشرةً في المتصفح.

---

### Requirement 5: قائمة الاختبارات لولي الأمر

**User Story:** بصفتي ولي أمر، أريد رؤية الاختبارات المتاحة لابني من مكان واضح في التطبيق، حتى لا أفوّت أي اختبار.

#### Acceptance Criteria

1. THE Exam_System SHALL يضيف عنصر "الاختبارات" في قائمة السايدبار الخاصة بولي الأمر بأيقونة `ClipboardList` من lucide-react.
2. WHEN يضغط Parent على "الاختبارات" في السايدبار، THE Exam_System SHALL يعرض صفحة تحتوي على كروت الاختبارات المنشورة فقط المتاحة لكل أبناء ولي الأمر، مرتبةً بتاريخ النشر تنازلياً.
3. THE Exam_System SHALL يعرض على كل كارت اختبار: عنوان الاختبار، اسم الفصل، المادة، المدة الزمنية بالدقائق، وشارة الحالة (جديد باللون الأزرق / تم الحل باللون الأخضر).
4. WHEN يكون الاختبار منشوراً ولم يُؤدَّ بعد من قِبل الطالب المرتبط بولي الأمر، THE Exam_System SHALL يعرض زر "ابدأ الاختبار" بلون أساسي (primary) بارز على الكارت.
5. WHEN يكون الاختبار قد أُدِّي من قِبل الطالب، THE Exam_System SHALL يعرض الدرجة التي حصل عليها الطالب بصيغة (X / Y) بدلاً من زر البدء.
6. WHERE ولي الأمر لديه أبناء متعددون، THE Exam_System SHALL يعرض اختبارات جميع الأبناء مع عرض اسم كل ابن بوضوح على كارت الاختبار المرتبط به.
7. IF لم يكن هناك أي اختبار منشور لأبناء ولي الأمر، THEN THE Exam_System SHALL يعرض رسالة حالة فارغة (Empty State) توضح عدم وجود اختبارات حالياً.

---

### Requirement 6: واجهة حل الاختبار (Parent/Student)

**User Story:** بصفتي ولي أمر، أريد أن يحل ابني الاختبار بواجهة احترافية ومنظمة مع وجود مؤقت زمني، حتى يكون الاختبار عادلاً ومنظماً.

#### Acceptance Criteria

1. WHEN يضغط Parent على "ابدأ الاختبار"، THE Exam_System SHALL يعرض شاشة تأكيد تحتوي على: عنوان الاختبار، اسم الطالب الذي سيؤدي الاختبار، عدد الأسئلة، المدة الزمنية، وزر التأكيد.
2. WHEN يؤكد Parent البدء، THE Exam_System SHALL يبدأ Exam_Timer التنازلي وينتقل إلى شاشة الاختبار.
3. WHILE يكون الاختبار جارياً، THE Exam_System SHALL يعرض سؤالاً واحداً في كل مرة مع شريط تقدم يوضح رقم السؤال الحالي من إجمالي الأسئلة.
4. WHILE يكون الاختبار جارياً، THE Exam_Timer SHALL يعرض الوقت المتبقي بصيغة (دقائق:ثواني) في مكان ثابت أعلى الشاشة.
5. WHEN يختار Parent إجابة، THE Exam_System SHALL يحفظ الاختيار في حالة المكوّن المحلية ويتيح الانتقال للسؤال التالي أو السابق.
6. WHILE يكون الاختبار جارياً، THE Exam_System SHALL يتيح للمستخدم مراجعة الأسئلة السابقة وتغيير الإجابة قبل الإرسال النهائي.
7. WHEN ينفد وقت الـ Exam_Timer، THE Exam_System SHALL يُرسل الإجابات المحفوظة تلقائياً ثم يعرض شاشة النتيجة.
8. WHEN يضغط Parent على "إنهاء الاختبار" قبل انتهاء الوقت، THE Exam_System SHALL يعرض حوار تأكيد؛ فإذا أكد المستخدم، يُرسل الإجابات ويعرض النتيجة، وإذا ألغى يعود إلى الاختبار.
9. WHEN يتم إرسال إجابات الاختبار، THE Exam_System SHALL يحسب الدرجة ويعرضها للطالب خلال 3 ثوانٍ مع تصحيح تفصيلي لكل سؤال (الإجابة الصحيحة والإجابة التي اختارها)، وتُعدّ الأسئلة غير المجاب عنها خطأ بدرجة صفر.
10. WHEN يتم إنهاء الاختبار، THE Exam_System SHALL يحفظ Exam_Attempt في قاعدة البيانات بحيث لا يمكن لنفس الطالب أداء الاختبار مرة أخرى.
11. IF فشل إرسال الإجابات بسبب خطأ في الشبكة، THEN THE Exam_System SHALL يعرض رسالة خطأ للمستخدم ويُتيح له إعادة المحاولة دون فقد الإجابات المحفوظة محلياً.

---

### Requirement 7: قاعدة البيانات للاختبارات الإلكترونية

**User Story:** بصفتي مطور، أريد مخطط قاعدة بيانات محكم يدعم الاختبارات الإلكترونية بكامل متطلباتها ويلتزم بنموذج multi-tenant الموجود في المشروع.

#### Acceptance Criteria

1. THE Exam_System SHALL ينشئ جدول `electronic_exams` يحتوي على الأعمدة التالية كلها NOT NULL ما لم يُذكر خلاف ذلك: id (uuid, PK)، school_id (uuid, FK → schools)، class_id (uuid, FK → classes)، teacher_id (uuid, FK → profiles)، title (text)، subject (text)، duration_minutes (integer, CHECK ≥1 AND ≤180)، instructions (text, nullable)، status (text, CHECK IN ('draft','published','archived'))، created_at (timestamptz)، updated_at (timestamptz).
2. THE Exam_System SHALL ينشئ جدول `exam_questions` يحتوي على: id (uuid, PK)، exam_id (uuid, FK → electronic_exams)، school_id (uuid, FK → schools, NOT NULL)، question_type (text, CHECK IN ('true_false','multiple_choice','fill_blank'))، question_text (text, NOT NULL)، options (jsonb, nullable)، correct_answer (text, NOT NULL)، order_index (integer, NOT NULL).
3. THE Exam_System SHALL ينشئ جدول `exam_attempts` يحتوي على: id (uuid, PK)، exam_id (uuid, FK → electronic_exams)، student_id (uuid, FK → profiles)، parent_id (uuid, FK → profiles)، answers (jsonb, NOT NULL)، score (integer, NOT NULL, CHECK ≥0)، total_score (integer, NOT NULL, CHECK ≥0)، time_spent_seconds (integer, NOT NULL, CHECK ≥0)، started_at (timestamptz)، completed_at (timestamptz)، مع قيد CHECK أن score ≤ total_score.
4. THE Exam_System SHALL يُطبّق Row Level Security على جميع الجداول الجديدة باستخدام دوال الأمان `get_my_school_id()` و`is_super_admin()` المتوفرة في المشروع لعزل البيانات بين المدارس، مع سياسات SELECT/INSERT/UPDATE/DELETE مناسبة لكل دور (admin، parent).
5. IF حاول نفس الطالب إدراج Exam_Attempt ثانٍ لنفس الاختبار، THEN THE Exam_System SHALL يمنع الإدراج تلقائياً باستخدام قيد UNIQUE على (exam_id, student_id) في جدول `exam_attempts`.

---

### Requirement 8: دردشة ولي الأمر مع إدارة المدرسة (Admin Chat)

**User Story:** بصفتي ولي أمر، أريد التواصل الخاص مع إدارة المدرسة بسهولة من صفحة التواصل، حتى أناقش أمور ابني بشكل مباشر وخاص.

#### Acceptance Criteria

1. WHEN يفتح Parent صفحة "/conversations"، THE Chat_System SHALL يعرض قسمَي الدردشة بشكل واضح ومنفصل: "التواصل مع المدرسة" و"دردشة الفصول".
2. THE Chat_System SHALL يعرض Admin_Chat كأول عنصر في قسم "التواصل مع المدرسة" بتصميم كارت مميز يحمل عنوان "التواصل مع الإدارة" وأيقونة تشير إلى الطابع الخاص للمحادثة.
3. WHEN يضغط Parent على كارت Admin_Chat، THE Chat_System SHALL يفتح واجهة المحادثة الثنائية الموجودة حالياً في نظام `conversations`.
4. IF لم تكن محادثة سابقة للـ Parent مع إدارة المدرسة المرتبطة بـ school_id الخاص به، THEN THE Chat_System SHALL ينشئ سجل محادثة جديداً تلقائياً في جدول `conversations` عند إرسال الرسالة الأولى.
5. THE Chat_System SHALL يعرض شارة (badge) تحتوي على عدد الرسائل غير المقروءة على كارت Admin_Chat؛ وتُعدّ الرسالة مقروءةً عند فتح واجهة المحادثة.
6. IF فشل إنشاء المحادثة تلقائياً بسبب خطأ في قاعدة البيانات، THEN THE Chat_System SHALL يعرض رسالة خطأ واضحة للمستخدم ويُتيح له إعادة المحاولة.

---

### Requirement 9: دردشة أولياء الأمور ضمن الفصل (Class Chat)

**User Story:** بصفتي ولي أمر، أريد التواصل مع أولياء أمور الطلاب الآخرين في نفس فصل ابني، حتى نتبادل المعلومات والأخبار المدرسية فيما بيننا.

#### Acceptance Criteria

1. WHEN يفتح Parent صفحة "/conversations"، THE Chat_System SHALL يعرض في قسم "دردشة الفصول" كارتاً مستقلاً لكل فصل يتواجد فيه ابن لولي الأمر.
2. WHERE ولي الأمر لديه أبناء في فصول متعددة، THE Chat_System SHALL يعرض كارتاً منفصلاً لكل فصل يحمل اسم الفصل بوضوح.
3. WHEN يضغط Parent على كارت فصل معين، THE Chat_System SHALL يفتح واجهة Class_Chat_Room التي تضم رسائل جميع أولياء الأمور في هذا الفصل.
4. WHEN تُفتح واجهة Class_Chat_Room، THE Chat_System SHALL يعرض آخر 100 رسالة مرتبة زمنياً تصاعدياً مع اسم مُرسِل كل رسالة.
5. WHEN يرسل Parent رسالة في Class_Chat_Room (بحد أقصى 500 حرف)، THE Chat_System SHALL يُرسل الرسالة عبر Supabase Realtime وتظهر لجميع أولياء الأمور في نفس الغرفة خلال 2 ثانية.
6. WHEN يفتح Parent واجهة Class_Chat_Room، THE Chat_System SHALL يُحدِّث حالة قراءة الرسائل ويُصفِّر عداد الرسائل غير المقروءة على الكارت المرتبط بذلك الفصل.
7. IF حاول Parent الوصول إلى Class_Chat_Room لفصل لا يوجد فيه أي من أبنائه، THEN THE Chat_System SHALL يرفض الوصول ويعرض رسالة "غير مصرح لك بالوصول إلى هذه الغرفة".
8. IF أرسل Parent رسالة تتجاوز 500 حرف، THEN THE Chat_System SHALL يمنع الإرسال ويعرض عداد الأحرف المتبقية باللون الأحمر.

---

### Requirement 10: قاعدة البيانات لدردشة الفصول

**User Story:** بصفتي مطور، أريد جداول قاعدة بيانات للدردشة الجماعية للفصول تستخدم Supabase Realtime وتلتزم بنموذج الأمان multi-tenant.

#### Acceptance Criteria

1. THE Chat_System SHALL ينشئ جدول `class_chat_rooms` يحتوي على: id (uuid, PK)، school_id (uuid, FK → schools, NOT NULL)، class_id (uuid, FK → classes, NOT NULL)، name (text, NOT NULL)، created_at (timestamptz)، مع قيد UNIQUE على (school_id, class_id).
2. THE Chat_System SHALL ينشئ جدول `class_chat_messages` يحتوي على: id (uuid, PK)، room_id (uuid, FK → class_chat_rooms, NOT NULL)، sender_id (uuid, NOT NULL, يُطبَّق CHECK أن قيمته يساوي auth.uid() عند الإدراج)، content (text, NOT NULL, CHECK length ≤ 500)، created_at (timestamptz DEFAULT now()).
3. THE Chat_System SHALL يُطبّق سياسة RLS على جدول `class_chat_messages` تسمح بـ SELECT و INSERT للـ sender فقط إذا كان لديه طالب في الفصل المرتبط بـ room_id، محققاً ذلك عبر الربط: class_chat_rooms.class_id → students.class_id → students.parent_id = auth.uid().
4. THE Chat_System SHALL يُفعّل Supabase Realtime على جدول `class_chat_messages` عبر تفعيل `REPLICA IDENTITY FULL` وإضافة الجدول إلى `supabase_realtime` publication.
5. WHEN يحاول Parent فتح Class_Chat_Room لأول مرة، THE Chat_System SHALL يتحقق من وجود سجل في `class_chat_rooms` لهذا الفصل؛ IF لم يكن موجوداً، THEN يُنشئه تلقائياً باستخدام `INSERT ... ON CONFLICT DO NOTHING` لضمان idempotency.

---

### Requirement 11: التصميم والتجربة البصرية

**User Story:** بصفتي مستخدم، أريد واجهات احترافية ومتسقة مع باقي تصميم التطبيق وتدعم اللغة العربية بشكل كامل.

#### Acceptance Criteria

1. THE Exam_System SHALL يستخدم نفس نمط الكروت المعتمد في المشروع: `rounded-[28px]`، `shadow`، وتأثير `hover:shadow-md transition-shadow` على جميع كروت الاختبارات.
2. THE Chat_System SHALL يستخدم نمط فقاعات الرسائل الموجود في `ParentConversationsPage`، مع إضافة عرض اسم المُرسِل بخط أصغر (text-xs) أعلى كل فقاعة رسالة في Class_Chat_Room.
3. THE Exam_System SHALL يدعم عرض RTL كامل لجميع الواجهات بتطبيق `dir="rtl"` على الحاويات الرئيسية واستخدام خصائص `space-x-reverse` و`text-right` حيثما يلزم.
4. WHEN يتبقى أقل من 120 ثانية في Exam_Timer، THE Exam_Timer SHALL يُغيّر لون عرض الوقت إلى `text-red-600` ويُضيف تأثير `animate-pulse` للفت الانتباه.
5. THE Exam_System SHALL يعرض حالات التحميل والخطأ عبر مكون `QueryStateHandler` الموجود في `src/components/QueryStateHandler.tsx`.
6. THE Chat_System SHALL يعرض حالات التحميل باستخدام أيقونة `Loader2` من lucide-react مع `animate-spin`، وتعرض أخطاء الإرسال عبر `toast.error()` من مكتبة sonner الموجودة في المشروع.
