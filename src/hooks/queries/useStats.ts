import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';

export function useAdminStats() {
  const { user, session } = useAuth();
  const queryKey = useMemo(() => ['admin-stats', user?.schoolId, user?.isSuperAdmin], [user?.schoolId, user?.isSuperAdmin]);

            
  return useQuery({
    queryKey,
    queryFn: async () => {
      const emptyStats = { 
        students: 0, teachers: 0, parents: 0, classes: 0, 
        totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0, absentToday: 0 
      };
      
      if (!user?.isSuperAdmin && !user?.schoolId) return emptyStats;

      try {
        const { data: stats, error } = await (supabase as any)
          .rpc('get_dashboard_stats', {
            p_school_id: user.schoolId,
            p_is_super_admin: user.isSuperAdmin || false
          });
        
        if (error) {
          logger.warn('Dashboard stats RPC not available, using fallback method:', error.message);
          return await fetchStatsFallback(user);
        }
        
        return stats || emptyStats;
      } catch (error) {
        logger.warn('Error fetching admin stats via RPC, using fallback:', error);
        return await fetchStatsFallback(user);
      }
    },
    enabled: !!(session && (user?.schoolId || user?.isSuperAdmin)),
    staleTime: 2 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// Fallback method for backward compatibility
async function fetchStatsFallback(user: any) {
  const emptyStats = { 
    students: 0, teachers: 0, parents: 0, classes: 0, 
    totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0, absentToday: 0 
  };

  const baseQuery = (table: string) => {
    const q = (supabase as any).from(table).select('id', { count: 'exact', head: true });
    if (!user?.isSuperAdmin && user?.schoolId) {
      q.eq('school_id', user.schoolId);
    }
    return q;
  };

  const [s, t, p, c, f, a] = await Promise.all([
    baseQuery('students'),
    supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId).eq('role', 'teacher'),
    supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId).eq('role', 'parent'),
    baseQuery('classes'),
    supabase.from('fees').select('amount_due, amount_paid').eq('school_id', user.schoolId),
    supabase.from('attendance').select('status, student_id').eq('school_id', user.schoolId).eq('date', new Date().toLocaleDateString('en-CA')),
  ]);

  // حسابات مباشرة بدون hooks — useMemo لا يعمل خارج React components
  const feeData = f.data || [];
  const totalDue = feeData.reduce((sum: number, fee: any) => sum + (Number(fee.amount_due) || 0), 0);
  const totalPaid = feeData.reduce((sum: number, fee: any) => sum + (Number(fee.amount_paid) || 0), 0);
  
  const attendance = a.data || [];
  // استخدام Set للحصول على معرفات الطلاب الفريدين لتجنب التكرار في حال تم رصد الحضور أكثر من مرة
  const presentStudentIds = new Set(attendance.filter((att: any) => att.status === 'present' || att.status === 'late').map((att: any) => att.student_id));
  const absentStudentIds = new Set(attendance.filter((att: any) => att.status === 'absent').map((att: any) => att.student_id));
  
  const presentToday = presentStudentIds.size;
  const absentToday = absentStudentIds.size;
  const totalStudents = s.count || 0;
  const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

  return {
    students: totalStudents,
    teachers: t.count || 0,
    parents: p.count || 0,
    classes: c.count || 0,
    totalDue,
    totalPaid,
    attendanceRate,
    presentToday,
    absentToday
  };
}

export function useTeacherStats() {
  const { user, session } = useAuth();
  const queryKey = useMemo(() => ['teacher-stats', user?.id, user?.schoolId], [user?.id, user?.schoolId]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const emptyStats = { students: 0, classes: 0, attendanceRate: 0 };
      if (!user?.id || !user?.schoolId) return emptyStats;

      const { data, error } = await (supabase as any).rpc('get_teacher_dashboard_stats', {
        p_teacher_id: user.id,
        p_school_id: user.schoolId
      });

      if (error) throw error;
      return data || emptyStats;
    },
    enabled: !!(session && user?.id && user?.schoolId && user?.role === 'teacher'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminActivities() {
  const { user, session } = useAuth();
  return useQuery({
    queryKey: ['admin-activities', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      
      const { data, error } = await (supabase as any).rpc('get_admin_dashboard_activities', {
        p_school_id: user.schoolId
      });

      if (error) {
        logger.error('Error fetching admin activities via RPC:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!(session && user?.schoolId && user?.role === 'admin'),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
