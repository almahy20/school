import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppUser, AppRole } from '@/types/auth';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { queryClient, clearAllCache } from '@/lib/queryClient';
import { getCachedUser, setCachedUser } from '@/lib/userCache';
import { realtimeEngine } from '@/lib/RealtimeEngine';
import { logger } from '@/utils/logger';
import { isNetworkError } from '@/utils/networkErrors';

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

function buildUserFromJwt(supaUser: SupabaseUser): AppUser | null {
  try {
    const app = supaUser.app_metadata as any;
    const meta = supaUser.user_metadata as any;
    const cached = getCachedUser();
    const isSameUser = cached?.id === supaUser.id;

    const role: AppRole = (
      app?.role ||
      meta?.role ||
      (isSameUser && cached?.role ? cached.role : 'parent')
    ) as AppRole;

    const schoolId: string | undefined =
      (app?.school_id ? String(app.school_id) : undefined) ||
      (meta?.school_id ? String(meta.school_id) : undefined) ||
      (isSameUser && cached?.schoolId ? cached.schoolId : undefined);

    // app_metadata (من JWT hook) يأتي أولاً، ثم user_metadata كـ fallback
    const fullName: string = app?.full_name || meta?.full_name || (isSameUser ? cached?.fullName || '' : '');
    const phone: string = app?.phone || meta?.phone || (isSameUser ? cached?.phone || '' : '');
    const isSuperAdmin: boolean = !!(app?.is_super_admin || meta?.is_super_admin || (isSameUser && cached?.isSuperAdmin));
    const approvalStatus = (app?.approval_status || meta?.approval_status || (isSameUser && cached?.approvalStatus) || 'approved') as 'approved' | 'pending' | 'rejected';

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
      approvalStatus,
      subscriptionExpired: false,
    };
  } catch {
    return null;
  }
}

function checkSubscriptionExpired(school: any): boolean {
  if (!school) return false;
  if (school.status === 'suspended') return true;
  if (school.subscription_end_date) {
    return new Date(school.subscription_end_date).getTime() < Date.now();
  }
  return false;
}

function autoRepairProfile(
  userId: string,
  profile: any,
  fullName: string,
  phone: string,
  schoolId?: string
) {
  if (profile && (!profile.full_name || !profile.school_id) && (fullName || schoolId)) {
    supabase.from('profiles').update({
      ...(fullName && !profile.full_name ? { full_name: fullName } : {}),
      ...(phone    && !profile.phone    ? { phone }               : {}),
      ...(schoolId && !profile.school_id ? { school_id: schoolId } : {}),
    }).eq('id', userId).then(() => { /* background, ignore result */ });
  }
}

function buildFinalAppUser(
  supaUser: SupabaseUser,
  profile: any,
  role: any,
  school: any
): AppUser {
  const userMeta = (supaUser.user_metadata || {}) as any;
  const appMeta  = (supaUser.app_metadata  || {}) as any;
  const fullName  = profile?.full_name?.trim()  || userMeta.full_name?.trim()  || appMeta.full_name?.trim()  || '';
  const phone     = profile?.phone?.trim()      || userMeta.phone?.trim()      || appMeta.phone?.trim()      || '';
  const schoolId  = profile?.school_id || role?.school_id
                    || (userMeta.school_id ? String(userMeta.school_id) : undefined)
                    || (appMeta.school_id  ? String(appMeta.school_id)  : undefined);

  autoRepairProfile(supaUser.id, profile, fullName, phone, schoolId);

  if (school && schoolId) {
    const b = { id: school.id, name: school.name, logo_url: school.logo_url || null, slug: school.slug, status: school.status };
    queryClient.setQueryData(['school-branding', schoolId], b);
    try { localStorage.setItem(`branding_${schoolId}`, JSON.stringify(b)); } catch { /* ignore */ }
  }

  if (profile && supaUser.id) {
    const profileData = {
      id: profile.id || supaUser.id,
      full_name: profile.full_name || fullName || null,
      phone: profile.phone || phone || null,
      role: role?.role || profile.role || (role ? String(role) : null),
      school_id: schoolId || profile.school_id || null,
      notification_prefs: profile.notification_prefs || null,
      created_at: profile.created_at || new Date().toISOString(),
      ...profile,
    };
    queryClient.setQueryData(['profile', supaUser.id], profileData);
  }

  const userRole = (role?.role || 'parent') as AppRole;
  return {
    id: supaUser.id,
    email: supaUser.email || '',
    phone,
    fullName,
    role: userRole,
    isSuperAdmin: role?.is_super_admin || false,
    schoolId,
    schoolStatus: school?.status || 'active',
    approvalStatus: (role?.approval_status || 'approved') as 'approved' | 'pending' | 'rejected',
    subscriptionExpired: checkSubscriptionExpired(school),
  };
}

async function buildAppUserFromDirectQueries(supaUser: SupabaseUser): Promise<AppUser | null> {
  try {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, school_id').eq('id', supaUser.id).maybeSingle(),
      (supabase).from('user_roles').select('id, user_id, role, school_id, approval_status, is_super_admin').eq('user_id', supaUser.id).maybeSingle(),
    ]);
    const profile = profileRes.data as any;
    const role = roleRes.data as any;

    const userMeta = (supaUser.user_metadata || {}) as any;
    const appMeta  = (supaUser.app_metadata  || {}) as any;
    const schoolId  = profile?.school_id || role?.school_id
                      || (userMeta.school_id ? String(userMeta.school_id) : undefined)
                      || (appMeta.school_id  ? String(appMeta.school_id)  : undefined);

    let school: any = null;
    if (schoolId) {
      const schoolRes = await supabase.from('schools').select('id, name, slug, status, logo_url, subscription_end_date').eq('id', schoolId).maybeSingle();
      school = schoolRes.data;
    }

    return buildFinalAppUser(supaUser, profile, role, school);
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

    return buildFinalAppUser(supaUser, profile, role, school);
  } catch {
    return buildAppUserFromDirectQueries(supaUser);
  }
}

async function prefetchCommonQueries(_appUser: AppUser) {
  // Profiles are fetched on-demand in AdminConversationsPage when targetType is 'all'
}

async function performSignOut(
  setUser: (u: AppUser | null) => void,
  setSession: (s: Session | null) => void,
) {
  try { queryClient.cancelQueries(); } catch (_e) { /* ignore */ }
  try { realtimeEngine.unsubscribeAll(); } catch (_e) { /* ignore */ }
  await clearAllCache();
  setUser(null);
  setSession(null);
  setCachedUser(null);
  
  try {
    localStorage.removeItem('school_auth_token');
    localStorage.removeItem('app_user_cache_v2');
    localStorage.removeItem('last_auth_sync');
  } catch (_e) { /* ignore */ }

  // local scope: clears this device's session without invalidating other devices' sessions
  try { await supabase.auth.signOut({ scope: 'local' }); } catch (_e) { /* ignore */ }

  try {
    const keysToRemove = Object.keys(localStorage).filter(k => 
      k.startsWith('sb-') || 
      k.includes('supabase') || 
      k.startsWith('branding_')
    );
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (_e) { /* ignore */ }
}

/** Pre-hydrates queryClient with cached branding BEFORE React renders — prevents flicker on refresh. */
function preHydrateBrandingCache() {
  try {
    const cached = getCachedUser();
    if (cached?.schoolId) {
      const raw = localStorage.getItem(`branding_${cached.schoolId}`);
      if (raw) {
        const branding = JSON.parse(raw);
        const existing = queryClient.getQueryData(['school-branding', cached.schoolId]);
        if (!existing && branding?.name) {
          let cleanName = branding.name.replace(/^مدرسة\s*/i, '').replace(/^مدرسه\s*/i, '').trim();
          cleanName = cleanName.split(' — ')[0];
          if (document.title !== cleanName) document.title = cleanName;
        }
        if (!existing) {
          queryClient.setQueryData(['school-branding', cached.schoolId], branding);
        }
      }
    }
  } catch (_e) { /* ignore */ }
}
preHydrateBrandingCache();

/** Synchronously extracts persisted Supabase session from localStorage for zero-latency initial queries */
function getPersistedSession(): Session | null {
  try {
    const raw = localStorage.getItem('school_auth_token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const s = parsed?.currentSession || parsed;
    if (s?.access_token && s?.user) {
      return s as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getPersistedSession());
  const [user, setUser] = useState<AppUser | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState(() => !getPersistedSession() && getCachedUser() === null);

  const isSigningOutRef = useRef(false);
  const loadingUserIdRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const activeSchoolIdRef = useRef<string | null>(null);

  // ── Token refresh throttling & backoff ───────────────────────────────────
  // Prevents spam of /auth/v1/token (refresh_token) during network errors/CORS/504
  const refreshInProgressRef = useRef(false);
  const lastRefreshAttemptAtRef = useRef(0);
  const consecutiveRefreshFailsRef = useRef(0);
  const BASE_REFRESH_COOLDOWN_MS = 15_000;      // 15s after first network fail
  const MAX_REFRESH_COOLDOWN_MS = 3 * 60_000;   // 3min ceiling (exponential backoff)
  const MIN_REFRESH_GAP_MS = 5_000;             // min gap between ANY two refresh attempts

  const getNextAllowedRefreshAt = (): number => {
    if (consecutiveRefreshFailsRef.current <= 0) return lastRefreshAttemptAtRef.current + MIN_REFRESH_GAP_MS;
    const backoff = Math.min(
      MAX_REFRESH_COOLDOWN_MS,
      BASE_REFRESH_COOLDOWN_MS * Math.pow(2, consecutiveRefreshFailsRef.current - 1)
    );
    return lastRefreshAttemptAtRef.current + backoff;
  };

  const recordRefreshAttempt = () => {
    lastRefreshAttemptAtRef.current = Date.now();
  };

  const recordRefreshResult = (ok: boolean, wasNetworkError: boolean) => {
    if (ok) {
      consecutiveRefreshFailsRef.current = 0;
    } else if (wasNetworkError) {
      consecutiveRefreshFailsRef.current++;
      logger.warn(
        `[Auth] Refresh network fail #${consecutiveRefreshFailsRef.current} — ` +
        `backoff ${Math.round((getNextAllowedRefreshAt() - Date.now()) / 1000)}s`
      );
    } else {
      consecutiveRefreshFailsRef.current = Math.min(consecutiveRefreshFailsRef.current + 1, 3);
    }
  };

  const applySession = (s: Session) => {
    // Reset refresh backoff — a valid session being applied means connectivity is healthy
    if (consecutiveRefreshFailsRef.current > 0) consecutiveRefreshFailsRef.current = 0;

    setSession(prev => {
      if (prev?.access_token === s.access_token && prev?.user?.id === s.user?.id) {
        return prev;
      }
      return s;
    });

    const newUserId = s.user?.id;
    const jwtUser = buildUserFromJwt(s.user);
    const newSchoolId = jwtUser?.schoolId || null;

    // لا يُمسح الكاش عند أول تحميل (من null إلى مستخدم)، ولا عند TOKEN_REFRESHED لنفس المستخدم
    // يُمسح فقط عند اختلافه عن مستخدم سابق غير null (أي تبديل حساب فعلي)
    const isUserSwitch = Boolean(activeUserIdRef.current && newUserId && activeUserIdRef.current !== newUserId);
    const isSchoolSwitch = Boolean(activeUserIdRef.current && activeSchoolIdRef.current && newSchoolId && activeSchoolIdRef.current !== newSchoolId);

    if (isUserSwitch || isSchoolSwitch) {
      logger.log('[Auth] User or School changed — clearing previous user cache');
      clearAllCache();
    }

    activeUserIdRef.current = newUserId || null;
    if (newSchoolId) activeSchoolIdRef.current = newSchoolId;

    const lastSync = parseInt(localStorage.getItem('last_auth_sync') || '0', 10);

    if (jwtUser) {
      setUser(prev => {
        // Prevent session downgrade: If prev belongs to the same user and has populated role/schoolId, preserve them
        if (prev && prev.id === jwtUser.id) {
          const mergedSchoolId = prev.schoolId || jwtUser.schoolId;
          const mergedRole = (jwtUser.role === 'parent' && prev.role !== 'parent') ? prev.role : jwtUser.role;
          const mergedFullName = prev.fullName || jwtUser.fullName;
          const mergedApproval = prev.approvalStatus || jwtUser.approvalStatus;

          const mergedUser: AppUser = {
            ...jwtUser,
            schoolId: mergedSchoolId,
            role: mergedRole,
            fullName: mergedFullName,
            approvalStatus: mergedApproval,
            isSuperAdmin: prev.isSuperAdmin || jwtUser.isSuperAdmin,
            schoolStatus: prev.schoolStatus || jwtUser.schoolStatus,
            subscriptionExpired: prev.subscriptionExpired ?? jwtUser.subscriptionExpired,
          };
          if (mergedSchoolId) activeSchoolIdRef.current = mergedSchoolId;
          setCachedUser(mergedUser);
          return mergedUser;
        }

        setCachedUser(jwtUser);
        return jwtUser;
      });
    }

    if (!s.access_token || s.access_token === s.refresh_token) {
      logger.warn('[Auth] Skipping background RPC — no valid access token');
      return;
    }

    if (loadingUserIdRef.current === s.user.id) {
      logger.log('[Auth] Background RPC skipped — already loading for this user');
      return;
    }

    const cachedUser = getCachedUser();
    const isJwtComplete = !!(jwtUser?.role && jwtUser?.schoolId);
    const hasApprovalStatus = !!(jwtUser?.approvalStatus || cachedUser?.approvalStatus);

    // ✅ ذكاء المزامنة: المزامنة الدورية تحدث كل 30 دقيقة للـ JWT المكتمل، أو كل 5 دقائق للبيانات الناقصة
    // يحل نهائياً مشكلة عدم تحديث الصلاحيات إلا بعد تسجيل الخروج والدخول مجدداً
    const SYNC_INTERVAL_MS = isJwtComplete ? 30 * 60 * 1000 : 5 * 60 * 1000;
    const isRecentlySynced = lastSync > 0 && (Date.now() - lastSync < SYNC_INTERVAL_MS);

    // تخطي الـ RPC فقط إذا كانت المزامنة حديثة فعلياً من السيرفر
    if (isRecentlySynced && ((isJwtComplete && hasApprovalStatus) || (cachedUser?.role && cachedUser?.schoolId))) {
      logger.log('[Auth] Background RPC skipped — synced recently');
      if (cachedUser) {
        prefetchCommonQueries(cachedUser);
      }
      return;
    }

    loadingUserIdRef.current = s.user.id;
    getAppUserData(s.user).then(appUser => {
      loadingUserIdRef.current = null;
      if (!appUser) return;
      if (appUser.schoolId) activeSchoolIdRef.current = appUser.schoolId;
      setUser(prev => {
        if (
          prev &&
          prev.id === appUser.id &&
          prev.role === appUser.role &&
          prev.schoolId === appUser.schoolId &&
          prev.approvalStatus === appUser.approvalStatus &&
          prev.schoolStatus === appUser.schoolStatus &&
          prev.subscriptionExpired === appUser.subscriptionExpired &&
          prev.fullName === appUser.fullName &&
          prev.phone === appUser.phone &&
          prev.isSuperAdmin === appUser.isSuperAdmin
        ) {
          return prev;
        }
        return appUser;
      });
      setCachedUser(appUser);
      localStorage.setItem('last_auth_sync', Date.now().toString());
      prefetchCommonQueries(appUser);
    }).catch(err => {
      loadingUserIdRef.current = null;
      logger.error('[Auth] getAppUserData failed:', err);
    });
  };

  // Alias for readability — uses the shared network error detector
  const isTokenRefreshNetworkError = isNetworkError;

  const silentRefresh = async (): Promise<boolean> => {
    // Guard 1: Offline — pretend success (no logout)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return true;
    }

    const now = Date.now();

    // Guard 2: Another refresh is currently in flight
    if (refreshInProgressRef.current) {
      logger.debug('[Auth] silentRefresh skipped — already in progress');
      return true;
    }

    // Guard 3: Cooldown/backoff active (prevents refresh_token spam)
    const nextAllowed = getNextAllowedRefreshAt();
    if (now < nextAllowed) {
      const waitSecs = Math.round((nextAllowed - now) / 1000);
      logger.debug(`[Auth] silentRefresh skipped — backoff cooldown active (${waitSecs}s left)`);
      // Treat as "no-op success" so callers don't panic. The cached session is still valid for now.
      return true;
    }

    refreshInProgressRef.current = true;
    recordRefreshAttempt();

    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        applySession(data.session);
        recordRefreshResult(true, false);
        return true;
      }

      const wasNet = isTokenRefreshNetworkError(error);
      recordRefreshResult(false, wasNet);

      // Network errors — keep session (true). Auth errors — let caller decide (false).
      if (wasNet) return true;
      // If error indicates invalid refresh token, we should NOT return true
      if (
        error?.message?.includes('Invalid Refresh Token') ||
        error?.message?.includes('invalid_grant') ||
        error?.message?.includes('refresh_token not found')
      ) {
        return false;
      }
      return true;
    } catch (_e) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      const wasNet = offline || isTokenRefreshNetworkError(_e);
      recordRefreshResult(false, wasNet);
      if (wasNet || offline) return true;
      return false;
    } finally {
      refreshInProgressRef.current = false;
    }
  };

  useEffect(() => {
    const noRemember = sessionStorage.getItem('no_remember_me');
    if (noRemember) {
      const lastSignInTime = sessionStorage.getItem('user_signup_time');
      if (!lastSignInTime) {
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
            // ✅ إلغاء أي استعلامات قديمة وإعادة جلب البيانات بالتوكن المستعاد
            queryClient.cancelQueries().then(() => {
              queryClient.invalidateQueries({ refetchType: 'active' });
            });
          } else {
            silentRefresh().then((success) => {
              if (!success) {
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
          if (eventSession) {
            applySession(eventSession);
            queryClient.invalidateQueries();
          }
          setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (isSigningOutRef.current) return;
          supabase.auth.getSession().then(({ data: { session: current } }) => {
            if (current) {
              logger.log('[Auth] SIGNED_OUT ignored — active session exists (token rotation)');
              applySession(current);
            } else {
              // ✅ لا تقم بعمل silentRefresh عند تسجيل الخروج — نظّف الكاش فوراً
              clearAllCache();
              activeUserIdRef.current = null;
              activeSchoolIdRef.current = null;
              setUser(null);
              setCachedUser(null);
              setSession(null);
            }
          }).catch(() => {
            clearAllCache();
            activeUserIdRef.current = null;
            activeSchoolIdRef.current = null;
            setUser(null);
            setCachedUser(null);
            setSession(null);
          });
          setIsLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESH_FAILED') {
          // If offline, do NOT sign out — keep working on cached session
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setIsLoading(false);
            return;
          }
          // Verify if session in storage is actually expired before logging out
          supabase.auth.getSession().then(({ data: { session: current } }) => {
            if (current && current.expires_at && current.expires_at > Math.floor(Date.now() / 1000) + 60) {
              logger.log('[Auth] TOKEN_REFRESH_FAILED ignored — current session is still valid');
              return;
            }
            silentRefresh().then((success) => {
              if (!success) {
                logger.warn('[Auth] TOKEN_REFRESH_FAILED confirmed invalid — clearing session');
                setUser(null);
                setCachedUser(null);
                setSession(null);
              }
            });
          }).catch(() => { /* offline / ignore */ });
          setIsLoading(false);
          return;
        }
      }
    );

    // Timeout safety: Ensure isLoading is never stuck forever
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      supabase.auth.getSession().then(({ data: { session: current } }) => {
        if (current) {
          const expiresAt = current.expires_at ?? 0;
          if (expiresAt - Math.floor(Date.now() / 1000) < 3 * 60) silentRefresh();
        } else {
          silentRefresh();
        }
      }).catch(() => { /* offline */ });
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    const refreshInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      supabase.auth.getSession().then(({ data: { session: current } }) => {
        if (!current) { silentRefresh(); return; }
        const expiresAt = current.expires_at ?? 0;
        if (expiresAt - Math.floor(Date.now() / 1000) < 3 * 60) silentRefresh();
      }).catch(() => { /* ignore */ });
    }, 4 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    isSigningOutRef.current = true;
    try {
      await performSignOut(setUser, setSession);
    } finally {
      // إبقاء flag الخروج نشطاً لمهلة كافية لمنع معالجة أحداث SIGNED_OUT غير المتزامنة ومحاولة الـ refresh
      setTimeout(() => {
        isSigningOutRef.current = false;
      }, 1500);
    }
  };

  const login = async (phone: string, password: string, rememberMe = true): Promise<string | null> => {
    try {
      const cleanInput = phone.trim();
      const isEmail = cleanInput.includes('@');
      
      // ✅ Smart Domain Hint: Check if a working domain was previously remembered for this phone
      let primaryEmail = isEmail ? cleanInput : `${cleanInput}@edara.com`;
      let fallbackEmail = isEmail ? null : `${cleanInput}@school.local`;

      if (!isEmail) {
        try {
          const rememberedDomain = localStorage.getItem(`auth_domain_${cleanInput}`);
          if (rememberedDomain === '@school.local') {
            primaryEmail = `${cleanInput}@school.local`;
            fallbackEmail = `${cleanInput}@edara.com`;
          }
        } catch { /* ignore */ }
      }

      if (!rememberMe) {
        try {
          const { data: { session: existing } } = await supabase.auth.getSession();
          if (!existing) {
            sessionStorage.setItem('no_remember_me', '1');
          }
        } catch (_e) { /* ignore */ }
      } else {
        sessionStorage.removeItem('no_remember_me');
      }

      let { data, error } = await supabase.auth.signInWithPassword({ email: primaryEmail, password });

      if (!error && data?.session && !isEmail) {
        try {
          const successfulDomain = primaryEmail.endsWith('@school.local') ? '@school.local' : '@edara.com';
          localStorage.setItem(`auth_domain_${cleanInput}`, successfulDomain);
        } catch { /* ignore */ }
      }

      if (error && fallbackEmail && error.message.includes('Invalid login credentials')) {
        const fallbackRes = await supabase.auth.signInWithPassword({ email: fallbackEmail, password });
        if (!fallbackRes.error) {
          data = fallbackRes.data;
          error = null;
          if (!isEmail) {
            try {
              const successfulDomain = fallbackEmail.endsWith('@school.local') ? '@school.local' : '@edara.com';
              localStorage.setItem(`auth_domain_${cleanInput}`, successfulDomain);
            } catch { /* ignore */ }
          }
        }
      }

      if (error) {
        return error.message.includes('Invalid login credentials')
          ? 'رقم الهاتف أو كلمة المرور غير صحيحة'
          : error.message;
      }
      if (data.session) {
        // عند تسجيل الدخول بحساب مختلف عن المستخدم السابق: تنظيف شامل للكاش
        const prevUserId = activeUserIdRef.current || getCachedUser()?.id;
        if (prevUserId && prevUserId !== data.session.user.id) {
          logger.log('[Auth] Switching account — clearing old cache');
          try { queryClient.cancelQueries(); } catch (_e) { /* ignore */ }
          await clearAllCache();
        }

        // Hydrate complete user profile BEFORE resolving login to eliminate data delays and role flips
        try {
          const appUser = await getAppUserData(data.session.user);
          if (appUser) {
            activeUserIdRef.current = appUser.id;
            if (appUser.schoolId) activeSchoolIdRef.current = appUser.schoolId;
            setUser(appUser);
            setCachedUser(appUser);
            localStorage.setItem('last_auth_sync', Date.now().toString());
          }
        } catch (e) {
          logger.warn('[Auth] Initial getAppUserData during login failed, falling back to session:', e);
        }
        applySession(data.session);
      }
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
      const cleanPhone = phone.trim();
      const cleanPassword = password.trim();
      const email = `${cleanPhone}@edara.com`;
      const { data, error } = await supabase.auth.signUp({
        email, 
        password: cleanPassword,
        options: { 
          data: { 
            full_name: fullName.trim(), 
            phone: cleanPhone, 
            role, 
            school_id: schoolId || undefined 
          } 
        },
      });

      if (error) {
        if (error.message.includes('User already registered') || error.message.includes('already exists')) {
          return 'رقم الهاتف مسجل بالفعل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك';
        }
        return error.message;
      }

      // If Supabase returned a session, apply it immediately
      if (data?.session) {
        applySession(data.session);
      } else {
        // Automatically login if session was not returned directly by signUp
        const loginErr = await login(cleanPhone, cleanPassword);
        if (loginErr) {
          logger.warn('[Auth] Auto login after signup:', loginErr);
        }
      }

      return null;
    } catch (err: any) {
      return err?.message || 'حدث خطأ غير متوقع أثناء إنشاء الحساب';
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

