import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
 * Hook to get database statistics (table sizes, row counts, etc.)
 */
export function useDatabaseStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['database-stats'],
    queryFn: async () => {
      // Get row counts for all major tables
      const tables = [
        'students', 'teachers', 'parents', 'classes', 
        'attendance', 'grades', 'fees', 'messages',
        'notifications', 'complaints', 'schools',
        'student_parents', 'exam_templates', 'curriculums'
      ];

      const stats: Record<string, { count: number; size_estimate: string }> = {};
      let totalRows = 0;

      for (const table of tables) {
        try {
          const { count, error } = await (supabase as any)
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (!error && count !== null) {
            stats[table] = {
              count,
              size_estimate: estimateTableSize(table, count)
            };
            totalRows += count;
          }
        } catch (err) {
          console.error(`Error fetching stats for ${table}:`, err);
        }
      }

      return {
        tables: stats,
        totalRows,
        totalTables: tables.length,
        lastUpdated: new Date().toISOString()
      };
    },
    enabled: !!user?.isSuperAdmin,
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

/**
 * Estimate table size based on row count (approximate)
 */
function estimateTableSize(tableName: string, rowCount: number): string {
  // Average row size varies by table
  const avgRowSizes: Record<string, number> = {
    students: 500,      // ~500 bytes per row
    teachers: 600,      // ~600 bytes per row
    parents: 550,       // ~550 bytes per row
    classes: 400,       // ~400 bytes per row
    attendance: 200,    // ~200 bytes per row
    grades: 350,        // ~350 bytes per row
    fees: 450,          // ~450 bytes per row
    messages: 800,      // ~800 bytes per row (text content)
    notifications: 700, // ~700 bytes per row
    complaints: 1000,   // ~1000 bytes per row (longer text)
    schools: 1000,      // ~1000 bytes per row
    student_parents: 200,
    exam_templates: 600,
    curriculums: 800
  };

  const avgSize = avgRowSizes[tableName] || 500;
  const totalBytes = rowCount * avgSize;

  if (totalBytes < 1024) {
    return `${totalBytes} B`;
  } else if (totalBytes < 1024 * 1024) {
    return `${(totalBytes / 1024).toFixed(1)} KB`;
  } else if (totalBytes < 1024 * 1024 * 1024) {
    return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(3)} GB`;
  }
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
