import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to automatically synchronize React Query cache with Supabase Realtime changes.
 */
export function useRealtimeSync(
  table: string,
  queryKey: any[],
  filter?: string
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setupChannel = useCallback(() => {
    if (!table) return;

    // 1. Clean up existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const queryKeyStr = JSON.stringify(queryKey);
    console.log(`📡 Setting up Realtime sync for [${table}]... Key: ${queryKeyStr}`);

    const channel = supabase
      .channel(`${table}-rt-${queryKeyStr.substring(0, 32)}`) // Shorter name
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log(`✨ Realtime [${table}] event:`, payload.eventType);

          // Update React Query cache directly for better UX
          queryClient.setQueriesData({ queryKey }, (oldData: any) => {
            if (!oldData) return oldData;

            if (Array.isArray(oldData)) {
              switch (payload.eventType) {
                case 'INSERT':
                  if (!oldData.find(item => item.id === payload.new.id)) {
                    return [payload.new, ...oldData];
                  }
                  return oldData;

                case 'UPDATE':
                  return oldData.map(item => 
                    item.id === payload.new.id ? { ...item, ...payload.new } : item
                  );

                case 'DELETE':
                  return oldData.filter(item => item.id === payload.old.id);

                default:
                  return oldData;
              }
            }

            if (typeof oldData === 'object' && oldData.id === (payload.new?.id || payload.old?.id)) {
              if (payload.eventType === 'DELETE') return null;
              if (payload.eventType === 'UPDATE') return { ...oldData, ...payload.new };
            }

            return oldData;
          });

          // Invalidate to ensure consistency, but only if not already refetching
          const query = queryClient.getQueryCache().find({ queryKey });
          if (query && query.state.fetchStatus !== 'fetching') {
            queryClient.invalidateQueries({ queryKey, exact: true });
          }
        }
      );

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Realtime [${table}] subscribed`);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`⚠️ Realtime [${table}] ${status}. Retrying in 10s...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          setupChannel();
        }, 10000); // 10s retry for less pressure
      }
    });

    channelRef.current = channel;
  }, [table, JSON.stringify(queryKey), filter, queryClient]);

  useEffect(() => {
    setupChannel();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (channelRef.current) {
        console.log(`📴 Unsubscribing from Realtime [${table}]`);
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [setupChannel, table]);
}
