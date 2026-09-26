import { useMemo } from 'react';
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
  student_parents?: { parent_id: string }[];
}

import {
  normalizeArabic,
  normalizeStudentName,
  buildArabicSearchPatterns,
  matchesArabic,
} from '@/utils/arabicSearch';

export { normalizeArabic, normalizeStudentName, buildArabicSearchPatterns, matchesArabic };

// ─── useAllStudents Hook (Lightweight cached fetch for count/mapping) ────────
export function useAllStudents() {
  const { user, session } = useAuth();
  
  const queryKey = ['students', 'all', user?.schoolId, user?.role, user?.id];
  
  return useQuery({
    queryKey,
    queryFn: async (): Promise<Student[]> => {
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
          return [];
        }
      }

      // ✅ FIX: Only fetch core columns without heavy relations
      let q = supabase
        .from('students')
        .select('id, name, class_id, parent_phone, school_id, monthly_fee, created_at');

      if (!user.isSuperAdmin && user.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }
      if (user.role === 'teacher' && teacherClassIds.length > 0) {
        q = q.in('class_id', teacherClassIds);
      }

      const { data, error } = await q.order('name');
      if (error) throw error;
      return (data || []) as Student[];
    },
    enabled: !!(user?.id && (user?.schoolId || user?.isSuperAdmin)),
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// ─── useStudents Hook (Server-Side Paginated, Filtered & Searched) ───────────
export function useStudents(page = 1, pageSize = 15, search = '', classId = 'الكل') {
  const { user, session } = useAuth();
  const cleanSearch = search.trim();
  const queryKey = [
    'students',
    'list',
    user?.schoolId,
    user?.role,
    user?.id,
    page,
    pageSize,
    cleanSearch,
    classId,
  ];

  return useQuery<{ data: Student[]; count: number }>({
    queryKey,
    queryFn: async () => {
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

      // ✅ FIX: Select only needed columns for the page + count: exact
      let q = supabase
        .from('students')
        .select('id, name, class_id, parent_phone, school_id, created_at, classes(id, name, grade_level)', { count: 'exact' });

      if (!user.isSuperAdmin && user.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }
      if (user.role === 'teacher' && teacherClassIds.length > 0) {
        q = q.in('class_id', teacherClassIds);
      }

      // 1. Server-side filter by class
      if (classId === 'بدون_فصل') {
        q = q.is('class_id', null);
      } else if (classId !== 'الكل' && classId !== 'بدون_ولي_امر') {
        q = q.eq('class_id', classId);
      }

      // 2. Server-side filter by search (Name or Phone)
      if (cleanSearch) {
        const cleanPhone = cleanSearch.replace(/\D/g, '');
        if (cleanPhone && cleanPhone.length >= 3) {
          q = q.or(`name.ilike.%${cleanSearch}%,parent_phone.ilike.%${cleanPhone}%`);
        } else {
          q = q.ilike('name', `%${cleanSearch}%`);
        }
      }

      // 3. Server-side pagination via .range()
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await q.order('name').range(from, to);
      if (error) throw error;

      return {
        data: (data || []) as Student[],
        count: count || 0,
      };
    },
    enabled: !!(session && (user?.schoolId || user?.isSuperAdmin)),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

// ─── useStudent Hook ──────────────────────────────────────────────────────────
export function useStudent(id: string | undefined) {
  const { user } = useAuth();
  const queryKey = ['student', id, user?.schoolId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      
      let q = supabase
        .from('students')
        .select(`
          id, name, class_id, school_id, parent_phone, monthly_fee, created_at, grade_level,
          classes:classes!students_class_id_fkey (
            id, name, grade_level, school_id, teacher_id, curriculum_id,
            teacher:profiles!classes_teacher_id_fkey(full_name)
          )
        `)
        .eq('id', id);

      if (user?.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }

      const { data: student, error: sError } = await q.maybeSingle();

      if (sError) throw sError;
      if (!student) return null;
      
      return student as Student & { classes: any };
    },

    enabled: !!id && !!(user?.schoolId || user?.isSuperAdmin),
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
      // ✅ FIX: Reduced from 12 to 5 invalidations — Realtime covers cross-table updates
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parent-children-basic'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['student-parent'], exact: false });
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
      // ✅ FIX: Reduced from 7 to 3 invalidations — classes/fees/parent-children are not
      //    immediately affected by adding a student; Realtime covers any side effects
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
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

      // ✅ FIX: Reduced from 6 to 2 invalidations — direct setQueriesData above already
      //    handles students, student, and child-full-details cache. Only stats and
      //    parent-children need server re-validation (Realtime covers other cross-table updates).
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parent-children-basic'], exact: false });
      
      toast.success('تم تحديث بيانات الطالب بنجاح');
    },
    onError: (err: any) => {
      toast.error('فشل تحديث بيانات الطالب', { description: err.message });
    },
  });
}


export function useStudentParent(studentId: string | null | undefined) {
  const { user } = useAuth();
  const queryKey = ['student-parent', studentId, user?.schoolId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!studentId) return null;
      let pLinkQuery = supabase
        .from('student_parents')
        .select('parent_id')
        .eq('student_id', studentId);

      if (user?.schoolId) {
        pLinkQuery = pLinkQuery.eq('school_id', user.schoolId);
      }

      const { data: parentLink } = await pLinkQuery.maybeSingle();

      if (!parentLink?.parent_id) return null;

      let profQuery = supabase
        .from('profiles')
        .select('id, full_name, phone, email, created_at, school_id')
        .eq('id', parentLink.parent_id);

      if (user?.schoolId) {
        profQuery = profQuery.eq('school_id', user.schoolId);
      }

      const { data: parentProfile, error } = await profQuery.maybeSingle();
      
      // Handle missing profile gracefully
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return parentProfile;
    },
    enabled: !!studentId && !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function useClassStudents(classId: string | null | undefined) {
  const { user } = useAuth();
  const queryKey = ['students', 'class', classId, user?.schoolId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!classId) return [];
      let q = supabase
        .from('students')
        .select('id, name, class_id, parent_phone, school_id, created_at')
        .eq('class_id', classId);

      if (user?.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }

      const { data, error } = await q.order('name').limit(200); // حد أمان: لا مدرسة لديها أكثر من 200 طالب في فصل واحد
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classId && !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

