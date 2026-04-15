import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { AppRole, AppUser } from '@/types/auth';
import { logger } from '@/utils/logger';

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
let lastVisibilityCheckTime = 0; // Throttle visibility checks
let isLoggingOut = false; // Track logout state

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
             logger.warn(`Auth Lock conflict detected, retrying (${retryCount + 1})...`);
             await new Promise(r => setTimeout(r, 100 * (retryCount + 1))); // Exponential backoff
             return fetchAppUser(supaUser, retryCount + 1);
           }
        }
        logger.error('RPC fetch error (get_complete_user_data):', rpcErr);
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
    try {
      // First, try to get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logger.warn('⚠️ [refreshUser] getSession error, trying refreshSession:', sessionError.message);
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshedSession?.user) {
          logger.error('❌ [refreshUser] Session refresh failed:', refreshError?.message);
          setUser(null);
          return;
        }
        
        // Use the refreshed session
        const appUser = await fetchAppUser(refreshedSession.user);
        setUser(prev => {
          if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
          return appUser;
        });
        return;
      }
      
      if (session?.user) {
        const appUser = await fetchAppUser(session.user);
        // Removed checkUserAccess filter to keep pending users in the 'user' state
        setUser(prev => {
          if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
          return appUser;
        });
      } else {
        // No session, try to refresh it
        logger.log('⚠️ [refreshUser] No session, attempting refresh...');
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        
        if (refreshedSession?.user) {
          const appUser = await fetchAppUser(refreshedSession.user);
          setUser(prev => {
            if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
            return appUser;
          });
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      logger.error('❌ [refreshUser] Critical error:', error);
      // Don't set to null on unknown errors - preserve existing state
    }
  };

  useEffect(() => {
    let isMounted = true;
    let isInitializing = true; // Track initialization state

    const initSession = async () => {
      try {
        logger.log('🔑 [AuthContext] Initializing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('❌ [AuthContext] Session init error:', error);
        }
        
        if (session?.user && isMounted) {
          logger.log('✅ [AuthContext] Session found for user:', session.user.id);
          const appUser = await fetchAppUser(session.user);
          if (isMounted) {
            setUser(prev => {
              if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
              return appUser;
            });
          }
        } else {
          logger.warn('⚠️ [AuthContext] No active session found');
        }
      } catch (err) {
        logger.error('❌ [AuthContext] Session init error:', err);
      } finally {
        if (isMounted) {
          logger.log('✅ [AuthContext] Auth initialization complete');
          isInitializing = false; // Mark initialization as complete
          setLoading(false);
        }
      }
    };
    initSession();

    // Handle Auth Events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      // Ignore events during initialization to prevent race conditions
      if (isInitializing) {
        logger.log(`⏳ [AuthContext] Ignoring ${event} during initialization`);
        return;
      }

      logger.log(`🔑 Auth Event: ${event} for user: ${session?.user?.id || 'none'}`);

      if (event === 'TOKEN_REFRESHED') {
        logger.log('🔄 Token refreshed successfully');
        // Don't refetch user data on token refresh - it's just a token update
        return;
      }

      if (event === 'SIGNED_OUT') {
        logger.warn('🚪 User signed out or session expired');
        // Only set to null if not already handled by logout function
        if (!isLoggingOut) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      
      // Skip initial session events (handled by initSession)
      if (event === 'INITIAL_SESSION') {
        logger.log('📋 [AuthContext] INITIAL_SESSION event (already handled)');
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
        logger.error("Auth Change Critical Error:", err);
        if (isMounted) setLoading(false);
      }
    });

    // Session Heartbeat - prevent session expiration during long idle periods
    const heartbeatInterval = setInterval(async () => {
      if (user && isMounted) {
        logger.log('💓 [AuthContext] Session heartbeat...');
        try {
          const { error } = await supabase.auth.getSession();
          if (error) logger.error('❌ Heartbeat session check failed:', error);
        } catch (e) {
          logger.error('❌ Heartbeat critical error:', e);
        }
      }
    }, 10 * 60 * 1000); // Every 10 minutes

    return () => {
      isMounted = false;
      isInitializing = false;
      clearInterval(heartbeatInterval);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once only — user dep caused subscription leak on every setUser() call

  // تم إزالة مؤقت تسجيل الخروج التلقائي بناءً على طلب المستخدم لمنع تسجيل الخروج المفاجئ.

  // Handle connection monitoring and session refresh
  useEffect(() => {
    let isMounted = true; // Track mount state for this effect
    
    const handleOnline = async () => {
      logger.log('🌐 [AuthContext] Device back online. Refreshing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session) {
        await refreshUser();
      }
    };
  
    // CRITICAL: Refresh session when tab becomes visible
    // This prevents the "infinite loader" issue when user returns after a long time
    const handleVisibilityChange = async () => {
      // Throttle visibility checks to once every 2 minutes
      const now = Date.now();
      if (document.visibilityState === 'visible' && (now - lastVisibilityCheckTime > 120000)) {
        lastVisibilityCheckTime = now;
        logger.log('👁️ [AuthContext] Tab became visible, checking session...');
        
        try {
          // Step 1: Try to get current session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            logger.error('❌ [AuthContext] getSession error:', sessionError);
            // Don't set user to null yet - try to refresh
          }
          
          if (session?.user) {
            logger.log('✅ [AuthContext] Session is valid, refreshing user data...');
            await refreshUser();
            return; // Session is valid, no need to refresh
          }
          
          // Step 2: If no session or expired, try to refresh it
          logger.log('⚠️ [AuthContext] No active session, attempting to refresh...');
          
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            logger.warn('⚠️ [AuthContext] Session refresh failed (session truly expired):', refreshError.message);
            // Session is truly expired, user needs to log in again
            if (!isLoggingOut) {
              setUser(null);
            }
            return;
          }
          
          if (refreshedSession?.user) {
            logger.log('✅ [AuthContext] Session refreshed successfully!');
            // Fetch user data with the new session
            const appUser = await fetchAppUser(refreshedSession.user);
            if (isMounted) {
              setUser(prev => {
                if (JSON.stringify(prev) === JSON.stringify(appUser)) return prev;
                return appUser;
              });
              setLoading(false);
            }
          } else {
            // No session even after refresh
            logger.warn('⚠️ [AuthContext] No session after refresh attempt');
            if (!isLoggingOut) {
              setUser(null);
            }
          }
        } catch (err) {
          logger.error('❌ [AuthContext] Visibility change handler error:', err);
          // Don't set user to null on unknown errors - let existing state persist
        }
      }
    };
  
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
        
    return () => {
      isMounted = false; // Prevent state updates after unmount
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
    try {
      logger.log('🚪 Initiating logout...');
      isLoggingOut = true;
      
      // Set loading to prevent race conditions during logout
      setLoading(true);
      
      // Clear all React Query cache to prevent stale data
      try {
        window.dispatchEvent(new Event('logout-clear-cache'));
      } catch (e) {
        logger.warn('Failed to dispatch cache clear event');
      }
      
      // Clear all active fetch promises
      activeFetchPromises.clear();
      
      // Clear local storage/session storage to remove any cached data
      try {
        // Remove React Query persisted cache
        localStorage.removeItem('rq-persist-v1');
      } catch (e) {
        logger.warn('Failed to clear localStorage');
      }
      
      // Sign out from Supabase with local scope (only this tab)
      // Using 'local' prevents race conditions with onAuthStateChange
      const { error } = await supabase.auth.signOut({ 
        scope: 'local'
      });
      
      if (error) {
        logger.error('❌ Logout error:', error);
        // Continue anyway - clear local state
      }
      
      logger.log('✅ Logout successful, clearing state...');
      
      // Clear local state IMMEDIATELY
      setUser(null);
      setLoading(false);
      
      // Additional safety: clear session again
      await supabase.auth.signOut({ scope: 'local' });
      
    } catch (err) {
      logger.error('❌ Logout critical error:', err);
      // Force clear state even on error
      setUser(null);
      setLoading(false);
    } finally {
      // Reset logout flag after a delay to prevent race conditions
      setTimeout(() => {
        isLoggingOut = false;
      }, 1000);
    }
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
