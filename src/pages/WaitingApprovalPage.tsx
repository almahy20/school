import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';

export default function WaitingApprovalPage() {
  const { user, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      // Navigation is handled by ProtectedRoute after user state changes
      navigate('/login', { replace: true });
    } catch (error) {
      logger.error('Logout failed:', error);
      // Force navigation even if logout fails
      navigate('/login', { replace: true });
    }
  };

  if (user?.approvalStatus === 'approved') {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 p-10 border border-slate-100 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-24 h-24 rounded-[32px] bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner animate-bounce">
            <Clock className="w-12 h-12" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">بانتظار موافقة الإدارة</h1>
            <p className="text-slate-500 font-medium leading-relaxed">
              مرحباً <span className="text-indigo-600 font-black">{user?.fullName}</span>، تم استلام طلب انضمامك بنجاح. حسابك الآن قيد المراجعة من قبل إدارة المدرسة.
            </p>
          </div>

          <div className="w-full p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-4">
             <div className="flex items-center gap-4 text-right">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                   <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-600 leading-relaxed">بمجرد تفعيل حسابك، ستتمكن من متابعة الأبناء، الدرجات، والمصروفات فوراً.</p>
             </div>
             
             <Button 
               onClick={refreshUser}
               className="w-full h-12 rounded-xl bg-white border-2 border-indigo-100 text-indigo-600 font-black hover:bg-indigo-50 transition-all gap-3"
             >
               <RefreshCw className="w-4 h-4" /> تحديث الحالة
             </Button>
          </div>

          <div className="flex flex-col w-full gap-3">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">هل تريد تسجيل الخروج؟</p>
             <Button 
               variant="ghost" 
               onClick={handleLogout}
               className="h-12 rounded-xl text-slate-400 font-black hover:text-rose-500 hover:bg-rose-50 transition-all gap-3"
             >
               <LogOut className="w-4 h-4" /> تسجيل الخروج
             </Button>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">نظام الإدارة المدرسية الذكي • منصتك التعليمية</p>
    </div>
  );
}
