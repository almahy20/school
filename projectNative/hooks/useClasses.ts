import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, orderBy, getDocs,
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Class } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';

function docToClass(d: QueryDocumentSnapshot): Class {
  const data = d.data();
  return {
    id:           d.id,
    name:         data.name,
    gradeLevel:   data.gradeLevel ?? null,
    teacherId:    data.teacherId ?? null,
    teacherName:  data.teacherName ?? null,
    schoolId:     data.schoolId,
    curriculumId: data.curriculumId ?? null,
    studentCount: data.studentCount ?? 0,
    createdAt:    data.createdAt?.toDate?.()?.toISOString() ?? '',
  };
}

export function useClasses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['classes', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn:  async () => {
      // Teachers only see their own classes
      const constraints: any[] = [where('schoolId', '==', user!.schoolId), orderBy('name')];
      if (user?.role === 'teacher') {
        constraints.push(where('teacherId', '==', user.id));
      }
      const q    = query(collection(db, COLLECTIONS.CLASSES), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(docToClass);
    },
  });
}

export function useAddClass() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Class, 'id' | 'schoolId' | 'createdAt'>) => {
      await addDoc(collection(db, COLLECTIONS.CLASSES), {
        ...data,
        schoolId:  user!.schoolId,
        createdAt: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] }),
  });
}

export function useUpdateClass() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Class> & { id: string }) => {
      await updateDoc(doc(db, COLLECTIONS.CLASSES, id), data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] }),
  });
}

export function useDeleteClass() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => deleteDoc(doc(db, COLLECTIONS.CLASSES, id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] }),
  });
}
