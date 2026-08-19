import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { ArrowRight, BookOpen, Calendar, ChevronLeft, Award, FileText, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useState, useMemo } from 'react';

function gradeInfo(pct: number | null) {
  if (pct === null || isNaN(pct)) return { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100', label: 'تقييم وصفي' };
  if (pct >= 90) return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'ممتاز' };
  if (pct >= 75) return { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100', label: 'جيد جداً' };
  if (pct >= 60) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100', label: 'جيد' };
  return { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100', label: 'يحتاج تحسين' };
}

export default function StudentGradesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Group grades by Month / Evaluation Title
  const monthGroups = useMemo(() => {
    if (!child?.grades || child.grades.length === 0) return [];

    const groups: Record<string, { title: string; date: string; items: any[] }> = {};

    child.grades.forEach((g: any) => {
      const gradeDate = new Date(g.date);
      const monthYearStr = gradeDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
      const monthTitle = g.term || g.exam_title || `تقييم ${monthYearStr}`;

      if (!groups[monthTitle]) {
        groups[monthTitle] = {
          title: monthTitle,
          date: g.date,
          items: [],
        };
      }
      groups[monthTitle].items.push(g);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [child?.grades]);

  const activeMonthData = useMemo(() => {
    if (!selectedMonth) return null;
    return monthGroups.find(m => m.title === selectedMonth) || null;
  }, [selectedMonth, monthGroups]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={child}
          onRetry={refetch}
          loadingMessage="جاري تحميل سجل التقييمات والنتائج..."
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (selectedMonth) {
                    setSelectedMonth(null);
                  } else {
                    navigate(`/parent/children/${id}`);
                  }
                }}
                className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                  {selectedMonth ? selectedMonth : `نتائج وتقييمات ${child?.name}`}
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-bold mt-0.5">
                  {child?.className} • {child?.academic_year || '2025/2026'}
                </p>
              </div>
            </div>

            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all"
              >
                عرض كل الشهور
              </button>
            )}
          </header>

          {!selectedMonth && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-600" />
                  تقييمات الشهور المسجلة
                </h2>
                <Badge variant="outline" className="bg-slate-50 text-slate-500 font-bold text-xs px-3 py-1">
                  {monthGroups.length} تقييم شهر
                </Badge>
              </div>

              {monthGroups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {monthGroups.map((mg) => {
                    const gradeDate = new Date(mg.date);
                    const formattedDate = gradeDate.toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    });

                    return (
                      <button
                        key={mg.title}
                        onClick={() => setSelectedMonth(mg.title)}
                        className="group bg-white border border-slate-100 hover:border-indigo-200 p-7 rounded-[32px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-right w-full relative overflow-hidden flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                            <Calendar className="w-7 h-7" />
                          </div>
                          <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-black text-xs px-3.5 py-1 rounded-xl">
                            {mg.items.length} مواد مسجلة
                          </Badge>
                        </div>

                        <div>
                          <h3 className="font-black text-slate-900 text-xl mb-1 group-hover:text-indigo-600 transition-colors">
                            {mg.title}
                          </h3>
                          <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5 mt-1">
                            <span>تاريخ التقييم:</span>
                            <span>{formattedDate}</span>
                          </p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-black text-indigo-600">
                          <span>استعراض تقييم المواد بالتفصيل</span>
                          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4 bg-white border border-slate-100 rounded-[32px]">
                  <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
                    <BookOpen className="w-10 h-10" />
                  </div>
                  <p className="text-slate-400 font-bold text-base">لا توجد تقييمات شهرية مسجلة حتى الآن</p>
                </div>
              )}
            </div>
          )}

          {selectedMonth && activeMonthData && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 md:p-8 rounded-[32px] shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <Badge className="bg-indigo-500/20 text-indigo-200 border-none font-bold text-xs px-3 py-1 mb-2">
                    التقرير الشهري التفصيلي
                  </Badge>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">{activeMonthData.title}</h2>
                  <p className="text-xs md:text-sm text-slate-300 font-medium mt-1">
                    نتائج وتقييمات الطالب في المواد الدراسية الخاصة بهذا الشهر
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-center shrink-0">
                  <p className="text-xs text-indigo-200 font-bold">عدد المواد</p>
                  <p className="text-2xl font-black">{activeMonthData.items.length}</p>
                </div>
              </div>

              <div className="space-y-4">
                {activeMonthData.items.map((g: any) => {
                  const scoreNum = Number(g.score);
                  const isNumeric = !isNaN(scoreNum) && g.score !== '' && g.score !== null;
                  const pct = isNumeric ? (scoreNum / (g.max_score || 100)) * 100 : null;
                  const gi = gradeInfo(pct);

                  return (
                    <div
                      key={g.id || g.subject}
                      className="bg-white border border-slate-100 rounded-[28px] p-6 md:p-8 shadow-sm hover:shadow-md transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0">
                            <BookOpen className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg md:text-xl font-black text-slate-900">{g.subject}</h3>
                            <p className="text-xs text-slate-400 font-bold mt-0.5">
                              مادة دراسية • {new Date(g.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge className={cn('border font-bold text-sm px-4 py-2 rounded-xl shadow-xs', gi.bg, gi.color, gi.border)}>
                            {gi.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            <span>التقييم والنتيجة:</span>
                          </p>
                          <p className="text-base md:text-lg font-black text-slate-800 leading-relaxed">
                            {g.score || 'تم التقييم بنجاح'}
                          </p>
                        </div>

                        {isNumeric && (
                          <div className="text-left bg-white px-5 py-3 rounded-xl border border-slate-100 shadow-xs shrink-0 self-end sm:self-center">
                            <p className="text-xs text-slate-400 font-bold">الدرجة الرقمية</p>
                            <p className="text-2xl font-black text-indigo-700">
                              {g.score} <span className="text-xs text-slate-400 font-medium">/ {g.max_score || 100}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}
