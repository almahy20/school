import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export function useAdminStats() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['admin-stats', user?.schoolId, user?.isSuperAdmin], [user?.schoolId, user?.isSuperAdmin]);

            
  return useQuery({
    queryKey,
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
    staleTime: 60 * 1000, // إحصائيات لوحة التحكم لا تحتاج للتحديث كل ثانية
    gcTime: 15 * 60 * 1000,
  });
}

export function useTeacherStats() {
  const { user } = useAuth();
  const queryKey = ['teacher-stats', user?.id, user?.schoolId];

    
  return useQuery({
    queryKey,
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

export function useAdminActivities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-activities', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      
      const [complaints, rolesRes, payments] = await Promise.all([
        supabase.from('complaints').select('id, content, created_at, status').eq('school_id', user.schoolId).order('created_at', { ascending: false }).limit(5),
        (supabase as any).from('user_roles').select('id, created_at, approval_status, user_id').eq('school_id', user.schoolId).eq('approval_status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('fee_payments').select('id, amount, payment_date, fees(student_id, students(name))').eq('school_id', user.schoolId).order('payment_date', { ascending: false }).limit(5),
      ]);

      const userIds = (rolesRes.data || []).map((r: any) => r.user_id).filter(Boolean);
      const profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        if (profs) {
          profs.forEach(p => { profilesMap[p.id] = p.full_name; });
        }
      }

      const activities: any[] = [];

      (complaints.data || []).forEach((c: any) => {
        activities.push({
          id: c.id,
          type: 'complaint',
          title: 'شكوى جديدة',
          description: c.content.length > 60 ? c.content.substring(0, 60) + '...' : c.content,
          date: c.created_at,
          status: c.status
        });
      });

      (rolesRes.data || []).forEach((r: any) => {
        activities.push({
          id: r.id,
          type: 'registration',
          title: 'طلب انضمام جديد',
          description: `المستخدم: ${profilesMap[r.user_id] || 'غير معروف'}`,
          date: r.created_at,
          status: r.approval_status
        });
      });

      (payments.data || []).forEach((p: any) => {
        const fee = Array.isArray(p.fees) ? p.fees[0] : p.fees;
        const studentName = fee?.students?.name || 'غير معروف';
        
        activities.push({
          id: p.id,
          type: 'payment',
          title: 'تم دفع رسوم',
          description: `المبلغ: ${p.amount} ج.م للطالب ${studentName}`,
          date: p.payment_date,
          status: 'success'
        });
      });

      return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

    },
    enabled: !!user?.schoolId && user?.role === 'admin',
    staleTime: 60 * 1000,
  });
}
