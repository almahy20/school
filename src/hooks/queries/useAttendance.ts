import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  class_id: string | null;
  school_id: string | null;
  students?: { name: string };
  classes?: { name: string };
}

async function fetchAttendance(schoolId: string | null, isSuperAdmin: boolean, dateFilter?: string): Promise<AttendanceRecord[]> {
  const q = supabase.from('attendance').select('*, students(name), classes(name)');
  if (!isSuperAdmin && schoolId) {
    q.eq('school_id', schoolId);
  }
  if (dateFilter) {
    q.eq('date', dateFilter);
  }
  const { data, error } = await q.order('date', { ascending: false }).limit(200);
  if (error) throw error;
  return (data as AttendanceRecord[]) || [];
}

export function useAttendance(dateFilter?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['attendance', user?.schoolId, dateFilter],
    queryFn: () => fetchAttendance(user?.schoolId || null, !!user?.isSuperAdmin, dateFilter),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 2 * 60 * 1000, // 2 min - attendance changes frequently
    gcTime: 5 * 60 * 1000,
  });
}

export function useAddAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (records: Omit<AttendanceRecord, 'id' | 'students' | 'classes'>[]) => {
      const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'student_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', user?.schoolId] });
    },
  });
}
