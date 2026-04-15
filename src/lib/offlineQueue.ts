import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { logger } from '@/utils/logger';

/**
 * Offline Mutation Queue
 * 
 * نظام طابور المعاملات غير المتصلة
 * يخزن جميع عمليات الكتابة في IndexedDB
 * ويعيد إرسالها تلقائياً عند عودة الاتصال
 */

interface MutationRecord {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface OfflineDB extends DBSchema {
  mutationQueue: {
    key: string;
    value: MutationRecord;
    indexes: {
      timestamp: number;
      table: string;
    };
  };
}

const DB_NAME = 'school-offline-queue';
const STORE_NAME = 'mutationQueue' as const;
const DB_VERSION = 1;

// TTL: 30 يوم بالمللي ثانية
const MUTATION_TTL = 30 * 24 * 60 * 60 * 1000;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('table', 'table');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * إضافة عملية جديدة للطابور
 */
export async function enqueueMutation(
  type: 'create' | 'update' | 'delete',
  table: string,
  data: any,
  maxRetries: number = 5
): Promise<string> {
  const db = await getDB();
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const record: MutationRecord = {
    id,
    type,
    table,
    data,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries,
  };

  await db.put(STORE_NAME, record);
  logger.log(`📦 [OfflineQueue] Enqueued mutation: ${type} on ${table} (${id})`);
  
  // تنظيف دوري للعمليات القديمة (10% احتمال كل مرة)
  if (Math.random() < 0.1) {
    cleanupOldMutations();
  }
  
  return id;
}

/**
 * تنظيف العمليات القديمة (أقدم من TTL)
 */
export async function cleanupOldMutations(): Promise<number> {
  try {
    const db = await getDB();
    const cutoff = Date.now() - MUTATION_TTL;
    
    // جلب جميع العمليات
    const allMutations = await db.getAll(STORE_NAME);
    
    // حذف القديمة
    let cleaned = 0;
    for (const mutation of allMutations) {
      if (mutation.timestamp < cutoff) {
        await db.delete(STORE_NAME, mutation.id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.log(`🗑️ [OfflineQueue] Cleaned ${cleaned} old mutations (older than 30 days)`);
    }
    
    return cleaned;
  } catch (error) {
    logger.error('❌ [OfflineQueue] Failed to cleanup old mutations:', error);
    return 0;
  }
}

/**
 * جلب جميع العمليات المعلقة
 */
export async function getPendingMutations(): Promise<MutationRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_NAME, 'timestamp');
  return all.sort((a, b) => a.timestamp - b.timestamp); // FIFO
}

/**
 * إزالة عملية من الطابور (بعد النجاح)
 */
export async function removeMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
  logger.log(`✅ [OfflineQueue] Removed mutation: ${id}`);
}

/**
 * تحديث عدد المحاولات
 */
export async function incrementRetryCount(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, id);
  
  if (record) {
    record.retryCount++;
    await db.put(STORE_NAME, record);
    logger.log(`🔄 [OfflineQueue] Retry #${record.retryCount} for: ${id}`);
  }
}

/**
 * الحصول على عدد العمليات المعلقة
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return await db.count(STORE_NAME);
}

/**
 * مسح الطابور بالكامل
 */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
  logger.log('🗑️ [OfflineQueue] Cleared entire queue');
}

/**
 * معالجة جميع العمليات المعلقة
 */
export async function processQueue(
  executeMutation: (mutation: MutationRecord) => Promise<void>
): Promise<{ success: number; failed: number }> {
  const pending = await getPendingMutations();
  
  if (pending.length === 0) {
    logger.log('✅ [OfflineQueue] No pending mutations');
    return { success: 0, failed: 0 };
  }

  logger.log(`🚀 [OfflineQueue] Processing ${pending.length} pending mutations...`);
  
  let success = 0;
  let failed = 0;

  for (const mutation of pending) {
    try {
      // Check if max retries exceeded
      if (mutation.retryCount >= mutation.maxRetries) {
        logger.error(`❌ [OfflineQueue] Max retries exceeded for: ${mutation.id}`);
        await removeMutation(mutation.id);
        failed++;
        continue;
      }

      // Execute the mutation
      await executeMutation(mutation);
      
      // Remove from queue on success
      await removeMutation(mutation.id);
      success++;
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      logger.error(`❌ [OfflineQueue] Failed to process ${mutation.id}:`, error);
      
      // Increment retry count
      await incrementRetryCount(mutation.id);
      failed++;
      
      // Stop processing on critical error
      if (error instanceof Error && error.message.includes('auth')) {
        logger.error('🔒 [OfflineQueue] Auth error - stopping queue processing');
        break;
      }
    }
  }

  logger.log(`✅ [OfflineQueue] Queue processing complete: ${success} succeeded, ${failed} failed`);
  return { success, failed };
}

/**
 * الاستماع للتغييرات في الطابور
 */
export function watchQueue(callback: (count: number) => void): () => void {
  const check = async () => {
    const count = await getPendingCount();
    callback(count);
  };

  // Check immediately
  check();
  
  // Check every 2 seconds
  const interval = setInterval(check, 2000);
  
  return () => clearInterval(interval);
}
