import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TableName = 'students' | 'classes' | 'grades' | 'attendance' | 'student_parents' | 'exam_templates';

/**
 * Hook to fetch all rows from a table
 */
export function useTableData(tableName: TableName) {
  return useQuery({
    queryKey: ['database', tableName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Hook to insert a new row into a table
 */
export function useInsertRow(tableName: TableName) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: Record<string, any>) => {
      const { data, error } = await supabase
        .from(tableName)
        .insert(record as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', tableName] });
    },
  });
}

/**
 * Hook to update a row in a table
 */
export function useUpdateRow(tableName: TableName) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { data, error } = await supabase
        .from(tableName)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', tableName] });
    },
  });
}

/**
 * Hook to delete a row from a table
 */
export function useDeleteRow(tableName: TableName) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', tableName] });
    },
  });
}
