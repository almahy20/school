import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Eye, EyeOff } from 'lucide-react';


export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError('يرجى إدخال رقم الهاتف وكلمة المرور');
      return;
    }
    setLoading(true);
    const err = await login(phone.trim(), password);
    setLoading(false);
    if (err) setError(err);
    else navigate('/');
  };


  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-[440px] relative z-10 animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 rounded-[2rem] bg-white shadow-2xl shadow-primary/20 mx-auto flex items-center justify-center mb-6 border border-primary/10 transition-transform hover:scale-110 hover:rotate-3">
            <BookOpen className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tight mb-3">إدارة عربية</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground font-medium">
            <span className="w-8 h-[1px] bg-muted-foreground/20" />
            <span>نظام الإدارة المدرسية الذكي</span>
            <span className="w-8 h-[1px] bg-muted-foreground/20" />
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-10 animate-scale-in">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">تسجيل الدخول</h2>
            <p className="text-muted-foreground text-sm">مرحباً بك مجدداً! يرجى إدخال بياناتك للمتابعة.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mr-1">رقم الهاتف / اسم المستخدم</label>
              <div className="relative group">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
                  className="w-full px-6 py-4 rounded-2xl border border-input bg-card/50 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-right font-bold"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mr-1">كلمة المرور</label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-6 py-4 rounded-2xl border border-input bg-card/50 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-right font-bold"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors p-2 rounded-xl"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button type="button" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                هل نسيت كلمة المرور؟
              </button>
              <label className="flex items-center gap-3 cursor-pointer group">
                <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">تذكرني</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors" />
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
            </div>

            {error && (
              <div className="bg-destructive/5 border border-destructive/10 text-destructive text-sm font-bold p-4 rounded-2xl text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4.5 rounded-2xl bg-primary text-primary-foreground font-black text-lg hover:shadow-2xl hover:shadow-primary/30 transition-all disabled:opacity-50 active:scale-[0.98] mt-2 shadow-lg shadow-primary/10"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>جارٍ التحقق...</span>
                </div>
              ) : 'دخول للمنصة'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm font-bold text-muted-foreground">
          ليس لديك حساب؟{' '}
          <Link to="/signup" className="text-primary hover:text-primary/80 transition-colors underline decoration-2 underline-offset-4">تواصل مع الإدارة</Link>
        </p>

        <p className="mt-12 text-center text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">
          E D A R A · A R A B I Y A · 2 0 2 5
        </p>
      </div>
    </div>
  );
}
