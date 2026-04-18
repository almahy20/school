import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Eye, EyeOff, User, Phone, Lock, ArrowLeft } from 'lucide-react';
import { useSchoolBySlug } from '@/hooks/queries';

export default function ParentSignupPage() {
  const { school_slug } = useParams();
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: school, isLoading: schoolLoading, error: schoolError } = useSchoolBySlug(school_slug);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const schoolBranding = useMemo(() => {
    if (!school) return { name: 'المدرسة الذكية', logo: '' };
    
    let logo = school.logo_url || '';
    
    // ✅ نشيل cache buster من اللوجو
    if (logo) {
      logo = logo.split('?')[0];
    }
    
    return {
      name: school.name,
      logo: logo
    };
  }, [school]);

  useEffect(() => {
    if (schoolError) {
      setError('المدرسة غير موجودة أو حدث خطأ في التحميل');
    }
  }, [schoolError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    if (!fullName.trim() || !phone.trim() || !password.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    const err = await signup(phone.trim(), password, fullName.trim(), 'parent', school.id);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      // ✅ Store signup time to trigger PWA onboarding
      sessionStorage.setItem('user_signup_time', Date.now().toString());
      
      setSuccessMsg('تم إنشاء الحساب بنجاح! جاري تحويلك لصفحة الانتظار...');
      setTimeout(() => navigate('/waiting-approval'), 2000);
    }
  };

  if (schoolLoading && !error) {
    return (
      <div className="min-h-screen-safe bg-[#0a0f1e] flex items-center justify-center p-6" dir="rtl">
         <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
         <p className="mt-4 text-white/40 font-bold">جاري تحميل بيانات المدرسة...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe bg-[#0a0f1e] flex items-center justify-center p-6 relative overflow-hidden text-right" dir="rtl">
      {/* Background Glows */}
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
          <p className="text-sm font-bold text-white/40 tracking-wider">تسجيل حساب ولي أمر جديد</p>
        </div>

        {/* Signup Card (Glassmorphism) */}
        <div className="bg-white/[0.03] backdrop-blur-3xl rounded-[40px] border border-white/10 shadow-2xl shadow-black/50 p-8 sm:p-10 lg:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          
          <div className="mb-10 text-center sm:text-right">
             {successMsg ? (
               <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold p-6 rounded-2xl text-center">
                 {successMsg}
               </div>
             ) : (
               <>
                 <h2 className="text-xl sm:text-2xl font-black text-white mb-2">إنشاء حساب ولي أمر</h2>
                 <p className="text-sm font-bold text-white/40">أبناء في مدرسة {school?.name}</p>
               </>
             )}
          </div>

          {!successMsg && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] mr-1">الاسم الكامل</label>
                <div className="relative group">
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-indigo-400 transition-colors">
                    <User className="w-full h-full" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => { setFullName(e.target.value); setError(''); }}
                    className="w-full h-14 px-5 pr-13 rounded-2xl border border-white/5 bg-white/[0.02] text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white/[0.05] focus:border-indigo-500/30 transition-all placeholder:text-white/10 font-bold"
                    placeholder="الاسم الكامل"
                  />
                </div>
              </div>

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
                    <span>جاري المعالجة...</span>
                  </div>
                ) : 'تسجيل حساب وطلب انضمام'}
              </button>
            </form>
          )}
        </div>

        {/* Login Link */}
        <div className="mt-10 text-center space-y-6">
          <p className="text-sm font-bold text-white/30">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="text-indigo-400 font-black hover:underline underline-offset-8 decoration-2">تسجيل الدخول</Link>
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
