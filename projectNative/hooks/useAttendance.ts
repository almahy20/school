import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, getDocs, doc,
  writeBatch, serverTimestamp, QueryDocumentSnapshot,
  orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { AttendanceRecord, AttendanceStatus, TeacherAttendanceRecord } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';

function docToAttendance(d: QueryDocumentSnapshot): AttendanceRecord {
  const data = d.data();
  return {
    id:          d.id,
    studentId:   data.studentId,
    studentName: data.studentName ?? undefined,
    classId:     data.classId ?? null,
    schoolId:    data.schoolId,
    date:        data.date,
    status:      data.status,
    createdAt:   data.createdAt?.toDate?.()?.toISOString() ?? '',
  };
}

function docToTeacherAttendance(d: QueryDocumentSnapshot): TeacherAttendanceRecord {
  const data = d.data();
  return {
    id:          d.id,
    teacherId:   data.teacherId,
    teacherName: data.teacherName ?? undefined,
    schoolId:    data.schoolId,
    date:        data.date,
    status:      data.status,
    createdAt:   data.createdAt?.toDate?.()?.toISOString() ?? '',
  };
}

// ── Student Attendance Hooks ──────────────────────────────────────────────────

// Fetch attendance for a class on a specific date
export function useClassAttendance(classId: string, date: Date) {
  const { user } = useAuth();
  const dateStr  = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['attendance', classId, dateStr],
    enabled:  !!classId && !!user?.schoolId,
    queryFn:  async () => {
      const q = query(
        collection(db, COLLECTIONS.ATTENDANCE),
        where('schoolId', '==', user!.schoolId),
        where('classId',  '==', classId),
        where('date',     '==', dateStr),
      );
      const snap = await getDocs(q);
      return snap.docs.map(docToAttendance);
    },
  });
}

// Fetch student attendance history
export function useStudentAttendance(studentId: string, monthDate?: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-attendance', studentId, monthDate?.toISOString()],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn:  async () => {
      const constraints: any[] = [
        where('schoolId',  '==', user!.schoolId),
        where('studentId', '==', studentId),
        orderBy('date', 'desc'),
      ];
      
      if (monthDate) {
        constraints.push(where('date', '>=', format(startOfMonth(monthDate), 'yyyy-MM-dd')));
        constraints.push(where('date', '<=', format(endOfMonth(monthDate), 'yyyy-MM-dd')));
      }

      const q    = query(collection(db, COLLECTIONS.ATTENDANCE), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(docToAttendance);
    },
  });
}

// Save attendance for entire class (batch write)
export function useSaveAttendance() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classId,
      date,
      records,
    }: {
      classId: string;
      date:    Date;
      records: { studentId: string; studentName: string; status: AttendanceStatus }[];
    }) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const batch   = writeBatch(db);

      // Delete existing records for this class/date first
      const existing = await getDocs(query(
        collection(db, COLLECTIONS.ATTENDANCE),
        where('schoolId', '==', user!.schoolId),
        where('classId',  '==', classId),
        where('date',     '==', dateStr),
      ));
      existing.docs.forEach((d) => batch.delete(d.ref));

      // Write new records
      records.forEach(({ studentId, studentName, status }) => {
        const ref = doc(collection(db, COLLECTIONS.ATTENDANCE));
        batch.set(ref, {
          studentId,
          studentName: studentName || '',
          classId,
          schoolId:  user!.schoolId,
          date:      dateStr,
          status,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
    },
    onSuccess: (_, { classId, date }) => {
      qc.invalidateQueries({ queryKey: ['attendance', classId, format(date, 'yyyy-MM-dd')] });
      qc.invalidateQueries({ queryKey: ['admin-stats', user?.schoolId] });
    },
  });
}

// ── Teacher Attendance Hooks ──────────────────────────────────────────────────

// Fetch teacher attendance for a specific date (Admin)
export function useTeachersAttendance(date: Date) {
  const { user } = useAuth();
  const dateStr  = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['teacher-attendance', dateStr],
    enabled:  !!user?.schoolId && (user.role === 'admin' || user.isSuperAdmin),
    queryFn:  async () => {
      const q = query(
        collection(db, COLLECTIONS.TEACHER_ATTENDANCE),
        where('schoolId', '==', user!.schoolId),
        where('date',     '==', dateStr),
      );
      const snap = await getDocs(q);
      return snap.docs.map(docToTeacherAttendance);
    },
  });
}

// Save teacher attendance (Admin)
export function useSaveTeacherAttendance() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({
      date,
      records,
    }: {
      date:    Date;
      records: { teacherId: string; teacherName: string; status: AttendanceStatus }[];
    }) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const batch   = writeBatch(db);

      const existing = await getDocs(query(
        collection(db, COLLECTIONS.TEACHER_ATTENDANCE),
        where('schoolId', '==', user!.schoolId),
        where('date',     '==', dateStr),
      ));
      existing.docs.forEach((d) => batch.delete(d.ref));

      records.forEach(({ teacherId, teacherName, status }) => {
        const ref = doc(collection(db, COLLECTIONS.TEACHER_ATTENDANCE));
        batch.set(ref, {
          teacherId,
          teacherName: teacherName || '',
          schoolId:  user!.schoolId,
          date:      dateStr,
          status,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
    },
    onSuccess: (_, { date }) => {
      qc.invalidateQueries({ queryKey: ['teacher-attendance', format(date, 'yyyy-MM-dd')] });
    },
  });
}
