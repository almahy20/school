import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppUser, AppRole } from '@/types/auth';
import { logger } from '@/utils/logger';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  login: (phone: string, password: string) => Promise<string | null>;
  signup: (phone: string, password: string, fullName: string, role: string, schoolId: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * دالة بسيطة لجلب بيانات المستخدم الإضافية (الرتبة والمدرسة)
 */
async function getAppUserData(supaUser: SupabaseUser): Promise<AppUser | null> {
  try {
    // جلب البيانات عبر RPC واحد بسيط
    const { data: userData, error } = await supabase.rpc('get_complete_user_data', { 
      p_user_id: supaUser.id 
    });


    if (error || !userData) {
      logger.error('Error fetching app user data:', error);
      return null;
    }

    const { profile, role, school } = userData as any;
    
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
      subscriptionExpired: false, // يتم التحقق منه في الحسابات المالية
    };
  } catch (err) {
    logger.error('Unexpected error in getAppUserData:', err);
    return null;
  }
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

    // Prefetch all profiles for messaging (IDs only)
    if (appUser.schoolId) {
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncUser = async (currentSession: Session | null) => {
    setSession(currentSession);
    if (currentSession?.user) {
      const appUser = await getAppUserData(currentSession.user);
      setUser(appUser);
      
      // Prefetch common queries in background after user is set
      if (appUser) {
        // Use setTimeout to not block the auth flow
        setTimeout(() => {
          prefetchCommonQueries(appUser);
        }, 100);
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // 1. جلب الجلسة الحالية عند التشغيل
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUser(session);
    });

    // 2. الاستماع لتغييرات التوثيق (Refresh, SignOut, SignIn)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        syncUser(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);


  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
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
      return null;
    } catch (err: any) {
      return err.message;
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
    <AuthContext.Provider value={{ session, user, loading: isLoading, isLoading, signOut, refreshUser, login, signup }}>
      {children}
    </AuthContext.Provider>
  );

}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
