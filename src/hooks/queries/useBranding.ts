import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useEffect } from 'react';
import { logger } from '@/utils/logger';

export interface SchoolBranding {
  id: string;
  name: string;
  logo_url: string | null;
  slug: string;
}

async function fetchBranding(schoolId: string | null): Promise<SchoolBranding | null> {
  if (!schoolId) return null;
  
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, logo_url, slug')
    .eq('id', schoolId)
    .maybeSingle();
    
  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching school branding:', error);
    return null;
  }
  
  return data as SchoolBranding;
}

export function useBranding() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['school-branding', user?.schoolId], [user?.schoolId]);
  const queryClient = useQueryClient();

  // ✅ Optimization: Load branding from localStorage immediately if available
  // This prevents the "flicker" where the logo disappears and comes back on refresh
  useEffect(() => {
    if (user?.schoolId) {
      const cached = localStorage.getItem(`branding_${user.schoolId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const existing = queryClient.getQueryData(queryKey);
          
          // ✅ Sync Title IMMEDIATELY from cache before even setting query data
          if (parsed.name) {
            const cleanName = parsed.name.split(' — ')[0];
            if (document.title !== cleanName) {
              document.title = cleanName;
            }
          }

          if (!existing) {
            queryClient.setQueryData(queryKey, parsed);
          }
        } catch (e) {
          console.error('Failed to parse cached branding');
        }
      }
    }
  }, [user?.schoolId, queryKey, queryClient]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const data = await fetchBranding(user?.schoolId || null);
      if (data && user?.schoolId) {
        localStorage.setItem(`branding_${user.schoolId}`, JSON.stringify(data));
        // ✅ Sync Title when data arrives
        if (data.name) {
          const cleanName = data.name.split(' — ')[0];
          if (document.title !== cleanName) {
            document.title = cleanName;
          }
        }
      }
      return data;
    },
    enabled: !!user?.schoolId,
    placeholderData: (previousData: any) => previousData,
    retry: 1,
    retryDelay: 1000,
    staleTime: Infinity, 
  });
}
export function useSchoolBySlug(slug: string | undefined | null) {
  return useQuery({
    queryKey: ['school-by-slug', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data: schoolId, error: rpcError } = await (supabase as any).rpc('get_school_id_by_slug', { p_slug: slug });
      if (rpcError) throw rpcError;
      if (!schoolId) return null;

      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id, name, logo_url')
        .eq('id', schoolId as string)
        .maybeSingle();
      
      if (schoolError && schoolError.code !== 'PGRST116') throw schoolError;
      return school;
    },
    enabled: !!slug,
    staleTime: Infinity, // التخزين في الذاكرة للأبد لسرعة التحميل
  });
}

