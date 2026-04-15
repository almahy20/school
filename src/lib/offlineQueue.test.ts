import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueMutation, getPendingCount, cleanupOldMutations, clearQueue, getPendingMutations, removeMutation } from './offlineQueue';

// تزييف مكتبة idb ومحاكاتها داخلياً في الذاكرة لتسريع عملية الفحص بدون متصفح فعلي
vi.mock('idb', () => {
  let store: any[] = [];
  return {
    openDB: vi.fn().mockResolvedValue({
      put: vi.fn(async (storeName, val) => {
        // تحديث أو إدخال
        const existing = store.findIndex(item => item.id === val.id);
        if (existing !== -1) store[existing] = val;
        else store.push(val);
      }),
      getAll: vi.fn(async () => store),
      getAllFromIndex: vi.fn(async () => [...store].sort((a,b) => a.timestamp - b.timestamp)),
      delete: vi.fn(async (storeName, id) => { store = store.filter(item => item.id !== id); }),
      count: vi.fn(async () => store.length),
      clear: vi.fn(async () => { store = []; }),
      get: vi.fn(async (storeName, id) => store.find(item => item.id === id)),
    })
  };
});

describe('OfflineQueue (Critical PWA Data Integrity)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearQueue(); // تنظيف السلة قبل كل اختبار
  });

  it('يجب أن يسجل المعاملة الجديدة (Mutation) في الطابور ويحتفظ ببياناتها لحين عودة الإنترنت', async () => {
    const fakeData = { name: 'طالب في الأوفلاين', score: 95 };
    const mutationId = await enqueueMutation('create', 'students', fakeData);
    
    expect(mutationId).toBeDefined();
    
    const count = await getPendingCount();
    expect(count).toBe(1); // يجب أن يكون هناك معاملة واحدة في الانتظار

    const pending = await getPendingMutations();
    expect(pending[0].data.name).toBe('طالب في الأوفلاين');
    expect(pending[0].table).toBe('students');
    expect(pending[0].retryCount).toBe(0);
  });

  it('يجب أن يحذف المعاملة من الطابور بنجاح بعد رفعها للسيرفر (التأكد من التخلص منها وعدم تكرار الإرسال)', async () => {
    const id = await enqueueMutation('update', 'grades', { id: 1, grade: 'A' });
    
    expect(await getPendingCount()).toBe(1);
    
    // محاكاة إرسالها بنجاح وحذفها
    await removeMutation(id);
    
    expect(await getPendingCount()).toBe(0);
  });

  it('حماية الذاكرة: يجب أن يمسح العمليات القديمة (أقدم من 30 يوماً) ليخفف العبء عن IndexedDB', async () => {
    // إضافة عملية حديثة
    await enqueueMutation('delete', 'posts', { id: 12 });
    
    // محاكاة عملية قديمة جداً يدوياً داخل المتجر (أقدم بـ 31 يوماً)
    const idbMock = await import('idb');
    const db = await idbMock.openDB();
    await db.put('mutationQueue', {
      id: 'zombie-mutation-123',
      type: 'update',
      table: 'fees',
      data: { amount: 500 },
      timestamp: Date.now() - (31 * 24 * 60 * 60 * 1000), // 31 days old
      retryCount: 0,
      maxRetries: 5
    });

    // لدينا العمليتين الآن
    expect(await getPendingCount()).toBe(2);

    // استدعاء غسيل الطابور
    const cleanedCount = await cleanupOldMutations();
    
    // يفترض أنه وجد واحدة قديمة ورماها
    expect(cleanedCount).toBe(1);

    // تبقت العملية الحديثة فقط
    expect(await getPendingCount()).toBe(1);
    
    const pending = await getPendingMutations();
    expect(pending[0].table).toBe('posts'); // الحديثة نجت!
  });
});
