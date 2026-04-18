import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  school_id: string | null;
  notification_prefs: any;
  // avatar_url: string | null; // ❌ column مش موجود
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
        .maybeSingle(); 
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return (data as unknown) as Profile;
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchInterval: false,
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
      toast.success('تم حفظ الإعدادات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['profile'], exact: false });
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
      toast.success('تم حفظ التغييرات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['profile'], exact: false });
    },
  });
}

/**
 * Hook to fetch a profile by ID with caching
 * Used to avoid duplicate profile queries across the app
 */
export function useProfileById(profileId: string | null | undefined) {
  const queryKey = useMemo(() => ['profile-by-id', profileId], [profileId]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!profileId) return null;
      // ✅ نشيل avatar_url - column ده مش موجود
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, school_id')
        .eq('id', profileId)
        .maybeSingle(); 
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return (data as unknown) as Profile;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
    refetchOnMount: false,
    refetchInterval: false,
    retry: 1,
  });
}

/**
 * Hook to fetch multiple profiles by IDs with caching
 * Batch fetch to reduce number of requests
 */
export function useProfilesByIds(profileIds: string[] | null | undefined) {
  const queryKey = useMemo(() => ['profiles-by-ids', profileIds?.sort()], [profileIds]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!profileIds || profileIds.length === 0) return [];
      
      // ✅ Fix: Supabase .in() fails with single-element array, use .eq() instead
      let query;
      if (profileIds.length === 1) {
        query = supabase
          .from('profiles')
          .select('id, full_name, phone, email, school_id')
          .eq('id', profileIds[0]);
      } else {
        query = supabase
          .from('profiles')
          .select('id, full_name, phone, email, school_id')
          .in('id', profileIds);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('❌ useProfilesByIds error:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!profileIds && profileIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
    refetchOnMount: false,
    refetchInterval: false,
    retry: 1,
  });
}
