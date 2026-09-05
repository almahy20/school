import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Student Attendance ───────────────────────────────────────────────────────

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: 'present' | 'absent' | 'late' | null;
  grade_level?: string;
  class_name?: string;
}

export function useClassAttendance(classId: string | null, date: string) {
  const { user, session } = useAuth();
  const queryKey = ['attendance', 'class', classId, date];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId || !classId) return [];

      const { data: students, error: sError } = await supabase
        .from('students')
        .select('id, name')
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('name');
      if (sError) throw sError;
      if (!students?.length) return [];

      const { data: records, error: rError } = await supabase
        .from('attendance')
        .select('id, student_id, status')
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .eq('date', date);
      if (rError) throw rError;

      return students.map(s => {
        const record = records?.find(r => r.student_id === s.id);
        return { 
          studentId: s.id, 
          studentName: s.name, 
          status: (record?.status as any) || null 
        };
      }) as AttendanceRecord[];
    },
    enabled: !!(session && user?.schoolId && classId),
    placeholderData: keepPreviousData,
  });
}

export function useUpsertAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (records: any[]) => {
      if (!records || records.length === 0) return;
      const classId = records[0].class_id;
      const date = records[0].date;
      const schoolId = records[0].school_id;
      const studentIds = records.map(r => r.student_id);

      // Try upsert first
      const { error } = await supabase
        .from('attendance')
        .upsert(records, {
          onConflict: 'student_id,date,school_id'
        });

      if (error) {
        // Fallback: delete existing records for these students on this date and school, then insert
        const { error: delError } = await supabase
          .from('attendance')
          .delete()
          .eq('date', date)
          .in('student_id', studentIds);

        if (delError) {
          // If delete with in failed, try with school_id filter
          await supabase
            .from('attendance')
            .delete()
            .eq('school_id', schoolId)
            .eq('date', date)
            .in('student_id', studentIds);
        }

        const { error: insError } = await supabase
          .from('attendance')
          .insert(records);

        if (insError) throw insError;
      }

      try {
        await (supabase as any).rpc('log_action', {
          p_action: 'MARK_STUDENT_ATTENDANCE',
          p_entity_type: 'attendance',
          p_details: `رصد حضور لعدد ${records.length} طلاب لتاريخ ${date}`
        });
      } catch {
        // Ignore audit log error
      }
    },
    onMutate: async (newRecords) => {
      if (newRecords.length === 0) return;
      const { class_id, date } = newRecords[0];
      const queryKey = ['attendance', 'class', class_id, date];

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((s: any) => {
          const record = newRecords.find(r => r.student_id === s.studentId);
          return record ? { ...s, status: record.status } : s;
        });
      });

      return { previousData, queryKey };
    },
    onError: (err, newRecords, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['attendance', 'class', variables[0].class_id, variables[0].date] 
        });
        queryClient.invalidateQueries({ queryKey: ['attendance', 'student'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['parent-children'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      }
    },
  });
}

export function useStudentAttendance(studentId: string | null) {
  const queryKey = ['attendance', 'student', studentId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('id, student_id, status, date, school_id, class_id, created_at')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(365); // حد معقول: سنة دراسية كاملة
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// ─── Teacher Attendance ───────────────────────────────────────────────────────

export interface TeacherAttendanceRecord {
  teacherId: string;
  teacherName: string;
  status: 'present' | 'absent' | 'late' | 'excused' | null;
}

export function useTeacherAttendance(date: string) {
  const { user, session } = useAuth();
  const queryKey = ['teacher-attendance', date];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return [];

      // Step 1: جلب IDs المعلمين المعتمدين
      const { data: rolesData, error: rolesError } = await (supabase
        .from('user_roles') as any)
        .select('user_id')
        .eq('school_id', user.schoolId)
        .eq('role', 'teacher')
        .eq('approval_status', 'approved');
        
      if (rolesError) throw rolesError;
      if (!rolesData?.length) return [];
      
      const teacherIds = rolesData.map(r => r.user_id);

      // Step 2: جلب profiles و attendance بالتوازي بدل الـ waterfall
      const [profilesRes, attendanceRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', teacherIds)
          .order('full_name'),
        (supabase as any)
          .from('teacher_attendance')
          .select('id, teacher_id, status, date, school_id')
          .eq('school_id', user.schoolId)
          .eq('date', date),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      const teachers = profilesRes.data || [];
      const records  = attendanceRes.data || [];

      if (!teachers.length) return [];

      return teachers.map(t => {
        const record = records.find(r => r.teacher_id === t.id);
        return { 
          teacherId: t.id, 
          teacherName: t.full_name || 'غير محدد', 
          status: (record?.status as any) || null 
        };
      }) as TeacherAttendanceRecord[];
    },
    enabled: !!(session && user?.schoolId),
    staleTime: 1000 * 60 * 60, 
    gcTime: 1000 * 60 * 60 * 2,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useUpsertTeacherAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (records: any[]) => {
      if (!records || records.length === 0) return;

      const db = supabase as any;
      const date = records[0].date;

      const { error } = await db
        .from('teacher_attendance')
        .upsert(records, {
          onConflict: 'teacher_id,date,school_id'
        });

      if (error) throw error;

      await db.rpc('log_action', {
        p_action: 'MARK_TEACHER_ATTENDANCE',
        p_entity_type: 'teacher_attendance',
        p_details: `رصد حضور لعدد ${records.length} معلمين لتاريخ ${date}`
      });
    },
    onMutate: async (newRecords) => {
      if (newRecords.length === 0) return;
      const date = newRecords[0].date;
      const queryKey = ['teacher-attendance', date];

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((t: any) => {
          const record = newRecords.find(r => r.teacher_id === t.teacherId);
          return record ? { ...t, status: record.status } : t;
        });
      });

      return { previousData, queryKey };
    },
    onError: (err, newRecords, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['teacher-attendance', variables[0].date] 
        });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      }
    },
  });
}
