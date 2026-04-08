import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';
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
  
  // توحيد queryKey ليكون ثابتًا (['students']) لتجنب الفقدان المتكرر للكاش عند إعادة تحميل الصفحة أو تأخر تحميل الـ user.
  // الدالة queryFn لن تتأثر لأن الـ query Client سيتم مسحه عند تسجيل الخروج.
  const queryKey = ['students'];
  
  return useQuery({
    queryKey,
    queryFn: () => fetchStudents(user),
    // تأخير طلب البيانات من الشبكة حتى يتم تحميل الـ user.
    // وبما أن المفتاح ثابت، سيقوم React Query بعرض البيانات المخزنة محلياً فوراً أثناء الانتظار!
    enabled: !!user?.id, 
    staleTime: 0, 
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // الحفاظ على بيانات الكاش السابقة لضمان عدم وميض الشاشة عند التحديث
    placeholderData: keepPreviousData,
  });
}

// ─── useStudent Hook ──────────────────────────────────────────────────────────
export function useStudent(id: string | undefined) {
  const queryKey = ['student', id];

  // Enable Realtime Sync for single student
  
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
    placeholderData: keepPreviousData,
  });
}

// ─── useDeleteStudent Hook ────────────────────────────────────────────────────
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    // التنفيذ المتفائل: الحذف من الشاشة فوراً
    onMutate: async (studentId: string) => {
      await queryClient.cancelQueries({ queryKey: ['students'] });
      const previousStudents = queryClient.getQueryData(['students']);
      
      queryClient.setQueriesData({ queryKey: ['students'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((s: Student) => s.id !== studentId);
      });

      return { previousStudents };
    },
    onError: (err, newTodo, context) => {
      // في حالة الفشل نعود للبيانات القديمة
      if (context?.previousStudents) {
        queryClient.setQueriesData({ queryKey: ['students'] }, context.previousStudents);
      }
    },
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
    },
    onSettled: () => {
      // تحديث هادئ في الخلفية لتأكيد العملية
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
    // التنفيذ المتفائل: الإضافة للشاشة فوراً قبل رد السيرفر
    onMutate: async (studentData) => {
      await queryClient.cancelQueries({ queryKey: ['students'] });
      const previousStudents = queryClient.getQueryData(['students']);
      
      const tempStudent = {
        id: `temp-${Date.now()}`,
        ...studentData,
        created_at: new Date().toISOString(),
        classes: null,
      };

      queryClient.setQueriesData({ queryKey: ['students'] }, (old: any) => {
        if (!Array.isArray(old)) return [tempStudent];
         // وضع الطالب الجديد في أعلى القائمة
        return [tempStudent, ...old];
      });

      return { previousStudents };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousStudents) {
        queryClient.setQueriesData({ queryKey: ['students'] }, context.previousStudents);
      }
    },
    mutationFn: async (studentData: Omit<Student, 'id' | 'created_at' | 'classes'>) => {
      const { data, error } = await supabase.from('students').insert(studentData).select().single();
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      // استبدال المعرف المؤقت بالحقيفي بصمت
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

// ─── useUpdateStudent Hook ───────────────────────────────────────────────────
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Student> & { id: string }) => {
      // 1. Snapshot previous value for rollback if needed
      const previousStudents = queryClient.getQueryData(['students']);
      
      // 2. Optimistically update the UI
      queryClient.setQueriesData({ queryKey: ['students'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map(s => s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } : s);
      });

      // 3. Perform the actual update with updated_at timestamp
      const { error } = await supabase
        .from('students')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) {
        // Rollback on error
        queryClient.setQueriesData({ queryKey: ['students'] }, previousStudents);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      // Background refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['students'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['student', variables.id], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'], refetchType: 'active' });
    },
  });
}

export function useStudentParent(studentId: string | null | undefined) {
  const queryKey = ['student-parent', studentId];
  
  return useQuery({
    queryKey,
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
    placeholderData: keepPreviousData,
  });
}

export function useClassStudents(classId: string | null | undefined) {
  const queryKey = ['students', 'class', classId];
  
  return useQuery({
    queryKey,
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
    placeholderData: keepPreviousData,
  });
}

