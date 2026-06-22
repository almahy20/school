import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { AdminStats } from '@/types/models';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export function useAdminStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-stats', user?.schoolId],
    enabled:  !!user?.schoolId && user.role === 'admin',
    staleTime: 2 * 60 * 1000, // 2 minutes
    queryFn:  async (): Promise<AdminStats> => {
      const schoolId = user!.schoolId!;
      const today    = format(new Date(), 'yyyy-MM-dd');

      // Run all counts in parallel
      const [
        studentsSnap,
        teachersSnap,
        parentsSnap,
        classesSnap,
        todayAttendanceSnap,
        feesSnap,
        complaintsSnap,
      ] = await Promise.all([
        getCountFromServer(query(collection(db, COLLECTIONS.STUDENTS),  where('schoolId', '==', schoolId))),
        getCountFromServer(query(collection(db, COLLECTIONS.USER_ROLES), where('schoolId', '==', schoolId), where('role', '==', 'teacher'))),
        getCountFromServer(query(collection(db, COLLECTIONS.USER_ROLES), where('schoolId', '==', schoolId), where('role', '==', 'parent'))),
        getCountFromServer(query(collection(db, COLLECTIONS.CLASSES),   where('schoolId', '==', schoolId))),
        getDocs(query(collection(db, COLLECTIONS.ATTENDANCE), where('schoolId', '==', schoolId), where('date', '==', today))),
        getDocs(query(collection(db, COLLECTIONS.FEES), where('schoolId', '==', schoolId))),
        getCountFromServer(query(collection(db, COLLECTIONS.COMPLAINTS), where('schoolId', '==', schoolId), where('status', '==', 'pending'))),
      ]);

      const totalStudents = studentsSnap.data().count;

      // Attendance rate
      const presentToday = todayAttendanceSnap.docs.filter(d => d.data().status === 'present').length;
      const todayAttendanceRate = totalStudents > 0
        ? Math.round((presentToday / totalStudents) * 100)
        : 0;

      // Fees
      let totalFeesCollected = 0;
      let totalFeesDue       = 0;
      feesSnap.docs.forEach((d) => {
        const data = d.data();
        totalFeesCollected += data.amountPaid  ?? 0;
        totalFeesDue       += data.amountDue   ?? 0;
      });

      return {
        totalStudents,
        totalTeachers:       teachersSnap.data().count,
        totalParents:        parentsSnap.data().count,
        totalClasses:        classesSnap.data().count,
        todayAttendanceRate,
        totalFeesCollected,
        totalFeesDue,
        pendingComplaints:   complaintsSnap.data().count,
      };
    },
  });
}
