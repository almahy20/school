import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';
import { useRealtimeSync } from '../useRealtimeSync';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  class_id: string | null;
  parent_phone: string | null;
  school_id: string | null;
  created_at: string;
  birth_date?: string | null;
  notes?: string | null;
  classes?: { name: string; grade_level: string | null; teacher_id?: string };
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
  const queryKey = ['students', user?.schoolId, user?.isSuperAdmin, user?.role, user?.id];
  
  // Enable Realtime Sync
  useRealtimeSync('students', queryKey, user?.isSuperAdmin ? undefined : `school_id=eq.${user?.schoolId}`);

  return useQuery({
    queryKey,
    queryFn: () => fetchStudents(user),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 0, // Ensure we check for updates frequently
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15 * 1000, // 15s fallback polling as requested
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

// ─── useStudent Hook ──────────────────────────────────────────────────────────
export function useStudent(id: string | undefined) {
  const queryKey = ['student', id];

  // Enable Realtime Sync for single student
  useRealtimeSync('students', queryKey, id ? `id=eq.${id}` : undefined);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('students')
        .select('*, classes:classes!students_class_id_fkey(*)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Fetch teacher name separately if teacher_id exists
      if (data.classes?.teacher_id) {
        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.classes.teacher_id)
          .single();
        
        if (teacherProfile) {
          (data.classes as any).teacher = { full_name: teacherProfile.full_name };
        }
      }
      
      return data as Student & { classes: any };
    },
    enabled: !!id,
    staleTime: 0,
    refetchInterval: 15 * 1000,
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
      // Invalidate all student-related queries
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
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
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

// ─── useUpdateStudent Hook ───────────────────────────────────────────────────
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Student> & { id: string }) => {
      const { error } = await supabase.from('students').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'] });
    },
  });
}

export function useStudentParent(studentId: string | null | undefined) {
  return useQuery({
    queryKey: ['student-parent', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data: parentLink } = await supabase
        .from('student_parents')
        .select('parent_id')
        .eq('student_id', studentId)
        .maybeSingle();

      if (!parentLink?.parent_id) return null;

      const { data: parentProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', parentLink.parent_id)
        .single();
      
      if (error) throw error;
      return parentProfile;
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClassStudents(classId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['students', 'class', classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classId,
    staleTime: 60 * 1000,
  });
}


