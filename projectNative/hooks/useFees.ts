import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, getDocs, doc,
  addDoc, updateDoc, serverTimestamp, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Fee, FeePayment } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';

function docToFee(d: QueryDocumentSnapshot): Fee {
  const data = d.data();
  return {
    id:          d.id,
    studentId:   data.studentId,
    studentName: data.studentName ?? undefined,
    schoolId:    data.schoolId,
    term:        data.term,
    amountDue:   data.amountDue  ?? 0,
    amountPaid:  data.amountPaid ?? 0,
    status:      data.status     ?? 'unpaid',
    createdAt:   data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt:   data.updatedAt?.toDate?.()?.toISOString() ?? '',
  };
}

export function useFees(term?: string, classId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['fees', user?.schoolId, term, classId],
    enabled:  !!user?.schoolId,
    queryFn:  async () => {
      const constraints: any[] = [where('schoolId', '==', user!.schoolId)];
      if (term) constraints.push(where('term', '==', term));

      const q    = query(collection(db, COLLECTIONS.FEES), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(docToFee);
    },
  });
}

export function useStudentFees(studentId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-fees', studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn:  async () => {
      const q = query(
        collection(db, COLLECTIONS.FEES),
        where('schoolId',  '==', user!.schoolId),
        where('studentId', '==', studentId),
      );
      const snap = await getDocs(q);
      return snap.docs.map(docToFee);
    },
  });
}

export function useAddPayment() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feeId,
      amount,
      paymentMethod,
    }: {
      feeId:         string;
      amount:        number;
      paymentMethod: string;
    }) => {
      // Add payment record
      await addDoc(collection(db, COLLECTIONS.FEE_PAYMENTS), {
        feeId,
        schoolId:      user!.schoolId,
        amount,
        paymentMethod,
        paymentDate:   new Date().toISOString(),
        createdAt:     serverTimestamp(),
      });

      // Update fee status
      const feeRef = doc(db, COLLECTIONS.FEES, feeId);
      const feeSnap = await getDocs(query(
        collection(db, COLLECTIONS.FEES),
        where('__name__', '==', feeId),
      ));

      if (!feeSnap.empty) {
        const fee = feeSnap.docs[0].data();
        const newPaid = (fee.amountPaid ?? 0) + amount;
        const newStatus = newPaid >= fee.amountDue ? 'paid' : 'partial';
        await updateDoc(feeRef, {
          amountPaid: newPaid,
          status:     newStatus,
          updatedAt:  serverTimestamp(),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees',       user?.schoolId] });
      qc.invalidateQueries({ queryKey: ['admin-stats', user?.schoolId] });
    },
  });
}
