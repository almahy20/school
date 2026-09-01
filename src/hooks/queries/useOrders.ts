import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export { type SchoolOrder, useSchoolOrders } from './useSuperAdmin';
import type { SchoolOrder } from './useSuperAdmin';

export function useOrder(id: string | undefined) {
  const queryKey = ['order', id];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('school_orders')
        .select('id, school_name, admin_name, admin_email, admin_phone, admin_whatsapp, plan, package_type, status, receipt_url, receipt_note, created_at')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as SchoolOrder;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
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
