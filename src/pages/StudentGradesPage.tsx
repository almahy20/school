import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { ArrowRight, BookOpen, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useState } from 'react';

function gradeInfo(pct: number) {
  if (pct >= 90) return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'ممتاز', icon: TrendingUp };
  if (pct >= 75) return { color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'جيد جداً', icon: TrendingUp };
  if (pct >= 60) return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'جيد', icon: Minus };
  return { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'يحتاج تحسين', icon: TrendingDown };
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

  // Get latest grade per subject
  const latestGrades = Object.entries(bySubject).map(([subject, grades]) => {
    const sorted = grades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { subject, latest: sorted[0], all: sorted };
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
          <header className="flex items-center gap-4 pb-6 border-b border-slate-100">
            <button
              onClick={() => navigate(`/parent/children/${id}`)}
              className="w-12 h-12 rounded-2xl bg-white text-slate-400 hover:text-slate-900 border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">درجات {child?.name}</h1>
                <p className="text-sm text-slate-500">{child?.className} • {child?.academic_year}</p>
              </div>
            </div>
          </header>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
            <button
              onClick={() => setViewMode('latest')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'latest' ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              آخر تسجيل
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'all' ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              كل الدرجات
            </button>
          </div>

          {/* Grades Display */}
          {viewMode === 'latest' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestGrades.map(({ subject, latest }) => {
                const pct = (Number(latest.score) / latest.max_score) * 100;
                const gi = gradeInfo(pct);
                const Icon = gi.icon;

                return (
                  <div key={subject} className={cn("bg-white border-2 rounded-2xl p-6", gi.border)}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", gi.bg)}>
                        <Icon className={cn("w-7 h-7", gi.color)} />
                      </div>
                      <Badge className={cn("border-none font-bold", gi.bg, gi.color)}>
                        {gi.label}
                      </Badge>
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-900 mb-2">{subject}</h3>
                    
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-4xl font-black mb-1">
                          <span className={gi.color}>{latest.score}</span>
                          <span className="text-lg text-slate-400">/{latest.max_score}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(latest.date).toLocaleDateString('ar-EG', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-black mb-1">
                          <span className={gi.color}>{Math.round(pct)}%</span>
                        </p>
                        <p className="text-xs text-slate-400">النسبة المئوية</p>
                      </div>
                    </div>

                    {latest.term && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500">
                          <span className="font-bold">الفترة:</span> {latest.term}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(bySubject).map(([subject, grades]) => {
                const numericGrades = grades.filter(g => !isNaN(Number(g.score)));
                const avg = numericGrades.length > 0 
                  ? Math.round(numericGrades.reduce((s, g) => s + (Number(g.score) / g.max_score) * 100, 0) / numericGrades.length)
                  : 0;
                const gi = gradeInfo(avg);

                return (
                  <div key={subject} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className={cn("px-6 py-4 flex items-center justify-between", gi.bg)}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-white", gi.color)}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-900">{subject}</span>
                      </div>
                      <Badge className={cn("bg-white border-none font-bold", gi.color)}>
                        المتوسط {avg}%
                      </Badge>
                    </div>
                    
                    <div className="divide-y divide-slate-50">
                      {grades.map((g: any, idx) => {
                        const pct = (Number(g.score) / g.max_score) * 100;
                        const itemGi = gradeInfo(pct);
                        const gradeDate = new Date(g.date);
                        const isRecent = (Date.now() - gradeDate.getTime()) < (7 * 24 * 60 * 60 * 1000);

                        return (
                          <div key={g.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-3 h-3 rounded-full",
                                isRecent ? "bg-green-500 animate-pulse" : "bg-slate-300"
                              )} />
                              <div>
                                <p className="font-bold text-slate-700">{g.term || `اختبار ${idx + 1}`}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span className="text-xs text-slate-500">
                                    {gradeDate.toLocaleDateString('ar-EG', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                  {isRecent && (
                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">جديد</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className={cn("text-xl font-black", itemGi.color)}>
                                {g.score}/{g.max_score}
                              </p>
                              <p className={cn("text-xs font-bold", itemGi.color)}>
                                {Math.round(pct)}%
                              </p>
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
