import { useAuth } from '@/contexts/AuthContext';
import { useAdminStats, useAdminActivities } from '@/hooks/queries';
import { formatDisplayDate } from '@/lib/date-utils';
import { 
  Users, School, CalendarCheck, Wallet, Activity, 
  MessageSquare, UserCheck, Calendar, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from './StatsCard';
import { RegistrationLinksCard } from './RegistrationLinksCard';

export function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats = { students: 0, teachers: 0, parents: 0, classes: 0, totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0 } } = useAdminStats();
  const { data: activities = [], isLoading: activitiesLoading } = useAdminActivities();

  const userName = user?.fullName ? user.fullName.split(' ')[0] : 'أدمن';

  return (
    <div className="flex flex-col gap-6 md:gap-8 lg:gap-10 max-w-[1400px] xl:max-w-[1500px] mx-auto text-right px-4 md:px-0">
      <header className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 p-8 md:p-12 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        {/* Removed external image dependency for better performance */}
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6 text-right">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-[28px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
               <School className="w-8 h-8 md:w-10 md:h-10 text-slate-900" />
            </div>
            <div className="space-y-2">
               <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">مرحباً، {userName}</h1>
               <p className="text-white/50 text-xs md:text-base font-medium leading-relaxed max-w-2xl">
                 نظرة عامة شاملة على أداء المدرسة اليوم. تابع التحصيل المالي، حضور الطلاب، ونشاط الكادر التعليمي.
               </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 px-8 py-5 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 group hover:scale-105 transition-all w-full md:w-auto">
             <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/50 group-hover:text-white transition-colors shrink-0">
               <Calendar className="w-6 h-6" />
             </div>
             <div className="min-w-0">
               <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-2 text-right">تاريخ اليوم</p>
               <p className="text-lg md:text-xl font-black text-white leading-none text-right truncate">
                 {formatDisplayDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
               </p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
        <StatsCard title="إجمالي الطلاب" value={stats.students || 0} icon={Users} color="white" trend="نشط" />
        <StatsCard 
          title="التحصيل المالي" 
          value={`${(stats.totalPaid || 0).toLocaleString()} ج.م`} 
          subValue={`من ${(stats.totalDue || 0).toLocaleString()}`} 
          icon={Wallet} 
          color="indigo" 
        />
        <StatsCard 
          title="نسبة الحضور" 
          value={`${stats.attendanceRate || 0}%`} 
          subValue={`حضور ${stats.presentToday || 0} طالب`} 
          icon={CalendarCheck} 
          color="emerald" 
        />
        <StatsCard title="كادر المعلمين" value={stats.teachers || 0} icon={Users} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        <div className="lg:col-span-2 premium-card p-4 md:p-6">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-sm">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                   <h2 className="text-lg md:text-xl font-bold text-slate-900">النشاطات الأخيرة</h2>
                   <p className="text-slate-500 text-[10px] font-medium mt-0.5">سجل التغييرات والعمليات المنفذة في النظام</p>
                </div>
             </div>
             <Button variant="ghost" className="h-9 px-3 rounded-xl text-slate-500 font-bold text-[10px] uppercase tracking-wide hover:bg-slate-50 self-start sm:self-auto">عرض سجل العمليات</Button>
           </div>
           
           <div className="space-y-6">
              {activitiesLoading ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-3xl" />
                  ))}
                </div>
              ) : activities.length > 0 ? (
                activities.map((act: any) => {
                  const Icon = act.type === 'complaint' ? MessageSquare : act.type === 'registration' ? UserCheck : Wallet;
                  return (
                    <div key={act.id} className="group p-3 md:p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shrink-0">
                            <Icon className="w-4 h-4" />
                         </div>
                         <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 mb-0.5 truncate">{act.title}</h3>
                            <p className="text-[10px] font-medium text-slate-500 truncate">{act.description}</p>
                         </div>
                      </div>
                      <div className="text-left shrink-0">
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">{new Date(act.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</p>
                         <Badge variant="outline" className={cn(
                           "border-none font-bold text-[8px] py-0 px-2 rounded-lg h-5 flex items-center justify-center",
                           act.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                         )}>
                           {act.status === 'pending' ? 'قيد الانتظار' : 'مكتمل'}
                         </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                 <div className="p-16 text-center flex flex-col items-center gap-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-slate-300 shadow-inner border border-slate-100 relative z-10 group-hover:scale-110 transition-transform">
                       <Activity className="w-8 h-8" />
                    </div>
                    <div className="relative z-10 space-y-2">
                       <p className="text-slate-900 font-bold text-base">لا توجد نشاطات مؤخرة</p>
                       <p className="text-slate-500 font-medium text-sm">سيظهر هنا أي تحديثات تتم على بيانات الطلاب أو المعلمين.</p>
                    </div>
                 </div>
              )}
           </div>
        </div>

        <div className="flex flex-col gap-10">
           <RegistrationLinksCard />
           
           <div className="premium-card bg-slate-100/50 border-slate-200 flex flex-col items-center justify-center relative overflow-hidden flex-1 group">
                <div className="text-center p-8 space-y-4 relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-slate-300 mx-auto shadow-inner border border-slate-100 group-hover:rotate-12 transition-transform">
                      <Target className="w-7 h-7" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-lg font-bold tracking-tight text-slate-500">الأهداف الاستراتيجية</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">قريباً في التحديث القادم</p>
                   </div>
                </div>
           </div>
        </div>
      </div>
    </div>
  );
}
