import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

interface RealtimeConfig<T> {
  table: string;
  select?: string;
  filter?: string;
  initialData?: T[];
  onDataChange?: (newData: T[]) => void;
  enabled?: boolean;
}

/**
 * useRealtimeData - خطاف مخصص لربط البيانات بـ Supabase Realtime
 * يحل محل React Query التقليدي لضمان تحديثات فورية بدون Loaders
 */
export function useRealtimeData<T extends { id: string | number }>({
  table,
  select = '*',
  filter,
  enabled = true
}: RealtimeConfig<T>) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // نستخدم ref لتجنب مشاكل الـ closures في الـ callbacks
  const dataRef = useRef<T[]>([]);
  dataRef.current = data;

  const fetchInitialData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setIsLoading(true);
      let query = supabase.from(table).select(select);
      
      if (filter) {
        // تطبيق الفلتر إذا وجد (بسيط: "column=eq.value")
        const [col, rest] = filter.split('=');
        const [op, val] = rest.split('.');
        if (op === 'eq') query = query.eq(col, val);
      }

      const { data: initialData, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      setData(initialData as T[]);
      setError(null);
    } catch (err: any) {
      logger.error(`[RealtimeData] Initial fetch error (${table}):`, err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [table, select, filter, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // 1. الجلب الأولي
    fetchInitialData();

    // 2. إعداد الاشتراك الفوري
    const channelId = `realtime-${table}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          logger.log(`🔔 [Realtime] Change detected in ${table}:`, payload.eventType);
          
          const currentData = dataRef.current;
          let updatedData = [...currentData];

          switch (payload.eventType) {
            case 'INSERT':
              updatedData = [payload.new as T, ...updatedData];
              break;
            case 'UPDATE':
              updatedData = updatedData.map(item => 
                item.id === (payload.new as T).id ? { ...item, ...payload.new } : item
              );
              break;
            case 'DELETE':
              updatedData = updatedData.filter(item => item.id !== (payload.old as T).id);
              break;
          }

          setData(updatedData);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.log(`✅ [Realtime] Subscribed to ${table}`);
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          logger.warn(`⚠️ [Realtime] Connection issue with ${table}:`, status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, enabled, fetchInitialData]);

  return {
    data,
    setData,
    isLoading,
    error,
    refresh: fetchInitialData
  };
}
