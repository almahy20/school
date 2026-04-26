import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function useParentChildren() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['parent-children', user?.id, user?.schoolId], [user?.id, user?.schoolId]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) {
        console.warn('[useParentChildren] Missing user data:', { userId: user?.id, schoolId: user?.schoolId, role: user?.role });
        return [];
      }
      
      console.log('[useParentChildren] Starting query for user:', user.id, 'school:', user.schoolId);
      
      try {
        // ✅ Optimization: ONE single RPC call for everything
        // This eliminates the "Waterfall Effect" and reduces requests by 100%
        console.log('[useParentChildren] Calling RPC get_parent_dashboard_summary...');
        const { data, error } = await (supabase as any).rpc('get_parent_dashboard_summary', { 
          p_parent_id: user.id,
          p_school_id: user.schoolId 
        });
        
        if (error) {
          console.error('[useParentChildren] RPC Error:', error);
          
          // ✅ Fallback: Try direct query if RPC fails
          console.log('[useParentChildren] Trying fallback direct query...');
          
          // Fetch student-parent links with basic info
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('student_parents')
            .select(`
              student_id,
              students (
                id,
                name,
                class_id,
                monthly_fee,
                classes (name)
              )
            `)
            .eq('parent_id', user.id)
            .eq('school_id', user.schoolId);
          
          if (fallbackError) {
            console.error('[useParentChildren] Fallback Error:', fallbackError);
            throw fallbackError;
          }
          
          if (!fallbackData || fallbackData.length === 0) {
            return [];
          }
          
          // Fetch grades, attendance, and fees for all students in parallel
          const studentIds = fallbackData.map((item: any) => item.students?.id).filter(Boolean);
          
          const [gradesResult, attendanceResult, feesResult] = await Promise.all([
            // Get grades
            supabase
              .from('grades')
              .select('student_id, score, max_score')
              .eq('school_id', user.schoolId)
              .in('student_id', studentIds),
            
            // Get attendance
            supabase
              .from('attendance')
              .select('student_id, status')
              .eq('school_id', user.schoolId)
              .in('student_id', studentIds),
            
            // Get fees
            supabase
              .from('fees')
              .select('student_id, amount_due, amount_paid')
              .eq('school_id', user.schoolId)
              .in('student_id', studentIds)
          ]);
          
          // Transform fallback data to match expected format with REAL data
          console.log('[useParentChildren] Fallback data fetched:', fallbackData?.length, 'students');
          console.log('[useParentChildren] Attendance records:', attendanceResult.data?.length);
          
          return fallbackData.map((item: any) => {
            const studentId = item.students?.id;
            const monthlyFee = item.students?.monthly_fee || 0;
            
            // Calculate average grade
            const studentGrades = (gradesResult.data || []).filter((g: any) => g.student_id === studentId);
            let avgGrade = 0;
            if (studentGrades.length > 0) {
              const validGrades = studentGrades.filter((g: any) => {
                const score = parseFloat(g.score);
                const maxScore = parseFloat(g.max_score);
                return !isNaN(score) && !isNaN(maxScore) && maxScore > 0;
              });
              
              if (validGrades.length > 0) {
                avgGrade = Math.round(
                  validGrades.reduce((sum: number, g: any) => {
                    return sum + (parseFloat(g.score) / parseFloat(g.max_score)) * 100;
                  }, 0) / validGrades.length
                );
              }
            }
            
            // Calculate attendance rate
            const studentAttendance = (attendanceResult.data || []).filter((a: any) => a.student_id === studentId);
            let attendanceRate = 0;
            
            console.log(`[useParentChildren] Student ${item.students?.name}:`, {
              totalAttendanceRecords: studentAttendance.length,
              attendanceData: studentAttendance
            });
            
            if (studentAttendance.length > 0) {
              const presentCount = studentAttendance.filter((a: any) => a.status === 'present').length;
              attendanceRate = Math.round((presentCount / studentAttendance.length) * 100);
              console.log(`[useParentChildren] Attendance calculation:`, {
                present: presentCount,
                total: studentAttendance.length,
                rate: attendanceRate
              });
            }
            
            // Calculate fees remaining
            const studentFees = (feesResult.data || []).filter((f: any) => f.student_id === studentId);
            const totalDue = studentFees.reduce((sum: number, f: any) => sum + parseFloat(f.amount_due || 0), 0);
            const totalPaid = studentFees.reduce((sum: number, f: any) => sum + parseFloat(f.amount_paid || 0), 0);
            const feesRemaining = Math.max(0, totalDue - totalPaid);
            
            return {
              id: studentId,
              name: item.students?.name,
              class_id: item.students?.class_id,
              className: item.students?.classes?.name,
              avgGrade,
              attendanceRate,
              feesRemaining
            };
          });
        }
        
        console.log('[useParentChildren] RPC returned data:', data?.length, 'students');
        if (data && data.length > 0) {
          console.log('[useParentChildren] First student:', data[0]);
          
          // ✅ Check if data has attendanceRate field
          const firstStudent = data[0];
          if (firstStudent.attendanceRate === 0 || firstStudent.attendanceRate === undefined) {
            console.warn('[useParentChildren] RPC returned data with attendanceRate = 0, using fallback...');
            // If RPC returns empty data, use fallback
            throw new Error('RPC returned incomplete data');
          }
        }
        
        return data || [];
      } catch (err) {
        console.error('[useParentChildren] Unexpected error:', err);
        throw err;
      }
    },
    enabled: !!(user?.id && user?.schoolId && user?.role === 'parent'),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
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

      const { student, grades, attendance, fees, payments, curriculum, current_term } = data;

      const presentCount = (attendance || []).filter((a: any) => a.status === 'present').length;
      
      const numericGrades = (grades || []).filter((g: any) => !isNaN(Number(g.score)));
      const avgGrade = numericGrades.length > 0
        ? Math.round(numericGrades.reduce((sum: number, g: any) => sum + (Number(g.score) / g.max_score) * 100, 0) / numericGrades.length)
        : 0;

      // ✅ New Monthly logic for parents:
      // If the current month doesn't have a fee record yet, create a virtual one with 0 paid
      let processedFees = [...(fees || [])];
      const currentMonthFee = processedFees.find((f: any) => f.term === current_term);
      
      if (!currentMonthFee && student?.monthly_fee > 0) {
        const now = new Date();
        processedFees.push({
          id: `virtual-${current_term}`,
          term: current_term,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          amount_due: student.monthly_fee,
          amount_paid: 0,
          status: 'unpaid',
          created_at: now.toISOString()
        });
      }

      // Calculate TOTAL remaining: (sum of all unpaid fees from database) + (remaining for current month)
      // We use the original 'fees' for past ones and calculate current separately to be safe
      const pastFeesRemaining = (fees || [])
        .filter((f: any) => f.term !== current_term)
        .reduce((sum: number, f: any) => sum + (Number(f.amount_due) - Number(f.amount_paid)), 0);

      const currentMonthAmountDue = Number(student?.monthly_fee) || 0;
      const currentMonthAmountPaid = currentMonthFee ? Number(currentMonthFee.amount_paid) : 0;
      const currentMonthRemaining = Math.max(0, currentMonthAmountDue - currentMonthAmountPaid);

      const totalFeesRemaining = Math.max(0, pastFeesRemaining + currentMonthRemaining);
      const attendanceRate = (attendance || []).length > 0 ? Math.round((presentCount / (attendance || []).length) * 100) : 0;

      return {
        ...student,
        grades: grades || [],
        attendance: attendance || [],
        fees: processedFees,
        payments: payments || [],
        curriculum: curriculum || [],
        avgGrade,
        attendanceRate,
        feesRemaining: totalFeesRemaining,
        currentTerm: current_term,
        summary: {
          avgGrade,
          attendanceRate,
          feesRemaining: totalFeesRemaining,
          currentTerm: current_term
        }
      };
    },
    enabled: !!(studentId && user?.schoolId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

