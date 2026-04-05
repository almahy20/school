import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useNotifications } from '@/hooks/queries/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bell, Check, Trash2, Clock, CreditCard, 
  GraduationCap, MessageSquare, AlertCircle,
  ChevronLeft, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function NotificationsPage() {
  const { data: notifications = [], isLoading, refetch } = useNotifications();
  const [marking, setMarking] = useState(false);

  const markAllAsRead = async () => {
    setMarking(true);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);
    refetch();
    setMarking(false);
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    refetch();
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'new_fee':
      case 'fee_payment':
        return { icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-50' };
      case 'new_grade':
        return { icon: GraduationCap, color: 'text-indigo-500', bg: 'bg-indigo-50' };
      case 'attendance_alert':
        return { icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50' };
      case 'broadcast_message':
        return { icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-50' };
      default:
        return { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-50' };
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1000px] mx-auto text-right pb-14">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">مركز التنبيهات</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">تابع آخر التحديثات والرسائل الهامة</p>
          </div>
          
          <div className="flex items-center gap-4">
             <Button 
                variant="outline" 
                onClick={markAllAsRead} 
                disabled={marking || notifications.filter(n => !n.is_read).length === 0}
                className="h-11 px-6 rounded-xl border-slate-200 text-slate-600 font-black text-xs gap-2"
             >
               <Check className="w-4 h-4" /> تحديد الكل كمقروء
             </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-300 font-black tracking-widest text-[10px] uppercase">جاري استرجاع التنبيهات</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <Bell className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا توجد تنبيهات حالياً</h2>
            <p className="text-slate-400 font-medium text-sm">سيظهر هنا أي إشعارات جديدة تصل لحسابك.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => {
              const config = getTypeConfig(n.type);
              return (
                <div 
                  key={n.id}
                  className={cn(
                    "bg-white border p-6 rounded-[32px] shadow-sm flex items-start gap-6 group transition-all hover:shadow-md",
                    !n.is_read ? "border-indigo-100 bg-indigo-50/10" : "border-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                    config.bg, config.color
                  )}>
                    <config.icon className="w-7 h-7" />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className={cn("text-base font-black", !n.is_read ? "text-slate-900" : "text-slate-600")}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(n.created_at).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed">
                      {n.message}
                    </p>
                    
                    {!n.is_read && (
                       <div className="pt-2">
                          <Badge className="bg-indigo-600 text-white border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">جديد</Badge>
                       </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                     <button 
                       onClick={() => deleteNotification(n.id)}
                       className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                     >
                       <Trash2 className="w-4.5 h-4.5" />
                     </button>
                     <a 
                       href={n.metadata?.url || '#'}
                       className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-all hover:scale-110"
                     >
                        <ChevronLeft className="w-5 h-5" />
                     </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="flex items-center gap-3 p-6 rounded-3xl bg-slate-900 text-white/40 shadow-xl mt-10">
           <Info className="w-5 h-5 text-indigo-400" />
           <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">تتم مزامنة التنبيهات تلقائياً مع خوادم السحابة لضمان دقة البيانات.</p>
        </div>
      </div>
    </AppLayout>
  );
}
