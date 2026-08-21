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

// ── Singleton fetch — منع الطلبات المتكررة ───────────────────────────────────
let userFetchPromise: Promise<AppUser | null> | null = null;
let currentFetchingId: string | null = null;
let loginSessionPromise: Promise<AppUser | null> | null = null; // منع double applySession من onAuthStateChange

async function buildAppUserFromDirectQueries(supaUser: SupabaseUser): Promise<AppUser | null> {
  try {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', supaUser.id).maybeSingle(),
      supabase.from('user_roles').select('*').eq('user_id', supaUser.id).maybeSingle(),
    ]);

    const profile = profileRes.data as any;
    const role = roleRes.data as any;
    let school: any = null;

    if (profile?.school_id) {
      const schoolRes = await supabase.from('schools').select('*').eq('id', profile.school_id).maybeSingle();
      school = schoolRes.data;
    }

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
    logger.error('[Auth] Direct fallback query also failed:', err);
    return null;
  }
}

async function getAppUserData(supaUser: SupabaseUser): Promise<AppUser | null> {
  if (userFetchPromise && currentFetchingId === supaUser.id) {
    return userFetchPromise;
  }

  currentFetchingId = supaUser.id;

  userFetchPromise = (async () => {
    try {
      let profile: any = null;
      let role: any = null;
      let school: any = null;

      try {
        const { data: userData, error } = await supabase.rpc('get_complete_user_data', {
          p_user_id: supaUser.id,
        });

        if (error || !userData) {
          logger.warn('[Auth] RPC get_complete_user_data failed, using direct table fallback:', error);
          throw new Error('rpc_failed');
        }

        const parsed = userData as any;
        profile = parsed.profile;
        role = parsed.role;
        school = parsed.school;
      } catch (rpcErr) {
        const fallbackUser = await buildAppUserFromDirectQueries(supaUser);
        if (fallbackUser) return fallbackUser;
        return null;
      }

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
      // Reset singleton lock after 30 seconds to allow re-fetch if session changes
      // (30s is safe: login flow takes <5s under normal conditions)
      setTimeout(() => {
        if (currentFetchingId === supaUser.id) {
          userFetchPromise = null;
          currentFetchingId = null;
        }
      }, 30000);
    }
  })();

  return userFetchPromise;
}

async function prefetchCommonQueries(appUser: AppUser) {
  try {
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
  } catch (err) {
    logger.error('[Prefetch] Error prefetching queries:', err);
  }
}

// ── الدالة الوحيدة لتسجيل الخروج الكامل ─────────────────────────────────────
// لا تُستدعى إلا من زر تسجيل الخروج اليدوي
async function performSignOut(
  setUser: (u: AppUser | null) => void,
  setSession: (s: Session | null) => void,
) {
  logger.warn('[Auth] Manual sign out — clearing everything');
  try { queryClient.cancelQueries(); } catch {}
  clearAllCache();
  setUser(null);
  setSession(null);
  setCachedUser(null);
  localStorage.removeItem('last_auth_sync');
  try { await supabase.auth.signOut(); } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(() => getCachedUser());
  // If we have a cached user, start with isLoading=false to avoid spinner on reload
  const [isLoading, setIsLoading] = useState(() => getCachedUser() === null);

  // ── حدّث الـ state لما تكون فيه session صحيحة ─────────────────────────────
  const applySession = async (s: Session) => {
    setSession(s);
    const appUser = await getAppUserData(s.user);
    if (appUser) {
      setUser(appUser);
      setCachedUser(appUser);
      localStorage.setItem('last_auth_sync', Date.now().toString());
      const defer = () => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => prefetchCommonQueries(appUser), { timeout: 2000 });
        } else {
          setTimeout(() => prefetchCommonQueries(appUser), 1000);
        }
      };
      defer();
    }
  };

  // ── محاولة تجديد الـ token بصمت ───────────────────────────────────────────
  const silentRefresh = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        await applySession(data.session);
        logger.log('[Auth] Silent refresh succeeded');
        return true;
      }
    } catch {}
    logger.log('[Auth] Silent refresh failed — keeping cached user');
    return false;
  };

  useEffect(() => {
    // ── 1. تحميل أولي ───────────────────────────────────────────────────────
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          await applySession(session);
        } else {
          // مفيش session — نحاول refresh صامت
          // لو فشل نفضل على الـ cached user (مش نطرد المستخدم)
          await silentRefresh();
        }
        setIsLoading(false);
      })
      .catch(() => {
        // offline أو خطأ شبكة — نفضل logged in من الـ cache
        logger.warn('[Auth] Failed to get initial session (offline?) — keeping cached user');
        setIsLoading(false);
      });

    // ── 2. Supabase auth events ──────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, eventSession) => {
        logger.log(`[Auth] Event: ${event}`);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          // Skip if login() is already handling this session — await it instead of double-fetching
          if (event === 'SIGNED_IN' && loginSessionPromise) {
            logger.log('[Auth] SIGNED_IN event — login() in progress, awaiting its result');
            await loginSessionPromise;
            return;
          }
          if (eventSession) await applySession(eventSession);
          return;
        }

        if (event === 'SIGNED_OUT') {
          // لا نعمل أي حاجة — تسجيل الخروج يحصل بس من performSignOut
          // Supabase ممكن يبعت SIGNED_OUT تلقائياً أثناء تسجيل دخول جديد (token rotation)
          // نتحقق أولاً لو فيه session فعلية قبل ما نحاول refresh
          logger.log('[Auth] SIGNED_OUT event received — checking current session first');
          try {
            const { data: { session: currentSess } } = await supabase.auth.getSession();
            if (currentSess) {
              // فيه session جديدة بالفعل (حصل login جديد) — مش محتاجين نعمل حاجة
              logger.log('[Auth] SIGNED_OUT ignored — active session exists');
              return;
            }
          } catch { /* offline */ }
          // مفيش session — نحاول refresh صامت
          await silentRefresh();
          return;
        }

        if (event === 'TOKEN_REFRESH_FAILED') {
          // الـ token مش صالح — نحاول refresh مرة أخيرة
          // لو فشل نفضل على الـ cached user (مش نطرد)
          logger.warn('[Auth] TOKEN_REFRESH_FAILED — retrying once');
          await silentRefresh();
          return;
        }

        // أي event تاني مع session → حدّث
        if (eventSession) await applySession(eventSession);
      }
    );

    // ── 3. لما المستخدم يرجع للتاب ──────────────────────────────────────────
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          // جدد لو قارب ينتهي خلال 10 دقايق
          const expiresAt = currentSession.expires_at ?? 0;
          if (expiresAt - Math.floor(Date.now() / 1000) < 10 * 60) {
            logger.log('[Auth] Visibility — token expiring soon, refreshing');
            await silentRefresh();
          }
        } else {
          // مفيش session — نحاول refresh صامت
          await silentRefresh();
        }
      } catch { /* offline */ }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    // ── 4. Proactive refresh كل 4 دقايق ─────────────────────────────────────
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          await silentRefresh();
          return;
        }
        const expiresAt = currentSession.expires_at ?? 0;
        if (expiresAt - Math.floor(Date.now() / 1000) < 10 * 60) {
          logger.log('[Auth] Proactive refresh — token expiring soon');
          await silentRefresh();
        }
      } catch { /* ignore */ }
    }, 4 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── تسجيل الخروج اليدوي فقط ─────────────────────────────────────────────
  const signOut = async () => {
    await performSignOut(setUser, setSession);
  };

  const login = async (phone: string, password: string): Promise<string | null> => {
    try {
      const email = `${phone}@edara.com`;

      // ضع placeholder في loginSessionPromise قبل الـ signIn
      // علشان أي SIGNED_IN event يجي فوراً يشوف إن login شغال وينتظر
      let resolveLogin!: () => void;
      loginSessionPromise = new Promise<AppUser | null>((resolve) => {
        resolveLogin = () => resolve(null);
      });

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        loginSessionPromise = null;
        if (error.message.includes('Invalid login credentials')) {
          return 'رقم الهاتف أو كلمة المرور غير صحيحة';
        }
        return error.message;
      }
      if (data.session) {
        // Reset singleton lock so fresh user data is fetched
        userFetchPromise = null;
        currentFetchingId = null;
        try {
          await applySession(data.session);
        } finally {
          setIsLoading(false);
          resolveLogin();
          loginSessionPromise = null;
        }
      } else {
        resolveLogin();
        loginSessionPromise = null;
      }
      sessionStorage.setItem('user_signup_time', Date.now().toString());
      return null;
    } catch {
      loginSessionPromise = null;
      setIsLoading(false);
      return 'حدث خطأ غير متوقع أثناء تسجيل الدخول';
    }
  };

  const signup = async (
    phone: string,
    password: string,
    fullName: string,
    role: string,
    schoolId: string,
  ): Promise<string | null> => {
    try {
      const email = `${phone}@edara.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, role, school_id: schoolId },
        },
      });
      if (error) return error.message;
      return null;
    } catch (err: any) {
      return err.message;
    }
  };

  const refreshUser = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) await applySession(s);
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
