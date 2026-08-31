import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Eye, EyeOff, Lock, Phone } from 'lucide-react';
import { useSchoolBySlug } from '@/hooks/queries';
import { useCleanBranding } from '@/hooks/useCleanBranding';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if there is a school slug in the URL query
  const params = new URLSearchParams(location.search);
  const slug = params.get('school');
  const { data: schoolData } = useSchoolBySlug(slug);
  const schoolBranding = useCleanBranding(schoolData);

  // Update document title
  useEffect(() => {
    if (schoolBranding.cleanName) {
      document.title = `${schoolBranding.cleanName} — تسجيل الدخول`;
    } else {
      document.title = "مدرسة الجيل الجديد — تسجيل الدخول";
    }
  }, [schoolBranding.cleanName]);

  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  const from = location.state?.from || '/';
  const isDeveloperLogin = from === '/super-admin';

  // Redirect when user state is set — this fires AFTER React state update, so user is guaranteed set
  const { user } = useAuth();
  useEffect(() => {
    if (user && (loginSuccess || !loginError)) {
      const destination = isDeveloperLogin ? '/super-admin' : (from === '/login' ? '/' : from);
      navigate(destination, { replace: true });
    }
  }, [user, loginSuccess, loginError, navigate, isDeveloperLogin, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setLoginError('يرجى إدخال رقم الهاتف وكلمة المرور');
      return;
    }
    setLoginError('');
    setLoading(true);
    const err = await login(phone.trim(), password, rememberMe);
    setLoading(false);
    if (err) {
      setLoginError(err);
      return;
    }
    // Mark success — useEffect above will navigate once user state updates in React
    setLoginSuccess(true);
  };

  // While waiting for user state to update after successful login, show a full-screen loader
  if (loginSuccess && !user) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-white/40 text-sm font-bold">جاري الدخول...</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            {schoolBranding.cleanName || 'الجيل الجديد'}
          </h1>
          <p className="text-sm font-bold text-white/40 tracking-wider">مدرسة الجيل الجديد</p>
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] mr-1">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setLoginError(''); }}
                className="w-full h-14 px-5 rounded-2xl border border-white/5 bg-white/[0.02] text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white/[0.05] focus:border-indigo-500/30 transition-all placeholder:text-white/10 font-bold text-base"
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] mr-1">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                  className="w-full h-14 px-5 pl-14 rounded-2xl border border-white/5 bg-white/[0.02] text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white/[0.05] focus:border-indigo-500/30 transition-all placeholder:text-white/10 font-bold text-base"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors p-2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setForgotPhone(phone);
                  setShowForgotModal(true);
                }}
                className="text-xs font-bold text-indigo-400/80 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                هل نسيت كلمة المرور؟
              </button>
              
              <label className="flex items-center gap-2.5 cursor-pointer group" title="تفعيل هذا الخيار يحفظ تسجيل دخولك على هذا الجهاز حتى بعد إغلاق المتصفح">
                <span className="text-xs font-bold text-white/50 group-hover:text-white transition-colors">تذكرني</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/40 rounded-full transition-all peer-checked:translate-x-4 peer-checked:bg-white shadow-sm" />
                </div>
              </label>
            </div>

            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold p-4 rounded-2xl text-center animate-in slide-in-from-top-2">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-base shadow-2xl shadow-indigo-600/20 hover:bg-indigo-500 hover:translate-y-[-2px] active:scale-[0.98] transition-all disabled:opacity-50 mt-2 cursor-pointer"
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

        {/* Support & Signup Section */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-sm font-bold text-white/40">
            ليس لديك حساب حالياً؟{' '}
            <Link to="/signup" className="text-indigo-400 font-black hover:underline underline-offset-8 decoration-2 mr-1">
              إنشاء حساب ولي أمر جديد 📝
            </Link>
          </p>
          
          <div className="h-[1px] w-20 bg-white/5 mx-auto" />
          
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
            نظام إدارة المدارس الإلكتروني الذكي
          </p>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
            <div className="bg-[#121829] border border-white/10 rounded-[32px] p-7 sm:p-8 max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
              
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-2xl">
                  🔑
                </div>
                <h3 className="text-xl font-black text-white">استعادة كلمة المرور</h3>
                <p className="text-xs font-bold text-white/60 leading-relaxed">
                  حرصاً على أمان بيانات الطلاب، يتم تعيين وتحديث كلمات المرور بالتواصل المباشر مع إدارة المدرسة.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40">رقم الهاتف المسجل به الحساب:</label>
                <input
                  type="tel"
                  value={forgotPhone}
                  onChange={e => setForgotPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const phoneText = forgotPhone ? ` (رقم هاتفي المسجل: ${forgotPhone})` : '';
                    const message = `السلام عليكم ورحمة الله، أرغب في استعادة كلمة المرور لحسابي في منصة المدرسة${phoneText}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
                  }}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/30"
                >
                  <span>📲 تواصل مع الإدارة عبر واتساب</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
