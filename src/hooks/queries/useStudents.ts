import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppUser } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  class_id: string | null;
  parent_phone: string | null;
  school_id: string | null;
  created_at: string;
  classes?: { name: string; grade_level: string | null };
}

// ─── Fetch function ───────────────────────────────────────────────────────────
async function fetchStudents(user: AppUser | null): Promise<Student[]> {
  if (!user?.isSuperAdmin && !user?.schoolId) return [];

  let teacherClassIds: string[] = [];
  if (user.role === 'teacher') {
    const { data: teacherClasses } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', user.id);
    
    if (teacherClasses && teacherClasses.length > 0) {
      teacherClassIds = teacherClasses.map(c => c.id);
    } else {
      return []; // Teacher has no classes, so no students
    }
  }

  const q = supabase.from('students').select('*, classes(*)');
  if (!user.isSuperAdmin && user.schoolId) {
    q.eq('school_id', user.schoolId);
  }
  
  if (user.role === 'teacher' && teacherClassIds.length > 0) {
    q.in('class_id', teacherClassIds);
  }

  const { data, error } = await q.order('name');
  if (error) throw error;
  return data || [];
}

// ─── useStudents Hook ─────────────────────────────────────────────────────────
export function useStudents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['students', user?.schoolId, user?.isSuperAdmin, user?.role, user?.id],
    queryFn: () => fetchStudents(user),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 30 * 1000, // 30 seconds - much more responsive
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

// ─── useDeleteStudent Hook ────────────────────────────────────────────────────
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: ['students', user?.schoolId] });
    },
  });
}

// ─── useAddStudent Hook ───────────────────────────────────────────────────────
export function useAddStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (studentData: Omit<Student, 'id' | 'created_at' | 'classes'>) => {
      const { data, error } = await supabase.from('students').insert(studentData).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', user?.schoolId] });
    },
  });
}
