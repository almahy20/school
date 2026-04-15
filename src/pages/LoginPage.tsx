import { useState, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Eye, EyeOff, Lock, Phone, ArrowLeft } from 'lucide-react';
import { useSchoolBySlug } from '@/hooks/queries';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if there is a school slug in the URL query
  const params = new URLSearchParams(location.search);
  const slug = params.get('school');
  const { data: schoolData } = useSchoolBySlug(slug);

  const schoolBranding = useMemo(() => {
    if (!schoolData) return { name: 'المدرسة الذكية', logo: '' };
    
    const timestamp = Date.now();
    const logo = schoolData.logo_url || '';
    const logoWithCacheBust = logo ? (logo.includes('?') ? `${logo}&v=${timestamp}` : `${logo}?v=${timestamp}`) : '';
    
    return {
      name: schoolData.name,
      logo: logoWithCacheBust
    };
  }, [schoolData]);

  const from = location.state?.from || '/';
  const isDeveloperLogin = from === '/super-admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError('يرجى إدخال رقم الهاتف وكلمة المرور');
      return;
    }
    setLoading(true);
    const err = await login(phone.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      // Get the user from the auth context (we might need to wait for it or just check what's returned)
      // Since login returns null on success, we check the user state or just use a generic check
      // For now, I'll update it to check the user role if possible, but the best way is to let the 
      // AuthContext handle the navigation or provide the user object.
      // Actually, I'll just check if the login was successful and then use a small delay or a check.
      
      // Better: Use a dedicated check for Super Admin redirect
      navigate(isDeveloperLogin ? '/super-admin' : '/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen-safe bg-[#0a0f1e] flex items-center justify-center p-6 relative overflow-hidden text-right" dir="rtl">
      {/* Background Glows (Matching Landing Page) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Brand Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[30px] bg-white/5 backdrop-blur-xl shadow-2xl mb-6 border border-white/10 group hover:scale-105 transition-all duration-500 overflow-hidden p-4">
            {schoolBranding.logo ? (
              <img src={schoolBranding.logo} alt="School Logo" className="w-full h-full object-contain drop-shadow-lg" />
            ) : (
              <BookOpen className="w-10 h-10 text-indigo-400 group-hover:rotate-6 transition-transform" />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">{schoolBranding.name}</h1>
          <p className="text-sm font-bold text-white/40 tracking-wider">نظام الإدارة المدرسية الذكي</p>
        </div>

        {/* Login Card (Glassmorphism) */}
        <div className="bg-white/[0.03] backdrop-blur-3xl rounded-[40px] border border-white/10 shadow-2xl shadow-black/50 p-8 sm:p-10 lg:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          
          <div className="mb-10 text-center sm:text-right">
             {isDeveloperLogin ? (
                <>
                  <h2 className="text-xl sm:text-2xl font-black text-orange-400 mb-2">بوابة المطورين (Super Admin)</h2>
                  <p className="text-sm font-bold text-white/40">يرجى تسجيل الدخول للوصول للوحة التحكم المركزية</p>
                </>
             ) : (
                <>
                  <h2 className="text-xl sm:text-2xl font-black text-white mb-2">تسجيل الدخول</h2>
                  <p className="text-sm font-bold text-white/40">أهلاً بك مجدداً، يرجى إدخال بياناتك</p>
                </>
             )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] mr-1">رقم الهاتف</label>
              <div className="relative group">
                <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-indigo-400 transition-colors">
                  <Phone className="w-full h-full" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
                  className="w-full h-14 px-5 pr-13 rounded-2xl border border-white/5 bg-white/[0.02] text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white/[0.05] focus:border-indigo-500/30 transition-all placeholder:text-white/10 font-bold"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] mr-1">كلمة المرور</label>
              <div className="relative group">
                <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-indigo-400 transition-colors">
                  <Lock className="w-full h-full" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full h-14 px-5 pr-13 rounded-2xl border border-white/5 bg-white/[0.02] text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white/[0.05] focus:border-indigo-500/30 transition-all placeholder:text-white/10 font-bold"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors p-2"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button type="button" className="text-xs font-bold text-white/30 hover:text-indigo-400 transition-colors">
                هل نسيت كلمة المرور؟
              </button>
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-xs font-bold text-white/30 group-hover:text-white transition-colors">تذكرني</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-9 h-5 bg-white/5 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/20 rounded-full transition-all peer-checked:translate-x-4 peer-checked:bg-white shadow-sm" />
                </div>
              </label>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold p-4 rounded-2xl text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-base shadow-2xl shadow-indigo-600/20 hover:bg-indigo-500 hover:translate-y-[-2px] active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري الدخول...</span>
                </div>
              ) : 'دخول للمنصة'}
            </button>
          </form>
        </div>

        {/* Support Section */}
        <div className="mt-10 text-center space-y-6">
          <p className="text-sm font-bold text-white/30">
            ليس لديك حساب حالياً؟{' '}
            <Link to="/signup" className="text-indigo-400 font-black hover:underline underline-offset-8 decoration-2">تواصل مع الإدارة</Link>
          </p>
          
          <div className="h-[1px] w-20 bg-white/5 mx-auto" />
          
          <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">
            E D A R A · A R A B I Y A · 2 0 2 5
          </p>
        </div>
      </div>
    </div>
  );
}
