import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { 
  useNotifications, 
  useMarkAllAsRead, 
  useDeleteNotification,
  useNotificationsRealtime
} from '@/hooks/queries/useNotifications';
import { 
  Bell, Check, Trash2, Clock, CreditCard, 
  GraduationCap, MessageSquare, AlertCircle,
  ChevronLeft, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import DataPagination from '@/components/ui/DataPagination';
import PageHeader from '@/components/layout/PageHeader';

const PAGE_SIZE = 15;

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useNotifications(page, PAGE_SIZE);
  const notificationsRealtime = useNotificationsRealtime();
  
  const notifications = data?.data || [];
  const totalItems = data?.count || 0;

  // Setup real-time subscription
  useEffect(() => {
    const cleanup = notificationsRealtime.subscribe();
    return () => cleanup?.();
  }, [notificationsRealtime]);

  // ── Mutations ──
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteNotificationMutation = useDeleteNotification();

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      refetch();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotificationMutation.mutateAsync(id);
      refetch();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
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
      case 'teacher_message':
        return { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50' };
      default:
        return { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-50' };
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto text-right pt-2 md:pt-6 pb-24 px-4 md:px-6">
        <PageHeader
          icon={Bell}
          title="مركز التنبيهات"
          subtitle="تابع آخر التحديثات والرسائل الهامة المتعلقة بمسيرتك التعليمية"
          action={
            <Button
              variant="outline"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending || notifications.filter(n => !n.is_read).length === 0}
              className="h-12 px-6 rounded-2xl border-slate-200 text-slate-700 font-black text-xs gap-2 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Check className="w-4 h-4 text-emerald-500" />
              {markAllAsReadMutation.isPending ? 'جاري التحديث...' : 'تحديد الكل كمقروء'}
            </Button>
          }
        />

        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={notifications}
          onRetry={refetch}
          isEmpty={notifications.length === 0}
          loadingMessage="جاري مزامنة التنبيهات الجديدة..."
          emptyMessage="سجلك خالٍ من التنبيهات حالياً. أهلاً بك!"
        >
          <div className="space-y-10">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} تنبيه — الصفحة {page}
              </span>
            </div>

            <div className="space-y-4">
              {notifications.map((n) => {
                const config = getTypeConfig(n.type);
                return (
                  <div 
                    key={n.id}
                    className={cn(
                      "bg-white border p-6 rounded-[32px] shadow-sm flex items-start gap-6 group transition-all hover:shadow-md relative overflow-hidden",
                      !n.is_read ? "border-indigo-100 bg-indigo-50/10" : "border-slate-50"
                    )}
                  >
                    {!n.is_read && <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-600" />}
                    
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:rotate-6",
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
                          <Clock className="w-3.5 h-3.5 text-slate-200" />
                          {new Date(n.created_at).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed text-right">
                        {n.message}
                      </p>
                      
                      {!n.is_read && (
                         <div className="pt-2">
                            <Badge className="bg-indigo-600 text-white border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-sm shadow-indigo-100">جديد</Badge>
                         </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                       <button 
                         onClick={() => handleDeleteNotification(n.id)}
                         disabled={deleteNotificationMutation.isPending}
                         className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm"
                       >
                         <Trash2 className="w-4.5 h-4.5" />
                       </button>
                       {n.metadata?.url && (
                         <a 
                           href={n.metadata.url}
                           className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-all hover:scale-110 shadow-sm"
                         >
                            <ChevronLeft className="w-5 h-5" />
                         </a>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4">
              <DataPagination
                currentPage={page}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </div>
        </QueryStateHandler>
        
        <div className="flex items-center gap-3 p-6 rounded-3xl bg-slate-900 text-white/40 shadow-xl mt-10">
           <Info className="w-5 h-5 text-indigo-400" />
           <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">تتم مزامنة التنبيهات تلقائياً في الخلفية لضمان وصول المعلومات فور رصدها.</p>
        </div>
      </div>
    </AppLayout>
  );
}
