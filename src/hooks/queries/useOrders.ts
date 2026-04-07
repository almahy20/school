import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '../useRealtimeSync';

export interface SchoolOrder {
  id: string;
  school_name: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  admin_whatsapp?: string;
  plan?: 'monthly' | 'half_yearly' | 'yearly';
  package_type?: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'expired';
  receipt_url?: string | null;
  receipt_note?: string | null;
  created_at: string;
}

export function useOrder(id: string | undefined) {
  const queryKey = ['order', id];
  useRealtimeSync('school_orders', queryKey, id ? `id=eq.${id}` : undefined);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('school_orders')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as SchoolOrder;
    },
    enabled: !!id,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useSchoolOrders() {
  const { user } = useAuth();
  const queryKey = ['school-orders'];
  useRealtimeSync('school_orders', queryKey);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.isSuperAdmin) return [];
      const { data, error } = await supabase
        .from('school_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SchoolOrder[];
    },
    enabled: !!user?.isSuperAdmin,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SchoolOrder> & { id: string }) => {
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

