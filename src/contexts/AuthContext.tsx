import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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
  login: (phone: string, password: string, rememberMe?: boolean) => Promise<string | null>;
  signup: (phone: string, password: string, fullName: string, role: string, schoolId: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Build a partial AppUser instantly from JWT claims (zero network) ──────────
function buildUserFromJwt(supaUser: SupabaseUser): AppUser | null {
  try {
    const app = supaUser.app_metadata as any;
    const meta = supaUser.user_metadata as any;
    const role: AppRole = (app?.role || meta?.role || 'parent') as AppRole;
    // school_id comes from app_metadata when the custom JWT hook is active,
    // falling back to user_metadata for older tokens / first-login before hook fires
    const schoolId: string | undefined =
      (app?.school_id ? String(app.school_id) : undefined) ||
      (meta?.school_id ? String(meta.school_id) : undefined);
    const fullName: string = meta?.full_name || '';
    const phone: string = meta?.phone || '';
    const isSuperAdmin: boolean = !!(app?.is_super_admin || meta?.is_super_admin);
    // approval_status is now embedded in the JWT by the custom hook,
    // so we can use it immediately instead of defaulting to 'approved'
    const approvalStatus = (app?.approval_status || 'approved') as 'approved' | 'pending' | 'rejected';

    // Load cached branding so dashboard renders with the correct logo immediately
    let schoolStatus = 'active';
    if (schoolId) {
      try {
        const cached = localStorage.getItem(`branding_${schoolId}`);
        if (cached) {
          const b = JSON.parse(cached);
          schoolStatus = b.status || 'active';
          queryClient.setQueryData(['school-branding', schoolId], b);
        }
      } catch { /* ignore */ }
    }

    return {
      id: supaUser.id,
      email: supaUser.email || '',
      phone,
      fullName,
      role,
      isSuperAdmin,
      schoolId,
      schoolStatus,
      approvalStatus, // from JWT when hook is active, else 'approved' default
      subscriptionExpired: false,
    };
  } catch {
    return null;
  }
}

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
      const b = { id: school.id, name: school.name, logo_url: school.logo_url || null, slug: school.slug };
      queryClient.setQueryData(['school-branding', profile.school_id], b);
      try { localStorage.setItem(`branding_${profile.school_id}`, JSON.stringify(b)); } catch { /* ignore */ }
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
    logger.error('[Auth] Direct fallback query failed:', err);
    return null;
  }
}

async function getAppUserData(supaUser: SupabaseUser): Promise<AppUser | null> {
  try {
    const { data: userData, error } = await supabase.rpc('get_complete_user_data', { p_user_id: supaUser.id });
    if (error || !userData) throw new Error('rpc_failed');
    const { profile, role, school } = userData as any;
    if (school && profile?.school_id) {
      const b = { id: school.id, name: school.name, logo_url: school.logo_url || null, slug: school.slug };
      queryClient.setQueryData(['school-branding', profile.school_id], b);
      try { localStorage.setItem(`branding_${profile.school_id}`, JSON.stringify(b)); } catch { /* ignore */ }
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
  } catch {
    return buildAppUserFromDirectQueries(supaUser);
  }
}

async function prefetchCommonQueries(appUser: AppUser) {
  try {
    queryClient.prefetchQuery({
      queryKey: ['profile', appUser.id],
      queryFn: async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', appUser.id).maybeSingle();
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
    if (appUser.schoolId && (appUser.role === 'admin' || appUser.role === 'teacher')) {
      queryClient.prefetchQuery({
        queryKey: ['all-profiles', appUser.schoolId],
        queryFn: async () => {
          const { data } = await supabase.from('profiles').select('id').eq('school_id', appUser.schoolId).neq('id', appUser.id);
          return (data || []).map((p: any) => p.id);
        },
        staleTime: 5 * 60 * 1000,
      });
    }
  } catch (err) {
    logger.error('[Prefetch] Error:', err);
  }
}

async function performSignOut(
  setUser: (u: AppUser | null) => void,
  setSession: (s: Session | null) => void,
) {
  try { queryClient.cancelQueries(); } catch (_e) { /* ignore */ }
  clearAllCache();
  setUser(null);
  setSession(null);
  setCachedUser(null);
  localStorage.removeItem('last_auth_sync');
  try { await supabase.auth.signOut(); } catch (_e) { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState(() => getCachedUser() === null);

  const isSigningOutRef = useRef(false);
  // Tracks the user ID currently being loaded — prevents duplicate RPC calls for same user
  const loadingUserIdRef = useRef<string | null>(null);

  const applySession = (s: Session) => {
    setSession(s);

    // Read last_auth_sync BEFORE updating it — used later to decide if RPC can be skipped
    const lastSync = parseInt(localStorage.getItem('last_auth_sync') || '0', 10);

    // Step 1: Set user immediately from JWT (instant, zero network)
    const jwtUser = buildUserFromJwt(s.user);
    if (jwtUser) {
      setUser(jwtUser);
      setCachedUser(jwtUser);
      localStorage.setItem('last_auth_sync', Date.now().toString());
    }

    // Step 2: Background RPC to get accurate approval_status / school data
    // Guard: don't fire if the session token is just the anon key (no real user auth)
    if (!s.access_token || s.access_token === s.refresh_token) {
      logger.warn('[Auth] Skipping background RPC — no valid access token');
      return;
    }

    // Skip if already loading for this user (prevents duplicate calls)
    if (loadingUserIdRef.current === s.user.id) {
      logger.log('[Auth] Background RPC skipped — already loading for this user');
      return;
    }

    // Skip if JWT has role + school_id AND we synced recently (within 30 min).
    // approval_status is optional — if the custom JWT hook isn't enabled yet we still
    // skip as long as the cached user has a valid approvalStatus from a previous RPC call.
    const cachedUser = getCachedUser();
    const jwtHasEssentials = !!(
      s.user.app_metadata?.role &&
      s.user.app_metadata?.school_id
    );
    const approvalKnown = !!(
      s.user.app_metadata?.approval_status ||   // JWT hook is active
      (cachedUser?.approvalStatus && cachedUser.id === s.user.id) // previous RPC result cached
    );
    const syncedRecently = (Date.now() - lastSync) < 30 * 60 * 1000 && lastSync > 0;

    if (jwtHasEssentials && approvalKnown && syncedRecently) {
      logger.log('[Auth] Background RPC skipped — JWT complete + recently synced');
      return;
    }
    loadingUserIdRef.current = s.user.id;

    getAppUserData(s.user)
      .then((appUser) => {
        if (!appUser) return;
        setUser(appUser);
        setCachedUser(appUser);
        localStorage.setItem('last_auth_sync', Date.now().toString());
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => prefetchCommonQueries(appUser), { timeout: 2000 });
        } else {
          setTimeout(() => prefetchCommonQueries(appUser), 1000);
        }
      })
      .catch(() => { /* keep JWT user */ })
      .finally(() => {
        loadingUserIdRef.current = null;
      });
  };

  const silentRefresh = async (): Promise<boolean> => {
    try {
      // إذا كان الجهاز غير متصل بالإنترنت، نحافظ على الجلسة الحالية ولا نسجل خروج
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return true;
      }
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        applySession(data.session);
        return true;
      }
      // في حال وجود خلل مؤقت في الاتصال بالسيرفر (Network Error / Failed to fetch)، لا نسجل خروج
      if (error && (
        error.message?.includes('Failed to fetch') || 
        error.message?.includes('NetworkError') || 
        (error as any)?.status === 0
      )) {
        return true;
      }
    } catch (_e) { 
      // أخطاء الشبكة غير المتوقعة لا تفقد المستخدم حسابه
      return true;
    }
    return false;
  };

  useEffect(() => {
    // لو المستخدم اختار "لا تذكرني" في المرة السابقة، نعمل signOut عند رجوعه
    const noRemember = sessionStorage.getItem('no_remember_me');
    if (noRemember) {
      // sessionStorage باقي = نفس الـ tab session، لما يفتح tab جديد بيتمسح تلقائياً
      // لكن لو فتح الصفحة من جديد في نفس الـ tab نعمل signOut يدوي
      const lastSignInTime = sessionStorage.getItem('user_signup_time');
      if (!lastSignInTime) {
        // لم يسجل في هذه الجلسة — يعني أعاد فتح الصفحة
        sessionStorage.removeItem('no_remember_me');
        performSignOut(setUser, setSession);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, eventSession) => {
        logger.log(`[Auth] Event: ${event}`);

        if (event === 'INITIAL_SESSION') {
          if (eventSession) {
            applySession(eventSession);
            setIsLoading(false);
          } else {
            silentRefresh().then((success) => {
              if (!success) {
                // لا توجد جلسة صالحة وفشل التجديد — تصفير المستخدم ومسح الكاش لمنع الجلسة الشبحية
                setUser(null);
                setCachedUser(null);
                setSession(null);
              }
              setIsLoading(false);
            });
          }
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (eventSession) applySession(eventSession);
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (isSigningOutRef.current) return; // manual sign-out, already handled
          // Supabase sends SIGNED_OUT during token rotation — check if session still exists
          supabase.auth.getSession().then(({ data: { session: current } }) => {
            if (current) {
              logger.log('[Auth] SIGNED_OUT ignored — active session exists (token rotation)');
              applySession(current);
            } else {
              silentRefresh().then((success) => {
                if (!success) {
                  setUser(null);
                  setCachedUser(null);
                  setSession(null);
                }
              });
            }
          }).catch(() => {
            setUser(null);
            setCachedUser(null);
            setSession(null);
          });
          return;
        }

        if (event === 'TOKEN_REFRESH_FAILED') {
          silentRefresh().then((success) => {
            if (!success) {
              setUser(null);
              setCachedUser(null);
              setSession(null);
            }
          });
          return;
        }
      }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.auth.getSession().then(({ data: { session: current } }) => {
        if (current) {
          const expiresAt = current.expires_at ?? 0;
          if (expiresAt - Math.floor(Date.now() / 1000) < 10 * 60) silentRefresh();
        } else {
          silentRefresh();
        }
      }).catch(() => { /* offline */ });
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    const refreshInterval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session: current } }) => {
        if (!current) { silentRefresh(); return; }
        const expiresAt = current.expires_at ?? 0;
        if (expiresAt - Math.floor(Date.now() / 1000) < 10 * 60) silentRefresh();
      }).catch(() => { /* ignore */ });
    }, 4 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    isSigningOutRef.current = true;
    await performSignOut(setUser, setSession);
    isSigningOutRef.current = false;
  };

  const login = async (phone: string, password: string, rememberMe = true): Promise<string | null> => {
    try {
      const email = `${phone}@edara.com`;

      // لو rememberMe = false نستخدم sessionStorage بدل localStorage
      // عشان الجلسة تنتهي لما يغلق المتصفح
      if (!rememberMe) {
        // نغير الـ storage مؤقتاً قبل الـ signIn
        try {
          const { data: { session: existing } } = await supabase.auth.getSession();
          if (!existing) {
            // تغيير الـ storage key للـ session storage فقط (Supabase v2 لا يدعم dynamic storage)
            // بنحفظ flag بدلاً منه ونعمل signOut عند إغلاق المتصفح
            sessionStorage.setItem('no_remember_me', '1');
          }
        } catch (_e) { /* ignore */ }
      } else {
        sessionStorage.removeItem('no_remember_me');
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return error.message.includes('Invalid login credentials')
          ? 'رقم الهاتف أو كلمة المرور غير صحيحة'
          : error.message;
      }
      if (data.session) applySession(data.session);
      sessionStorage.setItem('user_signup_time', Date.now().toString());
      return null;
    } catch {
      return 'حدث خطأ غير متوقع أثناء تسجيل الدخول';
    }
  };

  const signup = async (
    phone: string, password: string, fullName: string, role: string, schoolId: string,
  ): Promise<string | null> => {
    try {
      const email = `${phone}@edara.com`;
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, phone, role, school_id: schoolId } },
      });
      return error ? error.message : null;
    } catch (err: any) {
      return err.message;
    }
  };

  const refreshUser = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) applySession(s);
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
