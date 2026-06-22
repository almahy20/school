import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { AppUser } from '@/types/auth';
import {
  loginWithPhone,
  registerUser,
  signOut as firebaseSignOut,
  onAuthChange,
  fetchAppUser,
} from '@/lib/auth/authService';
import { getCachedUser, setCachedUser, clearUserCache } from '@/lib/storage/userCache';
import { queryClient } from '@/lib/queryClient';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthContextType {
  user:       AppUser | null;
  isLoading:  boolean;
  isReady:    boolean;
  login:      (phone: string, password: string) => Promise<string | null>;
  register:   (params: RegisterParams) => Promise<string | null>;
  logout:     () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterParams {
  phone:    string;
  password: string;
  fullName: string;
  role:     'teacher' | 'parent';
  schoolId: string;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady,   setIsReady]   = useState(false);

  // Load cached user immediately for instant UI
  useEffect(() => {
    getCachedUser().then((cached) => {
      if (cached) setUser(cached);
    });
  }, []);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = await fetchAppUser(firebaseUser);
        if (appUser) {
          setUser(appUser);
          await setCachedUser(appUser);
        } else {
          setUser(null);
          await clearUserCache();
        }
      } else {
        setUser(null);
        await clearUserCache();
        queryClient.clear();
      }
      setIsLoading(false);
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (phone: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    const { user: appUser, error } = await loginWithPhone(phone, password);
    if (appUser) {
      setUser(appUser);
      await setCachedUser(appUser);
    }
    setIsLoading(false);
    return error;
  }, []);

  const register = useCallback(async (params: RegisterParams): Promise<string | null> => {
    const { error } = await registerUser(params);
    return error;
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut();
    setUser(null);
    await clearUserCache();
    queryClient.clear();
  }, []);

  const refreshUser = useCallback(async () => {
    const { currentUser } = await import('@/lib/firebase/config').then(m => m.auth);
    if (currentUser) {
      const appUser = await fetchAppUser(currentUser);
      if (appUser) {
        setUser(appUser);
        await setCachedUser(appUser);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isReady, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
