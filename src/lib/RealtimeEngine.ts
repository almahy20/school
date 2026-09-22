import { supabase } from '@/integrations/supabase/client';
import { queryClient } from './queryClient';
import { logger } from '@/utils/logger';

/**
 * World-Class Silent Realtime Engine — Optimized Single-Channel Architecture
 *
 * 🚀 التحسينات الأساسية:
 *   1. استخدام قناة واحدة عالمية مشتركة (realtime-engine:sync) لجميع الجداول
 *      بدلاً من فتح قناة مستقلة لكل جدول → تخفيض كبير لاستهلاك موارد الخادم و list_changes و WAL
 *   2. تعطيل presence و broadcast بشكل كامل وصريح لتوفير الباندويث وحركة الشبكة
 *   3. ضمان عدم فتح أكثر من قناة واحدة في نفس الوقت (MAX_OPEN_CHANNELS = 1)
 *   4. Reference counting ذكي لإدارة الاشتراكات والتنظيف التلقائي عند مغادرة المكونات
 *   5. مطابقة دقيقة للفلاتر (col=eq.val و col=val) وتحديث صامت للـ React Query Cache
 */

const MASTER_CHANNEL_NAME = 'realtime-engine:sync';

export const SYNCED_TABLES = [
  'students',
  'classes',
  'attendance',
  'grades',
  'fees',
  'complaints',
  'notifications',
  'electronic_exams',
  'conversations',
  'conversation_messages',
  'class_chat_rooms',
  'class_chat_messages',
  'messages',
  'schools',
  'profiles',
  'user_roles',
  'student_parents',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

const MAX_OPEN_CHANNELS = 1;

export interface RealtimeListenerOptions {
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

interface ListenerEntry {
  id: string;
  callback: (payload: any) => void;
  event: string;
  filter?: string;
}

class RealtimeEngine {
  private listeners = new Map<string, Set<ListenerEntry>>();
  private masterChannel: ReturnType<typeof supabase.channel> | null = null;
  private masterChannelStatus: 'idle' | 'connecting' | 'active' | 'closed' = 'idle';
  private listenerCounter = 0;

  /**
   * تأكد من فتح القناة الرئيسية الواحدة إذا لم تكن مفتوحة
   */
  private ensureMasterChannel(): void {
    if (this.masterChannel && (this.masterChannelStatus === 'active' || this.masterChannelStatus === 'connecting')) {
      return;
    }

    if (this.masterChannelStatus === 'connecting') {
      return;
    }

    this.masterChannelStatus = 'connecting';

    try {
      // إغلاق أي قناة قديمة للتأكد من عدم تجاوز الحد الأقصى للقنوات
      if (this.masterChannel) {
        try {
          supabase.removeChannel(this.masterChannel);
        } catch (_e) {
          // ignore
        }
        this.masterChannel = null;
      }

      // إنشاء القناة الوحيدة مع تعطيل الـ broadcast والـ presence بالكامل
      const channel = supabase.channel(MASTER_CHANNEL_NAME, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: '' },
        },
      });

      // ربط جميع الجداول بنفس القناة الواحدة
      for (const table of SYNCED_TABLES) {
        channel.on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table },
          (payload: any) => this.dispatch(table, payload)
        );
      }

      channel.subscribe((status: string) => {
        logger.log(`[RealtimeEngine] Channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          this.masterChannelStatus = 'active';
        } else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          this.masterChannelStatus = 'closed';
          this.masterChannel = null;
        } else if (status === 'JOINING') {
          this.masterChannelStatus = 'connecting';
        }
      });

      this.masterChannel = channel;
    } catch (err) {
      this.masterChannelStatus = 'closed';
      this.masterChannel = null;
      logger.warn('[RealtimeEngine] Failed to initialize master channel:', err);
    }
  }

  /**
   * توزيع الأحداث الواردة على الـ Cache والمستمعين المسجلين
   */
  private dispatch(table: string, payload: any): void {
    try {
      this.syncToCache(table as SyncedTable, payload);
    } catch (e) {
      logger.warn('[RealtimeEngine] syncToCache failed for', table, e);
    }

    const tableListeners = this.listeners.get(table);
    if (!tableListeners || tableListeners.size === 0) return;

    const entries = Array.from(tableListeners);
    const { eventType } = payload;
    const record = eventType === 'DELETE' ? payload.old : payload.new;

    for (const entry of entries) {
      try {
        if (entry.event && entry.event !== '*' && entry.event !== eventType) {
          continue;
        }

        if (entry.filter && record) {
          const match = this.matchFilter(entry.filter, record);
          if (!match) continue;
        }

        entry.callback(payload);
      } catch (e) {
        logger.warn('[RealtimeEngine] listener callback failed:', e);
      }
    }
  }

  /**
   * مطابقة شروط الفلتر مع السجل (يدعم صيغ Supabase: col=eq.val و col=val)
   */
  private matchFilter(filter: string, record: Record<string, any>): boolean {
    if (!filter || !record) return true;

    // مثال: id=eq.123 أو school_id=eq.abc-xyz أو user_id=123
    const eqMatch = filter.match(/^([a-zA-Z0-9_]+)=eq\.(.+)$/);
    if (eqMatch) {
      const [, col, val] = eqMatch;
      if (!record.hasOwnProperty(col)) return true;
      const coercedVal = typeof record[col] === 'number' ? Number(val) : val;
      return String(record[col]) === String(coercedVal);
    }

    const simpleMatch = filter.match(/^([a-zA-Z0-9_]+)=(.+)$/);
    if (simpleMatch) {
      const [, col, val] = simpleMatch;
      if (!record.hasOwnProperty(col)) return true;
      const coercedVal = typeof record[col] === 'number' ? Number(val) : val;
      return String(record[col]) === String(coercedVal);
    }

    return true;
  }

  /**
   * إغلاق القناة الوحيدة عند عدم وجود مستمعين
   */
  private teardownMasterChannel(): void {
    if (!this.masterChannel) return;
    try {
      supabase.removeChannel(this.masterChannel);
    } catch (e) {
      logger.warn('[RealtimeEngine] removeChannel failed:', e);
    }
    this.masterChannel = null;
    this.masterChannelStatus = 'closed';
  }

  /**
   * الاشتراك في أحداث جدول معين عبر القناة الواحدة الموحدة
   */
  public subscribe(
    table: string,
    callback?: (payload: any) => void,
    options: RealtimeListenerOptions = {}
  ): () => void {
    if (!this.listeners.has(table)) {
      this.listeners.set(table, new Set());
    }

    const bucket = this.listeners.get(table)!;
    const entryId = `listener_${++this.listenerCounter}`;

    const entry: ListenerEntry = {
      id: entryId,
      callback: callback ?? (() => {}),
      event: options.event ?? '*',
      filter: options.filter,
    };

    bucket.add(entry);
    this.ensureMasterChannel();

    let cleaned = false;
    return () => {
      if (cleaned) return;
      cleaned = true;
      bucket.delete(entry);

      if (bucket.size === 0) {
        this.listeners.delete(table);
      }

      let totalListeners = 0;
      for (const s of this.listeners.values()) {
        totalListeners += s.size;
      }

      if (totalListeners === 0) {
        this.teardownMasterChannel();
      }
    };
  }

  /**
   * إلغاء جميع الاشتراكات وإغلاق القناة (مثلاً عند تسجيل الخروج)
   */
  public unsubscribeAll(): void {
    this.listeners.clear();
    this.teardownMasterChannel();
  }

  /**
   * الحصول على الحالة الحالية للمحرك
   */
  public getStatus(): { status: string; totalListeners: number; openChannels: number } {
    let totalListeners = 0;
    for (const s of this.listeners.values()) {
      totalListeners += s.size;
    }
    return {
      status: this.masterChannelStatus,
      totalListeners,
      openChannels: this.masterChannel && this.masterChannelStatus === 'active' ? 1 : 0,
    };
  }

  /**
   * تحديث صامت للـ React Query Cache عند وقوع أي حدث في الجداول المزامنة
   */
  private syncToCache(table: SyncedTable, payload: any): void {
    const { eventType, new: newRec, old: oldRec } = payload;

    switch (table) {
      case 'students': {
        const allStudentQueries = queryClient.getQueryCache().findAll({ queryKey: ['students'] });
        for (const query of allStudentQueries) {
          const key = query.queryKey as unknown[];
          const isClassCache = key[1] === 'class';
          const cacheClassId = isClassCache ? (key[2] as string | undefined) : undefined;

          queryClient.setQueryData(key, (oldData: any) => {
            if (Array.isArray(oldData)) {
              if (eventType === 'INSERT') {
                if (oldData.some((d: any) => d.id === newRec.id)) return oldData;
                if (cacheClassId && newRec.class_id && newRec.class_id !== cacheClassId) return oldData;
                return [...oldData, newRec].sort((a: any, b: any) =>
                  (a.name ?? '').localeCompare(b.name ?? '', 'ar')
                );
              }
              if (eventType === 'UPDATE') {
                return oldData.map((d: any) => (d.id === newRec.id ? { ...d, ...newRec } : d));
              }
              if (eventType === 'DELETE') {
                return oldData.filter((d: any) => d.id !== oldRec.id);
              }
              return oldData;
            }

            if (oldData && Array.isArray(oldData.data)) {
              let newArr = oldData.data;

              if (eventType === 'INSERT') {
                if (!newArr.some((d: any) => d.id === newRec.id)) {
                  newArr = [newRec, ...newArr];
                }
              } else if (eventType === 'UPDATE') {
                newArr = newArr.map((d: any) => (d.id === newRec.id ? { ...d, ...newRec } : d));
              } else if (eventType === 'DELETE') {
                newArr = newArr.filter((d: any) => d.id !== oldRec.id);
              }

              const prevCount =
                typeof oldData.count === 'number' ? oldData.count : oldData.data.length;
              let newCount = prevCount;
              if (eventType === 'INSERT') newCount = prevCount + 1;
              else if (eventType === 'DELETE') newCount = Math.max(0, prevCount - 1);

              return { ...oldData, data: newArr, count: newCount };
            }

            return oldData;
          });
        }

        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
        if (eventType !== 'INSERT') {
          queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['parent-children'], exact: false });
        }
        break;
      }

      case 'classes': {
        queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
        if (eventType !== 'INSERT') {
          queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['parent-children'], exact: false });
        }
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
        break;
      }

      case 'attendance': {
        queryClient.invalidateQueries({ queryKey: ['attendance'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
        break;
      }

      case 'grades': {
        queryClient.invalidateQueries({ queryKey: ['grades'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['student-grades'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['student-grades-full'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
        break;
      }

      case 'fees': {
        queryClient.invalidateQueries({ queryKey: ['fees'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['parent-children'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
        break;
      }

      case 'complaints': {
        queryClient.invalidateQueries({ queryKey: ['complaints'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['parent-complaints'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-activities'], exact: false });
        break;
      }

      case 'notifications': {
        queryClient.invalidateQueries({ queryKey: ['notifications'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-counts'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-activities'], exact: false });
        break;
      }

      case 'electronic_exams': {
        queryClient.invalidateQueries({ queryKey: ['electronic-exams'], exact: false });
        break;
      }

      case 'conversations': {
        queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false });
        if (newRec?.id) {
          queryClient.invalidateQueries({ queryKey: ['conversation', newRec.id], exact: false });
        }
        break;
      }

      case 'conversation_messages': {
        if (newRec?.conversation_id) {
          queryClient.invalidateQueries({
            queryKey: ['conversation-messages', newRec.conversation_id],
            exact: false,
          });
        }
        break;
      }

      case 'class_chat_rooms': {
        queryClient.invalidateQueries({ queryKey: ['class-chat-rooms'], exact: false });
        break;
      }

      case 'class_chat_messages': {
        if (newRec?.room_id) {
          queryClient.invalidateQueries({
            queryKey: ['class-chat-messages', newRec.room_id],
            exact: false,
          });
        }
        break;
      }

      case 'messages': {
        queryClient.invalidateQueries({ queryKey: ['messages'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['unread-announcements'], exact: false });
        break;
      }

      case 'schools': {
        if (newRec?.id) {
          queryClient.invalidateQueries({ queryKey: ['school-branding', newRec.id], exact: false });
        }
        break;
      }

      case 'profiles': {
        queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['teacher'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['parent'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['users'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-users'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['pending-parents'], exact: false });
        break;
      }

      case 'user_roles': {
        queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['users'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-users'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['pending-parents'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
        break;
      }

      case 'student_parents': {
        queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['parent-children'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
        break;
      }
    }
  }
}

export const realtimeEngine = new RealtimeEngine();
