import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Users, LayoutGrid, ChevronLeft, GraduationCap, Award, CalendarCheck, Wallet, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { QueryStateHandler } from '@/components/QueryStateHandler';

import { useParentChildren } from '@/hooks/queries';

export default function ParentDashboard() {
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
    <div className="flex flex-col gap-12 max-w-[1200px] mx-auto text-right py-4 sm:py-8 animate-in fade-in slide-in-from-bottom-4 duration-1000" dir="rtl">
      <QueryStateHandler
        loading={loading}
        error={error}
        data={children}
        onRetry={refetch}
        isRefetching={isRefetching}
        loadingMessage="جاري تحميل بيانات الأبناء..."
        errorMessage="عذراً، فشل تحميل بيانات الأبناء. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى."
        emptyMessage="لم يتم العثور على أبناء مرتبطين بحسابك. يرجى مراجعة إدارة المدرسة."
      >
        <header className="bg-slate-900 p-12 sm:p-20 rounded-[64px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-12">
          <div className="flex items-center gap-8">
             <div className="w-24 h-24 rounded-[32px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
                <GraduationCap className="w-12 h-12 text-slate-900" />
             </div>
             <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">أهلاً بك، {user?.fullName?.split(' ')[0]}</h1>
                <p className="text-white/40 text-xl font-medium leading-relaxed max-w-2xl">مرحباً بك في لوحة تحكم ولي الأمر. تابع تقدم أبنائك الأكاديمي والتحصيل العلمي بكل سهولة ويسر.</p>
             </div>
          </div>

          <div className="px-8 py-5 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 flex items-center gap-4 group hover:scale-[1.02] transition-all">
             <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
               <LayoutGrid className="w-7 h-7" />
             </div>
             <div>
               <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-2">إجمالي الأبناء</p>
               <p className="text-3xl font-black text-white leading-none">{children.length}</p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {children.map((child: any, idx) => (
          <div 
            key={child.id}
            onClick={() => navigate(`/parent/children/${child.id}`)}
            className="group premium-card p-0 overflow-hidden shadow-premium hover:translate-y-[-8px] transition-all duration-700 cursor-pointer border-slate-100/50"
          >
            <div className="p-10 space-y-8 h-full flex flex-col justify-between relative">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-[32px] bg-slate-900 flex items-center justify-center text-white font-black text-3xl shadow-2xl rotate-2 group-hover:rotate-0 group-hover:scale-110 transition-all duration-500 border-4 border-slate-100">
                    {child.name.trim()[0]}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{child.name}</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{child.className || 'بدون فصل'}</p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  <ChevronLeft className="w-6 h-6 group-hover:translate-x-[-4px] transition-transform" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50/30 group-hover:border-indigo-100/50 transition-colors text-center">
                    <Award className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">متوسط الدرجات</p>
                    <p className="text-lg font-black text-slate-900">{child.avgGrade}%</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-emerald-50/30 group-hover:border-emerald-100/50 transition-colors text-center">
                    <CalendarCheck className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">نسبة الحضور</p>
                    <p className="text-lg font-black text-slate-900">{child.attendanceRate}%</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-amber-50/30 group-hover:border-amber-100/50 transition-colors text-center">
                      <Wallet className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">الرسوم المتبقية</p>
                      <p className="text-lg font-black text-slate-900">{child.feesRemaining} ج.م</p>
                   </div>
              </div>

              <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/20" />
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">حالة الحساب: نشط</span>
                 </div>
                 <span className="text-[10px] font-black text-indigo-600 px-4 py-2 rounded-full bg-indigo-50/50 border border-indigo-100/50 opacity-0 group-hover:opacity-100 transition-opacity">عرض التفاصيل والتقارير</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      </QueryStateHandler>
    </div>
  );
}
