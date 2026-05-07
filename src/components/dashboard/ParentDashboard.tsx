import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayDate } from '@/lib/date-utils';
import { LayoutGrid, ChevronLeft, GraduationCap, Award, CalendarCheck, Wallet, Calendar, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useParentChildren } from '@/hooks/queries';
import { cn } from '@/lib/utils';

export function ParentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    data: children = [], 
    isLoading: loading, 
    error,
    refetch,
    isRefetching
  } = useParentChildren();

  return (
    <div className="flex flex-col gap-12 max-w-[1200px] mx-auto text-right py-8 sm:py-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 px-4 md:px-0" dir="rtl">
      <QueryStateHandler
        loading={loading}
        error={error}
        data={children}
        onRetry={refetch}
        isRefetching={isRefetching}
        errorMessage="عذراً، فشل تحميل بيانات الأبناء. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى."
        emptyMessage="لم يتم العثور على أبناء مرتبطين بحسابك. يرجى مراجعة إدارة المدرسة."
      >
        <header className="bg-slate-900 p-8 md:p-12 lg:p-16 rounded-[40px] md:rounded-[56px] text-white shadow-2xl relative overflow-hidden group animate-fade-in">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6 text-right">
               <div className="w-16 h-16 md:w-24 md:h-24 rounded-[24px] md:rounded-[36px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-700 shrink-0">
                  <GraduationCap className="w-8 h-8 md:w-12 md:h-12 text-slate-900" />
               </div>
               <div className="space-y-2">
                  <h1 className="text-2xl md:text-5xl font-black tracking-tight leading-tight">أهلاً بك، {user?.fullName?.split(' ')[0]}</h1>
                  <p className="text-white/40 text-xs md:text-lg font-medium leading-relaxed max-w-2xl">تابع تقدم أبنائك الأكاديمي والتحصيل العلمي بكل سهولة ويسر.</p>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="px-8 py-5 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 flex items-center gap-4 group hover:scale-[1.05] hover:bg-white/10 transition-all duration-500">
                 <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
                   <LayoutGrid className="w-6 h-6" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1 text-right">إجمالي الأبناء</p>
                   <p className="text-2xl md:text-4xl font-black text-white leading-none text-right">{children.length}</p>
                 </div>
              </div>

              <div className="px-8 py-5 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 flex items-center gap-4 group hover:scale-[1.05] hover:bg-white/10 transition-all duration-500">
                 <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
                   <Calendar className="w-6 h-6" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1 text-right">اليوم</p>
                   <p className="text-sm md:text-xl font-black text-white leading-none text-right">
                     {formatDisplayDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
                   </p>
                 </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 my-12">
          {children.map((child: any) => {
            return (
              <button 
                key={child.id}
                onClick={() => navigate(`/parent/children/${child.id}`)}
                className="stagger-item group relative w-full rounded-[40px] bg-white border border-slate-100 p-8 md:p-10 shadow-sm transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 active:scale-95 text-right overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-500" />
                
                <div className="flex items-start justify-between mb-10 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-900 font-black text-3xl md:text-5xl transition-all duration-700 group-hover:bg-slate-900 group-hover:text-white group-hover:rotate-3 shrink-0 shadow-inner">
                      {child.name.trim()[0]}
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{child.name}</h2>
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                        <User className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                        <p className="text-slate-500 group-hover:text-indigo-600 font-bold text-[10px] md:text-xs uppercase tracking-widest">{child.className || 'بدون فصل'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all duration-500 shadow-sm">
                    <ArrowLeft className="w-7 h-7 group-hover:-translate-x-1 transition-transform" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-10 relative z-10">
                  {/* الحضور - النسبة الإجمالية */}
                  <div className={cn(
                    "p-6 rounded-[28px] text-center transition-all duration-500 border",
                    child.attendanceRate > 0 
                      ? "bg-emerald-50/30 border-emerald-100 group-hover:bg-emerald-50" 
                      : "bg-slate-50/50 border-slate-100 opacity-50"
                  )}>
                    <CalendarCheck className={cn("w-7 h-7 mx-auto mb-3", child.attendanceRate > 0 ? "text-emerald-600" : "text-slate-300")} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الحضور الإجمالي</p>
                    <p className={cn("text-2xl font-black", child.attendanceRate > 0 ? "text-slate-900" : "text-slate-400")}>
                      {child.attendanceRate > 0 ? `${child.attendanceRate}%` : 'غير متاح'}
                    </p>
                  </div>
                  
                  {/* الرسوم */}
                  <div className={cn(
                    "p-6 rounded-[28px] text-center transition-all duration-500 border",
                    child.feesRemaining > 0 
                      ? "bg-amber-50/30 border-amber-100 group-hover:bg-amber-50" 
                      : "bg-emerald-50/30 border-emerald-100 opacity-80"
                  )}>
                    <Wallet className={cn("w-7 h-7 mx-auto mb-3", child.feesRemaining > 0 ? "text-amber-600" : "text-emerald-600")} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الحالة المالية</p>
                    <p className={cn("text-xl font-black", child.feesRemaining > 0 ? "text-slate-900" : "text-emerald-700")}>
                      {child.feesRemaining > 0 ? `${child.feesRemaining} ج` : 'مسدد بالكامل ✓'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-8 border-t border-slate-100 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">عرض التقارير والنتائج</span>
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 flex items-center gap-1 group-hover:gap-3 transition-all duration-500">
                    استكشاف الملف الشخصي 
                    <ChevronLeft className="w-4 h-4" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </QueryStateHandler>
    </div>
  );
}
