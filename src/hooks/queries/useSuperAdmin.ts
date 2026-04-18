import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export interface School {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
  subscription_end_date: string;
  slug: string;
  plan: string;
  logo_url?: string;
  address?: string;
  phone?: string;
}


export function useSchools() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['schools'], []);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as School[];
    },
    enabled: !!user?.isSuperAdmin,
    staleTime: 0,
  });
}

export function useSchoolOrders() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['school-orders'], []);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SchoolOrder[];
    },
    enabled: !!user?.isSuperAdmin,
    staleTime: 0,
  });
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<School> & { id: string }) => {
      const { error } = await supabase
        .from('schools')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return { id, ...updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['school-branding'] });
    },
  });
}

export function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (school: Omit<School, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('schools')
        .insert(school)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('school_orders')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('school_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['school-orders'] });
    },
  });
}

