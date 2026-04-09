import { supabase } from '@/integrations/supabase/client';
import { queryClient } from './queryClient';

/**
 * World-Class Silent Realtime Engine
 * 
 * هذا المحرك يستمع لقنوات Supabase Realtime بتخفّي، ويقوم عند استلام
 * تحديث جديد أو إضافة لجدول معين، بتعديل نسخة الـ Cache المحلية (React Query)
 * بشكل صامت، دون إجبار التطبيق على عمل Loading Spinners.
 */
class RealtimeEngine {
  private activeSubscriptions = new Map<string, { channel: any, table: string, callback?: (payload: any) => void, options: any }>();

  constructor() {
    // Listen for auth changes to update realtime auth
    if (typeof window !== 'undefined') {
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          console.log('[RealtimeEngine] Auth changed, updating realtime auth...');
          // Supabase v2 handles this automatically, but we can nudge it
        }
      });
    }
  }

  public subscribe(table: string, callback?: (payload: any) => void, options: { event?: string, filter?: string } = {}) {
    // Generate unique channel identifier based on specific filter/table
    const channelName = `realtime-engine:${table}:${options.event || '*'}:${options.filter || 'all'}`;
    
    // Cleanup existing to avoid memory leaks if re-subscribed
    if (this.activeSubscriptions.has(channelName)) {
       const existing = this.activeSubscriptions.get(channelName);
       supabase.removeChannel(existing.channel);
    }

    const createChannel = () => {
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
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
             console.warn(`[RealtimeEngine] Channel error for ${table}, attempting restart...`);
             setTimeout(() => this.reconnectChannel(channelName), 2000);
          }
          if (status === 'CLOSED') {
             console.log(`[RealtimeEngine] Channel closed for ${table}`);
          }
        });
      
      return channel;
    };

    const channel = createChannel();
    this.activeSubscriptions.set(channelName, { channel, table, callback, options });

    return () => {
      const sub = this.activeSubscriptions.get(channelName);
      if (sub) {
        supabase.removeChannel(sub.channel);
        this.activeSubscriptions.delete(channelName);
      }
    };
  }

  private reconnectChannel(channelName: string) {
    const sub = this.activeSubscriptions.get(channelName);
    if (sub) {
      console.log(`[RealtimeEngine] Re-subscribing to ${channelName}...`);
      supabase.removeChannel(sub.channel);
      this.subscribe(sub.table, sub.callback, sub.options);
    }
  }

  /**
   * Re-sync all active subscriptions after tab becomes visible again.
   * Properly handles closed/errored channels by recreating them.
   */
  public async resyncAll() {
    console.log('[RealtimeEngine] Resyncing all subscriptions...');
    const subs = Array.from(this.activeSubscriptions.entries());
    
    for (const [name, sub] of subs) {
      const channelState = sub.channel.state;
      console.log(`[RealtimeEngine] Channel ${name} state: ${channelState}`);
      
      // If channel is not in a healthy state, recreate it completely
      if (channelState === 'closed' || channelState === 'errored' || channelState === 'unsubscribed') {
        console.log(`[RealtimeEngine] Recreating channel ${name} (was ${channelState})`);
        supabase.removeChannel(sub.channel);
        this.subscribe(sub.table, sub.callback, sub.options);
      } 
      // If channel is joining or joined, do a health check
      else if (channelState === 'joined') {
        // Channel looks healthy, no action needed
        console.log(`[RealtimeEngine] Channel ${name} is healthy (joined)`);
      }
      // For other states (closing, joining), wait a bit then check again
      else {
        console.log(`[RealtimeEngine] Channel ${name} in transitional state (${channelState}), will retry...`);
        setTimeout(() => {
          const currentSub = this.activeSubscriptions.get(name);
          if (currentSub && currentSub.channel.state !== 'joined') {
            this.reconnectChannel(name);
          }
        }, 2000);
      }
    }
  }

  // المحرك السحري: يقوم بالتحديث الذكي للكاش محلياً لكي تختفي الـ Loading 완전히
  private syncToCache(table: string, payload: any) {
    const { eventType, new: newRec, old: oldRec } = payload;
    
    try {
      // تحسين المزامنة: بدلاً من تحديث كافة الاستعلامات يدوياً (والذي قد يكون مكلفاً مع التجزئة)،
      // نقوم بتحديث الاستعلامات النشطة فقط أو إبطالها لضمان الدقة.
      
      if (table === 'students') {
        // نقوم بإبطال كافة استعلامات الطلاب لضمان تحديث العد (count) والترتيب عبر كافة الصفحات
        queryClient.invalidateQueries({ 
          queryKey: ['students'],
          exact: false,
          refetchType: 'active' // تحديث الصفحات الظاهرة حالياً فقط في الخلفية
        });

        // تحديث استعلام الطالب المنفرد إذا كان مفتوحاً
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
           queryClient.setQueriesData({ queryKey: ['student', newRec.id] }, newRec);
        }
      }

      if (table === 'profiles') {
        // إذا تغير الملف الشخصي، قد يكون معلماً
        queryClient.invalidateQueries({ 
          queryKey: ['teachers'],
          exact: false,
          refetchType: 'active'
        });
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
           queryClient.setQueriesData({ queryKey: ['teacher', newRec.id] }, newRec);
        }
      }

      if (table === 'user_roles') {
        // إذا تغيرت الأدوار (قبول/رفض معلم)، نحدث قائمة المعلمين
        queryClient.invalidateQueries({ 
          queryKey: ['teachers'],
          exact: false,
          refetchType: 'active'
        });
      }

      if (table === 'classes') {
        queryClient.invalidateQueries({ 
          queryKey: ['classes'],
          exact: false,
          refetchType: 'active'
        });
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
           queryClient.setQueriesData({ queryKey: ['class', newRec.id] }, newRec);
        }
      }

      if (table === 'complaints') {
        queryClient.invalidateQueries({ 
          queryKey: ['complaints'],
          exact: false,
          refetchType: 'active'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['parent-complaints'],
          exact: false,
          refetchType: 'active'
        });
      }

      if (table === 'grades' || table === 'exam_templates') {
        queryClient.invalidateQueries({ 
          queryKey: ['exam-templates'],
          exact: false,
          refetchType: 'active'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['student-grades'],
          exact: false,
          refetchType: 'active'
        });
      }

      if (table === 'attendance') {
        queryClient.invalidateQueries({ 
          queryKey: ['attendance'],
          exact: false,
          refetchType: 'active'
        });
      }

      if (table === 'curriculums' || table === 'curriculum_subjects') {
        queryClient.invalidateQueries({ 
          queryKey: ['curriculums'],
          exact: false,
          refetchType: 'active'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['curriculum-subjects'],
          exact: false,
          refetchType: 'active'
        });
      }
      
      if (table === 'notifications' || table === 'messages') {
          queryClient.invalidateQueries({ queryKey: [table], exact: false });
          if (table === 'notifications') {
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
          }
      }

    } catch (e) {
      console.warn('[RealtimeEngine] Failed to auto-sync cache', e);
    }
  }
}

export const realtimeEngine = new RealtimeEngine();
