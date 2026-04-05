import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'teacher' | 'parent';

export interface AppUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: AppRole;
  isSuperAdmin: boolean;
  schoolId: string | null;
  schoolStatus: 'active' | 'suspended';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  subscriptionExpired: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<string | null>;
  signup: (phone: string, password: string, fullName: string, role?: AppRole, schoolId?: string) => Promise<string | null>;
  logout: () => Promise<void>;
  isRole: (role: AppRole) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@school.local`;
}

// Cache for active fetch promises to prevent concurrent race conditions
const activeFetchPromises = new Map<string, Promise<AppUser | null>>();
let lastEventUserId: string | null = null;
let lastEventTime = 0;

async function fetchAppUser(supaUser: SupabaseUser, retryCount = 0): Promise<AppUser | null> {
  // If there's already an active fetch for this user, return it
  if (activeFetchPromises.has(supaUser.id)) {
    return activeFetchPromises.get(supaUser.id)!;
  }

  const fetchPromise = (async () => {
    try {
      const normalizedPhone = normalizePhone((supaUser.user_metadata?.phone as string) || supaUser.phone || '');
      const isDeveloperUser = normalizedPhone === '0192837465' || supaUser.email === '0192837465@school.local';

      // Developer shortcut
      if (isDeveloperUser) {
        return {
          id: supaUser.id,
          email: supaUser.email || '',
          phone: normalizedPhone,
          fullName: (supaUser.user_metadata?.full_name as string) || 'المطور الماحي',
          role: 'admin' as AppRole,
          isSuperAdmin: true,
          schoolId: null,
          schoolStatus: 'active' as const,
          approvalStatus: 'approved' as const,
          subscriptionExpired: false,
        };
      }

      // Single RPC for all user data - prevents Auth Lock contention
      const { data: userData, error: rpcErr } = await (supabase as any).rpc('get_complete_user_data', { 
        p_user_id: supaUser.id 
      });

      if (rpcErr) {
        // If it's a lock error, we retry after a small delay
        if (rpcErr.message?.includes('AbortError') || rpcErr.message?.includes('Lock broken')) {
           if (retryCount < 3) {
             console.warn(`Auth Lock conflict detected, retrying (${retryCount + 1})...`);
             await new Promise(r => setTimeout(r, 100 * (retryCount + 1))); // Exponential backoff
             return fetchAppUser(supaUser, retryCount + 1);
           }
        }
        console.error('RPC fetch error (get_complete_user_data):', rpcErr);
        return null;
      }

      if (!userData) return null;

      const { profile, role, school } = userData as any;
      if (!profile || !role) return null;

      return {
        id: supaUser.id,
        email: supaUser.email || '',
        phone: profile.phone || normalizedPhone,
        fullName: profile.full_name || '',
        role: (role?.role || 'parent') as AppRole,
        isSuperAdmin: role?.is_super_admin || false,
        schoolId: profile?.school_id,
        schoolStatus: school?.status || 'active',
        approvalStatus: role?.approval_status || 'pending',
        subscriptionExpired: school?.subscription_end_date ? new Date(school.subscription_end_date) < new Date() : false,
      };
    } catch (error: any) {
      // Catch AbortError from navigator.locks or network layer
      if (error?.name === 'AbortError' || error?.message?.includes('Lock broken')) {
        if (retryCount < 3) {
          await new Promise(r => setTimeout(r, 100 * (retryCount + 1)));
          return fetchAppUser(supaUser, retryCount + 1);
        }
      }
    } finally {
      activeFetchPromises.delete(supaUser.id);
    }
  })();

  activeFetchPromises.set(supaUser.id, fetchPromise);
  return fetchPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const roleLabel = user?.isSuperAdmin ? 'المشرف العام'
    : user?.role === 'admin' ? 'مدير النظام'
    : user?.role === 'teacher' ? 'معلم ممارس'
    : user?.role === 'parent' ? 'ولي أمر معتمد'
    : 'زائر';

  const checkUserAccess = async (appUser: AppUser | null): Promise<string | null> => {
    if (!appUser) return 'فشل تحميل بيانات المستخدم';
    
    if (appUser.approvalStatus === 'pending') {
      return 'حسابك ما زال قيد المراجعة في انتظار موافقة الإدارة';
    }
    if (appUser.approvalStatus === 'rejected') {
      return 'تم رفض طلب انضمامك للمكتب الثقافي/المدرسة';
    }
    return null;
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const appUser = await fetchAppUser(session.user);
      // Removed checkUserAccess filter to keep pending users in the 'user' state
      setUser(prev => {
        if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
        return appUser;
      });
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const appUser = await fetchAppUser(session.user);
          if (isMounted) {
            setUser(prev => {
              if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
              return appUser;
            });
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initSession();

    // Handle Auth Events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log(`🔑 Auth Event: ${event} for user: ${session?.user?.id || 'none'}`);

      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed successfully');
      }

      if (event === 'SIGNED_OUT') {
        console.warn('🚪 User signed out or session expired');
        setUser(null);
        return;
      }

      const now = Date.now();
      const userId = session?.user?.id || null;
      
      // Deduplicate rapid-fire events for the same user (common in Strict Mode)
      if (userId === lastEventUserId && (now - lastEventTime) < 500) {
        return;
      }
      
      lastEventUserId = userId;
      lastEventTime = now;
      
      try {
        if (session?.user) {
          const appUser = await fetchAppUser(session.user);
          if (isMounted) {
            setUser(prev => {
              if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
              return appUser;
            });
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Auth Change Critical Error:", err);
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // Session timeout after 30 minutes of inactivity
      timeoutId = setTimeout(() => {
        if (user) {
          console.log('Session timeout due to inactivity');
          logout();
        }
      }, 30 * 60 * 1000);
    };

    if (user) {
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keypress', resetTimer);
      window.addEventListener('scroll', resetTimer);
      window.addEventListener('click', resetTimer);
      resetTimer();
    }

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('click', resetTimer);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  // Handle connection monitoring and session refresh
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🌐 Device back online. Refreshing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session) {
        await refreshUser();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const login = async (phone: string, password: string): Promise<string | null> => {
    try {
      const email = phoneToEmail(phone);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) return error.message === 'Invalid login credentials' 
        ? 'رقم الهاتف أو كلمة المرور غير صحيحة' 
        : error.message;

      if (data.session?.user) {
        // Wait for user context (profile + role)
        const appUser = await fetchAppUser(data.session.user);

        if (!appUser) {
          // If profile is missing but auth exists, it's a configuration error or pending initialization
          return 'حسابك غير مكتمل أو قيد المراجعة. يرجى مراجعة إدارة المنصة.';
        }

        // Allow pending users to log in, but reject 'rejected' status
        if (appUser.approvalStatus === 'rejected') {
          await supabase.auth.signOut();
          return 'تم رفض طلب انضمامك للمكتب الثقافي/المدرسة';
        }

        setUser(appUser);
      }
      return null;
    } catch (err: any) {
      return err.message || 'حدث خطأ أثناء تسجيل الدخول';
    }
  };

  const signup = async (phone: string, password: string, fullName: string, role?: AppRole, schoolId?: string): Promise<string | null> => {
    const normalizedPhone = normalizePhone(phone);
    const email = phoneToEmail(normalizedPhone);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { 
          full_name: fullName, 
          phone: normalizedPhone,
          role: role || 'parent',
          school_id: schoolId || null
        } 
      },
    });
    if (error) {
      if (error.message.includes('already registered')) return 'رقم الهاتف مسجل بالفعل';
      return error.message;
    }
    return null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isRole = (role: AppRole) => user?.role === role;

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
