import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

/**
 * useRealtimeSync - خطاف ذكي يربط React Query بـ Supabase Realtime
 * يضمن تحديث الكاش فورياً عند حدوث أي تغيير في الجداول المحددة
 * يغني عن الـ polling ويمنع ظهور الـ Loaders المتكررة
 */
export function useRealtimeSync(tables: string[], schoolId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tables.length) return;

    // لتجنب تكرار الريكويستات في وقت قصير (Debounce)
    const pendingInvalidations = new Set<string>();
    let debounceTimer: any = null;

    const processInvalidations = () => {
      if (pendingInvalidations.size === 0) return;
      
      const uniqueKeys = Array.from(pendingInvalidations);
      pendingInvalidations.clear();
      
      uniqueKeys.forEach(keyStr => {
        const queryKey = JSON.parse(keyStr);
        logger.log(`🔄 [RealtimeSync] Invalidating ACTIVE queries for: ${queryKey[0]}`);
        queryClient.invalidateQueries({
          queryKey,
          exact: false,
          // ⚡ Optimization: Only refetch ACTIVE queries on screen
          refetchType: 'active' 
        });
      });
    };

    const invalidateTable = (queryKey: string[]) => {
      pendingInvalidations.add(JSON.stringify(queryKey));
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processInvalidations, 500);
    };

    // Tables that are known NOT to have a school_id column
    const globalTables = ['profiles', 'schools'];

    const sortedTables = [...tables].sort();
    const channelId = `sync-${sortedTables.join('-')}-${schoolId || 'global'}`;
    
    logger.log(`🔗 [RealtimeSync] Initializing channel: ${channelId}`);
    const channel = supabase.channel(channelId);

    tables.forEach(table => {
      const isGlobal = globalTables.includes(table);
      
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: (schoolId && !isGlobal) ? `school_id=eq.${schoolId}` : undefined,
        },
        () => {
          // 1. Invalidate the table itself
          invalidateTable([table]);

          // 2. Special mappings (Cross-table relationships)
          const mappings: Record<string, string[][]> = {
            'schools': [['school-branding']],
            'exam_templates': [['exam-templates']],
            'grades': [['student-grades'], ['parent-child-overview'], ['child-full-details'], ['stats']],
            'curriculum_subjects': [['curriculum-subjects']],
            'school_orders': [['school-orders']],
            'user_profiles': [['admin-users']],
            'complaints': [['parent-complaints'], ['admin-stats'], ['admin-activities']],
            'student_parents': [['parent-children'], ['admin-parent-children'], ['parents'], ['students']],
            'attendance': [['parent-child-overview'], ['parent-child-activities'], ['child-full-details'], ['stats']],
            'fees': [['fees'], ['parent-child-overview'], ['child-full-details'], ['stats'], ['admin-activities']],
            'fee_payments': [['fees'], ['parent-child-overview'], ['child-full-details'], ['stats'], ['admin-activities']],
            'profiles': [['admin-stats'], ['students'], ['teachers'], ['parents'], ['parent-detail'], ['admin-activities']],
            'user_roles': [['admin-stats'], ['students'], ['teachers'], ['parents'], ['parent-detail'], ['admin-activities']],
            'students': [['students'], ['student-detail'], ['class-students'], ['stats'], ['parent-children']],
            'teachers': [['teachers'], ['teacher-detail'], ['stats']],
            'classes': [['classes'], ['class-detail'], ['class-students'], ['stats']]
          };

          if (mappings[table]) {
            mappings[table].forEach(key => invalidateTable(key));
          }
          
          // Force refresh parents/students lists on any related change
          if (table === 'user_roles' || table === 'profiles' || table === 'student_parents') {
            invalidateTable(['parents']);
            invalidateTable(['students']);
          }
        }
      );
    });

    channel.subscribe((status) => {
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        logger.warn(`⚠️ [RealtimeSync] Channel ${status}`);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };

  }, [tables, schoolId, queryClient]);
}
