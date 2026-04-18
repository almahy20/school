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
          // DEBUG: Log when realtime event is received
          logger.log(`🔄 [RealtimeSync] Change detected in table: ${table}`);
          
          // Fix: Use findAll to get ALL matching queries, not just the first one
          const matchingQueries = queryClient.getQueryCache().findAll({
            queryKey: [table],
            exact: false
          });
          
          if (matchingQueries.length > 0) {
            logger.log(`   → Found ${matchingQueries.length} matching queries for table: ${table}`);
            logger.log(`   → Invalidating queries for table: ${table}`);
            queryClient.invalidateQueries({
               queryKey: [table],
               exact: false
            });
          }

          // Special mappings - only invalidate if those queries exist
          const mappings: Record<string, string[]> = {
            'schools': ['school-branding'],
            'exam_templates': ['exam-templates'],
            'grades': ['student-grades', 'parent-child-overview', 'child-full-details'],
            'curriculum_subjects': ['curriculum-subjects'],
            'school_orders': ['school-orders'],
            'user_profiles': ['admin-users'],
            'complaints': ['parent-complaints', 'admin-stats'],
            'student_parents': ['parent-children', 'admin-parent-children'],
            'attendance': ['parent-child-overview', 'parent-child-activities', 'child-full-details'],
            'fees': ['fees', 'parent-child-overview', 'child-full-details'],
            'profiles': ['admin-stats', 'students', 'teachers', 'parents', 'parent-detail'],
            'user_roles': ['admin-stats', 'students', 'teachers', 'parents', 'parent-detail'],
            'students': ['students', 'student-detail', 'class-students'],
            'teachers': ['teachers', 'teacher-detail'],
            'classes': ['classes', 'class-detail', 'class-students']
          };

          if (mappings[table]) {
            mappings[table].forEach(key => {
              // Fix: Use findAll to check if ANY queries exist for this key
              const mappedQueries = queryClient.getQueryCache().findAll({ queryKey: [key], exact: false });
              if (mappedQueries.length > 0) {
                logger.log(`   → Found ${mappedQueries.length} mapped queries for: ${key}`);
                logger.log(`   → Invalidating mapped query: ${key}`);
                queryClient.invalidateQueries({ queryKey: [key], exact: false });
              }
            });
          }
          
          // Invalidate ALL parent queries (with any pagination/status params)
          if (table === 'user_roles' || table === 'profiles' || table === 'student_parents') {
            logger.log(`   → Invalidating ALL parents queries`);
            // Invalidate with partial match - will catch all pagination variants
            queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
          }
          
          // Invalidate ALL student queries
          if (table === 'students' || table === 'student_parents') {
            logger.log(`   → Invalidating ALL students queries`);
            queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
          }
          
          // Invalidate ALL teacher queries  
          if (table === 'teachers') {
            logger.log(`   → Invalidating ALL teachers queries`);
            queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
          }
          
          // Invalidate ALL class queries
          if (table === 'classes') {
            logger.log(`   → Invalidating ALL classes queries`);
            queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
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
      supabase.removeChannel(channel);
    };

  }, [tables, schoolId, queryClient]);
}
