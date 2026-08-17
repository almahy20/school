import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppUser, AppRole } from '@/types/auth';
import { logger } from '@/utils/logger';
import { getCachedUser, setCachedUser } from '@/lib/userCache';
import { queryClient, clearAllCache } from '@/lib/queryClient';

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  login: (phone: string, password: string) => Promise<string | null>;
  signup: (phone: string, password: string, fullName: string, role: string, schoolId: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * دالة بسيطة لجلب بيانات المستخدم الإضافية (الرتبة والمدرسة)
 * ✅ تحسين: منع الطلبات المتكررة نهائياً عبر Singleton Pattern صارم
 */
let userFetchPromise: Promise<AppUser | null> | null = null;
let currentFetchingId: string | null = null;

// ✅ Flag للتمييز بين logout يدوي وانتهاء الـ token تلقائياً
let isManualSignOut = false;

async function getAppUserData(supaUser: SupabaseUser): Promise<AppUser | null> {
  // 1. If we are already fetching for THIS user, return the same promise
  if (userFetchPromise && currentFetchingId === supaUser.id) {
    logger.log('[Auth] Reusing existing fetch promise for:', supaUser.id);
    return userFetchPromise;
  }

  // 2. Start a new fetch
  logger.log('[Auth] Starting fresh singleton fetch for:', supaUser.id);
  currentFetchingId = supaUser.id;
  
  userFetchPromise = (async () => {
    try {
      const { data: userData, error } = await supabase.rpc('get_complete_user_data', { 
        p_user_id: supaUser.id 
      });

      if (error || !userData) {
        logger.error('Error fetching app user data:', error);
        return null;
      }

      const { profile, role, school } = userData as any;

      // ✅ Seed branding cache from RPC — eliminates separate schools HTTP request
      if (school && profile?.school_id) {
        const brandingData = {
          id: school.id,
          name: school.name,
          logo_url: school.logo_url || null,
          slug: school.slug,
        };
        queryClient.setQueryData(['school-branding', profile.school_id], brandingData);
        try {
          localStorage.setItem(`branding_${profile.school_id}`, JSON.stringify(brandingData));
        } catch { /* ignore quota errors */ }
      }

      return {
        id: supaUser.id,
        email: supaUser.email || '',
        phone: profile?.phone || '',
        fullName: profile?.full_name || '',
        role: (role?.role || 'parent') as AppRole,
        isSuperAdmin: role?.is_super_admin || false,
        schoolId: profile?.school_id,
        schoolStatus: school?.status || 'active',
        approvalStatus: role?.approval_status || 'approved',
        subscriptionExpired: false,
      };
    } catch (err) {
      logger.error('Unexpected error in getAppUserData:', err);
      return null;
    } finally {
      // ✅ Keep the promise cached for 10 seconds to swallow all initial events (SESSION, SIGNED_IN, etc)
      setTimeout(() => {
        if (currentFetchingId === supaUser.id) {
          userFetchPromise = null;
          currentFetchingId = null;
        }
      }, 10000); 
    }
  })();

  return userFetchPromise;
}

/**
 * Prefetch common queries when user logs in to improve initial load performance
 */
async function prefetchCommonQueries(appUser: AppUser) {
  try {
    // Prefetch user's own profile
    queryClient.prefetchQuery({
      queryKey: ['profile', appUser.id],
      queryFn: async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', appUser.id)
          .maybeSingle();
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });

    // Prefetch all profiles for messaging (IDs only) - ONLY FOR ADMINS/TEACHERS
    if (appUser.schoolId && (appUser.role === 'admin' || appUser.role === 'teacher')) {
      queryClient.prefetchQuery({
        queryKey: ['all-profiles', appUser.schoolId],
        queryFn: async () => {
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('school_id', appUser.schoolId)
            .neq('id', appUser.id);
          
          return (data || []).map((p: any) => p.id);
        },
        staleTime: 5 * 60 * 1000,
      });
    }

    logger.log('[Prefetch] Common queries prefetched for user:', appUser.id);
  } catch (err) {
    logger.error('[Prefetch] Error prefetching queries:', err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  
  const [user, setUser] = useState<AppUser | null>(() => getCachedUser());

  const [isLoading, setIsLoading] = useState(true);

  const syncUser = async (currentSession: Session | null, event?: string) => {
    logger.log(`[Auth] Syncing user for event: ${event || 'initial'}`);

    if (currentSession?.user) {
      // ✅ فيه session حقيقية — حدّث الـ state
      setSession(currentSession);
      const appUser = await getAppUserData(currentSession.user);

      if (appUser) {
        setUser(appUser);
        setCachedUser(appUser);
        localStorage.setItem('last_auth_sync', Date.now().toString());

        const deferPrefetch = () => {
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => prefetchCommonQueries(appUser), { timeout: 2000 });
          } else {
            setTimeout(() => prefetchCommonQueries(appUser), 1000);
          }
        };
        deferPrefetch();
      }
    } else if (event === 'SIGNED_OUT') {
      // ✅ الحالة الوحيدة اللي نمسح فيها المستخدم — تسجيل خروج يدوي
      logger.warn('[Auth] Manual sign out — clearing user');
      setSession(null);
      setUser(null);
      setCachedUser(null);
      localStorage.removeItem('last_auth_sync');
    } else {
      // ✅ كل الحالات التانية (token expired, network error, null session, etc.)
      // — نفضل logged in ومنعملش حاجة
      logger.log(`[Auth] Session null on event "${event}" — keeping user logged in (manual sign out only)`);
    }

    setIsLoading(false);
  };

  const forceSignOut = () => {
    // ✅ هذه الدالة بتشتغل بس من تسجيل الخروج اليدوي
    logger.warn('[Auth] Manual sign-out triggered');
    isManualSignOut = true; // ✅ نرفع الـ flag قبل signOut
    try { queryClient.cancelQueries(); } catch (e) { logger.warn('[Auth] cancelQueries error:', e); }
    clearAllCache();
    setUser(null);
    setSession(null);
    setCachedUser(null);
    localStorage.removeItem('last_auth_sync');
    supabase.auth.signOut().catch((e) => logger.warn('[Auth] signOut error:', e));
  };

  useEffect(() => {
    // ✅ أوقفنا auth:force-signout — مش محتاجينه بعد كده
    // window.addEventListener('auth:force-signout', ...) — removed intentionally

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        syncUser(session, 'INITIAL_SESSION');
      })
      .catch((error) => {
        logger.warn('[Auth] Failed to get initial session:', error);
        // ✅ لو فشل (offline) — نفضل logged in من الـ cache
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          logger.log('[Auth] Token refreshed successfully');
          syncUser(session, event);
          return;
        }

        if (event === 'SIGNED_OUT') {
          // ✅ نمسح المستخدم بس لو كان logout يدوي — مش انتهاء token تلقائي
          if (isManualSignOut) {
            logger.warn('[Auth] Manual SIGNED_OUT event — clearing user');
            isManualSignOut = false;
            try { queryClient.cancelQueries(); } catch {}
            clearAllCache();
            syncUser(null, 'SIGNED_OUT');
          } else {
            logger.log('[Auth] Supabase-triggered SIGNED_OUT (token expired?) — keeping user logged in');
            // محاولة تجديد الـ session في الخلفية
            supabase.auth.refreshSession().catch(() => {
              logger.log('[Auth] Refresh failed after SIGNED_OUT — user stays logged in from cache');
            });
          }
          return;
        }

        // ✅ كل الأحداث التانية (TOKEN_REFRESH_FAILED, USER_UPDATED, etc.)
        // لو فيه session جديدة — حدّث. لو مفيش — ابقى logged in
        if (session) {
          syncUser(session, event);
        } else {
          logger.log(`[Auth] Event "${event}" with no session — keeping user logged in`);
        }
      }
    );

    // ✅ Visibility change — بس للتحديث لو فيه session جديدة، مش للـ logout
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession()
          .then(({ data: { session } }) => {
            if (session) {
              logger.log('[Auth] App focused — refreshing session');
              syncUser(session, 'VISIBILITY_CHANGE');
            }
            // ✅ لو مفيش session — نفضل logged in من الـ cache
          })
          .catch(() => {
            // offline — مش نعمل حاجة
          });
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);


  const signOut = async () => {
    isManualSignOut = true; // ✅ نرفع الـ flag قبل signOut
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    await clearAllCache();
    setCachedUser(null);
  };

  const login = async (phone: string, password: string): Promise<string | null> => {
    try {
      const email = `${phone}@edara.com`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return 'رقم الهاتف أو كلمة المرور غير صحيحة';
        }
        return error.message;
      }
      
      // ✅ Set signup time to trigger PWA prompt
      sessionStorage.setItem('user_signup_time', Date.now().toString());
      
      return null;
    } catch (err) {
      return 'حدث خطأ غير متوقع أثناء تسجيل الدخول';
    }
  };

  const signup = async (phone: string, password: string, fullName: string, role: string, schoolId: string): Promise<string | null> => {
    try {
      const email = `${phone}@edara.com`;
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone, // ✅ إضافة رقم الهاتف
            role: role,
            school_id: schoolId
          }
        }
      });
      if (error) return error.message;
      return null;
    } catch (err: any) {
      return err.message;
    }
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await syncUser(session);
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, signOut, refreshUser, login, signup }}>
      {children}
    </AuthContext.Provider>
  );

}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
