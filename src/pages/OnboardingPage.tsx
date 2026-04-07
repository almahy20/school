import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Users, PartyPopper, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const roleLabel = user?.role === 'admin' ? 'مدير نظام' : user?.role === 'teacher' ? 'معلم' : 'ولي أمر';

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto text-right py-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="bg-white border border-slate-100 rounded-[40px] p-12 shadow-sm text-center relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="w-20 h-20 rounded-[30px] bg-primary/5 border border-primary/10 mx-auto flex items-center justify-center mb-8 group overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 transition-transform group-hover:scale-110">
              <PartyPopper className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">أهلاً بك، {user?.fullName}</h1>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-500 font-bold text-xs border border-slate-100 mb-8">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>تم تفعيل حسابك كـ <span className="text-primary">{roleLabel}</span></span>
          </div>

          <div className="space-y-6 mb-10 max-w-sm mx-auto">
            <p className="text-base font-medium text-slate-500 leading-relaxed">
              تم إعداد حسابك بنجاح في منصتك المدرسية الذكية. يمكنك الآن البدء في استكشاف النظام ومتابعة المهام التعليمية.
            </p>
            {user?.role === 'parent' && (
              <p className="text-sm font-medium text-amber-600 bg-amber-50 rounded-2xl p-4 border border-amber-100">
                ملاحظة: سيقوم مدير المدرسة بربط أبنائك بحسابك قريباً لتتمكن من متابعة درجاتهم وحضورهم بشكل كامل.
              </p>
            )}
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-12 py-4 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-xl shadow-slate-900/10 hover:bg-primary hover:shadow-primary/20 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center gap-3 mx-auto group"
          >
            <span>الذهاب إلى لوحة التحكم</span>
            <ArrowLeft className="w-4 h-4 group-hover:translate-x-[-4px] transition-transform" />
          </button>
        </div>
        
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 opacity-50">
          {[
            { label: 'واجهة بسيطة', desc: 'سهولة في التصفح والوصول' },
            { label: 'مزامنة فورية', desc: 'تحديثات لحظية للبيانات' },
            { label: 'أمان كامل', desc: 'حماية بياناتك وصلاحياتك' }
          ].map((item, i) => (
            <div key={i} className="text-center space-y-1">
              <h4 className="text-xs font-bold text-slate-900">{item.label}</h4>
              <p className="text-[10px] font-medium text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
