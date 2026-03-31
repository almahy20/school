import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<string | null>;
  signup: (phone: string, password: string, fullName: string) => Promise<string | null>;
  logout: () => Promise<void>;
  isRole: (role: AppRole) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Convert phone to a fake email for authentication only
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@school.local`;
}

async function fetchAppUser(supaUser: SupabaseUser): Promise<AppUser | null> {
  // Check for developer by phone first to ensure absolute priority
  const normalizedPhone = normalizePhone((supaUser.user_metadata?.phone as string) || supaUser.phone || '');
  const isDeveloperUser = normalizedPhone === '0192837465' || supaUser.email === '0192837465@school.local';

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select(`
      full_name, phone, email, school_id,
      schools ( status )
    `)
    .eq('id', supaUser.id)
    .maybeSingle();

  const { data: roleData, error: rErr } = await supabase
    .from('user_roles')
    .select('role, is_super_admin')
    .eq('user_id', supaUser.id)
    .maybeSingle();

  if (pErr || rErr) {
    console.error('Error fetching user data:', pErr || rErr);
  }

  const p = profile as any;
  const r = roleData as any;

  // Fallback to metadata if profile is not yet created
  const fullName = p?.full_name || (supaUser.user_metadata?.full_name as string) || (isDeveloperUser ? 'المطور الماحي' : '');
  const role = isDeveloperUser ? 'admin' : (r?.role as AppRole || 'parent');
  const isSuperAdmin = isDeveloperUser ? true : (r?.is_super_admin || false);

  return {
    id: supaUser.id,
    email: p?.email || supaUser.email || '',
    phone: p?.phone || normalizedPhone,
    fullName,
    role,
    isSuperAdmin,
    schoolId: p?.school_id || null,
    schoolStatus: isDeveloperUser ? 'active' : (p?.schools?.status || 'active'),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const appUser = await fetchAppUser(session.user);
      setUser(appUser);
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setTimeout(async () => {
          const appUser = await fetchAppUser(session.user);
          setUser(appUser);
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const appUser = await fetchAppUser(session.user);
        setUser(appUser);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (phone: string, password: string): Promise<string | null> => {
    const normalizedPhone = normalizePhone(phone);
    const email = phoneToEmail(normalizedPhone);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message === 'Invalid login credentials'
      ? 'رقم الهاتف أو كلمة المرور غير صحيحة'
      : error.message;
    return null;
  };

  const signup = async (phone: string, password: string, fullName: string): Promise<string | null> => {
    const normalizedPhone = normalizePhone(phone);
    const email = phoneToEmail(normalizedPhone);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone: normalizedPhone } },
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
