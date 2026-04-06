import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  school_id: string | null;
  notification_prefs: any;
  avatar_url: string | null;
  created_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return (data as unknown) as Profile;
    },
    enabled: !!user?.id,
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (prefs: any) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('profiles')
        .update({ notification_prefs: prefs } as any)
        .eq('id', user.id);
      if (error) throw error;
      return prefs;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });
}
