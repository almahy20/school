import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Eye, EyeOff, User, Phone, Lock } from 'lucide-react';
import { useSchoolBySlug } from '@/hooks/queries';

export default function TeacherSignupPage() {
  const { school_slug } = useParams();
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
    const err = await signup(phone.trim(), password, fullName.trim(), 'teacher', school.id);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      // ✅ Store signup time to trigger PWA install prompt
      const signupTime = Date.now().toString();
      sessionStorage.setItem('user_signup_time', signupTime);
      console.log('✅ Teacher signup - stored signup time:', signupTime);
      
      setSuccessMsg('تم إنشاء الحساب بنجاح! جاري تحويلك لصفحة الانتظار لحين موافقة الإدارة...');
      setTimeout(() => navigate('/'), 3000);
    }
  };

  if (schoolLoading && !error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" dir="rtl">
         <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
         <p className="mt-4 text-slate-500 font-bold">جاري تحميل بيانات المدرسة...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden text-right">
      <div className="w-full max-w-[480px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[30px] bg-white shadow-xl shadow-slate-200/50 mb-6 border border-slate-100 group overflow-hidden">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="School Logo" className="w-full h-full object-contain" />
            ) : (
              <BookOpen className="w-10 h-10 text-primary" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">تسجيل كمعلم جديد</h1>
          <p className="text-sm font-medium text-slate-400">
            الانضمام إلى مدرسة: <span className="font-bold text-slate-800">{school?.name}</span>
          </p>
        </div>

        <div className="bg-white/70 backdrop-blur-2xl rounded-[40px] border border-white shadow-2xl shadow-slate-900/5 p-10">
          {error && !school ? (
             <div className="bg-rose-50 border border-rose-100 text-rose-500 text-sm font-bold p-6 rounded-xl text-center">
               {error}
             </div>
          ) : successMsg ? (
             <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold p-6 rounded-xl text-center">
               {successMsg}
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">الاسم الكامل</label>
                <div className="relative group">
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300">
                    <User className="w-full h-full" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => { setFullName(e.target.value); setError(''); }}
                    className="w-full px-6 pr-14 py-5 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">رقم الهاتف</label>
                <div className="relative group">
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300">
                    <Phone className="w-full h-full" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    className="w-full px-6 pr-14 py-5 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">كلمة المرور</label>
                <div className="relative group">
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300">
                    <Lock className="w-full h-full" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="w-full px-6 pr-14 py-5 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 p-2"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-500 text-xs font-bold p-4 rounded-xl text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-16 rounded-2xl bg-slate-900 text-white font-bold text-base shadow-xl mt-4 hover:bg-primary transition-colors"
              >
                {loading ? 'جاري المعالجة...' : 'تسجيل حساب وطلب انضمام'}
              </button>
            </form>
          )}
        </div>
        <div className="mt-10 text-center">
          <p className="text-sm font-medium text-slate-400">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">تسجيل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
