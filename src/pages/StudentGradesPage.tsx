import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { ArrowRight, BookOpen, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useState } from 'react';

function gradeInfo(pct: number | null) {
  if (pct === null || isNaN(pct)) return { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', label: 'تقييم وصفي', icon: BookOpen };
  if (pct >= 90) return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'ممتاز', icon: TrendingUp };
  if (pct >= 75) return { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100', label: 'جيد جداً', icon: TrendingUp };
  if (pct >= 60) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100', label: 'جيد', icon: Minus };
  return { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100', label: 'يحتاج تحسين', icon: TrendingDown };
}

export default function StudentGradesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);
  const [viewMode, setViewMode] = useState<'latest' | 'all'>('latest');

  // Group grades by subject
  const bySubject: Record<string, any[]> = {};
  child?.grades?.forEach(g => {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(g);
  });

  // Get latest grade per subject and sort subjects by latest grade date
  const latestGrades = Object.entries(bySubject)
    .map(([subject, grades]) => {
      // رتبنا الدرجات داخل المادة من الأقدم للأحدث (حسب طلب المستخدم)
      const sorted = grades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      // أحدث درجة هي آخر عنصر في المصفوفة المرتبة تصاعدياً
      return { subject, latest: sorted[sorted.length - 1], all: sorted };
    })
    .sort((a, b) => {
      // رتبنا المواد نفسها بحيث تظهر المادة التي حدثت مؤخراً في الأعلى
      return new Date(b.latest.date).getTime() - new Date(a.latest.date).getTime();
    });



  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={child}
          onRetry={refetch}
          loadingMessage="جاري تحميل الدرجات..."
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/parent/children/${id}`)}
                className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-white border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-none mb-1">درجات {child?.name}</h1>
                <p className="text-sm text-slate-500 font-medium">{child?.className} • {child?.academic_year}</p>
              </div>
            </div>
          </header>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-100 w-fit">
            <button
              onClick={() => setViewMode('latest')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'latest' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              آخر تسجيل
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              كل الدرجات
            </button>
          </div>

          {/* Grades Display */}
          {viewMode === 'latest' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestGrades.map(({ subject, latest }) => {
                const scoreNum = Number(latest.score);
                const isNumeric = !isNaN(scoreNum);
                const pct = isNumeric ? (scoreNum / latest.max_score) * 100 : null;
                const gi = gradeInfo(pct);
                const Icon = gi.icon;

                return (
                  <div key={subject} className="bg-white border border-slate-100 rounded-[28px] p-8 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-6">
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", gi.bg)}>
                        <Icon className={cn("w-7 h-7", gi.color)} />
                      </div>
                      <Badge className={cn("border border-slate-100 font-bold px-3 py-1 rounded-lg", gi.bg, gi.color)}>
                        {gi.label}
                      </Badge>
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-900 mb-3">{subject}</h3>
                    
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-4xl font-black mb-1">
                          <span className={gi.color}>{latest.score}</span>
                          {isNumeric && (
                            <span className="text-lg text-slate-300">/{latest.max_score}</span>
                          )}
                        </p>
                        <p className="text-sm text-slate-400 font-medium">
                          {new Date(latest.date).toLocaleDateString('ar-EG', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                      {isNumeric && (
                        <div className="text-left">
                          <p className="text-2xl font-black mb-1">
                            <span className={gi.color}>{Math.round(pct || 0)}%</span>
                          </p>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">النسبة</p>
                        </div>
                      )}
                    </div>

                    {latest.term && (
                      <div className="mt-5 pt-5 border-t border-slate-50">
                        <p className="text-xs text-slate-400 font-bold">
                          <span className="text-slate-500">الفترة:</span> {latest.term}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {latestGrades.map(({ subject, all: grades }) => {

                const numericGrades = grades.filter(g => !isNaN(Number(g.score)));
                const hasNumeric = numericGrades.length > 0;
                const avg = hasNumeric
                  ? Math.round(numericGrades.reduce((s, g) => s + (Number(g.score) / g.max_score) * 100, 0) / numericGrades.length)
                  : null;
                const gi = gradeInfo(avg);

                return (
                  <div key={subject} className="bg-white border border-slate-100 rounded-[28px] overflow-hidden shadow-sm">
                    <div className={cn("px-8 py-5 flex items-center justify-between border-b border-slate-50", gi.bg)}>
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm", gi.color)}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <span className="font-black text-slate-900 text-lg">{subject}</span>
                      </div>
                      {avg !== null && (
                        <Badge className={cn("bg-white border border-slate-100 font-bold px-4 py-1.5 rounded-full shadow-sm", gi.color)}>
                          المتوسط {avg}%
                        </Badge>
                      )}
                    </div>
                    
                    <div className="divide-y divide-slate-50 p-2">
                      {grades.map((g: any, idx) => {
                        const scoreNum = Number(g.score);
                        const isNumeric = !isNaN(scoreNum);
                        const pct = isNumeric ? (scoreNum / g.max_score) * 100 : null;
                        const itemGi = gradeInfo(pct);
                        const gradeDate = new Date(g.date);
                        const isRecent = (Date.now() - gradeDate.getTime()) < (7 * 24 * 60 * 60 * 1000);

                        return (
                          <div key={g.id} className="px-6 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded-2xl">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                isRecent ? "bg-green-500 animate-pulse" : "bg-slate-200"
                              )} />
                              <div>
                                <p className="font-black text-slate-700">{g.term || `اختبار ${idx + 1}`}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs text-slate-400 font-bold">
                                    {gradeDate.toLocaleDateString('ar-EG', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                  {isRecent && (
                                    <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">جديد</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className={cn("text-2xl font-black", itemGi.color)}>
                                {g.score}
                                {isNumeric && (
                                  <span className="text-xs opacity-40 ml-1">/{g.max_score}</span>
                                )}
                              </p>
                              {isNumeric && (
                                <p className={cn("text-xs font-black opacity-60", itemGi.color)}>
                                  {Math.round(pct || 0)}%
                                </p>
                              )}
                            </div>
                          </div>

                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(bySubject).length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
                <BookOpen className="w-10 h-10" />
              </div>
              <p className="text-slate-400 font-bold">لا توجد درجات مسجلة حتى الآن</p>
            </div>
          )}
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}
