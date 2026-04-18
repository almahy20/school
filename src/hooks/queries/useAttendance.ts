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

      console.log(`Fetching attendance for class ${classId} on ${date}`);

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
    staleTime: 30000, // Increased staleTime to avoid constant refetching
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60000, // Check every minute
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
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['attendance', 'class', variables[0].class_id, variables[0].date] 
        });
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
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15 * 1000,
  });
}
