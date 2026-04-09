# الدليل التقني الشامل لاستخدام `useEffect` مع `useState` في React

هذا الدليل مصمم لتقديم تحليل متعمق وعملي لكيفية استخدام أهم خطافين (Hooks) في React بشكل متزامن واحترافي، مع التركيز على الأداء، الأمان، والتعامل مع حالات الوقت الفعلي (Real-time).

---

## 1. تحليل آليات العمل والعلاقة المتبادلة

### `useState`: إدارة الحالة المحلية
- **الوظيفة**: تسمح للمكونات بحفظ البيانات التي تتغير بمرور الوقت.
- **إعادة الرندرة (Re-rendering)**: عند استدعاء دالة التحديث (مثل `setState`) والقيمة الجديدة تختلف عن القديمة، يقوم React بإعادة رندرة المكون.

### `useEffect`: إدارة العمليات الجانبية (Side Effects)
- **الوظيفة**: تنفيذ كود خارج نطاق الرندرة النقي (Pure Render)، مثل جلب البيانات أو التعامل مع الـ DOM.
- **التوقيت**: يتم تنفيذه **بعد** رسم المكون على الشاشة (After Paint).

### العلاقة المتبادلة ودورة الحياة
1. **Initial Render**: يتم رصد الـ `state` الابتدائي، ثم يتم تنفيذ الـ `useEffect` (إذا كان موجوداً).
2. **State Update**: تتغير الـ `state` -> يعيد React الرندرة -> يتم تنفيذ الـ `cleanup` الخاص بالـ `effect` السابق -> يتم تنفيذ الـ `effect` الجديد بناءً على مصفوفة الاعتماديات (Dependency Array).

---

## 2. تصنيف الحالات الإلزامية لاستخدام `useEffect`

يكون `useEffect` ضرورياً عندما نحتاج إلى:
- **العمليات الجانبية**: تحديث عنوان الصفحة (`document.title`) أو التلاعب بالـ DOM يدوياً.
- **المزامنة الخارجية**: حفظ واسترجاع البيانات من `localStorage` أو `IndexedDB`.
- **جلب البيانات (Data Fetching)**: استدعاء API endpoints عند تغيير بارامترات معينة.
- **الاشتراكات (Subscriptions)**: فتح قنوات WebSocket أو إضافة Event Listeners.
- **المؤقتات**: استخدام `setTimeout` أو `setInterval` مع ضمان تنظيفها.

---

## 3. أمثلة عملية مفصلة

### أ. مزامنة الحالة مع `localStorage`
```tsx
import React, { useState, useEffect } from 'react';

export function PersistentCounter() {
  // الحالة الابتدائية: نحاول استرجاعها من التخزين المحلي
  const [count, setCount] = useState(() => {
    try {
      const saved = localStorage.getItem('app-counter');
      return saved !== null ? JSON.parse(saved) : 0;
    } catch {
      return 0;
    }
  });

  // مزامنة التغييرات مع localStorage
  useEffect(() => {
    try {
      localStorage.setItem('app-counter', JSON.stringify(count));
    } catch (err) {
      console.error('فشل حفظ البيانات في localStorage', err);
    }
  }, [count]); // ينفذ فقط عند تغير count

  return (
    <div className="p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-lg font-bold">العداد المستمر: {count}</h2>
      <button 
        onClick={() => setCount(prev => prev + 1)}
        className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg"
      >
        زيادة العداد
      </button>
    </div>
  );
}
```

### ب. جلب البيانات من API مع معالجة الـ Race Conditions
```tsx
import React, { useState, useEffect } from 'react';

export function UserSearch({ userId }: { userId: string }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // العلم لمنع الـ Race Condition
    let isMounted = true; 
    
    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`https://api.example.com/users/${userId}`);
        const data = await response.json();
        
        // نحدث الحالة فقط إذا كان المكون لا يزال موجوداً (Mounted)
        if (isMounted) {
          setUser(data);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (userId) fetchUser();

    // دالة التنظيف (Cleanup)
    return () => {
      isMounted = false; // نلغي العمليات المعلقة عند unmount أو تغير userId
    };
  }, [userId]); // ينفذ عند تغير userId فقط

  if (loading) return <div>جاري التحميل...</div>;
  if (error) return <div>خطأ: {error}</div>;
  return user ? <div>اسم المستخدم: {user.name}</div> : null;
}
```

### ج. اتصال WebSocket مع إعادة الاتصال التلقائي (Real-time)
```tsx
import React, { useState, useEffect } from 'react';

export function RealtimeStatus() {
  const [status, setStatus] = useState('offline');
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    let ws: WebSocket;
    let timeoutId: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket('wss://api.example.com/realtime');

      ws.onopen = () => setStatus('online');
      ws.onmessage = (event) => setMessages(prev => [event.data, ...prev].slice(0, 10));
      ws.onclose = () => {
        setStatus('offline');
        // محاولة إعادة الاتصال بعد 3 ثواني
        timeoutId = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(timeoutId);
    };
  }, []); // ينفذ مرة واحدة عند mount

  return (
    <div className="flex flex-col gap-2">
      <div className={`p-2 rounded ${status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
        الحالة: {status === 'online' ? 'متصل' : 'جاري إعادة الاتصال...'}
      </div>
      <ul className="list-disc pr-5">
        {messages.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
    </div>
  );
}
```

### د. تصفية المدخلات (Debouncing) للبحث
```tsx
import React, { useState, useEffect } from 'react';

export function SearchBox() {
  const [input, setInput] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    // ننتظر 500 ملي ثانية بعد توقف المستخدم عن الكتابة قبل تحديث القيمة الفعلية
    const timer = setTimeout(() => {
      setDebouncedValue(input);
    }, 500);

    // دالة التنظيف: تمسح المؤقت السابق إذا كتب المستخدم حرفاً جديداً قبل انتهاء الوقت
    return () => clearTimeout(timer);
  }, [input]);

  return (
    <div className="p-4">
      <input 
        type="text" 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="ابحث هنا..."
        className="border p-2 rounded w-full"
      />
      <div className="mt-2 text-slate-500">
        سيتم إرسال الطلب لـ: <span className="font-bold">{debouncedValue}</span>
      </div>
    </div>
  );
}
```

### هـ. مزامنة الحالة مع عنوان URL (URL Params Sync)
```tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function FilterSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // استرجاع القيمة الابتدائية من الـ URL
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

  // مزامنة التغييرات مع الـ URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (category !== 'all') params.category = category;
    if (sort !== 'newest') params.sort = sort;
    
    setSearchParams(params, { replace: true });
  }, [category, sort, setSearchParams]);

  return (
    <div className="flex gap-4 p-4 bg-slate-50 rounded-lg">
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">كل الفئات</option>
        <option value="electronics">إلكترونيات</option>
        <option value="fashion">أزياء</option>
      </select>
      
      <select value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="newest">الأحدث</option>
        <option value="oldest">الأقدم</option>
      </select>
    </div>
  );
}
```

---

## 4. الأخطاء الشائعة والحرجة

1. **الحلقات اللانهائية (Infinite Loops)**:
   - *السبب*: تحديث الـ `state` داخل `useEffect` بدون مصفوفة اعتماديات، أو وضع دالة تتغير في كل رندرة داخل المصفوفة.
   - *الحل*: استخدم `useCallback` للدوال، أو تأكد من مصفوفة الاعتماديات.

2. **نسيان الـ Cleanup**:
   - *السبب*: ترك الـ `intervals` أو الـ `event listeners` تعمل بعد إغلاق المكون.
   - *النتيجة*: تسرب الذاكرة (Memory Leaks).

3. **استخدام `async` مباشرة في الـ `Effect`**:
   - *الخطأ*: `useEffect(async () => { ... }, [])`.
   - *الصح*: عرّف دالة `async` داخل الـ `effect` ثم استدعها.

---

## 5. قائمة الفحص (Checklist) وقواعد القياس

### هل أحتاج فعلاً لـ `useEffect`؟
- [ ] هل العملية خارجية (API, DOM, Storage)؟ **نعم -> استخدمه**.
- [ ] هل العملية حسابية بحتة بناءً على props/state؟ **نعم -> لا تستخدمه**، احسبها مباشرة أو استخدم `useMemo`.
- [ ] هل العملية رد فعل لحدث (Click, Submit)؟ **نعم -> لا تستخدمه**، ضع الكود في معالج الحدث مباشرة.

### مؤشرات سوء الاستخدام (Overuse Signals)
- وجود أكثر من 5 `useEffect` في مكون واحد.
- سلسلة من الـ `effects` حيث يغير الأول `state` ليقوم الثاني بعملية أخرى. (الأفضل دمجها أو استخدام `useReducer`).

---

## 6. الاختبارات البرمجية (Testing)

باستخدام `Vitest` و `React Testing Library`:

```tsx
import { render, screen, act, waitFor } from '@testing-library/react';
import { PersistentCounter } from './PersistentCounter';
import { describe, it, expect, vi } from 'vitest';

describe('PersistentCounter', () => {
  it('يستعيد الحالة من localStorage', () => {
    localStorage.setItem('app-counter', JSON.stringify(10));
    render(<PersistentCounter />);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('يحفظ التغييرات في localStorage عند الزيادة', async () => {
    render(<PersistentCounter />);
    const btn = screen.getByText('زيادة العداد');
    
    await act(async () => {
      btn.click();
    });

    expect(localStorage.getItem('app-counter')).toBe(JSON.stringify(1));
  });
});
```

---

## 7. أفضل الممارسات (Best Practices)

- **استراتيجية الإلغاء**: استخدم `AbortController` في طلبات الـ API لضمان إلغاء الطلبات المعلقة عند خروج المكون.
- **تزامن التبويبات (Multiple Tabs)**: استمع لحدث `storage` لمزامنة الـ `state` بين التبويبات المفتوحة لنفس الموقع.
- **إدارة التعقيد**: إذا زاد تعقيد الـ `state` والـ `effects` المرتبطة به، انتقل لاستخدام **Custom Hooks** لتغليف المنطق وجعل المكون أنظف.

---

## 8. أنماط متقدمة ومزامنة الوقت الفعلي (Advanced Patterns)

### أ. مزامنة التبويبات المتعددة باستخدام `BroadcastChannel`
تسمح هذه التقنية بمزامنة الحالة بين عدة تبويبات مفتوحة لنفس الموقع في نفس الوقت، مما يضمن تجربة مستخدم موحدة.

```tsx
import React, { useState, useEffect } from 'react';

export function MultiTabSync() {
  const [data, setData] = useState('القيمة الابتدائية');

  useEffect(() => {
    const channel = new BroadcastChannel('app_sync_channel');

    // استلام الرسائل من التبويبات الأخرى
    channel.onmessage = (event) => {
      setData(event.data);
    };

    return () => channel.close();
  }, []);

  const updateData = (newValue: string) => {
    setData(newValue);
    // إرسال التحديث للتبويبات الأخرى
    const channel = new BroadcastChannel('app_sync_channel');
    channel.postMessage(newValue);
  };

  return (
    <div className="p-4 border rounded-lg">
      <p>البيانات الحالية: {data}</p>
      <button 
        onClick={() => updateData(`تحديث جديد: ${Date.now()}`)}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        تحديث في كل التبويبات
      </button>
    </div>
  );
}
```

### ب. الإلغاء المتقدم للعمليات غير المتزامنة (`AbortController`)
استخدام `AbortController` هو الطريقة القياسية لإلغاء طلبات `fetch` ومنع تحديث الحالة في مكونات تم إغلاقها.

```tsx
useEffect(() => {
  const controller = new AbortController();
  const signal = controller.signal;

  async function fetchData() {
    try {
      const response = await fetch('/api/data', { signal });
      const json = await response.json();
      setData(json);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('تم إلغاء الطلب بنجاح');
      } else {
        setError(error.message);
      }
    }
  }

  fetchData();

  return () => {
    controller.abort(); // إلغاء الطلب عند unmount
  };
}, [dependency]);
```

### ج. العمليات الحسابية المعقدة المعتمدة على حالات متعددة
عندما تكون العملية الحسابية ثقيلة جداً أو تتطلب تفاعلاً مع نظام خارجي بعد الحساب.

```tsx
const [a, setA] = useState(0);
const [b, setB] = useState(0);
const [result, setResult] = useState(0);

useEffect(() => {
  // تخيل أن هذه عملية حسابية ثقيلة جداً تأخذ وقتاً
  const heavyCalculation = (x: number, y: number) => {
    let res = 0;
    for(let i = 0; i < 1000000; i++) res += x + y;
    return res;
  };

  const calculated = heavyCalculation(a, b);
  setResult(calculated);
  
  // تحديث نظام خارجي بعد الحساب
  document.title = `النتيجة: ${calculated}`;
}, [a, b]); // تنفذ فقط عند تغير a أو b
```

---

## 9. التعامل مع الحالات الحافة (Edge Cases)

### منع تسرب الذاكرة (Memory Leaks) في التطبيقات طويلة الأمد
- **Event Listeners**: تأكد دائماً من إزالة المستمعات في دالة التنظيف.
- **Async inside Loops**: تجنب تشغيل عمليات `async` داخل حلقات تكرارية في `useEffect` دون آلية إلغاء.
- **SetState on Unmounted Component**: رغم أن React الحديث يقلل من خطورة هذا التحذير، إلا أن استراتيجية `isMounted` أو `AbortController` تظل هي الأفضل للأداء.

### التعامل مع Race Conditions في الـ API Calls
- استخدم دائماً "معرف الطلب" أو آلية `isMounted` للتأكد من أن الاستجابة التي وصلت هي لآخر طلب تم إرساله، وليس لطلب قديم تأخر في الشبكة.

---

## 10. اختبار العمليات غير المتزامنة (Testing Async Effects)

```tsx
it('يجب أن يعرض البيانات بعد جلبها بنجاح', async () => {
  // Mock للـ fetch
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ name: 'اختبار' })
  });

  render(<UserSearch userId="1" />);

  // استخدام waitFor للانتظار حتى يظهر الاسم على الشاشة
  await waitFor(() => {
    expect(screen.getByText('اسم المستخدم: اختبار')).toBeInTheDocument();
  });
});
```

---
*تم إعداد هذا الدليل لضمان بناء تطبيقات React قوية، قابلة للصيانة، وذات أداء عالي.*

