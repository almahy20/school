import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// ── مساعدات حساب مشتركة ──────────────────────────────────────────────────────

function calcAttendanceRate(attendance: any[]): number {
  if (!attendance || attendance.length === 0) return 0;
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  return Math.round((presentCount / attendance.length) * 100);
}

function calcAvgGrade(grades: any[]): number {
  const numeric = (grades || []).filter(
    (g) => !isNaN(Number(g.score)) && Number(g.max_score) > 0
  );
  if (numeric.length === 0) return 0;
  return Math.round(
    numeric.reduce((sum: number, g: any) => sum + (Number(g.score) / Number(g.max_score)) * 100, 0) /
      numeric.length
  );
}

function calcFeesRemaining(fees: any[], currentTerm: string, monthlyFee: number): {
  totalFeesRemaining: number;
  currentMonthFee: any | undefined;
  processedFees: any[];
} {
  const nowObj = new Date();
  const processedFees = [...(fees || [])];
  const currentMonthFee = processedFees.find((f) => f.term === currentTerm);

  if (!currentMonthFee && monthlyFee > 0) {
    processedFees.push({
      id: `virtual-${currentTerm}`,
      term: currentTerm,
      month: nowObj.getMonth() + 1,
      year: nowObj.getFullYear(),
      amount_due: monthlyFee,
      amount_paid: 0,
      status: 'unpaid',
      created_at: nowObj.toISOString(),
    });
  }

  const pastFeesRemaining = (fees || [])
    .filter((f) => f.term !== currentTerm)
    .reduce((sum: number, f: any) => sum + (Number(f.amount_due) - Number(f.amount_paid)), 0);

  const currentMonthAmountDue = monthlyFee;
  const currentMonthAmountPaid = currentMonthFee ? Number(currentMonthFee.amount_paid) : 0;
  const currentMonthRemaining = Math.max(0, currentMonthAmountDue - currentMonthAmountPaid);
  const totalFeesRemaining = Math.max(0, pastFeesRemaining + currentMonthRemaining);

  return { totalFeesRemaining, currentMonthFee, processedFees };
}

function getCurrentTerm(): string {
  const now = new Date();
  return 'شهر ' + MONTHS_AR[now.getMonth()] + ' ' + now.getFullYear();
}

export function useParentChildren() {
  const { user, session } = useAuth();
  const queryKey = useMemo(() => ['parent-children', user?.id, user?.schoolId], [user?.id, user?.schoolId]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) {
        logger.warn('[useParentChildren] Missing user data:', { userId: user?.id, schoolId: user?.schoolId, role: user?.role });
        return [];
      }
      
      logger.log('[useParentChildren] Starting query for user:', user.id, 'school:', user.schoolId);
      
      try {
        // ✅ Optimization: ONE single RPC call for everything
        // This eliminates the "Waterfall Effect" and reduces requests by 100%
        logger.log('[useParentChildren] Calling RPC get_parent_dashboard_summary...');
        const { data, error } = await (supabase as any).rpc('get_parent_dashboard_summary', { 
          p_parent_id: user.id,
          p_school_id: user.schoolId 
        });
        
        if (error) {
          logger.error('[useParentChildren] RPC Error:', error);
          
          // ✅ Fallback: Try direct query if RPC fails
          logger.log('[useParentChildren] Trying fallback direct query...');
          
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
            logger.error('[useParentChildren] Fallback Error:', fallbackError);
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
          logger.log('[useParentChildren] Fallback data fetched:', fallbackData?.length, 'students');
          logger.log('[useParentChildren] Attendance records:', attendanceResult.data?.length);
          
          return fallbackData.map((item: any) => {
            const studentId = item.students?.id;
            const monthlyFee = Number(item.students?.monthly_fee) || 0;

            // Calculate average grade using shared helper
            const studentGrades = (gradesResult.data || []).filter((g: any) => g.student_id === studentId);
            const avgGrade = calcAvgGrade(studentGrades);

            // Calculate attendance rate using shared helper
            const studentAttendance = (attendanceResult.data || []).filter((a: any) => a.student_id === studentId);

            logger.log(`[useParentChildren] Student ${item.students?.name}:`, {
              totalAttendanceRecords: studentAttendance.length,
              attendanceData: studentAttendance
            });

            const attendanceRate = calcAttendanceRate(studentAttendance);
            logger.log(`[useParentChildren] Attendance rate: ${attendanceRate}%`);

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
        
        logger.log('[useParentChildren] RPC returned data:', data?.length, 'students');
        if (data && data.length > 0) {
          logger.log('[useParentChildren] First student sample received');
          
          // ✅ Check if data has attendanceRate field
          const firstStudent = data[0];
          if (!Object.prototype.hasOwnProperty.call(firstStudent, 'attendanceRate')) {
            logger.warn('[useParentChildren] RPC returned data without attendanceRate, using fallback...');
            throw new Error('RPC returned incomplete data');
          }
        }
        
        return data || [];
      } catch (err) {
        logger.error('[useParentChildren] Unexpected error:', err);
        throw err;
      }
    },
    enabled: !!session && !!(user?.id && user?.schoolId && user?.role === 'parent'),
    staleTime: 10 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

export function useChildFullDetails(studentId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['child-full-details', studentId],
    queryFn: async () => {
      if (!studentId || !user?.schoolId) return null;

      const current_term = getCurrentTerm();

      try {
        logger.log('[useChildFullDetails] Calling RPC get_child_full_details for student:', studentId);
        const { data, error } = await (supabase as any).rpc('get_child_full_details', {
          p_student_id: studentId,
          p_school_id: user.schoolId,
        });

        if (error) {
          logger.warn('[useChildFullDetails] RPC failed, falling back to direct queries:', error);
          throw error;
        }

        if (!data) return null;

        const { student, grades, attendance, fees, payments, curriculum, current_term: rpc_term } = data;
        const term = rpc_term || current_term;

        const avgGrade = calcAvgGrade(grades);
        const attendanceRate = calcAttendanceRate(attendance);
        const { totalFeesRemaining, processedFees } = calcFeesRemaining(
          fees,
          term,
          Number(student?.monthly_fee) || 0
        );

        logger.log('[useChildFullDetails] RPC succeeded for student:', studentId);
        return {
          ...student,
          className: student?.classes?.name,
          grades: grades || [],
          attendance: attendance || [],
          fees: processedFees,
          payments: payments || [],
          curriculum: curriculum || [],
          avgGrade,
          attendanceRate,
          feesRemaining: totalFeesRemaining,
          currentTerm: term,
          summary: { avgGrade, attendanceRate, feesRemaining: totalFeesRemaining, currentTerm: term },
        };
      } catch (rpcError) {
        logger.warn('[useChildFullDetails] Falling back to direct table queries...');

        const [studentResult, gradesResult, attendanceResult, feesResult, curriculumResult] =
          await Promise.all([
            supabase
              .from('students')
              .select('*, classes(id, name, curriculum_id)')
              .eq('id', studentId)
              .eq('school_id', user.schoolId)
              .maybeSingle(),

            supabase
              .from('grades')
              .select('*, exam_templates(id, title, term, subject)')
              .eq('student_id', studentId)
              .eq('school_id', user.schoolId)
              .order('created_at', { ascending: true }),

            supabase
              .from('attendance')
              .select('*')
              .eq('student_id', studentId)
              .eq('school_id', user.schoolId)
              .order('date', { ascending: false }),

            supabase
              .from('fees')
              .select('*')
              .eq('student_id', studentId)
              .eq('school_id', user.schoolId)
              .order('created_at', { ascending: false }),

            (async () => {
              const { data: stud } = await supabase
                .from('students')
                .select('classes!inner(curriculum_id)')
                .eq('id', studentId)
                .eq('school_id', user.schoolId)
                .maybeSingle();
              const curriculumId = (stud as any)?.classes?.curriculum_id;
              if (!curriculumId) return { data: [], error: null };
              return supabase
                .from('curriculum_subjects')
                .select('*')
                .eq('curriculum_id', curriculumId)
                .order('subject_name');
            })(),
          ]);

        if (studentResult.error) {
          logger.error('[useChildFullDetails] Fallback failed at student fetch:', studentResult.error);
          throw studentResult.error;
        }

        const rawStudent = studentResult.data as any;
        if (!rawStudent) return null;

        const student = {
          id: rawStudent.id,
          name: rawStudent.name,
          class_id: rawStudent.class_id,
          parent_phone: rawStudent.parent_phone,
          school_id: rawStudent.school_id,
          monthly_fee: Number(rawStudent.monthly_fee) || 0,
          address: rawStudent.address || null,
          classes: rawStudent.classes,
        };

        const grades = gradesResult.data || [];
        const attendance = attendanceResult.data || [];
        const fees = feesResult.data || [];
        const curriculum = (curriculumResult as any).data || [];

        const avgGrade = calcAvgGrade(grades);
        const attendanceRate = calcAttendanceRate(attendance);
        const { totalFeesRemaining, processedFees } = calcFeesRemaining(
          fees,
          current_term,
          student.monthly_fee
        );

        const feeIds = fees.map((f: any) => f.id).filter(Boolean);
        let payments: any[] = [];
        if (feeIds.length > 0) {
          const { data: pData } = await supabase
            .from('fee_payments')
            .select('*')
            .eq('school_id', user.schoolId)
            .in('fee_id', feeIds)
            .order('payment_date', { ascending: false });
          payments = pData || [];
        }

        logger.log('[useChildFullDetails] Fallback succeeded for student:', studentId);
        return {
          ...student,
          className: student.classes?.name,
          grades,
          attendance,
          fees: processedFees,
          payments,
          curriculum,
          avgGrade,
          attendanceRate,
          feesRemaining: totalFeesRemaining,
          currentTerm: current_term,
          summary: {
            avgGrade,
            attendanceRate,
            feesRemaining: totalFeesRemaining,
            currentTerm: current_term,
          },
        };
      }
    },
    enabled: !!(studentId && user?.schoolId),
    staleTime: 15 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      if (error?.code === 'PGRST202' || (error?.status >= 400 && error?.status < 500)) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: 1000,
  });
}
