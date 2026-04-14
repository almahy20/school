import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeacherAttendanceRecord {
  teacherId: string;
  teacherName: string;
  status: 'present' | 'absent' | 'late' | 'excused' | null;
}

export function useTeacherAttendance(date: string) {
  const { user } = useAuth();
  const queryKey = ['teacher-attendance', date];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return [];

      // Fetch all teachers in the school
      const { data: teachers, error: tError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', user.schoolId)
        .order('full_name');
      
      if (tError) throw tError;
      if (!teachers?.length) return [];

      // Fetch attendance records for date
      const { data: records, error: rError } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('date', date);
      
      if (rError) throw rError;

      return teachers.map(t => {
        const record = records?.find(r => r.teacher_id === t.id);
        return { 
          teacherId: t.id, 
          teacherName: t.full_name || 'غير محدد', 
          status: (record?.status as any) || null 
        };
      }) as TeacherAttendanceRecord[];
    },
    enabled: !!user?.schoolId,
    placeholderData: keepPreviousData,
    staleTime: 30000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60000,
  });
}

export function useUpsertTeacherAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (records: any[]) => {
      if (!records || records.length === 0) return;

      // Delete existing records for this date
      const date = records[0].date;
      await supabase
        .from('teacher_attendance')
        .delete()
        .eq('date', date);

      // Insert new records
      const { error } = await supabase.from('teacher_attendance').insert(records);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['teacher-attendance', variables[0].date] 
        });
      }
    },
  });
}
