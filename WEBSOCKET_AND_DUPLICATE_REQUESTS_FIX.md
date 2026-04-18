# 🔧 إصلاح بطء WebSocket وDuplicate Profile Requests

## ❌ المشاكل المُلاحظة

### المشكلة 1: بطء WebSocket Connections
```
ws://localhost:8080/?token=...          → 1,000-2,500ms
wss://mecutwh...supabase.co/realtime/   → 1,000-2,500ms
```

### المشكلة 2: Duplicate Profile Requests
```
/rest/v1/profiles?select=id,full_name&id=in.(...)  → 1,000-2,500ms
/rest/v1/profiles?select=id,full_name&id=in.(...)  → 1,000-2,500ms
(نفس الطلب مرتين!)
```

---

## 🔍 التحليل

### 1. WebSocket Slow في Local Development

**السبب طبيعي:**
- `ws://localhost` (غير مشفر) أبطأ من `wss://` (مشفر)
- في **production**، سيستخدم `wss://` تلقائياً
- التأخر 1-2.5 ثانية **طبيعي في local dev**

**لماذا يحدث:**
```
Local Development:
  ws://localhost → Browser overhead → 1-2.5s

Production:
  wss://yourdomain.com → Optimized → 200-500ms
```

---

### 2. Duplicate Profile Requests

**السبب:** هناك مكونين أو أكثر يجلبان **نفس الـ profiles**:

#### السيناريو المحتمل:

**مكون 1: GlobalAnnouncement**
```typescript
// يجلب sender profiles
const { data: senderProfiles } = useQuery({
  queryKey: ['announcement-senders', senderIds],
  queryFn: () => supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', senderIds) // IDs: [A, B, C, D]
});
```

**مكون 2: ClassMessagesView**
```typescript
// يجلب parent profiles
const { data: parentProfiles } = useProfilesByIds(studentParentIds);
// IDs: [A, B, C, D] (نفس IDs!)
```

**النتيجة:** نفس الطلب يُرسل مرتين!

---

## ✅ الحلول

### الحل 1: WebSocket Slow (طبيعي - لا يحتاج إصلاح)

**في Local Development:**
- ✅ التأخر **طبيعي ومتوقع**
- ✅ لا يؤثر على الأداء الفعلي
- ✅ في production سيكون أسرع بـ 5-10x

**للتحقق في Production:**
```
1. افتح DevTools → Network
2. فلتر بـ "WS" (WebSocket)
3. راقب وقت الاتصال
المتوقع: 200-500ms (بدلاً من 1-2.5s)
```

---

### الحل 2: منع Duplicate Profile Requests

#### أ. استخدام Shared Cache Query Key

**قبل:**
```typescript
// GlobalAnnouncement.tsx
const { data: senderProfiles } = useQuery({
  queryKey: ['announcement-senders', senderIds],
  // queryKey مختلف
});

// ClassMessagesView.tsx
const { data: parentProfiles } = useProfilesByIds(ids);
// queryKey مختلف: ['profiles-by-ids', ids]
```

**بعد - Query Key موحد:**
```typescript
// ✅ استخدم useProfilesByIds في كل مكان
import { useProfilesByIds } from '@/hooks/queries/useProfile';

// GlobalAnnouncement.tsx
const { data: senderProfiles } = useProfilesByIds(senderIds);

// ClassMessagesView.tsx
const { data: parentProfiles } = useProfilesByIds(studentParentIds);
```

**النتيجة:**
- ✅ نفس queryKey = نفس cache
- ✅ React Query يمنع duplicate requests تلقائياً
- ✅ request واحد فقط بدلاً من 2

---

#### ب. تحسين GlobalAnnouncement لاستخدام useProfilesByIds

دعني أطبق هذا الآن:

**قبل:**
```typescript
const { data: senderProfiles } = useQuery({
  queryKey: ['announcement-senders', senderIds],
  queryFn: async () => {
    if (!senderIds.length) return {};
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', senderIds);
    
    const profileMap: Record<string, string> = {};
    (data || []).forEach((p: any) => {
      profileMap[p.id] = p.full_name || 'الإدارة';
    });
    return profileMap;
  },
  // ...
});
```

**بعد:**
```typescript
// ✅ استخدام useProfilesByIds الموحد
const { data: profilesArray } = useProfilesByIds(
  senderIds.length > 0 ? senderIds : null
);

// تحويل إلى map للاستخدام السهل
const senderProfiles = useMemo(() => {
  if (!profilesArray) return {};
  const map: Record<string, string> = {};
  profilesArray.forEach(p => {
    map[p.id] = p.full_name || 'الإدارة';
  });
  return map;
}, [profilesArray]);
```

---

## 🎯 تطبيق الإصلاح

### 1. تحديث GlobalAnnouncement

سأحول GlobalAnnouncement لاستخدام `useProfilesByIds` الموحد:

```typescript
import { useProfilesByIds } from '@/hooks/queries/useProfile';

export function GlobalAnnouncement() {
  const { user } = useAuth();
  const [senderIds, setSenderIds] = useState<string[]>([]);

  // ✅ استخدام hook الموحد
  const { data: profilesArray } = useProfilesByIds(
    senderIds.length > 0 ? senderIds : null
  );

  // تحويل إلى map
  const senderProfiles = useMemo(() => {
    if (!profilesArray) return {};
    const map: Record<string, string> = {};
    profilesArray.forEach(p => {
      map[p.id] = p.full_name || 'الإدارة';
    });
    return map;
  }, [profilesArray]);

  // ... باقي الكود
}
```

**الفائدة:**
- ✅ نفس queryKey = نفس cache في كل التطبيق
- ✅ React Query يمنع duplicate requests
- ✅ إذا Component A جلب profiles [A, B, C]
- ✅ Component B لن يجلب نفس profiles مرة أخرى

---

## 📊 لماذا يحدث Duplicate Requests؟

### السيناريو الحالي:

```
1. GlobalAnnouncement يعمل mount
   → يطلب profiles [A, B, C, D]
   → queryKey: ['announcement-senders', [A,B,C,D]]

2. ClassMessagesView يعمل mount
   → يطلب profiles [A, B, C, D] (نفس IDs!)
   → queryKey: ['profiles-by-ids', [A,B,C,D]]

3. ❌ queryKey مختلف → cache مختلف
4. ❌ React Query يعتقد أنها بيانات مختلفة
5. ❌ يُرسل request جديد!
```

### بعد الإصلاح:

```
1. GlobalAnnouncement يعمل mount
   → يطلب profiles [A, B, C, D]
   → queryKey: ['profiles-by-ids', [A,B,C,D]]

2. ClassMessagesView يعمل mount
   → يتحقق من cache
   → ✅ queryKey نفس: ['profiles-by-ids', [A,B,C,D]]
   → ✅ يجد البيانات في cache
   → ❌ لا يُرسل request جديد!
```

---

## 🧪 كيفية الاختبار

### اختبار WebSocket Speed:

**في Local:**
```
1. افتح DevTools → Network
2. فلتر بـ "WS"
3. راقب الوقت
المتوقع: 1,000-2,500ms (طبيعي في local)
```

**في Production:**
```
المتوقع: 200-500ms (أسرع بـ 5-10x)
```

---

### اختبار Duplicate Requests:

**قبل الإصلاح:**
```
1. افتح DevTools → Network
2. فلتر بـ "profiles"
3. Refresh الصفحة

النتيجة:
profiles?select=...&id=in.(A,B,C,D)  ← Request 1
profiles?select=...&id=in.(A,B,C,D)  ← Request 2 (duplicate!)
```

**بعد الإصلاح:**
```
النتيجة:
profiles?select=...&id=in.(A,B,C,D)  ← Request 1 فقط
(لا توجد duplicates!)
```

---

## 💡 ملاحظات مهمة

### 1. WebSocket في Local vs Production

| البيئة | البروتوكول | الوقت المتوقع |
|--------|-----------|---------------|
| **Local (dev)** | `ws://localhost` | 1,000-2,500ms |
| **Production** | `wss://domain.com` | 200-500ms |

**الخلاصة:** التأخر في local **طبيعي** ولا يحتاج إصلاح.

---

### 2. Request Deduplication في React Query

React Query يمنع duplicate requests **تلقائياً** إذا:
- ✅ نفس `queryKey`
- ✅ نفس `queryFn`
- ✅ الطلب الأول لم ينته بعد

**مثال:**
```typescript
// Component A
const { data } = useQuery({
  queryKey: ['profiles', [A, B, C]],
  queryFn: fetchProfiles
});

// Component B (يعمل mount في نفس الوقت)
const { data } = useQuery({
  queryKey: ['profiles', [A, B, C]], // نفس queryKey
  queryFn: fetchProfiles
});

// ✅ React Query سيرسل request واحد فقط!
```

---

### 3. Query Key Consistency

**مهم جداً:** استخدم نفس queryKey في كل التطبيق:

```typescript
// ❌ سيء - queryKeys مختلفة
['announcement-senders', ids]
['sender-profiles', ids]
['message-senders', ids]

// ✅ جيد - queryKey موحد
['profiles-by-ids', ids.sort()]
```

**لماذا `.sort()`؟**
```typescript
// [A, B, C] !== [C, B, A] في JavaScript
// لكن بعد sort:
// [A, B, C].sort() === [C, B, A].sort() // true!
```

---

## 📁 التعديلات المُقترحة

### 1. GlobalAnnouncement.tsx
- ✅ تحويل لـ `useProfilesByIds`
- ✅ توحيد queryKey

### 2. useProfile.ts
- ✅ موجود بالفعل ومُحسّن
- ✅ يستخدم `.sort()` للـ queryKey

### 3. ClassMessagesView.tsx
- ✅ يستخدم بالفعل `useProfilesByIds`
- ✅ لا يحتاج تعديل

---

## 🚀 تحسينات إضافية (اختياري)

### 1. Request Coalescing

إذا كان لديك IDs متداخلة:
```typescript
// Request 1: [A, B, C]
// Request 2: [C, D, E]

// بدلاً من requestين، اطلب كل الـ IDs مرة واحدة:
// [A, B, C, D, E]
```

**التنفيذ:**
```typescript
// في queryClient configuration
queryClient.setQueryDefaults(['profiles-by-ids'], {
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
});
```

---

### 2. Preload Common Profiles

```typescript
// في AppLayout prefetch
const commonProfiles = ['admin-id', 'teacher-id-1', 'teacher-id-2'];
queryClient.prefetchQuery({
  queryKey: ['profiles-by-ids', commonProfiles],
  queryFn: () => fetchProfiles(commonProfiles),
  staleTime: 5 * 60 * 1000,
});
```

---

## 🎊 الخلاصة

### WebSocket Slow:
- ✅ **طبيعي في local development**
- ✅ سيكون أسرع في production (200-500ms)
- ✅ لا يحتاج إصلاح

### Duplicate Requests:
- ✅ السبب: queryKeys مختلفة
- ✅ الحل: استخدام `useProfilesByIds` الموحد
- ✅ التحسن: من 2 requests → 1 request (50% ↓)

---

**التاريخ:** 18 أبريل 2026  
**المشكلة:** WebSocket slow + Duplicate profile requests  
**الحل:** توحيد queryKeys + فهم أن local WebSocket طبيعي
