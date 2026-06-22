import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, orderBy, getDocs,
  doc, addDoc, updateDoc, serverTimestamp, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Complaint, ComplaintStatus } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';

function docToComplaint(d: QueryDocumentSnapshot): Complaint {
  const data = d.data();
  return {
    id:            d.id,
    parentId:      data.parentId,
    parentName:    data.parentName ?? undefined,
    studentId:     data.studentId  ?? null,
    studentName:   data.studentName ?? undefined,
    schoolId:      data.schoolId,
    content:       data.content,
    status:        data.status        ?? 'pending',
    adminResponse: data.adminResponse ?? null,
    createdAt:     data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt:     data.updatedAt?.toDate?.()?.toISOString() ?? '',
  };
}

// Admin: all complaints
export function useComplaints(statusFilter?: ComplaintStatus) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['complaints', user?.schoolId, statusFilter],
    enabled:  !!user?.schoolId,
    queryFn:  async () => {
      const constraints: any[] = [
        where('schoolId', '==', user!.schoolId),
        orderBy('createdAt', 'desc'),
      ];
      if (statusFilter) constraints.push(where('status', '==', statusFilter));

      const q    = query(collection(db, COLLECTIONS.COMPLAINTS), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(docToComplaint);
    },
  });
}

// Parent: own complaints
export function useMyComplaints() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-complaints', user?.id],
    enabled:  !!user?.id,
    queryFn:  async () => {
      const q = query(
        collection(db, COLLECTIONS.COMPLAINTS),
        where('parentId', '==', user!.id),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(docToComplaint);
    },
  });
}

export function useSubmitComplaint() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, studentId }: { content: string; studentId?: string }) => {
      await addDoc(collection(db, COLLECTIONS.COMPLAINTS), {
        parentId:      user!.id,
        parentName:    user!.fullName,
        studentId:     studentId ?? null,
        schoolId:      user!.schoolId,
        content,
        status:        'pending',
        adminResponse: null,
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-complaints', user?.id] }),
  });
}

export function useRespondToComplaint() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      response,
      status,
    }: {
      id:       string;
      response: string;
      status:   ComplaintStatus;
    }) => {
      await updateDoc(doc(db, COLLECTIONS.COMPLAINTS, id), {
        adminResponse: response,
        status,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints',  user?.schoolId] });
      qc.invalidateQueries({ queryKey: ['admin-stats', user?.schoolId] });
    },
  });
}
