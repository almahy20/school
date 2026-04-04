import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useParentChildren() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-children', user?.id, user?.schoolId],
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return [];
      
      const { data, error } = await supabase.from('student_parents')
        .select('student_id, students(id, name, class_id, classes(name))')
        .eq('parent_id', user.id)
        .eq('school_id', user.schoolId);
      
      if (error) throw error;
      
      const kids = data?.map((d: any) => ({
        ...d.students,
        className: d.students?.classes?.name || 'غير محدد'
      })).filter(Boolean) || [];

      // Enrich with summary data
      const enrichedKids = await Promise.all(kids.map(async (kid: any) => {
        const [{ data: grades }, { data: attendance }, { data: fees }] = await Promise.all([
          supabase.from('grades').select('score, max_score').eq('student_id', kid.id).eq('school_id', user.schoolId),
          supabase.from('attendance').select('status').eq('student_id', kid.id).eq('school_id', user.schoolId),
          supabase.from('fees').select('amount_due, amount_paid').eq('student_id', kid.id).eq('school_id', user.schoolId),
        ]);

        const numericGrades = (grades || []).filter(g => !isNaN(Number(g.score)));
        const avgGrade = numericGrades.length > 0
          ? Math.round(numericGrades.reduce((sum, g) => sum + (Number(g.score) / g.max_score) * 100, 0) / numericGrades.length)
          : 0;

        const presentCount = (attendance || []).filter(a => a.status === 'present').length;
        const attendanceRate = (attendance || []).length > 0 
          ? Math.round((presentCount / (attendance || []).length) * 100) 
          : 100;

        const totalDue = (fees || []).reduce((sum, f) => sum + (Number(f.amount_due) || 0), 0);
        const totalPaid = (fees || []).reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);

        return {
          ...kid,
          avgGrade,
          attendanceRate,
          feesRemaining: Math.max(0, totalDue - totalPaid)
        };
      }));

      return enrichedKids;
    },
    enabled: !!(user?.id && user?.schoolId && user?.role === 'parent'),
    staleTime: 30 * 1000, // Reduced to 30 seconds for better responsiveness
  });
}

export function useParentChildOverview(studentId: string | undefined) {
  return useQuery({
    queryKey: ['parent-child-overview', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await (supabase as any).rpc('get_child_overview', { p_student_id: studentId });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
    staleTime: 30 * 1000,
  });
}

export function useParentChildActivities(studentId: string | undefined) {
  return useQuery({
    queryKey: ['parent-child-activities', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await (supabase as any).rpc('get_child_activities', { p_student_id: studentId });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
    staleTime: 30 * 1000,
  });
}

export function useChildFullDetails(studentId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['child-full-details', studentId],
    queryFn: async () => {
      if (!studentId || !user?.schoolId) return null;

      // 1. Fetch basic student info and class curriculum_id
      const { data: student, error: sErr } = await supabase
        .from('students')
        .select('*, classes(*)')
        .eq('id', studentId)
        .single();
      if (sErr) throw sErr;

      // 2. Fetch grades, attendance, and fees in parallel
      const [{ data: grades }, { data: attendance }, { data: fees }] = await Promise.all([
        supabase.from('grades').select('*').eq('school_id', user.schoolId).eq('student_id', studentId).order('date', { ascending: true }),
        supabase.from('attendance').select('*').eq('school_id', user.schoolId).eq('student_id', studentId).order('date', { ascending: false }),
        supabase.from('fees').select('*').eq('school_id', user.schoolId).eq('student_id', studentId),
      ]);

      // 3. Fetch fee payments if there are fees
      const feeIds = (fees || []).map(f => f.id);
      let payments: any[] = [];
      if (feeIds.length > 0) {
        const { data: pData } = await supabase.from('fee_payments').select('*').eq('school_id', user.schoolId).in('fee_id', feeIds).order('payment_date', { ascending: false });
        payments = pData || [];
      }

      // 4. Fetch curriculum subjects if class has a curriculum
      let curriculum: any[] = [];
      if (student.classes?.curriculum_id) {
        const { data: cData } = await supabase
          .from('curriculum_subjects')
          .select('*')
          .eq('curriculum_id', student.classes.curriculum_id)
          .order('subject_name');
        curriculum = cData || [];
      }

      const presentCount = (attendance || []).filter(a => a.status === 'present').length;
      
      const numericGrades = (grades || []).filter(g => !isNaN(Number(g.score)));
      const avgGrade = numericGrades.length > 0
        ? Math.round(numericGrades.reduce((sum, g) => sum + (Number(g.score) / g.max_score) * 100, 0) / numericGrades.length)
        : 0;

      const totalDue = (fees || []).reduce((sum: number, f: any) => sum + (Number(f.amount_due) || 0), 0);
      const totalPaid = (fees || []).reduce((sum: number, f: any) => sum + (Number(f.amount_paid) || 0), 0);

      return {
        ...student,
        className: student.classes?.name || '',
        grades: grades || [],
        attendance: attendance || [],
        attendanceRate: (attendance || []).length > 0 ? Math.round((presentCount / (attendance || []).length) * 100) : 0,
        avgGrade,
        feesRemaining: Math.max(0, totalDue - totalPaid),
        fees: fees || [],
        payments,
        curriculum,
      };
    },
    enabled: !!(studentId && user?.schoolId),
    staleTime: 30 * 1000,
  });
}

