import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';

export interface DashboardStats {
  students: number;
  teachers: number;
  parents: number;
  classes: number;
  totalDue: number;
  totalPaid: number;
  attendanceRate: number;
  presentToday: number;
  absentToday: number;
}

export interface DashboardActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  status: string;
}

export function useAdminDashboardSummary() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['admin-dashboard-summary', user?.schoolId, user?.id], [user?.schoolId, user?.id]);

  return useQuery<{ stats: DashboardStats; activities: DashboardActivity[] }>({
    queryKey,
    queryFn: async () => {
      const emptyStats: DashboardStats = {
        students: 0, teachers: 0, parents: 0, classes: 0,
        totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0, absentToday: 0
      };

      if (!user?.schoolId || !user?.id) {
        return { stats: emptyStats, activities: [] };
      }

      // 1. استدعاء الدالة المدمجة الجديدة أولاً (طلب شبكة واحد يجمع الإحصائيات والأنشطة)
      try {
        const { data, error } = await (supabase as any).rpc('get_admin_dashboard_summary', {
          p_school_id: user.schoolId,
          p_caller_id: user.id
        });

        if (!error && data && data.stats) {
          const stats = data.stats as DashboardStats;
          const activities = (data.activities || []) as DashboardActivity[];

          // تحديث مفاتيح الكاش الفرعية للتوافق مع أي مكونات قد تستخدمها
          queryClient.setQueryData(['admin-stats', user.schoolId, user.isSuperAdmin], stats);
          queryClient.setQueryData(['admin-activities', user.schoolId, user.id], activities);

          return { stats, activities };
        }
        logger.warn('[useAdminDashboardSummary] Combined RPC failed, falling back to legacy RPCs:', error?.message);
      } catch (err) {
        logger.warn('[useAdminDashboardSummary] Combined RPC threw, falling back to legacy RPCs:', err);
      }

      // 2. Fallback: استدعاء الدالتين القديمتين بالتوازي
      const [statsRes, activitiesRes] = await Promise.all([
        (supabase as any).rpc('get_dashboard_stats', {
          p_school_id: user.schoolId,
          p_is_super_admin: user.isSuperAdmin || false
        }).then((res: any) => res.data).catch(() => null),
        (supabase as any).rpc('get_admin_dashboard_activities', {
          p_school_id: user.schoolId,
          p_caller_id: user.id
        }).then((res: any) => res.data).catch(() => [])
      ]);

      const finalStats = statsRes || await fetchStatsFallback(user);
      const finalActivities = (activitiesRes || []) as DashboardActivity[];

      queryClient.setQueryData(['admin-stats', user.schoolId, user.isSuperAdmin], finalStats);
      queryClient.setQueryData(['admin-activities', user.schoolId, user.id], finalActivities);

      return {
        stats: finalStats,
        activities: finalActivities
      };
    },
    enabled: !!(session && user?.schoolId && user?.id && (user?.role === 'admin' || user?.isSuperAdmin)),
    staleTime: 3 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

export function useAdminStats() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['admin-stats', user?.schoolId, user?.isSuperAdmin], [user?.schoolId, user?.isSuperAdmin]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const emptyStats: DashboardStats = { 
        students: 0, teachers: 0, parents: 0, classes: 0, 
        totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0, absentToday: 0 
      };
      
      if (!user?.isSuperAdmin && !user?.schoolId) return emptyStats;

      // فحص كاش الدالة المدمجة أولاً
      const summaryCache = queryClient.getQueryData<{ stats: DashboardStats }>(['admin-dashboard-summary', user?.schoolId, user?.id]);
      if (summaryCache?.stats) return summaryCache.stats;

      // تجربة الدالة المدمجة الجديدة
      try {
        const { data, error } = await (supabase as any).rpc('get_admin_dashboard_summary', {
          p_school_id: user.schoolId,
          p_caller_id: user.id
        });
        if (!error && data?.stats) {
          if (data.activities) {
            queryClient.setQueryData(['admin-activities', user.schoolId, user.id], data.activities);
          }
          return data.stats;
        }
      } catch { /* ignore and use legacy fallback */ }

      // Fallback: الدالة القديمة get_dashboard_stats
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
    staleTime: 3 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// Fallback method — uses aggregate queries only (no full table scans)
async function fetchStatsFallback(user: any) {
  const emptyStats = { 
    students: 0, teachers: 0, parents: 0, classes: 0, 
    totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0, absentToday: 0 
  };

  const schoolFilter = !user?.isSuperAdmin && user?.schoolId;
  const today = new Date().toLocaleDateString('en-CA');

  // استخدام count فقط بدون جلب كل البيانات
  const [s, t, p, c, feeAgg, presAgg, absAgg] = await Promise.all([
    supabase.from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', user.schoolId),

    supabase.from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', user.schoolId)
      .eq('role', 'teacher'),

    supabase.from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', user.schoolId)
      .eq('role', 'parent'),

    supabase.from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', user.schoolId),

    // مجموع الرسوم — aggregate بدون جلب كل الصفوف
    (supabase as any).rpc('get_fees_summary', { p_school_id: user.schoolId })
      .maybeSingle(),

    // عدد الحاضرين فقط
    supabase.from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', user.schoolId)
      .eq('date', today)
      .eq('status', 'present'),

    // عدد الغائبين فقط
    supabase.from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', user.schoolId)
      .eq('date', today)
      .eq('status', 'absent'),
  ]);

  const presentToday = presAgg.count || 0;
  const absentToday  = absAgg.count  || 0;
  const totalStudents = s.count || 0;
  const attendanceRate = totalStudents > 0
    ? Math.round((presentToday / totalStudents) * 100)
    : 0;

  // fees summary من RPC لو شغالة، وإلا صفر
  const feeData = feeAgg.data;
  const totalDue  = Number(feeData?.total_due)  || 0;
  const totalPaid = Number(feeData?.total_paid) || 0;

  return {
    students: totalStudents,
    teachers: t.count || 0,
    parents:  p.count || 0,
    classes:  c.count || 0,
    totalDue,
    totalPaid,
    attendanceRate,
    presentToday,
    absentToday,
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

      try {
        const { data, error } = await (supabase as any).rpc('get_teacher_dashboard_stats', {
          p_teacher_id: user.id,
          p_school_id: user.schoolId
        });

        if (!error && data) return data;
        logger.warn('[useTeacherStats] RPC failed, using direct fallback');
      } catch (e) {
        logger.warn('[useTeacherStats] RPC threw, using direct fallback');
      }

      const teacherClassesRes = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user.id)
        .eq('school_id', user.schoolId);

      const classIds = (teacherClassesRes.data || []).map((c: any) => c.id);

      if (classIds.length === 0) return emptyStats;

      const [studentsCountRes, attendanceRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true })
          .eq('school_id', user.schoolId).in('class_id', classIds),
        // نجلب فقط status للحساب، مع حد 5000 سجل لآخر الفترة
        supabase.from('attendance').select('status')
          .eq('school_id', user.schoolId).in('class_id', classIds)
          .order('date', { ascending: false }).limit(5000),
      ]);

      const rows = attendanceRes.data || [];
      const present = rows.filter((a: any) => a.status === 'present').length;
      const total = rows.length;

      return {
        students: studentsCountRes.count || 0,
        classes: classIds.length,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    },
    enabled: !!(session && user?.id && user?.schoolId && user?.role === 'teacher'),
    staleTime: 3 * 60 * 1000,
  });
}

export function useAdminActivities() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['admin-activities', user?.schoolId, user?.id],
    queryFn: async () => {
      if (!user?.schoolId || !user?.id) return [];

      // فحص كاش الدالة المدمجة أولاً
      const summaryCache = queryClient.getQueryData<{ activities: DashboardActivity[] }>(['admin-dashboard-summary', user?.schoolId, user?.id]);
      if (summaryCache?.activities) return summaryCache.activities;

      // تجربة الدالة المدمجة الجديدة
      try {
        const { data, error } = await (supabase as any).rpc('get_admin_dashboard_summary', {
          p_school_id: user.schoolId,
          p_caller_id: user.id
        });
        if (!error && data?.activities) {
          if (data.stats) {
            queryClient.setQueryData(['admin-stats', user.schoolId, user.isSuperAdmin], data.stats);
          }
          return data.activities;
        }
      } catch { /* ignore and use legacy fallback */ }

      // Fallback: استدعاء الدالة القديمة get_admin_dashboard_activities
      const { data, error } = await (supabase as any).rpc('get_admin_dashboard_activities', {
        p_school_id: user.schoolId,
        p_caller_id: user.id
      });

      if (error) {
        logger.error('Error fetching admin activities via RPC:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!(session && user?.schoolId && user?.id && user?.role === 'admin'),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
