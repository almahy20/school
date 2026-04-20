import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export function useParentChildren() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['parent-children', user?.id, user?.schoolId], [user?.id, user?.schoolId]);

            
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return [];
      
      // ✅ Optimization: ONE single RPC call for everything
      // This eliminates the "Waterfall Effect" and reduces requests by 100%
      const { data, error } = await (supabase as any).rpc('get_parent_dashboard_summary', { 
        p_parent_id: user.id,
        p_school_id: user.schoolId 
      });
      
      if (error) {
        console.error('Error fetching parent dashboard summary:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!(user?.id && user?.schoolId && user?.role === 'parent'),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useParentChildOverview(studentId: string | undefined) {
  const queryKey = useMemo(() => ['parent-child-overview', studentId], [studentId]);
    
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await (supabase as any).rpc('get_child_overview', { p_student_id: studentId });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useParentChildActivities(studentId: string | undefined) {
  const queryKey = useMemo(() => ['parent-child-activities', studentId], [studentId]);
      
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await (supabase as any).rpc('get_child_activities', { p_student_id: studentId });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useChildFullDetails(studentId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['child-full-details', studentId],
    queryFn: async () => {
      if (!studentId || !user?.schoolId) return null;

      // ✅ Optimization: ONE single RPC call for everything on the detail page
      // This replaces 6 separate requests for students, grades, attendance, fees, payments, curriculum
      const { data, error } = await (supabase as any).rpc('get_child_full_details', { 
        p_student_id: studentId,
        p_school_id: user.schoolId 
      });

      if (error) {
        console.error('Error fetching child full details:', error);
        throw error;
      }

      if (!data) return null;

      const { student, grades, attendance, fees, payments, curriculum } = data;

      const presentCount = (attendance || []).filter((a: any) => a.status === 'present').length;
      
      const numericGrades = (grades || []).filter((g: any) => !isNaN(Number(g.score)));
      const avgGrade = numericGrades.length > 0
        ? Math.round(numericGrades.reduce((sum: number, g: any) => sum + (Number(g.score) / g.max_score) * 100, 0) / numericGrades.length)
        : 0;

      const totalDue = (fees || []).reduce((sum: number, f: any) => sum + (Number(f.amount_due) || 0), 0);
      const totalPaid = (fees || []).reduce((sum: number, f: any) => sum + (Number(f.amount_paid) || 0), 0);

      return {
        ...student,
        grades: grades || [],
        attendance: attendance || [],
        fees: fees || [],
        payments: payments || [],
        curriculum: curriculum || [],
        summary: {
          avgGrade,
          attendanceRate: (attendance || []).length > 0 ? Math.round((presentCount / (attendance || []).length) * 100) : 0,
          feesRemaining: Math.max(0, totalDue - totalPaid)
        }
      };
    },
    enabled: !!(studentId && user?.schoolId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

