import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS } from './collections';

/**
 * دالة لتهيئة بيانات المدرسة الأولى والمدير العام
 * تُستخدم لمرة واحدة عند بدء المشروع
 */
export async function seedInitialData(adminUid: string, schoolData: {
  name: string;
  slug: string;
}) {
  const schoolId = 'main-school'; // معرف ثابت للمدرسة الأولى أو يمكن توليده

  try {
    console.log('[Seed] Starting database initialization...');

    // 1. إنشاء المدرسة
    await setDoc(doc(db, COLLECTIONS.SCHOOLS, schoolId), {
      id: schoolId,
      name: schoolData.name,
      slug: schoolData.slug,
      status: 'active',
      plan: 'enterprise',
      createdAt: new Date().toISOString(),
      subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // سنة من الآن
    });
    console.log('[Seed] School created successfully.');

    // 2. إنشاء بروفايل المدير
    await setDoc(doc(db, COLLECTIONS.PROFILES, adminUid), {
      id: adminUid,
      fullName: 'المدير العام',
      schoolId: schoolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('[Seed] Admin profile created successfully.');

    // 3. تعيين الصلاحيات (Super Admin)
    await setDoc(doc(db, COLLECTIONS.USER_ROLES, adminUid), {
      id: adminUid,
      userId: adminUid,
      role: 'admin',
      isSuperAdmin: true,
      approvalStatus: 'approved',
      schoolId: schoolId,
      createdAt: new Date().toISOString(),
    });
    console.log('[Seed] Admin roles assigned successfully.');

    return { success: true, schoolId };
  } catch (error) {
    console.error('[Seed] Error during initialization:', error);
    throw error;
  }
}
