import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayDate } from '@/lib/date-utils';
import { LayoutGrid, ChevronLeft, GraduationCap, Award, CalendarCheck, Wallet, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useParentChildren } from '@/hooks/queries';

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
    <div className="animate-in fade-in duration-700" dir="rtl">
      <QueryStateHandler
        loading={loading}
        error={error}
        data={children}
        onRetry={refetch}
        isRefetching={isRefetching}
        errorMessage="عذراً، فشل تحميل بيانات الأبناء. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى."
        emptyMessage="لم يتم العثور على أبناء مرتبطين بحسابك. يرجى مراجعة إدارة المدرسة."
      >
        <header className="mb-12 md:mb-20">
          <div className="flex flex-col gap-4">
            <h1 className="page-title-standard">لوحة المتابعة</h1>
            <p className="page-subtitle-standard max-w-2xl">مرحباً {user?.fullName?.split(' ')[0]}، تابع تقدم أبنائك الأكاديمي والتحصيل العلمي بكل سهولة ويسر من مكان واحد</p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 md:gap-16 lg:gap-20">
          {children.map((child: any) => (
            <div 
              key={child.id}
              onClick={() => navigate(`/parent/children/${child.id}`)}
              className="group relative h-full flex flex-col bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/20 hover:shadow-2xl hover:shadow-indigo-500/10 hover:translate-y-[-8px] transition-all duration-700 cursor-pointer overflow-hidden p-0"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
              
              <div className="p-7 md:p-10 space-y-6 md:space-y-8 h-full flex flex-col justify-between relative text-right">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] md:rounded-[32px] bg-slate-900 flex items-center justify-center text-white font-black text-2xl md:text-3xl shadow-2xl rotate-2 group-hover:rotate-0 group-hover:scale-110 transition-all duration-700 border-4 border-white/10">
                      {child.name.trim()[0]}
                    </div>
                    <div className="space-y-1 md:space-y-2">
                      <h2 className="text-xl md:text-2xl font-[900] text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">{child.name}</h2>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <p className="text-slate-400 font-black text-[10px] md:text-[11px] uppercase tracking-widest">{child.className || 'بدون فصل'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all border border-slate-100 shadow-sm">
                    <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-[-4px] transition-transform" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:gap-4 mt-6 md:mt-8">
                   <div className="p-3 md:p-5 rounded-[24px] bg-indigo-50/30 border border-indigo-100/50 hover:bg-indigo-50 transition-colors text-center shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-indigo-600 mx-auto mb-3 shadow-sm">
                        <Award className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <p className="text-[7px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 leading-tight">متوسط الدرجات</p>
                      <p className="text-sm md:text-xl font-black text-slate-900">{child.avgGrade}%</p>
                   </div>
                   <div className="p-3 md:p-5 rounded-[24px] bg-emerald-50/30 border border-emerald-100/50 hover:bg-emerald-50 transition-colors text-center shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-emerald-600 mx-auto mb-3 shadow-sm">
                        <CalendarCheck className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <p className="text-[7px] md:text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1 leading-tight">نسبة الحضور</p>
                      <p className="text-sm md:text-xl font-black text-slate-900">{child.attendanceRate}%</p>
                   </div>
                   <div className="p-3 md:p-5 rounded-[24px] bg-amber-50/30 border border-amber-100/50 hover:bg-amber-50 transition-colors text-center shadow-sm">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-amber-600 mx-auto mb-3 shadow-sm">
                          <Wallet className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <p className="text-[7px] md:text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1 leading-tight">الرسوم المتبقية</p>
                        <p className="text-sm md:text-xl font-black text-slate-900">{child.feesRemaining} ج.م</p>
                     </div>
                </div>

                <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/20" />
                      <span className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">مفعل في {child.academic_year || '2024'}</span>
                   </div>
                   <span className="text-[10px] font-black text-indigo-600 px-5 py-2.5 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-sm">لوحة التقارير</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </QueryStateHandler>
    </div>
  );
}
