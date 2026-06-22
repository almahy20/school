import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, query, where, orderBy, getDocs,
  doc, addDoc, updateDoc, serverTimestamp, QueryDocumentSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Message } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';

function docToMessage(d: QueryDocumentSnapshot): Message {
  const data = d.data();
  return {
    id:           d.id,
    senderId:     data.senderId,
    senderName:   data.senderName   ?? undefined,
    receiverId:   data.receiverId,
    receiverName: data.receiverName ?? undefined,
    studentId:    data.studentId    ?? null,
    schoolId:     data.schoolId,
    content:      data.content,
    isRead:       data.isRead       ?? false,
    createdAt:    data.createdAt?.toDate?.()?.toISOString() ?? '',
  };
}

// Parent: inbox
export function useMyMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['messages', user?.id],
    enabled:  !!user?.id,
    queryFn:  async () => {
      const q = query(
        collection(db, COLLECTIONS.MESSAGES),
        where('receiverId', '==', user!.id),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(docToMessage);
    },
  });
}

// Admin/Teacher: sent messages
export function useSentMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sent-messages', user?.schoolId, user?.id],
    enabled:  !!user?.schoolId,
    queryFn:  async () => {
      const q = query(
        collection(db, COLLECTIONS.MESSAGES),
        where('schoolId', '==', user!.schoolId),
        where('senderId', '==', user!.id),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(docToMessage);
    },
  });
}

// Send message to one user
export function useSendMessage() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiverId,
      receiverName,
      content,
      studentId,
    }: {
      receiverId:   string;
      receiverName: string;
      content:      string;
      studentId?:   string;
    }) => {
      await addDoc(collection(db, COLLECTIONS.MESSAGES), {
        senderId:     user!.id,
        senderName:   user!.fullName,
        receiverId,
        receiverName,
        studentId:    studentId ?? null,
        schoolId:     user!.schoolId,
        content,
        isRead:       false,
        createdAt:    serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sent-messages', user?.schoolId] }),
  });
}

// Broadcast to all users in school
export function useBroadcastMessage() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, targetRole }: { content: string; targetRole?: string }) => {
      // Get all users in school
      const constraints: any[] = [where('schoolId', '==', user!.schoolId)];
      if (targetRole) constraints.push(where('role', '==', targetRole));

      const rolesSnap = await getDocs(query(collection(db, COLLECTIONS.USER_ROLES), ...constraints));
      const batch     = writeBatch(db);

      rolesSnap.docs.forEach((roleDoc) => {
        const receiverId = roleDoc.data().userId;
        if (receiverId === user!.id) return; // skip self

        const ref = doc(collection(db, COLLECTIONS.MESSAGES));
        batch.set(ref, {
          senderId:     user!.id,
          senderName:   user!.fullName,
          receiverId,
          receiverName: null,
          studentId:    null,
          schoolId:     user!.schoolId,
          content,
          isRead:       false,
          createdAt:    serverTimestamp(),
        });
      });

      await batch.commit();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sent-messages', user?.schoolId] }),
  });
}

// Mark message as read
export function useMarkMessageRead() {
  const { user } = useAuth();
  const qc       = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      await updateDoc(doc(db, COLLECTIONS.MESSAGES, messageId), { isRead: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', user?.id] }),
  });
}
