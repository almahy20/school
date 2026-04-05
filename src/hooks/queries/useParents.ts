import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Parent {
  id: string;
  full_name: string;
  phone: string;
  school_id: string | null;
  created_at: string;
}

async function fetchParents(schoolId: string | null): Promise<Parent[]> {
  const { data: roles, error: rolesErr } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'parent')
    .eq('school_id', schoolId!);

  if (rolesErr || !roles?.length) return [];

  const parentIds = roles.map(r => r.user_id);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', parentIds)
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export function useParents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parents', user?.schoolId],
    queryFn: () => fetchParents(user?.schoolId || null),
    enabled: !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
