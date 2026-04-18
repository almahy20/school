import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, LogOut, ExternalLink } from "lucide-react";

export default function SubscriptionExpiredPage() {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-cairo text-right" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-[48px] shadow-2xl shadow-slate-200 border border-slate-100 p-12 text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 rounded-[32px] bg-rose-50 flex items-center justify-center mx-auto mb-8 border border-rose-100 animate-bounce">
          <AlertTriangle className="w-12 h-12 text-rose-500" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">عذراً، انتهى الاشتراك!</h1>
        <p className="text-slate-500 font-medium text-lg leading-relaxed mb-10">
          يبدو أن اشتراك <strong className="text-slate-900">مدرستك</strong> قد انتهى. يرجى التواصل مع مطور النظام لتجديد الاشتراك وتفعيل الحساب.
        </p>

        <div className="space-y-4 mb-10">
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <Phone className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تواصل مع المطور</p>
                <p className="text-lg font-black text-slate-900">عبدالرحمن سيد فوزي</p>
              </div>
            </div>
            <a 
              href="https://wa.me/201029082772" 
              target="_blank" 
              rel="noreferrer"
              className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => window.open('https://wa.me/201029082772', '_blank')}
            className="h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg shadow-xl shadow-indigo-100"
          >
            تجديد الاشتراك الآن
          </Button>
          <Button 
            variant="ghost" 
            onClick={signOut}
            className="h-14 rounded-2xl text-slate-400 font-bold hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </div>

        <p className="mt-12 text-[10px] font-black text-slate-300 tracking-[0.3em] uppercase">
          Edara Arabiya Executive System
        </p>
      </div>
    </div>
  );
}
