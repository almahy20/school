import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useAdminStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-stats', user?.schoolId, user?.isSuperAdmin],
    queryFn: async () => {
      const emptyStats = { 
        students: 0, teachers: 0, parents: 0, classes: 0, 
        totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0 
      };
      
      if (!user?.isSuperAdmin && !user?.schoolId) return emptyStats;

      const baseQuery = (table: string) => {
        const q = (supabase as any).from(table).select('id', { count: 'exact', head: true });
        if (!user?.isSuperAdmin && user?.schoolId) {
          q.eq('school_id', user.schoolId);
        }
        return q;
      };

      try {
        const [s, t, p, c, f, a] = await Promise.all([
          baseQuery('students'),
          supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId).eq('role', 'teacher'),
          supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId).eq('role', 'parent'),
          baseQuery('classes'),
          supabase.from('fees').select('amount_due, amount_paid').eq('school_id', user.schoolId),
          supabase.from('attendance').select('status').eq('school_id', user.schoolId).eq('date', new Date().toISOString().split('T')[0]),
        ]);

        const totalDue = (f.data || []).reduce((sum: number, fee: any) => sum + (Number(fee.amount_due) || 0), 0);
        const totalPaid = (f.data || []).reduce((sum: number, fee: any) => sum + (Number(fee.amount_paid) || 0), 0);
        
        const attendance = a.data || [];
        const presentToday = attendance.filter((att: any) => att.status === 'present').length;
        const attendanceRate = attendance.length > 0 ? Math.round((presentToday / attendance.length) * 100) : 0;

        return {
          students: s.count || 0,
          teachers: t.count || 0,
          parents: p.count || 0,
          classes: c.count || 0,
          totalDue,
          totalPaid,
          attendanceRate,
          presentToday
        };
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        return emptyStats;
      }
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 30 * 1000,
  });
}

export function useTeacherStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-stats', user?.id, user?.schoolId],
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return { classes: 0, students: 0 };

      const { data: classes } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('teacher_id', user.id);
      
      const myClasses = classes || [];
      if (myClasses.length === 0) return { classes: 0, students: 0 };

      const classIds = myClasses.map(c => c.id);
      const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user.schoolId)
        .in('class_id', classIds);
      
      return {
        classes: myClasses.length,
        students: count || 0
      };
    },
    enabled: !!(user?.id && user?.schoolId && user?.role === 'teacher'),
    staleTime: 5 * 60 * 1000,
  });
}
