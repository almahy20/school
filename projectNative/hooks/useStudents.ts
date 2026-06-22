import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, orderBy, getDocs,
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  limit, startAfter, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Student } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
function docToStudent(d: QueryDocumentSnapshot): Student {
  const data = d.data();
  return {
    id:          d.id,
    name:        data.name,
    classId:     data.classId ?? null,
    className:   data.className ?? null,
    schoolId:    data.schoolId,
    birthDate:   data.birthDate ?? null,
    parentPhone: data.parentPhone ?? null,
    notes:       data.notes ?? null,
    monthlyFee:  data.monthlyFee ?? null,
    createdAt:   data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt:   data.updatedAt?.toDate?.()?.toISOString() ?? '',
  };
}

// ── Fetch All Students ────────────────────────────────────────────────────────
export function useStudents(classFilter?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['students', user?.schoolId, classFilter],
    enabled:  !!user?.schoolId,
    queryFn:  async () => {
      const constraints: any[] = [
        where('schoolId', '==', user!.schoolId),
        orderBy('name'),
      ];
      if (classFilter) constraints.push(where('classId', '==', classFilter));

      const q    = query(collection(db, COLLECTIONS.STUDENTS), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(docToStudent);
    },
  });
}

// ── Update Student Count for Class ───────────────────────────────────────────
async function updateClassStudentCount(classId: string, schoolId: string) {
  const q = query(
    collection(db, COLLECTIONS.STUDENTS),
    where('schoolId', '==', schoolId),
    where('classId', '==', classId)
  );
  const snap = await getDocs(q);
  const count = snap.size;
  
  const classRef = doc(db, COLLECTIONS.CLASSES, classId);
  await updateDoc(classRef, { studentCount: count });
}

// ── Add Student ───────────────────────────────────────────────────────────────
export function useAddStudent() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Student, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>) => {
      const now = serverTimestamp();
      const docRef = await addDoc(collection(db, COLLECTIONS.STUDENTS), {
        ...data,
        schoolId:  user!.schoolId,
        createdAt: now,
        updatedAt: now,
      });

      if (data.classId) {
        await updateClassStudentCount(data.classId, user!.schoolId!);
      }
      return docRef.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] });
      qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] });
      qc.invalidateQueries({ queryKey: ['admin-stats', user?.schoolId] });
    },
  });
}

// ── Update Student ────────────────────────────────────────────────────────────
export function useUpdateStudent() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, oldClassId, ...data }: Partial<Student> & { id: string; oldClassId?: string | null }) => {
      await updateDoc(doc(db, COLLECTIONS.STUDENTS, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });

      // If class changed, update both counts
      if (data.classId !== undefined && data.classId !== oldClassId) {
        if (data.classId) await updateClassStudentCount(data.classId, user!.schoolId!);
        if (oldClassId) await updateClassStudentCount(oldClassId, user!.schoolId!);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] });
      qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] });
    },
  });
}

// ── Delete Student ────────────────────────────────────────────────────────────
export function useDeleteStudent() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classId }: { id: string; classId?: string | null }) => {
      await deleteDoc(doc(db, COLLECTIONS.STUDENTS, id));
      if (classId) {
        await updateClassStudentCount(classId, user!.schoolId!);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] });
      qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] });
      qc.invalidateQueries({ queryKey: ['admin-stats', user?.schoolId] });
    },
  });
}
