import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: 'present' | 'absent' | 'late' | null;
  grade_level?: string;
  class_name?: string;
}

export function useClassAttendance(classId: string | null, date: string) {
  const { user } = useAuth();
  const queryKey = ['attendance', 'class', classId, date];
  
  
  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId || !classId) return [];

      // Fetch students in class
      const { data: students, error: sError } = await supabase
        .from('students')
        .select('id, name')
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('name');
      if (sError) throw sError;
      if (!students?.length) return [];

      // Fetch attendance records for class and date
      const { data: records, error: rError } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .eq('date', date);
      if (rError) throw rError;

      return students.map(s => {
        const record = records?.find(r => r.student_id === s.id);
        return { 
          studentId: s.id, 
          studentName: s.name, 
          status: (record?.status as any) || null 
        };
      }) as AttendanceRecord[];
    },
    enabled: !!(user?.schoolId && classId),
    placeholderData: keepPreviousData,
  });

  return queryResult;
}

export function useUpsertAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (records: any[]) => {
      if (!records || records.length === 0) return;
      const classId = records[0].class_id;
      const date = records[0].date;

      // 1. Delete existing records for this class & date
      await supabase
        .from('attendance')
        .delete()
        .eq('class_id', classId)
        .eq('date', date);

      // 2. Insert new records
      const { error } = await supabase.from('attendance').insert(records);
      if (error) throw error;
    },
    // ✅ Optimization: Optimistic Update
    onMutate: async (newRecords) => {
      if (newRecords.length === 0) return;
      const { class_id, date } = newRecords[0];
      const queryKey = ['attendance', 'class', class_id, date];

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((s: any) => {
          const record = newRecords.find(r => r.student_id === s.studentId);
          return record ? { ...s, status: record.status } : s;
        });
      });

      return { previousData, queryKey };
    },
    onError: (err, newRecords, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['attendance', 'class', variables[0].class_id, variables[0].date] 
        });
        // Also invalidate stats
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      }
    },
  });
}

export function useStudentAttendance(studentId: string | null) {
  const queryKey = ['attendance', 'student', studentId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
