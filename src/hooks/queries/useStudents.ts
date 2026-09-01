import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';
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

// ─── Arabic text normalizer ───────────────────────────────────────────────────
// يحوّل أحرف Unicode المتشابهة بصرياً لشكل موحّد:
//   - ی فارسي (U+06CC) → ي عربي (U+064A)
//   - ك أردية (U+06A9) → ك عربية (U+0643)
//   - ة → ه  |  أ إ آ ء ؤ ئ → ا / و / ي
//   - يزيل التشكيل
export function normalizeArabic(text: string): string {
  return text
    .replace(/\u06CC/g, '\u064A')   // ی فارسي → ي
    .replace(/\u06A9/g, '\u0643')   // ك أردية → ك
    .replace(/[أإآءؤئ]/g, 'ا')     // همزات → ا  (للبحث فقط)
    .replace(/ة/g, 'ه')
    .replace(/ى/g, '\u064A')        // ى → ي
    .replace(/[\u064B-\u0652\u0670]/g, '') // حذف التشكيل
    .trim();
}

// نسخة للأسماء المدخلة — تحافظ على الهمزات وتُوحّد فقط Unicode المشابه
export function normalizeStudentName(text: string): string {
  return text
    .replace(/\u06CC/g, '\u064A')   // ی فارسي → ي
    .replace(/\u06A9/g, '\u0643')   // ك أردية → ك
    .replace(/[\u064B-\u0652\u0670]/g, '') // حذف التشكيل
    .replace(/\s+/g, ' ')
    .trim();
}

// يبني كل variants ممكنة للكلمة (مع/بدون تطبيع) ليشمل الحالتين في ilike
function buildArabicSearchPatterns(search: string): string[] {
  const normalized = normalizeArabic(search);
  const patterns = new Set<string>();
  patterns.add(search);
  patterns.add(normalized);
  // أيضاً: ه → ة و ي → ى (العكس)
  patterns.add(search.replace(/ه/g, 'ة').replace(/ي/g, 'ى'));
  patterns.add(search.replace(/ه/g, 'ة'));
  patterns.add(search.replace(/ي/g, 'ى'));
  return Array.from(patterns).filter(Boolean);
}

// ─── Fetch function ───────────────────────────────────────────────────────────
async function fetchStudents(
  user: AppUser | null,
  page = 1,
  pageSize = 15,
  search = '',
  classId = 'الكل'  // الآن نستقبل classId بدل className
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

  // ── فلتر "بدون ولي أمر" — يحتاج subquery منفصل ──
  if (classId === 'بدون_ولي_امر') {
    // جلب كل الطلاب اللي عندهم ربط في student_parents
    const { data: linked } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('school_id', user.schoolId || '');
    const linkedIds = (linked || []).map((l: any) => l.student_id).filter(Boolean);

    let q = supabase
      .from('students')
      .select('id, name, class_id, parent_phone, school_id, created_at, classes(id, name, grade_level)', { count: 'exact' });

    if (!user.isSuperAdmin && user.schoolId) q = q.eq('school_id', user.schoolId);
    if (user.role === 'teacher' && teacherClassIds.length > 0) q = q.in('class_id', teacherClassIds);

    // الطلاب اللي مش موجودين في student_parents
    if (linkedIds.length > 0) {
      q = q.not('id', 'in', `(${linkedIds.map(id => `"${id}"`).join(',')})`);
    }

    if (search.trim()) {
      const patterns = buildArabicSearchPatterns(search.trim());
      const orFilter = patterns.map(p => `name.ilike.%${p}%`).join(',');
      q = q.or(orFilter);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await q.order('name').range(from, to);
    if (error) throw error;
    return { data: (data || []) as Student[], count: count || 0 };
  }

  let q = supabase
    .from('students')
    .select('id, name, class_id, parent_phone, school_id, created_at, classes(id, name, grade_level)', { count: 'exact' });

  if (!user.isSuperAdmin && user.schoolId) {
    q = q.eq('school_id', user.schoolId);
  }
  
  if (user.role === 'teacher' && teacherClassIds.length > 0) {
    q = q.in('class_id', teacherClassIds);
  }

  // ── فلتر الفصل (server-side) ──
  if (classId === 'بدون_فصل') {
    q = q.is('class_id', null);
  } else if (classId !== 'الكل') {
    q = q.eq('class_id', classId);
  }

  // ── البحث مع دعم ة/ه و ى/ي (server-side) ──
  if (search.trim()) {
    const patterns = buildArabicSearchPatterns(search.trim());
    const orFilter = patterns.map(p => `name.ilike.%${p}%`).join(',');
    q = q.or(orFilter);
  }

  // ── Pagination ──
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  const { data, error, count } = await q
    .order('name')
    .range(from, to);

  if (error) throw error;
  return { data: (data || []) as Student[], count: count || 0 };
}

// ─── useStudents Hook ─────────────────────────────────────────────────────────
export function useStudents(page = 1, pageSize = 15, search = '', classId = 'الكل') {
  const { user, session } = useAuth();
  
  const queryKey = ['students', user?.schoolId, page, pageSize, search, classId];
  
  return useQuery({
    queryKey,
    queryFn: () => fetchStudents(user, page, pageSize, search, classId),
    enabled: !!(session && user?.id), 
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// ─── useStudent Hook ──────────────────────────────────────────────────────────
export function useStudent(id: string | undefined) {
  const queryKey = ['student', id];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      
      const { data: student, error: sError } = await supabase
        .from('students')
        .select(`
          *,
          classes:classes!students_class_id_fkey (
            *,
            teacher:profiles!classes_teacher_id_fkey(full_name)
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (sError) throw sError;
      if (!student) return null;
      
      return student as Student & { classes: any };
    },

    enabled: !!id,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}


// ─── useDeleteStudent Hook ────────────────────────────────────────────────────
export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;

      // Log action to audit logs
      await (supabase as any).rpc('log_action', {
        p_action: 'DELETE_STUDENT',
        p_entity_type: 'students',
        p_entity_id: studentId,
        p_details: `حذف الطالب نهائياً من النظام`
      });
    },
    // ✅ Optimization: Optimistic Update
    onMutate: async (studentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['students'] });

      // Snapshot previous value
      const previousStudents = queryClient.getQueryData(['students']);

      // Optimistically update
      queryClient.setQueriesData({ queryKey: ['students'] }, (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.filter((s: any) => s.id !== studentId),
          count: Math.max(0, (old.count || 0) - 1)
        };
      });

      return { previousStudents };
    },
    onError: (err, studentId, context) => {
      if (context?.previousStudents) {
        queryClient.setQueryData(['students'], context.previousStudents);
      }
      toast.error('فشل حذف الطالب');
    },
    onSuccess: () => {
      toast.success('تم حذف الطالب بنجاح');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['student'], exact: false });
      // Also invalidate stats since student count changed
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}


// ─── useAddStudent Hook ───────────────────────────────────────────────────────
export function useAddStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentData: Omit<Student, 'id' | 'created_at' | 'classes'>) => {
      const normalized = { ...studentData, name: normalizeStudentName(studentData.name) };
      const { data, error } = await supabase.from('students').insert(normalized).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم إضافة الطالب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}


// ─── useUpdateStudent Hook ───────────────────────────────────────────────────
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Student> & { id: string }) => {
      const normalized = {
        ...updates,
        ...(updates.name ? { name: normalizeStudentName(updates.name) } : {}),
      };
      const { data, error } = await supabase
        .from('students')
        .update(normalized)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log action to audit logs (safely handled)
      try {
        await (supabase as any).rpc('log_action', {
          p_action: 'UPDATE_STUDENT',
          p_entity_type: 'students',
          p_entity_id: id,
          p_details: `تحديث بيانات الطالب: ${Object.keys(updates).join(', ')}`
        });
      } catch {
        // audit log is non-critical — ignore failures
      }

      return data as Student;
    },
    onSuccess: (updatedData, variables) => {
      // 1. Direct synchronous cache update for list queries
      queryClient.setQueriesData({ queryKey: ['students'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map(s => s.id === variables.id ? { ...s, ...updatedData } : s);
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((s: any) => s.id === variables.id ? { ...s, ...updatedData } : s),
          };
        }
        return old;
      });

      // 2. Direct cache update for single student query
      queryClient.setQueryData(['student', variables.id], (old: any) => {
        if (!old) return updatedData;
        return { ...old, ...updatedData };
      });

      // 3. Direct cache update for child full details query
      queryClient.setQueriesData({ queryKey: ['child-full-details', variables.id] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          name: updatedData?.name || old.name,
          class_id: updatedData?.class_id !== undefined ? updatedData.class_id : old.class_id,
          parent_phone: updatedData?.parent_phone !== undefined ? updatedData.parent_phone : old.parent_phone,
          classes: updatedData?.classes || old.classes,
        };
      });

      // 4. Invalidate all related student & class queries
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['student'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parent-children'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
      
      toast.success('تم تحديث بيانات الطالب بنجاح');
    },
    onError: (err: any) => {
      toast.error('فشل تحديث بيانات الطالب', { description: err.message });
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
        .select('id, full_name, phone, email, created_at, school_id')
        .eq('id', parentLink.parent_id)
        .maybeSingle();
      
      // Handle missing profile gracefully
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return parentProfile;
    },
    enabled: !!studentId,
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
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
        .select('id, name, class_id, parent_phone, school_id, created_at')
        .eq('class_id', classId)
        .order('name')
        .limit(200); // حد أمان: لا مدرسة لديها أكثر من 200 طالب في فصل واحد
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classId,
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

