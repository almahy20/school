# إصلاح خطأ 403 - Data Retention Policies

## 🎯 المشكلة

```
GET https://...supabase.co/rest/v1/data_retention_policies?select=*&enabled=eq.true 
403 (Forbidden)

Error: permission denied for table data_retention_policies
```

**السبب:**
- المستخدم (teacher/parent) يحاول الوصول إلى جدول `data_retention_policies`
- هذا الجدول محمي بـ RLS (Row Level Security)
- فقط الـ admin لديه صلاحيات القراءة

---

## 🔍 التحليل

### لماذا يحدث هذا؟

```typescript
// useDataRetention.ts - BEFORE

export function useRetentionPolicies() {
  return useQuery({
    queryKey: ['data-retention-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_retention_policies')  // ❌ Admin only table
        .select('*')
        .order('table_name');

      if (error) throw error;
      return data as RetentionPolicy[];
    },
    // ❌ لا يوجد check للمستخدم!
  });
}
```

**المشكلة:**
```
1. الـ hook يُستدعى في DataRetentionSettingsPage
2. الصفحة محمية بـ allowedRoles={['admin']}
3. لكن الـ hook نفسه لا يتحقق من role المستخدم
4. إذا تم استدعاء الـ hook في أي مكان آخر
5. أو إذا تغير role المستخدم
6. ❌ يحاول fetch → 403 Forbidden
```

---

## ✅ الحل

### إضافة Role Check في الـ Hooks

**AFTER:**
```typescript
export function useRetentionPolicies() {
  const { user } = useAuth();  // ✅ احصل على المستخدم
  
  return useQuery({
    queryKey: ['data-retention-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_retention_policies')
        .select('*')
        .order('table_name');

      if (error) throw error;
      return data as RetentionPolicy[];
    },
    // ✅ فقط للـ admin
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
  });
}
```

**الفرق:**
```
قبل: يستدعي دائماً → 403 إذا لم يكن admin
بعد: يتحقق أولاً → لا يستدعي إلا إذا كان admin
```

---

## 📊 الـ Hooks المُعدلة

### 1. **useRetentionPolicies**

```typescript
export function useRetentionPolicies() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['data-retention-policies'],
    queryFn: async () => {
      // Fetch policies
    },
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
  });
}
```

**متى يعمل؟**
- ✅ `user.role === 'admin'`
- ✅ `user.isSuperAdmin === true`
- ❌ `user.role === 'teacher'`
- ❌ `user.role === 'parent'`

---

### 2. **useDatabaseSizeInfo**

```typescript
export function useDatabaseSizeInfo() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['database-size-info'],
    queryFn: async () => {
      // Fetch database size
    },
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
    refetchInterval: 60000,
  });
}
```

**لماذا؟**
```
database_size_info view يحتاج صلاحيات خاصة
يعرض معلومات حساسة عن حجم البيانات
يجب أن يكون admin فقط
```

---

### 3. **useCleanupEstimate**

```typescript
export function useCleanupEstimate() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['cleanup-estimate'],
    queryFn: async () => {
      // يحتاج قراءة data_retention_policies
      const { data: policies } = await supabase
        .from('data_retention_policies')  // ❌ Admin only
        .select('*')
        .eq('enabled', true);
      
      // Count records to delete
    },
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
    refetchInterval: 300000,
  });
}
```

**لماذا؟**
```
يحتاج قراءة data_retention_policies
إذا لم يكن admin → 403
لذلك يجب التحقق أولاً
```

---

## 🎯 كيف يعمل `enabled`؟

### React Query `enabled` Option

```typescript
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  enabled: condition  // ← إذا false، لا يستدعي queryFn
});
```

**Behavior:**
```
enabled = true:
  ✅ يستدعي queryFn
  ✅ يجلب البيانات
  ✅ يخزن في cache

enabled = false:
  ❌ لا يستدعي queryFn
  ❌ لا يجلب بيانات
  ❌ لا errors
  ⏸️ query في حالة idle
```

---

### في حالتنا:

```typescript
enabled: user?.role === 'admin' || user?.isSuperAdmin === true

// أمثلة:

user = { role: 'admin' }
→ enabled = true
→ ✅ fetches data

user = { role: 'teacher' }
→ enabled = false
→ ❌ doesn't fetch

user = { role: 'parent' }
→ enabled = false
→ ❌ doesn't fetch

user = null (not logged in)
→ enabled = false
→ ❌ doesn't fetch
```

---

## 📋 الجداول المحمية

### جداول تحتاج Admin فقط:

| الجدول | السبب | RLS |
|--------|-------|-----|
| **data_retention_policies** | إعدادات حساسة | ✅ Admin only |
| **database_size_info** | معلومات النظام | ✅ Admin only |
| **schools** | بيانات المدارس | ✅ School-based |
| **user_roles** | صلاحيات المستخدمين | ✅ Admin only |

### جداول متاحة للجميع:

| الجدول | الوصول |
|--------|--------|
| **students** | Admin + Teacher |
| **attendance** | Admin + Teacher |
| **grades** | Admin + Teacher + Parent (own children) |
| **classes** | Admin + Teacher |

---

## 🔒 Row Level Security (RLS)

### كيف تعمل في Supabase؟

```sql
-- مثال على RLS policy
CREATE POLICY "Admin can view retention policies"
ON data_retention_policies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
```

**ماذا يعني؟**
```
1. عندما يحاول user قراءة الجدول
2. Supabase يتحقق من RLS policy
3. إذا user.role === 'admin' → ✅ يسمح
4. إذا user.role !== 'admin' → ❌ 403 Forbidden
```

---

## ✅ Testing

### كيف تختبر الإصلاح؟

**1. Admin Login:**
```bash
1. سجل دخول كـ admin
2. افتح Data Retention Settings
3. ✅ يجب أن تعمل بدون errors
4. ✅ يجب أن ترى البيانات
```

**2. Teacher Login:**
```bash
1. سجل دخول كـ teacher
2. ❌ لا يجب أن ترى Data Retention Settings
3. ✅ لا يجب أن ترى 403 errors
4. Console يجب أن يكون نظيف
```

**3. Parent Login:**
```bash
1. سجل دخول كـ parent
2. ❌ لا يجب أن ترى Data Retention Settings
3. ✅ لا يجب أن ترى 403 errors
4. Console يجب أن يكون نظيف
```

---

## 📊 النتائج

### قبل الإصلاح:

```
Teacher Login:
❌ GET data_retention_policies → 403
❌ GET database_size_info → 403
❌ GET cleanup-estimate → 403
❌ Console مليء بالأخطاء
```

### بعد الإصلاح:

```
Teacher Login:
✅ enabled = false
✅ لا fetch
✅ لا errors
✅ Console نظيف

Admin Login:
✅ enabled = true
✅ fetches data
✅ يعمل بشكل طبيعي
```

---

## 🎯 Best Practices

### 1. **دائماً تحقق من Role في الـ Hooks**

```typescript
// ❌ Bad
export function useAdminData() {
  return useQuery({
    queryKey: ['admin-data'],
    queryFn: fetchAdminData,
    // ❌ لا يوجد role check
  });
}

// ✅ Good
export function useAdminData() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['admin-data'],
    queryFn: fetchAdminData,
    enabled: user?.role === 'admin',  // ✅
  });
}
```

---

### 2. **استخدم Protected Routes**

```typescript
// ✅ في App.tsx
<Route 
  path="/data-retention" 
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <DataRetentionSettingsPage />
    </ProtectedRoute>
  } 
/>
```

---

### 3. **تعامل مع الـ Errors Gracefully**

```typescript
const { data, error, isLoading } = useRetentionPolicies();

if (error) {
  // ✅ تعامل مع الخطأ
  if (error.code === '42501') {
    // Permission denied
    toast.error('ليس لديك صلاحيات للوصول');
  }
}
```

---

## 📝 ملخص التغييرات

### الملفات المُعدلة:

**useDataRetention.ts:**
```diff
export function useRetentionPolicies() {
+ const { user } = useAuth();
  
  return useQuery({
    queryKey: ['data-retention-policies'],
    queryFn: async () => {
      // ...
    },
+   enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
  });
}

export function useDatabaseSizeInfo() {
+ const { user } = useAuth();
  
  return useQuery({
    queryKey: ['database-size-info'],
    queryFn: async () => {
      // ...
    },
+   enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
    refetchInterval: 60000,
  });
}

export function useCleanupEstimate() {
+ const { user } = useAuth();
  
  return useQuery({
    queryKey: ['cleanup-estimate'],
    queryFn: async () => {
      // ...
    },
+   enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
    refetchInterval: 300000,
  });
}
```

---

## ✨ الفوائد

### للأمان:
```
✅ لا 403 errors
✅ لا unauthorized access attempts
✅ RLS policies محترمة
✅ Principle of least privilege
```

### للأداء:
```
✅ لا unnecessary requests
✅ أقل bandwidth
✅ أسرع load time
✅ أنظف console
```

### للتجربة:
```
✅ لا errors مرئية للمستخدم
✅ كل user يرى فقط ما يحتاجه
✅ UX أفضل
✅ ثقة أعلى
```

---

## 🎉 النتيجة

**تم الإصلاح!**

**قبل:**
- ❌ 403 Forbidden errors
- ❌ Console مليء بالأخطاء
- ❌ Unauthorized access attempts

**بعد:**
- ✅ No 403 errors
- ✅ Clean console
- ✅ Role-based access control
- ✅ Best practices applied

---

**الإصلاح يضمن:**
1. ✅ Admin فقط يمكنه الوصول لـ data retention
2. ✅ Teacher/Parent لا يحاولون الوصول
3. ✅ لا unauthorized requests
4. ✅ Clean, error-free experience
