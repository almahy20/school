import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';
import { enqueueMutation } from '@/lib/offlineQueue';
import { toast } from 'sonner';
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
async function fetchStudents(
  user: AppUser | null,
  page = 1,
  pageSize = 15,
  search = '',
  className = 'الكل'
): Promise<{ data: Student[]; count: number }> {
  if (!user?.isSuperAdmin && !user?.schoolId) return { data: [], count: 0 };

  let teacherClassIds: string[] = [];
  if (user.role === 'teacher') {
    const { data: teacherClasses } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', user.id);
    
    if (teacherClasses && teacherClasses.length > 0) {
      teacherClassIds = teacherClasses.map(c => c.id);
    } else {
      return { data: [], count: 0 };
    }
  }

  // نحسن الاستعلام باختيار الأعمدة المطلوبة فقط واستخدام التجزئة في قاعدة البيانات
  let q = supabase
    .from('students')
    .select('id, name, class_id, parent_phone, school_id, created_at, classes(id, name, grade_level)', { count: 'exact' });

  if (!user.isSuperAdmin && user.schoolId) {
    q = q.eq('school_id', user.schoolId);
  }
  
  if (user.role === 'teacher' && teacherClassIds.length > 0) {
    q = q.in('class_id', teacherClassIds);
  }

  // إضافة البحث من جهة الخادم
  if (search) {
    q = q.ilike('name', `%${search}%`);
  }

  // إضافة فلترة الفصل من جهة الخادم
  if (className !== 'الكل') {
    q = q.filter('classes.name', 'eq', className);
  }

  // إضافة التجزئة (Pagination)
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  const { data, error, count } = await q
    .order('name')
    .range(from, to);

  if (error) throw error;
  return { data: (data || []) as Student[], count: count || 0 };
}

// ─── useStudents Hook ─────────────────────────────────────────────────────────
export function useStudents(page = 1, pageSize = 15, search = '', className = 'الكل') {
  const { user } = useAuth();
  
  // تضمين البارامترات في الـ queryKey لضمان التحديث عند تغيير الصفحة أو البحث
  const queryKey = ['students', user?.schoolId, page, pageSize, search, className];
  
  return useQuery({
    queryKey,
    queryFn: () => fetchStudents(user, page, pageSize, search, className),
    enabled: !!user?.id, 
    // ⚡ SPEED: Reduce from 0 to 5s - prevents excessive refetching
    staleTime: 2 * 60 * 1000, // 2 minutes - professional app
    gcTime: 5 * 60 * 1000, // Reduce from 15min to 5min
            refetchOnMount: true,
    placeholderData: keepPreviousData,
    // ⚡ SPEED: Reduce retry from 3 to 2 for faster failure
    retry: 2,
    // ⚡ SPEED: Faster retry delays (0.5s, 1s instead of 1s, 2s)
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
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
      
      // Add timeout to prevent hanging requests
      const queryPromise = supabase
        .from('students')
        .select('*, classes:classes!students_class_id_fkey(*)')
        .eq('id', id)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout: Student data fetch took too long')), 10000)
      );
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (error) throw error;
      
      // Fetch teacher name separately if teacher_id exists
      if (data?.classes?.teacher_id) {
        const teacherPromise = supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.classes.teacher_id)
          .maybeSingle();
        
        const teacherTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Teacher fetch timeout')), 5000)
        );
        
        try {
          const { data: teacherProfile } = await Promise.race([teacherPromise, teacherTimeout]) as any;
          
          if (teacherProfile) {
            (data.classes as any).teacher = { full_name: teacherProfile.full_name };
          }
        } catch (teacherError) {
          console.warn('Failed to fetch teacher name, continuing without it:', teacherError);
        }
      }
      
      return data as Student & { classes: any };
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds - reduced from 0
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disable auto-refetch to prevent stuck states
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true, // ✅ Refetch when network reconnects
    networkMode: 'online', // ✅ Only fetch when online
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
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
      // Offline-first: queue if offline
      if (!window.navigator.onLine) {
        const mutationId = await enqueueMutation('delete', 'students', { id: studentId });
        toast.success('تم تحديد الطالب للحذف - سيتم الحذف عند عودة الاتصال');
        return { id: mutationId, offline: true };
      }

      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      return { offline: false };
    },
    onSuccess: (result) => {
      if (!result?.offline) {
        toast.success('تم حذف الطالب بنجاح');
      }
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
      // Offline-first: queue if offline
      if (!window.navigator.onLine) {
        const mutationId = await enqueueMutation('create', 'students', studentData);
        toast.success('تم حفظ الطالب - سيتم المزامنة عند عودة الاتصال');
        return { id: `temp-${Date.now()}`, offline: true };
      }

      const { data, error } = await supabase.from('students').insert(studentData).select().single();
      if (error) throw error;
      return { ...data, offline: false };
    },
    onSuccess: (result) => {
      if (!result?.offline) {
        toast.success('تم إضافة الطالب بنجاح');
      }
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
      // Offline-first: queue if offline
      if (!window.navigator.onLine) {
        const mutationId = await enqueueMutation('update', 'students', { id, ...data });
        toast.success('تم حفظ التغييرات - سيتم المزامنة عند عودة الاتصال');
        return { id: mutationId, offline: true };
      }

      // 1. Snapshot previous value for rollback if needed
      const previousStudents = queryClient.getQueryData(['students']);
      
      // 2. Optimistically update the UI
      queryClient.setQueriesData({ queryKey: ['students'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map(s => s.id === id ? { ...s, ...data } : s);
      });

      // 3. Perform the actual update
      const { error } = await supabase
        .from('students')
        .update({ ...data })
        .eq('id', id);
        
      if (error) {
        // Rollback on error
        queryClient.setQueriesData({ queryKey: ['students'] }, previousStudents);
        throw error;
      }

      return { offline: false };
    },
    onSuccess: (result, variables) => {
      // Background refetch to ensure consistency
      if (!result?.offline) {
        queryClient.invalidateQueries({ queryKey: ['students'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['student', variables.id], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['child-full-details'], refetchType: 'active' });
        toast.success('تم تحديث الطالب بنجاح');
      }
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
        .maybeSingle();
      
      // Handle missing profile gracefully
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
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

