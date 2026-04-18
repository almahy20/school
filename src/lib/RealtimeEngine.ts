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
        const queryKey = ['students'];
        
        queryClient.setQueriesData({ queryKey }, (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          if (eventType === 'INSERT') {
            if (oldData.some(d => d.id === newRec.id)) return oldData;
            return [newRec, ...oldData];
          }
          if (eventType === 'UPDATE') {
            return oldData.map(d => d.id === newRec.id ? { ...d, ...newRec } : d);
          }
          if (eventType === 'DELETE') {
            return oldData.filter(d => d.id !== oldRec.id);
          }
          return oldData;
        });
      }
      
      // Add similar automatic synced responses for messages, notifications etc. if generic
      if (table === 'notifications') {
          // just force invalidate in background to be safe
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      }

    } catch (e) {
      console.warn('[RealtimeEngine] Failed to auto-sync cache', e);
    }
  }
}

export const realtimeEngine = new RealtimeEngine();
