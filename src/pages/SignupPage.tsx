import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Eye, EyeOff } from 'lucide-react';

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
      setError('يرجى ملء جميع الحقول');
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
    else navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-[480px] relative z-10 animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-[1.5rem] bg-white shadow-xl shadow-primary/10 mx-auto flex items-center justify-center mb-5 border border-primary/5 transition-transform hover:scale-110 hover:rotate-3">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight mb-2">إنشاء حساب جديد</h1>
          <p className="text-muted-foreground font-medium text-sm">انضم إلى مجتمع إداره عربية الذكي</p>
        </div>

        {/* Signup Form Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-8 sm:p-10 animate-scale-in">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mr-1">الاسم الكامل</label>
              <input
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError(''); }}
                className="w-full px-6 py-3.5 rounded-2xl border border-input bg-card/50 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-right font-bold"
                placeholder="مثال: أحمد محمد علي"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                className="w-full px-6 py-3.5 rounded-2xl border border-input bg-card/50 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-right font-bold"
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mr-1">كلمة المرور</label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-6 py-3.5 rounded-2xl border border-input bg-card/50 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-right font-bold"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors p-2"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mr-1">يجب أن تكون 6 أحرف على الأقل</p>
            </div>

            {error && (
              <div className="bg-destructive/5 border border-destructive/10 text-destructive text-[13px] font-bold p-3.5 rounded-2xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-lg hover:shadow-2xl hover:shadow-primary/30 transition-all disabled:opacity-50 active:scale-[0.98] mt-4 shadow-lg shadow-primary/10"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>جارٍ الإنشاء...</span>
                </div>
              ) : 'إنشاء حساب جديد'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm font-bold text-muted-foreground">
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="text-primary hover:text-primary/80 transition-colors underline decoration-2 underline-offset-4">تسجيل الدخول</Link>
        </p>

        <p className="mt-10 text-center text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">
          T R U S T E D · B Y · E D U C A T O R S
        </p>
      </div>
    </div>
  );
}
