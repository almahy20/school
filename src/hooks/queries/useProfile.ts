import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

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
  const queryKey = useMemo(() => ['profile', user?.id], [user?.id]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle() to handle missing profiles gracefully
      
      // If error is PGRST116 (no rows), return null instead of throwing
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return (data as unknown) as Profile;
    },
    enabled: !!user?.id,
    staleTime: 5 * 1000, // ⚡ 5 seconds
    gcTime: 5 * 60 * 1000, // ⚡ 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    refetchInterval: 10 * 1000, // ⚡ 10 seconds (was 15s)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
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
