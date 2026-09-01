import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppUser, AppRole } from '@/types/auth';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { queryClient, clearAllCache } from '@/lib/queryClient';
import { getCachedUser, setCachedUser } from '@/lib/userCache';
import { logger } from '@/utils/logger';

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
    const role: AppRole = (app?.role || meta?.role || 'parent') as AppRole;
    const schoolId: string | undefined =
      (app?.school_id ? String(app.school_id) : undefined) ||
      (meta?.school_id ? String(meta.school_id) : undefined);
    const fullName: string = meta?.full_name || '';
    const phone: string = meta?.phone || '';
    const isSuperAdmin: boolean = !!(app?.is_super_admin || meta?.is_super_admin);
    const approvalStatus = (app?.approval_status || 'approved') as 'approved' | 'pending' | 'rejected';

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

async function buildAppUserFromDirectQueries(supaUser: SupabaseUser): Promise<AppUser | null> {
  try {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, school_id').eq('id', supaUser.id).maybeSingle(),
      (supabase as any).from('user_roles').select('id, user_id, role, school_id, approval_status, is_super_admin').eq('user_id', supaUser.id).maybeSingle(),
    ]);
    const profile = profileRes.data as any;
    const role = roleRes.data as any;
    let school: any = null;
    if (profile?.school_id) {
      const schoolRes = await supabase.from('schools').select('id, name, slug, status, logo_url, subscription_end_date').eq('id', profile.school_id).maybeSingle();
      school = schoolRes.data;
    }
    if (school && profile?.school_id) {
      const b = { id: school.id, name: school.name, logo_url: school.logo_url || null, slug: school.slug, status: school.status };
      queryClient.setQueryData(['school-branding', profile.school_id], b);
      try { localStorage.setItem(`branding_${profile.school_id}`, JSON.stringify(b)); } catch { /* ignore */ }
    }
    const userRole = (role?.role || 'parent') as AppRole;
    return {
      id: supaUser.id,
      email: supaUser.email || '',
      phone: profile?.phone || '',
      fullName: profile?.full_name || '',
      role: userRole,
      isSuperAdmin: role?.is_super_admin || false,
      schoolId: profile?.school_id,
      schoolStatus: school?.status || 'active',
      approvalStatus: (role?.approval_status || 'approved') as 'approved' | 'pending' | 'rejected',
      subscriptionExpired: checkSubscriptionExpired(school),
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
      const b = { id: school.id, name: school.name, logo_url: school.logo_url || null, slug: school.slug, status: school.status };
      queryClient.setQueryData(['school-branding', profile.school_id], b);
      try { localStorage.setItem(`branding_${profile.school_id}`, JSON.stringify(b)); } catch { /* ignore */ }
    }
    const userRole = (role?.role || 'parent') as AppRole;
    return {
      id: supaUser.id,
      email: supaUser.email || '',
      phone: profile?.phone || '',
      fullName: profile?.full_name || '',
      role: userRole,
      isSuperAdmin: role?.is_super_admin || false,
      schoolId: profile?.school_id,
      schoolStatus: school?.status || 'active',
      approvalStatus: (role?.approval_status || 'approved') as 'approved' | 'pending' | 'rejected',
      subscriptionExpired: checkSubscriptionExpired(school),
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
        const { data } = await supabase.from('profiles').select('id, full_name, phone, school_id, notification_prefs, created_at').eq('id', appUser.id).maybeSingle();
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
  
  try {
    localStorage.removeItem('school_auth_token');
    localStorage.removeItem('app_user_cache_v2');
    localStorage.removeItem('last_auth_sync');
  } catch (_e) { /* ignore */ }

  try { await supabase.auth.signOut({ scope: 'local' }); } catch (_e) { /* ignore */ }
  try { await supabase.auth.signOut({ scope: 'global' }); } catch (_e) { /* ignore */ }

  try {
    const keysToRemove = Object.keys(localStorage).filter(k => 
      k.startsWith('sb-') || 
      k.includes('supabase') || 
      k.startsWith('branding_')
    );
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (_e) { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState(() => getCachedUser() === null);

  const isSigningOutRef = useRef(false);
  const loadingUserIdRef = useRef<string | null>(null);

  const applySession = (s: Session) => {
    setSession(prev => {
      if (prev?.access_token === s.access_token && prev?.user?.id === s.user?.id) {
        return prev;
      }
      return s;
    });

    const lastSync = parseInt(localStorage.getItem('last_auth_sync') || '0', 10);

    const jwtUser = buildUserFromJwt(s.user);
    if (jwtUser) {
      setUser(prev => {
        if (
          prev &&
          prev.id === jwtUser.id &&
          prev.role === jwtUser.role &&
          prev.schoolId === jwtUser.schoolId &&
          prev.approvalStatus === jwtUser.approvalStatus &&
          prev.fullName === jwtUser.fullName &&
          prev.phone === jwtUser.phone
        ) {
          return prev;
        }
        return jwtUser;
      });
      setCachedUser(jwtUser);
      localStorage.setItem('last_auth_sync', Date.now().toString());
    }

    if (!s.access_token || s.access_token === s.refresh_token) {
      logger.warn('[Auth] Skipping background RPC â€” no valid access token');
      return;
    }

    if (loadingUserIdRef.current === s.user.id) {
      logger.log('[Auth] Background RPC skipped â€” already loading for this user');
      return;
    }

    const cachedUser = getCachedUser();
    const isJwtComplete = !!(jwtUser?.role && jwtUser?.schoolId);
    const hasApprovalStatus = !!(jwtUser?.approvalStatus || cachedUser?.approvalStatus);
    const isRecentlySynced = Date.now() - lastSync < 30 * 60 * 1000;

    if (isJwtComplete && hasApprovalStatus && isRecentlySynced) {
      logger.log('[Auth] Background RPC skipped â€” JWT complete + recently synced');
      if (cachedUser) {
        prefetchCommonQueries(cachedUser);
      }
      return;
    }

    loadingUserIdRef.current = s.user.id;
    getAppUserData(s.user).then(appUser => {
      loadingUserIdRef.current = null;
      if (!appUser) return;
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
          prev.phone === appUser.phone
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

  const silentRefresh = async (): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return true;
      }
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        applySession(data.session);
        return true;
      }
      if (error && (
        error.message?.includes('Failed to fetch') || 
        error.message?.includes('NetworkError') || 
        (error as any)?.status === 0
      )) {
        return true;
      }
    } catch (_e) { 
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return true;
      }
      return false;
    }
    return false;
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
          if (eventSession) applySession(eventSession);
          setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (isSigningOutRef.current) return;
          supabase.auth.getSession().then(({ data: { session: current } }) => {
            if (current) {
              logger.log('[Auth] SIGNED_OUT ignored â€” active session exists (token rotation)');
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
          setIsLoading(false);
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
      clearTimeout(timeout);
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
      const cleanInput = phone.trim();
      const isEmail = cleanInput.includes('@');
      const primaryEmail = isEmail ? cleanInput : `${cleanInput}@edara.com`;
      const fallbackEmail = isEmail ? null : `${cleanInput}@school.local`;

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

      if (error && fallbackEmail && error.message.includes('Invalid login credentials')) {
        const fallbackRes = await supabase.auth.signInWithPassword({ email: fallbackEmail, password });
        if (!fallbackRes.error) {
          data = fallbackRes.data;
          error = null;
        }
      }

      if (error) {
        return error.message.includes('Invalid login credentials')
          ? 'Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ Ø£Ùˆ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± ØµØ­ÙŠØ­Ø©'
          : error.message;
      }
      if (data.session) applySession(data.session);
      sessionStorage.setItem('user_signup_time', Date.now().toString());
      return null;
    } catch {
      return 'Ø­Ø¯Ø« Ø®Ø·Ø£ ØºÙŠØ± Ù…ØªÙˆÙ‚Ø¹ Ø£Ø«Ù†Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„';
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

