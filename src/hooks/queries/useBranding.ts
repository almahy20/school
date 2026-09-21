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

/** Reads branding from localStorage synchronously — used BEFORE first render to prevent flicker. */
function readBrandingFromLocalStorage(schoolId: string | null): SchoolBranding | null | undefined {
  if (!schoolId) return undefined;
  try {
    const cached = localStorage.getItem(`branding_${schoolId}`);
    if (cached) {
      const parsed = JSON.parse(cached) as SchoolBranding;
      if (parsed?.name) syncDocumentTitle(parsed.name);
      return parsed;
    }
  } catch (_e) { /* ignore */ }
  return undefined;
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
  const schoolId = user?.schoolId || getCachedUser()?.schoolId || null;
  const queryKey = useMemo(() => ['school-branding', schoolId], [schoolId]);
  const queryClient = useQueryClient();

  const initialData = useMemo<SchoolBranding | null | undefined>(() => {
    const fromClient = queryClient.getQueryData<SchoolBranding>(queryKey);
    if (fromClient) {
      if (fromClient.name) syncDocumentTitle(fromClient.name);
      return fromClient;
    }
    return readBrandingFromLocalStorage(schoolId);
  }, [queryKey, queryClient, schoolId]);

  useEffect(() => {
    if (schoolId) {
      const cached = localStorage.getItem(`branding_${schoolId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as SchoolBranding;
          const existing = queryClient.getQueryData<SchoolBranding>(queryKey);
          if (!existing && parsed?.name) {
            syncDocumentTitle(parsed.name);
          }
        } catch (_e) { /* ignore */ }
      }
    }
  }, [schoolId, queryKey, queryClient]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const data = await fetchBranding(schoolId);
      if (data && schoolId) {
        localStorage.setItem(`branding_${schoolId}`, JSON.stringify(data));
        if (data.name) syncDocumentTitle(data.name);
      }
      return data;
    },
    enabled: !!schoolId,
    initialData,
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

      // 1. Try exact slug match via RPC
      const { data: schoolId, error: rpcError } = await (supabase as any).rpc('get_school_id_by_slug', { p_slug: slug });
      if (!rpcError && schoolId) {
        const { data: school, error: schoolError } = await supabase
          .from('schools')
          .select('id, name, logo_url, slug')
          .eq('id', schoolId as string)
          .maybeSingle();
        if (!schoolError && school) return school;
      }

      // 2. Fallback: case-insensitive ilike search directly on schools table
      //    (handles slug variations like hyphens vs underscores, spacing differences)
      const { data: schools } = await supabase
        .from('schools')
        .select('id, name, logo_url, slug')
        .ilike('slug', slug)
        .limit(1);

      if (schools && schools.length > 0) return schools[0];

      // 3. Second fallback: strip hyphens and compare
      const slugNormalized = slug.replace(/-/g, ' ').replace(/_/g, ' ').trim();
      const { data: schools2 } = await supabase
        .from('schools')
        .select('id, name, logo_url, slug')
        .ilike('name', `%${slugNormalized}%`)
        .limit(1);

      return (schools2 && schools2.length > 0) ? schools2[0] : null;
    },
    enabled: !!slug,
    staleTime: Infinity,
    retry: 2,
  });
}

