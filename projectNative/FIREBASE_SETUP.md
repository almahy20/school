# إعداد Firebase للمشروع 🚀

لضمان عمل المشروع بأفضل حال واستقرار، يرجى اتباع الخطوات التالية لإعداد Firebase Console.

## 1. إعداد Firestore
قم بإنشاء قاعدة بيانات Firestore في وضع "Production Mode" واختيار أقرب خادم لمنطقتك.

### قواعد الحماية (Security Rules)
انسخ القواعد التالية والصقها في تبويب **Rules** في Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // وظيفة للتحقق من تسجيل الدخول
    function isSignedIn() {
      return request.auth != null;
    }
    
    // وظيفة للتحقق من انتماء المستخدم لمدرسة معينة
    function belongsToSchool(schoolId) {
      return isSignedIn() && get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.schoolId == schoolId;
    }

    // وظيفة للتحقق مما إذا كان المستخدم مديراً
    function isAdmin() {
      return isSignedIn() && get(/databases/$(database)/documents/userRoles/$(request.auth.uid)).data.role == 'admin';
    }

    // قواعد مدرسة (Schools)
    match /schools/{schoolId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // قواعد الملفات الشخصية (Profiles)
    match /profiles/{userId} {
      allow read: if isSignedIn();
      allow write: if request.auth.uid == userId || isAdmin();
    }

    // قواعد الطلاب (Students)
    match /students/{studentId} {
      allow read: if belongsToSchool(resource.data.schoolId);
      allow write: if isAdmin() && belongsToSchool(request.resource.data.schoolId);
    }

    // قواعد الفصول (Classes)
    match /classes/{classId} {
      allow read: if belongsToSchool(resource.data.schoolId);
      allow write: if isAdmin() && belongsToSchool(request.resource.data.schoolId);
    }
    
    // أضف بقية القواعد بناءً على منطق التطبيق...
  }
}
```

## 2. الفهارس (Indexes)
قد تحتاج بعض الاستعلامات المتقدمة إلى فهارس. إذا ظهر خطأ في Console يطلب "Composite Index"، قم بالضغط على الرابط الذي يوفره الخطأ لإنشائه تلقائياً.

## 3. المصادقة (Authentication)
تأكد من تفعيل:
- **Email/Password**: مستخدم حالياً كغطاء لرقم الهاتف.
- **Phone Number** (اختياري إذا أردت استخدامه مستقبلاً).

## 4. إعدادات البيئة
تأكد من أن ملف `.env` يحتوي على القيم الصحيحة من صفحة **Project Settings** في Firebase.

```env
EXPO_PUBLIC_FIREBASE_API_KEY=xxx
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
EXPO_PUBLIC_FIREBASE_APP_ID=xxx
```

## 5. تهيئة البيانات لأول مرة
عند تشغيل التطبيق لأول مرة وتسجيل مستخدم جديد، يمكنك استخدام دالة `seedInitialData` الموجودة في `lib/firebase/seed.ts` لإنشاء المدرسة الأولى وتعيين المستخدم كمدير عام.
