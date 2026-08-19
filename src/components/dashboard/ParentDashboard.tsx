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
        <header className="bg-slate-900 p-6 md:p-10 rounded-[32px] md:rounded-[48px] text-white shadow-2xl relative overflow-hidden group animate-fade-in">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5 text-right">
               <div className="w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[32px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-700 shrink-0">
                  <GraduationCap className="w-7 h-7 md:w-10 md:h-10 text-slate-900" />
               </div>
               <div className="space-y-1.5 md:space-y-2">
                  <h1 className="text-xl md:text-3xl lg:text-4xl font-black tracking-tight leading-tight">أهلاً بك، {user?.fullName?.split(' ')[0]}</h1>
                  <p className="text-white/40 text-[11px] md:text-sm lg:text-base font-medium leading-relaxed max-w-2xl">تابع تقدم أبنائك الأكاديمي والتحصيل العلمي بكل سهولة ويسر.</p>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
              <div className="px-5 py-4 md:px-6 md:py-4 rounded-[24px] md:rounded-[28px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 flex items-center gap-3 md:gap-4 group hover:scale-[1.03] hover:bg-white/10 transition-all duration-500">
                 <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
                   <LayoutGrid className="w-5 h-5 md:w-6 md:h-6" />
                 </div>
                 <div>
                   <p className="text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-widest mb-0.5 md:mb-1 text-right">إجمالي الأبناء</p>
                   <p className="text-xl md:text-3xl font-black text-white leading-none text-right">{children.length}</p>
                 </div>
              </div>

              <div className="px-5 py-4 md:px-6 md:py-4 rounded-[24px] md:rounded-[28px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 flex items-center gap-3 md:gap-4 group hover:scale-[1.03] hover:bg-white/10 transition-all duration-500">
                 <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
                   <Calendar className="w-5 h-5 md:w-6 md:h-6" />
                 </div>
                 <div className="min-w-0">
                   <p className="text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-widest mb-0.5 md:mb-1 text-right">اليوم</p>
                   <p className="text-sm md:text-lg font-black text-white leading-none text-right truncate">
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
                
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 md:w-18 md:h-18 rounded-[24px] bg-slate-50 flex items-center justify-center text-slate-900 font-black text-2xl md:text-3xl transition-all duration-700 group-hover:bg-slate-900 group-hover:text-white group-hover:rotate-3 shrink-0 shadow-inner" style={{ width: '64px', height: '64px' }}>
                      {child.name.trim()[0]}
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{child.name}</h2>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                        <User className="w-3 h-3 text-slate-400 group-hover:text-indigo-500" />
                        <p className="text-slate-500 group-hover:text-indigo-600 font-bold text-[10px] md:text-xs uppercase tracking-widest">{child.className || 'بدون فصل'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all duration-500 shadow-sm shrink-0">
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                  {/* الحضور */}
                  <div className={cn(
                    "p-4 rounded-[24px] text-center transition-all duration-500 border",
                    child.attendanceRate > 0 
                      ? "bg-emerald-50/30 border-emerald-100 group-hover:bg-emerald-50" 
                      : "bg-slate-50/50 border-slate-100 opacity-50"
                  )}>
                    <CalendarCheck className={cn("w-5 h-5 mx-auto mb-2", child.attendanceRate > 0 ? "text-emerald-600" : "text-slate-300")} />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">الحضور</p>
                    <p className={cn("text-xl font-black", child.attendanceRate > 0 ? "text-slate-900" : "text-slate-400")}>
                      {child.attendanceRate > 0 ? `${child.attendanceRate}%` : 'غير متاح'}
                    </p>
                  </div>
                  
                  {/* الرسوم */}
                  <div className={cn(
                    "p-4 rounded-[24px] text-center transition-all duration-500 border",
                    child.feesRemaining > 0 
                      ? "bg-amber-50/30 border-amber-100 group-hover:bg-amber-50" 
                      : "bg-slate-50/50 border-slate-100 opacity-70"
                  )}>
                    <Wallet className={cn("w-5 h-5 mx-auto mb-2", child.feesRemaining > 0 ? "text-amber-600" : "text-slate-400")} />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">الرسوم</p>
                    <p className={cn("text-base font-black leading-tight", child.feesRemaining > 0 ? "text-slate-900" : "text-slate-400")}>
                      {child.feesRemaining > 0 ? `${child.feesRemaining} ج.م` : 'لا يوجد متأخرات'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-5 border-t border-slate-100 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">عرض التقارير</span>
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all duration-500">
                    الملف الشخصي
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
