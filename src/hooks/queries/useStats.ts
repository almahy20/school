import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';

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

      try {
        // Use optimized SQL aggregate function (single RPC call)
        // Before: 6 parallel queries, ~500KB data transfer
        // After: 1 RPC call, ~100 bytes data transfer
        // NOTE: Requires running migrations: 20260415000002_add_aggregate_functions.sql
        const { data: stats, error } = await (supabase as any)
          .rpc('get_dashboard_stats', {
            p_school_id: user.schoolId,
            p_is_super_admin: user.isSuperAdmin || false
          });
        
        if (error) {
          logger.warn('Dashboard stats RPC not available, using fallback method:', error.message);
          // Fallback to old method if RPC fails (e.g., migration not run yet)
          return await fetchStatsFallback(user);
        }
        
        return stats || emptyStats;
      } catch (error) {
        logger.warn('Error fetching admin stats via RPC, using fallback:', error);
        // Fallback to ensure app works even if migration hasn't been run
        return await fetchStatsFallback(user);
      }
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 10 * 60 * 1000, // 10 دقائق - تقليل إعادة الجلب
    gcTime: 30 * 60 * 1000, // 30 دقيقة
    refetchOnMount: false, // معطل - نعتمد على staleTime
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// Fallback method for backward compatibility
async function fetchStatsFallback(user: any) {
  const emptyStats = { 
    students: 0, teachers: 0, parents: 0, classes: 0, 
    totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0 
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
    supabase.from('attendance').select('status').eq('school_id', user.schoolId).eq('date', new Date().toISOString().split('T')[0]),
  ]);

  // حسابات مباشرة بدون hooks — useMemo لا يعمل خارج React components
  const feeData = f.data || [];
  const totalDue = feeData.reduce((sum: number, fee: any) => sum + (Number(fee.amount_due) || 0), 0);
  const totalPaid = feeData.reduce((sum: number, fee: any) => sum + (Number(fee.amount_paid) || 0), 0);
  
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
    staleTime: 5 * 60 * 1000, // 5 دقائق - تقليل إعادة الجلب
    gcTime: 15 * 60 * 1000, // 15 دقيقة
    refetchOnMount: false, // معطل - نعتمد على staleTime
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

export function useAdminActivities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-activities', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      
      // Optimized: Fetch pending registrations without invalid JOIN
      const [complaints, rolesRawRes, payments] = await Promise.all([
        supabase.from('complaints').select('id, content, created_at, status').eq('school_id', user.schoolId).order('created_at', { ascending: false }).limit(5),
        supabase.from('user_roles').select('id, created_at, approval_status, user_id').eq('school_id', user.schoolId).eq('approval_status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('fee_payments').select('id, amount, payment_date, fees(student_id, students(name))').eq('school_id', user.schoolId).order('payment_date', { ascending: false }).limit(5),
      ]);

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

      // Handle roles join manually to fix 400 error
      const rolesData = rolesRawRes.data || [];
      if (rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        rolesData.forEach((r: any) => {
          const profile = (profiles || []).find(p => p.id === r.user_id);
          const fullName = profile?.full_name || 'غير معروف';
          activities.push({
            id: r.id,
            type: 'registration',
            title: 'طلب انضمام جديد',
            description: `المستخدم: ${fullName}`,
            date: r.created_at,
            status: r.approval_status
          });
        });
      }

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
    staleTime: 3 * 60 * 1000, // 3 دقائق - تقليل إعادة الجلب
    gcTime: 10 * 60 * 1000, // 10 دقائق
    refetchOnMount: false, // معطل - نعتمد على staleTime
  });
}
