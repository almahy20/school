import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Eye, EyeOff, Lock, Phone, ArrowLeft } from 'lucide-react';

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
  const defaultLogo = "https://mecutwhreywjwstirpka.supabase.co/storage/v1/object/public/branding/logo.png";
  const [schoolBranding, setSchoolBranding] = useState({ name: 'المدرسة الذكية', logo: defaultLogo });

  useEffect(() => {
    // Check if there is a school slug in the URL query
    const params = new URLSearchParams(location.search);
    const slug = params.get('school');
    
    if (slug) {
      const fetchBranding = async () => {
        try {
          const { data, error } = await supabase
            .from('schools')
            .select('name, logo_url, icon_url, theme_color')
            .eq('slug', slug)
            .maybeSingle();
            
          if (error) {
            console.error('Error fetching branding:', error);
            return;
          }

          if (data) {
            // Update theme color CSS variable
            if (data.theme_color) {
              document.documentElement.style.setProperty('--school-primary', data.theme_color);
            }

            const timestamp = Date.now();
            const logo = data.icon_url || data.logo_url || '';
            const logoWithCacheBust = logo ? (logo.includes('?') ? `${logo}&v=${timestamp}` : `${logo}?v=${timestamp}`) : '';
            
            setSchoolBranding({
              name: data.name,
              logo: logoWithCacheBust
            });
          }
        } catch (err) {
          console.error('Fatal error in fetchBranding:', err);
        }
      };
      fetchBranding();
    }
  }, [location.search]);
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden text-right">
      {/* Soft Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-slate-200/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-[460px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Brand Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[30px] bg-white shadow-xl shadow-slate-200/50 mb-6 border border-slate-100 group hover:scale-105 transition-all duration-500 overflow-hidden">
            {schoolBranding.logo ? (
              <img src={schoolBranding.logo} alt="School Logo" className="w-full h-full object-contain" />
            ) : (
              <BookOpen className="w-10 h-10 text-primary group-hover:rotate-6 transition-transform" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">{schoolBranding.name}</h1>
          <p className="text-sm font-medium text-slate-400">نظام الإدارة المدرسية الذكي</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/70 backdrop-blur-2xl rounded-[40px] border border-white shadow-2xl shadow-slate-900/5 p-10 lg:p-12">
          <div className="mb-10 text-center sm:text-right">
             {isDeveloperLogin ? (
                <>
                  <h2 className="text-2xl font-bold text-orange-600 mb-2">بوابة المطورين (Super Admin)</h2>
                  <p className="text-sm font-medium text-slate-400">يرجى تسجيل الدخول للوصول للوحة التحكم المركزية</p>
                </>
             ) : (
                <>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">تسجيل الدخول</h2>
                  <p className="text-sm font-medium text-slate-400">أهلاً بك مجدداً، يرجى إدخال بياناتك</p>
                </>
             )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">رقم الهاتف</label>
              <div className="relative group">
                <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors">
                  <Phone className="w-full h-full" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
                  className="w-full h-14 px-6 pr-14 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all placeholder:text-slate-200 font-bold"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">كلمة المرور</label>
              <div className="relative group">
                <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors">
                  <Lock className="w-full h-full" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full h-14 px-6 pr-14 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all placeholder:text-slate-200 font-bold"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors p-2"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button type="button" className="text-xs font-bold text-slate-400 hover:text-primary transition-colors">
                هل نسيت كلمة المرور؟
              </button>
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-xs font-bold text-slate-400 group-hover:text-slate-900 transition-colors">تذكرني</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-9 h-5 bg-slate-100 rounded-full peer peer-checked:bg-primary transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-4 shadow-sm" />
                </div>
              </label>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-500 text-xs font-bold p-4 rounded-xl text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 rounded-2xl bg-primary text-white font-bold text-base shadow-xl shadow-primary/20 hover:shadow-2xl hover:translate-y-[-2px] transition-all disabled:opacity-50 active:scale-95 mt-2"
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
          <p className="text-sm font-medium text-slate-400">
            ليس لديك حساب حالياً؟{' '}
            <Link to="/signup" className="text-school-primary font-bold hover:underline underline-offset-4 decoration-2">تواصل مع الإدارة</Link>
          </p>
          
          <div className="h-[1px] w-20 bg-slate-200 mx-auto" />
          
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
            E D A R A · A R A B I Y A · 2 0 2 5
          </p>
        </div>
      </div>
    </div>
  );
}
