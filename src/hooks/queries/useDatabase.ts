import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTableData(tableName: string) {
  return useQuery({
    queryKey: ['database-table', tableName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

export function useInsertRow(tableName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: any) => {
      const { data, error } = await supabase
        .from(tableName as any)
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-table', tableName] });
    },
  });
}

export function useUpdateRow(tableName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from(tableName as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-table', tableName] });
    },
  });
}

export function useDeleteRow(tableName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-table', tableName] });
    },
  });
}
