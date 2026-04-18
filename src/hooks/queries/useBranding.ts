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

  return useQuery({
    queryKey,
    queryFn: () => fetchBranding(user?.schoolId || null),
    enabled: !!user?.schoolId,
    placeholderData: (previousData: any) => previousData,
    retry: 1,
    retryDelay: 1000,
    staleTime: Infinity, // التخزين في الذاكرة للأبد لسرعة التحميل
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

