import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    .single();
    
  if (error) {
    console.error('Error fetching school branding:', error);
    return null;
  }
  
  return data as SchoolBranding;
}

export function useBranding() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['school-branding', user?.schoolId],
    queryFn: () => fetchBranding(user?.schoolId || null),
    enabled: !!user?.schoolId,
    staleTime: 24 * 60 * 60 * 1000, // Branding rarely changes, cache for 24 hours
    gcTime: 48 * 60 * 60 * 1000,
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
        .single();
      
      if (schoolError) throw schoolError;
      return school;
    },
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
  });
}
