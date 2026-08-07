import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

/**
 * useRealtimeSync - خطاف ذكي يربط React Query بـ Supabase Realtime
 * يضمن تحديث الكاش فورياً عند حدوث أي تغيير في الجداول المحددة
 * يغني عن الـ polling ويمنع ظهور الـ Loaders المتكررة
 */
export function useRealtimeSync(tables: string[] | string, schoolId?: string | null) {
  const queryClient = useQueryClient();
  const tablesKey = useMemo(() => {
    const tableList = Array.isArray(tables) ? tables : [tables];
    return JSON.stringify(tableList);
  }, [tables]);

  useEffect(() => {
    const tableList = JSON.parse(tablesKey) as string[];
    if (!tableList.length) return;

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

    const sortedTables = [...tableList].sort();
    const channelId = `sync-${sortedTables.join('-')}-${schoolId || 'global'}`;
    
    logger.log(`🔗 [RealtimeSync] Initializing channel: ${channelId}`);
    const channel = supabase.channel(channelId);

    tableList.forEach(table => {
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
          /*
            💡 اقتراح لـ admin-stats (للتطبيق لاحقاً مع RealtimeEngine — لا تنفذه دلوقتي):
            بدل ما نعمل invalidateQueries كامل لـ admin-stats مع كل تغيير بسيط ونجيب كل البيانات
            من الأول، ممكن نستخدم setQueryData ونعدّل الأرقام يدوياً حسب نوع الحدث:
            - INSERT في students: زيادة total_students بـ 1
            - DELETE في students: نقصان total_students بـ 1
            - INSERT/DELETE في teachers: زيادة/نقصان total_teachers بـ 1
            - INSERT في fee_payments: زيادة total_collected بـ newRec.amount
            - INSERT في complaints: زيادة total_complaints بـ 1
            هذه الطريقة هتقضي على استعلام كبير كامل مع كل تغيير صغير
            وستتكامل مع RealtimeEngine اللي فعلاً بيعمل syncToCache لـ students.
          */
          const mappings: Record<string, string[][]> = {
            'schools': [['school-branding']],
            'exam_templates': [['exam-templates']],
            'grades': [['student-grades']],
            'curriculum_subjects': [['curriculum-subjects']],
            'school_orders': [['school-orders']],
            'user_profiles': [['admin-users']],
            'complaints': [['parent-complaints']],
            'student_parents': [['parent-children'], ['admin-parent-children']],
            'attendance': [['parent-child-overview'], ['parent-child-activities'], ['child-full-details']],
            'fees': [['fees']],
            'fee_payments': [['fees']],
            'profiles': [['parent-detail']],
            'user_roles': [],
            'students': [['students'], ['student-detail'], ['class-students'], ['parent-children']],
            'teachers': [['teachers'], ['teacher-detail']],
            'classes': [['classes'], ['class-detail'], ['class-students']]
          };

          if (mappings[table]) {
            mappings[table].forEach(key => invalidateTable(key));
          }
          
          // Direct-dependency list refreshes (only for tables that directly compose those lists)
          if (table === 'user_roles') {
            invalidateTable(['parents']);
            invalidateTable(['teachers']);
            invalidateTable(['students']);
          }
          if (table === 'profiles') {
            invalidateTable(['parents']);
            invalidateTable(['teachers']);
            invalidateTable(['students']);
          }
          if (table === 'student_parents') {
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

  }, [tablesKey, schoolId, queryClient]);
}
