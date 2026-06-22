import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types/models';

/**
 * جلب المعلمين في المدرسة
 */
export function useTeachers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teachers', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn:  async () => {
      // 1. جلب الأدوار (Roles)
      const qRoles = query(
        collection(db, COLLECTIONS.USER_ROLES),
        where('schoolId', '==', user!.schoolId),
        where('role', '==', 'teacher')
      );
      const rolesSnap = await getDocs(qRoles);
      const userIds = rolesSnap.docs.map(d => d.data().userId);
      if (userIds.length === 0) return [];

      // 2. جلب البروفايلات
      const qProfiles = query(
        collection(db, COLLECTIONS.PROFILES),
        where('schoolId', '==', user!.schoolId),
        where('id', 'in', userIds.slice(0, 10))
      );
      const profilesSnap = await getDocs(qProfiles);
      return profilesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Profile));
    },
  });
}

/**
 * جلب أولياء الأمور في المدرسة
 */
export function useParents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parents', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn:  async () => {
      const qRoles = query(
        collection(db, COLLECTIONS.USER_ROLES),
        where('schoolId', '==', user!.schoolId),
        where('role', '==', 'parent')
      );
      const rolesSnap = await getDocs(qRoles);
      const userIds = rolesSnap.docs.map(d => d.data().userId);
      if (userIds.length === 0) return [];

      const qProfiles = query(
        collection(db, COLLECTIONS.PROFILES),
        where('schoolId', '==', user!.schoolId),
        where('id', 'in', userIds.slice(0, 10))
      );
      const profilesSnap = await getDocs(qProfiles);
      return profilesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Profile));
    },
  });
}
