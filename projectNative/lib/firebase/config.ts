import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

/**
 * Firebase Configuration
 * يتم جلب هذه القيم من ملف .env (EXPO_PUBLIC_...)
 */
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// التحقق من وجود الإعدادات الأساسية
const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';

if (!isConfigValid && !__DEV__) {
  console.error('[Firebase] Configuration is missing! Please check your .env file.');
}

// Prevent duplicate initialization (important for hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// تهيئة Firestore مع دعم التخزين المحلي (Offline Persistence)
// في الويب نستخدم persistentLocalCache، وفي الموبايل يتم تفعيلها تلقائياً
const db = initializeFirestore(app, {
  localCache: Platform.OS === 'web' 
    ? persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      })
    : undefined // Native handles this differently or automatically
});

export const auth    = getAuth(app);
export const storage = getStorage(app);

export { db };
export default app;

