import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { ArrowRight, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function StudentAttendancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);

  // Stats
  const present = child?.attendance?.filter((a: any) => a.status === 'present').length || 0;
  const absent = child?.attendance?.filter((a: any) => a.status === 'absent').length || 0;
  const late = child?.attendance?.filter((a: any) => a.status === 'late').length || 0;
  const total = child?.attendance?.length || 0;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={child}
          onRetry={refetch}
          loadingMessage="جاري تحميل سجل الحضور..."
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-6 md:p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/parent/children/${id}`)}
                className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-white border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-none mb-1">حضور {child?.name}</h1>
                <p className="text-sm text-slate-500 font-medium">{child?.className} • {child?.academic_year}</p>
              </div>
            </div>
          </header>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="premium-card p-6 text-center hover:scale-[1.02] transition-transform">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
              <p className="text-3xl font-black text-emerald-600 mb-1">{present}</p>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest">حاضر</p>
            </div>
            <div className="premium-card p-6 text-center hover:scale-[1.02] transition-transform">
              <XCircle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
              <p className="text-3xl font-black text-rose-600 mb-1">{absent}</p>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest">غائب</p>
            </div>
            <div className="premium-card p-6 text-center hover:scale-[1.02] transition-transform">
              <Clock className="w-8 h-8 text-amber-600 mx-auto mb-3" />
              <p className="text-3xl font-black text-amber-600 mb-1">{late}</p>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest">متأخر</p>
            </div>
            <div className="premium-card p-6 text-center bg-slate-900 text-white hover:scale-[1.02] transition-transform">
              <Calendar className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
              <p className="text-3xl font-black text-white mb-1">{total}</p>
              <p className="text-xs text-white/40 font-black uppercase tracking-widest">الإجمالي</p>
            </div>
          </div>

          {/* Attendance Calendar Grid */}
          {child?.attendance?.length > 0 ? (
            <div className="premium-card p-8">
              <h2 className="text-xl font-black text-slate-900 mb-6">السجل الزمني</h2>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
                {child.attendance
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((a: any) => {
                    const date = new Date(a.date);
                    const statusConfig = {
                      present: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'حاضر' },
                      absent: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', label: 'غائب' },
                      late: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'متأخر' }
                    };
                    const config = statusConfig[a.status as keyof typeof statusConfig];

                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all hover:scale-105 cursor-default",
                          config.bg,
                          config.border
                        )}
                        title={`${date.toLocaleDateString('ar-EG')} - ${config.label}`}
                      >
                        <span className={cn("text-lg font-black", config.text)}>
                          {date.getDate()}
                        </span>
                        <span className={cn("text-[8px] font-bold", config.text)}>
                          {date.toLocaleDateString('ar-EG', { month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
                <Calendar className="w-10 h-10" />
              </div>
              <p className="text-slate-400 font-bold">لا يوجد سجل حضور مسجل</p>
            </div>
          )}
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}
