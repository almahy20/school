/**
 * Offline-First Mutation Example
 * 
 * هذا الملف يوضح كيفية استخدام نظام Offline-First
 * مع أي mutation في التطبيق
 * 
 * يمكنك تطبيق هذا النمط على جميع الـ mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { enqueueMutation } from '@/lib/offlineQueue';
import { toast } from 'sonner';

/**
 * مثال 1: إنشاء طالب جديد (Offline-First)
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentData: any) => {
      // التحقق من الاتصال
      if (!window.navigator.onLine) {
        // Offline: إضافة إلى الطابور
        console.log('📵 [Offline] Queueing student creation...');
        
        const mutationId = await enqueueMutation(
          'create',
          'students',
          studentData
        );
        
        toast.success('تم حفظ الطالب - سيتم المزامنة عند عودة الاتصال', {
          description: `رقم العملية: ${mutationId}`
        });
        
        return { id: mutationId, offline: true };
      }

      // Online: إرسال مباشرة
      console.log('🌐 [Online] Creating student...');
      const { data, error } = await supabase
        .from('students')
        .insert(studentData)
        .select()
        .single();

      if (error) throw error;
      return { data, offline: false };
    },

    // Optimistic Update - تحديث فوري للـ UI
    onMutate: async (newStudent) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['students'] });

      // Snapshot the previous value
      const previousStudents = queryClient.getQueryData(['students']);

      // Optimistically update the cache
      queryClient.setQueryData(['students'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: [...old.data, { ...newStudent, id: 'temp-' + Date.now() }]
        };
      });

      return { previousStudents };
    },

    // On Error - استرجاع البيانات القديمة
    onError: (err, newStudent, context: any) => {
      console.error('❌ Failed to create student:', err);
      
      // Rollback to previous data
      if (context?.previousStudents) {
        queryClient.setQueryData(['students'], context.previousStudents);
      }

      // Show error only if online
      if (window.navigator.onLine) {
        toast.error('فشل إنشاء الطالب');
      }
    },

    // On Success - إعادة جلب البيانات
    onSuccess: (result) => {
      if (!result.offline) {
        // Invalidate to refresh with real data
        queryClient.invalidateQueries({ queryKey: ['students'] });
        toast.success('تم إنشاء الطالب بنجاح');
      }
    },
  });
}

/**
 * مثال 2: تحديث طالب (Offline-First)
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: any) => {
      if (!window.navigator.onLine) {
        console.log('📵 [Offline] Queueing student update...');
        
        const mutationId = await enqueueMutation(
          'update',
          'students',
          { id, ...updateData }
        );
        
        toast.success('تم حفظ التغييرات - سيتم المزامنة لاحقاً');
        return { id: mutationId, offline: true };
      }

      console.log('🌐 [Online] Updating student...');
      const { data, error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, offline: false };
    },

    // Optimistic Update
    onMutate: async ({ id, ...updateData }) => {
      await queryClient.cancelQueries({ queryKey: ['student', id] });

      const previousStudent = queryClient.getQueryData(['student', id]);

      // Update individual student cache
      queryClient.setQueryData(['student', id], (old: any) => {
        if (!old) return old;
        return { ...old, ...updateData };
      });

      // Also update in the list
      queryClient.setQueryData(['students'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((s: any) => 
            s.id === id ? { ...s, ...updateData } : s
          )
        };
      });

      return { previousStudent };
    },

    onError: (err, variables, context: any) => {
      console.error('❌ Failed to update student:', err);
      
      if (context?.previousStudent) {
        queryClient.setQueryData(['student', variables.id], context.previousStudent);
      }

      if (window.navigator.onLine) {
        toast.error('فشل تحديث الطالب');
      }
    },

    onSuccess: (result, variables) => {
      if (!result.offline) {
        queryClient.invalidateQueries({ queryKey: ['student', variables.id] });
        queryClient.invalidateQueries({ queryKey: ['students'] });
        toast.success('تم تحديث الطالب بنجاح');
      }
    },
  });
}

/**
 * مثال 3: حذف طالب (Offline-First)
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!window.navigator.onLine) {
        console.log('📵 [Offline] Queueing student deletion...');
        
        const mutationId = await enqueueMutation(
          'delete',
          'students',
          { id }
        );
        
        toast.success('تم تحديد الطالب للحذف - سيتم الحذف لاحقاً');
        return { id: mutationId, offline: true };
      }

      console.log('🌐 [Online] Deleting student...');
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { offline: false };
    },

    // Optimistic Update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['students'] });

      const previousStudents = queryClient.getQueryData(['students']);

      // Remove from cache immediately
      queryClient.setQueryData(['students'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((s: any) => s.id !== id)
        };
      });

      return { previousStudents };
    },

    onError: (err, id, context: any) => {
      console.error('❌ Failed to delete student:', err);
      
      if (context?.previousStudents) {
        queryClient.setQueryData(['students'], context.previousStudents);
      }

      if (window.navigator.onLine) {
        toast.error('فشل حذف الطالب');
      }
    },

    onSuccess: (result) => {
      if (!result.offline) {
        queryClient.invalidateQueries({ queryKey: ['students'] });
        toast.success('تم حذف الطالب بنجاح');
      }
    },
  });
}

/**
 * كيفية الاستخدام في Component:
 * يمكنك استيراد هذه الهوكس واستخدامها مثل أي useMutation عادي في React Query.
 */
