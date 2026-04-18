import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useClasses, useTeacherStats } from '@/hooks/queries';
import { formatDisplayDate } from '@/lib/date-utils';
import { 
  GraduationCap, School, Users, LayoutGrid, Calendar, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from './StatsCard';

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: myClasses = [] } = useClasses();
  const { data: stats = { classes: 0, students: 0 } } = useTeacherStats();

  return (
    <div className="flex flex-col gap-12 max-w-[1500px] mx-auto text-right">
      <header className="bg-slate-900 p-6 md:p-10 lg:p-12 rounded-[32px] md:rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
          <div className="flex items-center gap-4 md:gap-6 text-right">
            <div className="w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[28px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
               <GraduationCap className="w-7 h-7 md:w-10 md:h-10 text-slate-900" />
            </div>
            <div className="space-y-1 md:space-y-2">
               <h1 className="text-xl md:text-4xl font-black tracking-tight leading-tight">مرحباً، أ. {user?.fullName?.split(' ')[0]}</h1>
               <p className="text-white/40 text-xs md:text-base font-medium leading-relaxed max-w-2xl">أهلاً بك في فضاء المعلم المبدع. تابع فصولك، قيم أداء طلابك، وقم بإدارة المحتوى الدراسي بكل سلاسة واحترافية.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-4 px-5 md:px-8 py-3.5 md:py-5 rounded-[20px] md:rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 group hover:scale-105 transition-all w-full md:w-auto">
             <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
               <Calendar className="w-5 h-5 md:w-7 md:h-7" />
             </div>
             <div className="min-w-0">
               <p className="text-[8px] md:text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1 md:mb-2 text-right">تاريخ اليوم</p>
                 <p className="text-sm md:text-xl font-black text-white leading-none text-right truncate">
                   {formatDisplayDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
                 </p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <StatsCard title="فصولي الدراسية" value={stats.classes} icon={School} color="indigo" trend="نشط" />
        <StatsCard title="الطلاب النشطون" value={stats.students} icon={Users} color="emerald" />
      </div>

      <section className="premium-card p-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                <LayoutGrid className="w-7 h-7" />
              </div>
              <div>
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight">إدارة الفصول النشطة</h2>
                 <p className="text-slate-400 font-medium text-sm mt-1">عرض وتحديث سجلات الطلاب والمنهج لكل فصل</p>
              </div>
           </div>
           <Button variant="outline" className="h-14 px-8 rounded-2xl border-slate-200 font-black text-xs gap-3 hover:bg-slate-50 transition-all">
              <Filter className="w-4 h-4" /> تصفية الفصول
           </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
           {myClasses.length > 0 ? myClasses.map(c => (
             <div key={c.id} className="p-10 rounded-[40px] bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
               
               <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-900 font-black border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                     {c.name.trim()[0]}
                  </div>
                  <Badge className="bg-white border-slate-100 text-slate-400 font-black text-[9px] uppercase tracking-widest shadow-sm">
                    {c.grade_level || 'دراسات عليا'}
                  </Badge>
               </div>

               <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
               <p className="text-xs font-medium text-slate-400 leading-relaxed mb-8">
                  إدارة شاملة لطلاب الفصل، رصد الدرجات، ومتابعة التقدم في الخطة الدراسية.
               </p>

               <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <div className="flex -space-x-3 space-x-reverse">
                     {[1,2,3].map(i => (
                       <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {i}
                       </div>
                     ))}
                     <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">
                        +20
                     </div>
                  </div>
                  <Button 
                    onClick={() => navigate(`/classes/${c.id}`)}
                    className="rounded-2xl bg-white text-slate-900 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all px-6 font-black text-xs h-11"
                  >
                     دخول السجل
                  </Button>
               </div>
             </div>
           )) : (
             <div className="col-span-full p-20 text-center flex flex-col items-center gap-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-[40px] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 rounded-[24px] bg-white flex items-center justify-center text-slate-200 shadow-inner border border-slate-100 relative z-10 group-hover:scale-110 transition-transform">
                   <School className="w-8 h-8" />
                </div>
                <div className="relative z-10 space-y-2">
                   <p className="text-slate-900 font-black text-lg">لا توجد فصول دراسية</p>
                   <p className="text-slate-400 font-medium text-sm">لم يتم تعيين أي فصول دراسية لك بعد. يرجى التواصل مع إدارة المدرسة.</p>
                </div>
             </div>
           )}
        </div>
      </section>
    </div>
  );
}
