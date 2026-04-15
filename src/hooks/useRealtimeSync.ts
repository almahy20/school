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
          queryClient.invalidateQueries({
             queryKey: [table],
             exact: false
          });

          // Special mappings
          const mappings: Record<string, string[]> = {
            'schools': ['school-branding'],
            'exam_templates': ['exam-templates'],
            'grades': ['student-grades', 'parent-child-overview', 'child-full-details', 'parent-children'],
            'curriculum_subjects': ['curriculum-subjects'],
            'school_orders': ['school-orders'],
            'user_profiles': ['admin-users'],
            'complaints': ['parent-complaints', 'admin-stats'],
            'student_parents': ['parent-children'],
            'attendance': ['parent-child-overview', 'parent-child-activities', 'child-full-details'],
            'fees': ['fees', 'parent-child-overview', 'child-full-details'],
            'profiles': ['admin-stats', 'students', 'teachers'],
            'user_roles': ['admin-stats', 'students', 'teachers']
          };

          if (mappings[table]) {
            mappings[table].forEach(key => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
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
