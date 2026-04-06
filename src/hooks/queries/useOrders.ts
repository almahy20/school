import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      return data as SchoolOrder;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSchoolOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['school-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SchoolOrder[];
    },
    enabled: !!user?.isSuperAdmin,
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

