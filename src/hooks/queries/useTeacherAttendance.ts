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
  
  // Cast to any for teacher_attendance table (not in auto-generated types)
  const db = supabase as any;
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return [];

      // Fetch teacher roles
      const { data: rolesData, error: rolesError } = await (supabase
        .from('user_roles') as any)
        .select('user_id')
        .eq('school_id', user.schoolId)
        .eq('role', 'teacher')
        .eq('approval_status', 'approved');
        
      if (rolesError) throw rolesError;
      if (!rolesData?.length) return [];
      
      const teacherIds = rolesData.map(r => r.user_id);

      // Fetch profiles for those teachers
      const { data: teachers, error: tError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds)
        .order('full_name');
      
      if (tError) throw tError;
      if (!teachers?.length) return [];

      // Fetch attendance records for date
      const { data: records, error: rError } = await db
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
    // ⚡ REALTIME: No more polling or auto-refetch. Realtime handles it.
    staleTime: 1000 * 60 * 60, 
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useUpsertTeacherAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (records: any[]) => {
      if (!records || records.length === 0) return;

      const db = supabase as any;

      // Delete existing records for this date
      const date = records[0].date;
      await db
        .from('teacher_attendance')
        .delete()
        .eq('date', date);

      // Insert new records
      const { error } = await db.from('teacher_attendance').insert(records);
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
