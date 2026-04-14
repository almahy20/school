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
  const { data: classesData } = useClasses();
  const myClasses = classesData?.data || [];
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

      <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
        <StatsCard title="إجمالي الفصول" value={stats.classes} icon={School} color="indigo" trend="نشط" />
      </div>
    </div>
  );
}
