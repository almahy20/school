import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useEffect } from 'react';
import { logger } from '@/utils/logger';
import { getCachedUser } from '@/lib/userCache';

export interface SchoolBranding {
  id: string;
  name: string;
  logo_url: string | null;
  slug: string;
}

/** Sets document.title to the clean school name (strips "مدرسة" prefix and suffixes). */
function syncDocumentTitle(name: string) {
  let cleanName = name.replace(/^مدرسة\s*/i, '').replace(/^مدرسه\s*/i, '').trim();
  cleanName = cleanName.split(' — ')[0];
  if (document.title !== cleanName) {
    document.title = cleanName;
  }
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
  // ✅ Use cached schoolId immediately for parallel loading
  const schoolId = user?.schoolId || getCachedUser()?.schoolId || null;
  const queryKey = useMemo(() => ['school-branding', schoolId], [schoolId]);
  const queryClient = useQueryClient();

  // ✅ Optimization: Load branding from localStorage immediately if available
  // This prevents the "flicker" where the logo disappears and comes back on refresh
  useEffect(() => {
    if (schoolId) {
      const cached = localStorage.getItem(`branding_${schoolId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const existing = queryClient.getQueryData(queryKey);
          
          // ✅ Sync Title IMMEDIATELY from cache before even setting query data
          if (parsed.name) {
            syncDocumentTitle(parsed.name);
          }

          if (!existing) {
            queryClient.setQueryData(queryKey, parsed);
          }
        } catch (e) {
          logger.error('Failed to parse cached branding');
        }
      }
    }
  }, [schoolId, queryKey, queryClient]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const data = await fetchBranding(schoolId);
      if (data && schoolId) {
        localStorage.setItem(`branding_${schoolId}`, JSON.stringify(data));
        // ✅ Sync Title when data arrives
        if (data.name) {
          syncDocumentTitle(data.name);
        }
      }
      return data;
    },
    enabled: !!schoolId,
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

