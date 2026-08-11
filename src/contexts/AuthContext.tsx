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
    
    setSession(currentSession);
    
    if (currentSession?.user) {
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
    } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      logger.warn('[Auth] Explicit sign out or user delete');
      setUser(null);
      setCachedUser(null);
      localStorage.removeItem('last_auth_sync');
    } else if (!currentSession && event === 'INITIAL_SESSION') {
      logger.log('[Auth] No initial session found — will retry getSession after 3s');
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          logger.warn('[Auth] Confirmed no session after retry — clearing stale cache');
          setUser(null);
          setCachedUser(null);
          localStorage.removeItem('last_auth_sync');
        }
      }, 3000);
    } else if (!currentSession && event !== 'INITIAL_SESSION') {
      logger.warn('[Auth] Session became null (non-initial) — clearing cache');
      setUser(null);
      setCachedUser(null);
      localStorage.removeItem('last_auth_sync');
    }
    
    setIsLoading(false);
  };

  const forceSignOut = () => {
    logger.warn('[Auth] Force sign-out triggered by global event');
    try { queryClient.cancelQueries(); } catch (e) { logger.warn('[Auth] cancelQueries error:', e); }
    clearAllCache();
    setUser(null);
    setSession(null);
    setCachedUser(null);
    localStorage.removeItem('last_auth_sync');
    supabase.auth.signOut().catch((e) => logger.warn('[Auth] signOut after force:', e));
  };

  useEffect(() => {
    const onForceSignout = () => forceSignOut();
    window.addEventListener('auth:force-signout', onForceSignout);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        syncUser(session, 'INITIAL_SESSION');
      })
      .catch((error) => {
        logger.warn('[Auth] Failed to get initial session:', error);
        syncUser(null, 'INITIAL_SESSION');
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          logger.log('[Auth] Token refreshed successfully');
        }
        
        if (event === 'SIGNED_OUT') {
          try { queryClient.cancelQueries(); } catch {}
          clearAllCache();
        }

        if (event === 'TOKEN_REFRESH_FAILED') {
          logger.warn('[Auth] TOKEN_REFRESH_FAILED event — emergency cleanup');
          try { queryClient.cancelQueries(); } catch {}
          forceSignOut();
          return;
        }

        if (!session && event !== 'INITIAL_SESSION' && event !== 'SIGNED_OUT') {
          logger.warn(`[Auth] session=null on event ${event} — cleanup`);
          try { queryClient.cancelQueries(); } catch {}
          forceSignOut();
          return;
        }

        syncUser(session, event);
      }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.log('[Auth] App focused, checking session...');
        supabase.auth.getSession()
          .then(({ data: { session } }) => {
            if (session) {
              syncUser(session, 'VISIBILITY_CHANGE');
            } else {
              logger.warn('[Auth] No session on focus — triggering cleanup');
              forceSignOut();
            }
          })
          .catch((error) => {
            logger.warn('[Auth] Session check failed on focus:', error);
          });
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('auth:force-signout', onForceSignout);
    };
  }, []);


  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    await clearAllCache();
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
