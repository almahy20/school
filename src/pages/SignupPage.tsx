import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Eye, EyeOff, User, Phone, Lock, ArrowLeft } from 'lucide-react';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !password.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    const err = await signup(phone.trim(), password, fullName.trim());
    setLoading(false);
    if (err) setError(err);
    else {
      // ✅ Store signup time to trigger PWA install prompt
      const signupTime = Date.now().toString();
      sessionStorage.setItem('user_signup_time', signupTime);
      console.log('✅ General signup - stored signup time:', signupTime);
      navigate('/onboarding');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden text-right">
      {/* Soft Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-slate-200/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-[480px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Brand Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[30px] bg-white shadow-xl shadow-slate-200/50 mb-6 border border-slate-100 group hover:scale-105 transition-all duration-500">
            <BookOpen className="w-10 h-10 text-primary group-hover:rotate-6 transition-transform" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">إنشاء حساب جديد</h1>
          <p className="text-sm font-medium text-slate-400">انضم إلى مجتمع إدارة عربية المتطور</p>
        </div>

        {/* Signup Card */}
        <div className="bg-white/70 backdrop-blur-2xl rounded-[40px] border border-white shadow-2xl shadow-slate-900/5 p-10 lg:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">الاسم الكامل</label>
              <div className="relative group">
                <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors">
                  <User className="w-full h-full" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setError(''); }}
                  className="w-full px-6 pr-14 py-4.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all placeholder:text-slate-200 font-bold"
                  placeholder="الاسم الرباعي للمستخدم"
                />
              </div>
            </div>

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
                  className="w-full px-6 pr-14 py-4.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all placeholder:text-slate-200 font-bold"
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
                  className="w-full px-6 pr-14 py-4.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all placeholder:text-slate-200 font-bold"
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
              <p className="text-[10px] font-medium text-slate-300 pr-2">يجب أن تتكون من 6 أحرف على الأقل</p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-500 text-xs font-bold p-4 rounded-xl text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 rounded-2xl bg-slate-900 text-white font-bold text-base shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:translate-y-[-2px] transition-all disabled:opacity-50 active:scale-95 mt-4"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري المعالجة...</span>
                </div>
              ) : 'إنشاء الحساب الآن'}
            </button>
          </form>
        </div>

        <div className="mt-10 text-center space-y-6">
          <p className="text-sm font-medium text-slate-400">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="text-primary font-bold hover:underline underline-offset-4 decoration-2">تسجيل الدخول</Link>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
            <Link to="/super-admin" className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors w-full sm:w-auto flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10">
              <User className="w-4 h-4" />
              بوابة المطورين
            </Link>
          </div>
          
          <div className="h-[1px] w-20 bg-slate-200 mx-auto" />
          
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
            S E C U R E · A C C E S S · G U A R A N T E E D
          </p>
        </div>
      </div>
    </div>
  );
}
