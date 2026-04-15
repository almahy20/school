import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useClasses, useTeacherStats } from '@/hooks/queries';
import { formatDisplayDate } from '@/lib/date-utils';
import { 
  GraduationCap, School, Users, LayoutGrid, Calendar, Filter,
  ArrowLeft, ChevronLeft, BookOpen
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
    <div className="flex flex-col gap-10 max-w-[1500px] mx-auto text-right px-4 md:px-0">
      <header className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-8 md:p-12 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6 text-right">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-[28px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
               <GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-slate-900" />
            </div>
            <div className="space-y-2">
               <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">مرحباً، أ. {user?.fullName?.split(' ')[0]}</h1>
               <p className="text-white/40 text-xs md:text-base font-medium leading-relaxed max-w-2xl">أهلاً بك في فضاء المعلم المبدع. تابع فصولك، قيم أداء طلابك، وقم بإدارة المحتوى الدراسي بكل سلاسة واحترافية.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 px-8 py-5 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 group hover:scale-105 transition-all w-full md:w-auto">
             <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="إجمالي الفصول" value={stats.classes} icon={School} color="indigo" />
        <StatsCard title="عدد الطلاب" value={stats.students} icon={Users} color="emerald" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-slate-900">فصولي الدراسية</h2>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {myClasses.map((cls) => (
             <div 
               key={cls.id}
               onClick={() => navigate(`/classes/${cls.id}`)}
               className="group premium-card p-6 flex flex-col justify-between cursor-pointer hover:translate-y-[-4px] transition-all duration-300 min-h-[160px]"
             >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <School className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{cls.name}</h3>
                      <p className="text-xs text-slate-400 font-bold">{cls.grade_level || 'بدون مرحلة'}</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> عرض الطلاب</span>
                  <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> المنهج الدراسي</span>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
