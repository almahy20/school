import { supabase } from '@/integrations/supabase/client';
import { queryClient } from './queryClient';
import { logger } from '@/utils/logger';

/**
 * World-Class Silent Realtime Engine
 * 
 * هذا المحرك يستمع لقنوات Supabase Realtime بتخفّي، ويقوم عند استلام
 * تحديث جديد أو إضافة لجدول معين، بتعديل نسخة الـ Cache المحلية (React Query)
 * بشكل صامت، دون إجبار التطبيق على عمل Loading Spinners.
 * 
 * 💡 ملاحظة حول اشتراكات messages في المشروع (2 اشتراك فقط شغال، وكلاهما مقصود):
 *   1) useMessages في useMessaging.ts: تحديث قائمة الرسائل + cache عند أي تغيير
 *   2) GlobalAnnouncement.tsx: عرض رسائل إدارية فورية كمودال منفصل
 *   (useMessageNotifications كـ export موجود حالياً لكن غير مستخدم في أي مكان)
 * 
 * 💡 ملاحظة حول اشتراك schools (تم توحيده في البند الأول):
 *   - قبل كان فيه اشتراك في RealtimeNotificationsManager + اشتراك في PwaManager
 *   - الآن اعتمدنا PwaManager على useBranding() hook نفسو، وقناة واحدة فقط في
 *     RealtimeNotificationsManager مسؤولة عن invalidate branding cache، وPwaManager
 *     بيسمع بتغيرات الـ cache data عشان يعيد بناء الـ PWA Manifest.
 */
class RealtimeEngine {
  private activeSubscriptions = new Map<string, any>();

  public subscribe(table: string, callback?: (payload: any) => void, options: { event?: string, filter?: string } = {}) {
    // Generate unique channel identifier based on specific filter/table
    const channelName = `realtime-engine:${table}:${options.event || '*'}:${options.filter || 'all'}`;
    
    // Cleanup existing to avoid memory leaks if re-subscribed
    if (this.activeSubscriptions.has(channelName)) {
       const existing = this.activeSubscriptions.get(channelName);
       supabase.removeChannel(existing);
    }

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: options.event || '*',
          schema: 'public',
          table: table,
          filter: options.filter,
        },
        (payload: any) => {
          // 1. Silent Cache Auto-Sync
          this.syncToCache(table, payload);
          
          // 2. Trigger individual UI callbacks
          if (callback) {
            callback(payload);
          }
        }
      )
      .subscribe();

    this.activeSubscriptions.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      this.activeSubscriptions.delete(channelName);
    };
  }

  // المحرك السحري: يقوم بالتحديث الذكي للكاش محلياً لكي تختفي الـ Loading 완전히
  private syncToCache(table: string, payload: any) {
    const { eventType, new: newRec, old: oldRec } = payload;
    
    try {
      if (table === 'students') {
        // نحدّث كل student queries بشكل مخصص بناءً على نوع الـ cache
        const allStudentQueries = queryClient.getQueryCache().findAll({ queryKey: ['students'] });

        for (const query of allStudentQueries) {
          const key = query.queryKey as unknown[];
          const isClassCache = key[1] === 'class'; // ['students', 'class', classId]
          const cacheClassId = isClassCache ? (key[2] as string | undefined) : undefined;

          queryClient.setQueryData(key, (oldData: any) => {
            if (Array.isArray(oldData)) {
              // Format A: direct array — useClassStudents(['students', 'class', classId])
              if (eventType === 'INSERT') {
                if (oldData.some((d: any) => d.id === newRec.id)) return oldData;
                // لو الـ cache خاص بفصل معين، نضيف الطالب فقط لو هو من نفس الفصل
                if (cacheClassId && newRec.class_id && newRec.class_id !== cacheClassId) return oldData;
                return [...oldData, newRec].sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? '', 'ar'));
              }
              if (eventType === 'UPDATE') {
                return oldData.map((d: any) => d.id === newRec.id ? { ...d, ...newRec } : d);
              }
              if (eventType === 'DELETE') {
                return oldData.filter((d: any) => d.id !== oldRec.id);
              }
              return oldData;
            }

            if (oldData && Array.isArray(oldData.data)) {
              // Format B: { data: Student[], count: number } — useStudents paginated
              let newArr = oldData.data;

              if (eventType === 'INSERT') {
                if (!newArr.some((d: any) => d.id === newRec.id)) {
                  newArr = [newRec, ...newArr];
                }
              } else if (eventType === 'UPDATE') {
                newArr = newArr.map((d: any) => d.id === newRec.id ? { ...d, ...newRec } : d);
              } else if (eventType === 'DELETE') {
                newArr = newArr.filter((d: any) => d.id !== oldRec.id);
              }

              const prevCount = typeof oldData.count === 'number' ? oldData.count : oldData.data.length;
              let newCount = prevCount;
              if (eventType === 'INSERT') newCount = prevCount + 1;
              else if (eventType === 'DELETE') newCount = Math.max(0, prevCount - 1);

              return { ...oldData, data: newArr, count: newCount };
            }

            return oldData;
          });
        }

        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      }
      
      // Add similar automatic synced responses for messages, notifications etc. if generic
      // ✅ notifications are handled exclusively by RealtimeNotificationsManager
      // to avoid duplicate subscriptions and conflicting cache updates.

    } catch (e) {
      logger.warn('[RealtimeEngine] Failed to auto-sync cache', e);
    }
  }
}

export const realtimeEngine = new RealtimeEngine();
