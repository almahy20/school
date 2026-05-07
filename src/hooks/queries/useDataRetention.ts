import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface RetentionPolicy {
  id: string;
  table_name: string;
  retention_period: string | null; // INTERVAL as string
  enabled: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSizeInfo {
  table_name: string;
  row_count: number;
  size: string;
  oldest_record: string | null;
  newest_record: string | null;
}

export interface CleanupResult {
  success: boolean;
  tables_cleaned: number;
  total_deleted: number;
  details: Array<{
    table: string;
    deleted: number;
    cutoff: string;
  }>;
  executed_at: string;
}

/**
 * Hook to get data retention policies
 * Admin only - controls how long data is kept
 */
export function useRetentionPolicies() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['data-retention-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_retention_policies')
        .select('*')
        .order('table_name');

      if (error) throw error;
      return data as RetentionPolicy[];
    },
    // Only fetch for admin users
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
  });
}

/**
 * Hook to update retention policy
 * Admin only
 */
export function useUpdateRetentionPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      tableName, 
      retentionDays, 
      enabled 
    }: { 
      tableName: string; 
      retentionDays: number | null;
      enabled: boolean;
    }) => {
      const retentionPeriod = retentionDays 
        ? `${retentionDays} days` 
        : null;

      const { data, error } = await supabase
        .from('data_retention_policies')
        .update({
          retention_period: retentionPeriod,
          enabled,
          updated_at: new Date().toISOString()
        })
        .eq('table_name', tableName)
        .select()
        .single();

      if (error) throw error;
      return data as RetentionPolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-retention-policies'] });
    },
  });
}

/**
 * Hook to trigger manual data cleanup
 * Returns summary of deleted records
 */
export function useTriggerCleanup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<CleanupResult> => {
      const { data, error } = await supabase.rpc('trigger_data_cleanup');

      if (error) throw error;
      return data as CleanupResult;
    },
    onSuccess: () => {
      // Refresh database size info
      queryClient.invalidateQueries({ queryKey: ['database-size-info'] });
    },
  });
}

/**
 * Hook to get database size information
 * Shows real-time size of all tables
 * Admin only
 */
export function useDatabaseSizeInfo() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['database-size-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('database_size_info')
        .select('*')
        .order('row_count', { ascending: false });

      if (error) throw error;
      return data as DatabaseSizeInfo[];
    },
    // Only fetch for admin users
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
  });
}

/**
 * Hook to get student attendance history
 * Yearly summary computed on-demand (no storage cost)
 */
export function useStudentAttendanceHistory(studentId: string | null) {
  return useQuery({
    queryKey: ['attendance-history', studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data, error } = await supabase
        .from('student_attendance_history')
        .select('*')
        .eq('student_id', studentId)
        .order('academic_year', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });
}

/**
 * Hook to get student grade history
 * Summary by subject and term (computed on-demand)
 */
export function useStudentGradeHistory(studentId: string | null) {
  return useQuery({
    queryKey: ['grade-history', studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data, error } = await supabase
        .from('student_grade_history')
        .select('*')
        .eq('student_id', studentId)
        .order('academic_year', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });
}

/**
 * Hook to get school-wide attendance statistics
 * Monthly breakdown by school
 */
export function useSchoolAttendanceStats(schoolId: string | null) {
  return useQuery({
    queryKey: ['school-attendance-stats', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];

      const { data, error } = await supabase
        .from('school_attendance_stats')
        .select('*')
        .eq('school_id', schoolId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });
}

/**
 * Hook to estimate how many records will be deleted
 * Useful for preview before running cleanup
 * Admin only
 */
export function useCleanupEstimate() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['cleanup-estimate'],
    queryFn: async () => {
      const estimates: Record<string, number> = {};

      // Get policies
      const { data: policies } = await supabase
        .from('data_retention_policies')
        .select('*')
        .eq('enabled', true);

      if (!policies) return estimates;

      // Count records that would be deleted for each table
      for (const policy of policies) {
        if (policy.retention_period === null) continue;

        // Parse interval (e.g., "90 days")
        const days = parseInt(policy.retention_period.split(' ')[0]);
        
        // Skip estimates for "forever" periods (long intervals > 100 years or specifically flagged)
        // 36500 days = 100 years
        if (days > 36500) {
          estimates[policy.table_name] = 0;
          continue;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let count = 0;

        if (policy.table_name === 'attendance') {
          const { count: attendanceCount } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .lt('date', cutoffDate.toISOString().split('T')[0]);
          count = attendanceCount || 0;
        } else {
          const { count: tableCount } = await supabase
            .from(policy.table_name)
            .select('*', { count: 'exact', head: true })
            .lt('created_at', cutoffDate.toISOString());
          count = tableCount || 0;
        }

        estimates[policy.table_name] = count;
      }

      return estimates;
    },
    // Only fetch for admin users
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
  });
}
