import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { AppUser, AppRole } from '@/types/auth';

/**
 * تحويل رقم الهاتف إلى إيميل للاستخدام مع Firebase Auth
 */
export function phoneToEmail(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '').replace(/^0/, '');
  return `${cleaned}@school-app.com`;
}

/**
 * جلب بيانات المستخدم الكاملة من Firestore
 */
export async function fetchAppUser(firebaseUser: FirebaseUser): Promise<AppUser | null> {
  try {
    // جلب الـ profile
    const profileRef = doc(db, COLLECTIONS.PROFILES, firebaseUser.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) return null;
    const profile = profileSnap.data();

    // جلب الـ role
    const roleRef = doc(db, COLLECTIONS.USER_ROLES, firebaseUser.uid);
    const roleSnap = await getDoc(roleRef);

    if (!roleSnap.exists()) return null;
    const roleData = roleSnap.data();

    // جلب بيانات المدرسة
    let schoolName: string | null = null;
    let schoolLogo: string | null = null;
    let schoolStatus: 'active' | 'suspended' = 'active';
    let subscriptionExpired = false;

    if (profile.schoolId) {
      const schoolRef = doc(db, COLLECTIONS.SCHOOLS, profile.schoolId);
      const schoolSnap = await getDoc(schoolRef);
      if (schoolSnap.exists()) {
        const school = schoolSnap.data();
        schoolName   = school.name || null;
        schoolLogo   = school.logoUrl || null;
        schoolStatus = school.status || 'active';

        if (school.subscriptionEndDate) {
          subscriptionExpired = new Date(school.subscriptionEndDate) < new Date();
        }
      }
    }

    return {
      id:                 firebaseUser.uid,
      email:              firebaseUser.email || '',
      phone:              profile.phone || '',
      fullName:           profile.fullName || '',
      role:               (roleData.role || 'parent') as AppRole,
      isSuperAdmin:       roleData.isSuperAdmin || false,
      schoolId:           profile.schoolId || null,
      schoolName,
      schoolLogo,
      schoolStatus,
      approvalStatus:     roleData.approvalStatus || 'approved',
      subscriptionExpired,
      specialization:     profile.specialization || null,
      lastSeen:           profile.lastSeen || null,
    };
  } catch (error) {
    console.error('[AuthService] fetchAppUser error:', error);
    return null;
  }
}

import { seedInitialData } from '../firebase/seed';

/**
 * إنشاء حساب المدير الأول وتهيئة المدرسة
 */
export async function createAdminAccount(params: {
  phone:    string;
  password: string;
  fullName: string;
  schoolName: string;
  schoolSlug: string;
}): Promise<{ error: string | null }> {
  try {
    const email = phoneToEmail(params.phone);
    // 1. إنشاء المستخدم في Firebase Auth
    const credential = await createUserWithEmailAndPassword(auth, email, params.password);
    
    // 2. تهيئة المدرسة والبيانات الأساسية للمدير
    await seedInitialData(credential.user.uid, {
      name: params.schoolName,
      slug: params.schoolSlug,
    });

    // تحديث الاسم في Auth
    await updateProfile(credential.user, { displayName: params.fullName });

    return { error: null };
  } catch (err: any) {
    console.error('[AuthService] createAdminAccount error:', err);
    if (err.code === 'auth/email-already-in-use') {
      return { error: 'رقم الهاتف مسجل مسبقاً' };
    }
    return { error: err.message || 'حدث خطأ أثناء إنشاء حساب المدير' };
  }
}

/**
 * تسجيل الدخول برقم الهاتف وكلمة المرور
 */
export async function loginWithPhone(
  phone: string,
  password: string
): Promise<{ user: AppUser | null; error: string | null }> {
  try {
    const email = phoneToEmail(phone);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const appUser = await fetchAppUser(credential.user);

    if (!appUser) {
      return { user: null, error: 'لم يتم العثور على بيانات المستخدم' };
    }

    // تحديث آخر ظهور
    await updateDoc(doc(db, COLLECTIONS.PROFILES, credential.user.uid), {
      lastSeen: serverTimestamp(),
    });

    return { user: appUser, error: null };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return { user: null, error: 'رقم الهاتف أو كلمة المرور غير صحيحة' };
    }
    if (code === 'auth/user-not-found') {
      return { user: null, error: 'لا يوجد حساب بهذا الرقم' };
    }
    if (code === 'auth/too-many-requests') {
      return { user: null, error: 'تم تجاوز عدد المحاولات، حاول لاحقاً' };
    }
    return { user: null, error: 'حدث خطأ غير متوقع، حاول مرة أخرى' };
  }
}

/**
 * إنشاء حساب جديد
 */
export async function registerUser(params: {
  phone: string;
  password: string;
  fullName: string;
  role: AppRole;
  schoolId: string;
}): Promise<{ error: string | null }> {
  try {
    const email = phoneToEmail(params.phone);
    const credential = await createUserWithEmailAndPassword(auth, email, params.password);
    const uid = credential.user.uid;

    // تحديث اسم المستخدم في Firebase Auth
    await updateProfile(credential.user, { displayName: params.fullName });

    const now = serverTimestamp();

    // إنشاء الـ profile
    await setDoc(doc(db, COLLECTIONS.PROFILES, uid), {
      id:             uid,
      fullName:       params.fullName,
      email,
      phone:          params.phone,
      schoolId:       params.schoolId,
      specialization: null,
      lastSeen:       now,
      createdAt:      now,
      updatedAt:      now,
    });

    // إنشاء الـ role
    await setDoc(doc(db, COLLECTIONS.USER_ROLES, uid), {
      id:             uid,
      userId:         uid,
      role:           params.role,
      schoolId:       params.schoolId,
      isSuperAdmin:   false,
      approvalStatus: 'pending',
      createdAt:      now,
    });

    return { error: null };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') {
      return { error: 'رقم الهاتف مسجل مسبقاً' };
    }
    if (code === 'auth/weak-password') {
      return { error: 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل' };
    }
    return { error: 'حدث خطأ أثناء إنشاء الحساب' };
  }
}

/**
 * تسجيل الخروج
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * الاستماع لتغييرات حالة المصادقة
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
