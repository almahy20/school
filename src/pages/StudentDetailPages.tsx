import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { ArrowRight, CreditCard, Layers, User, Phone, MapPin, Hash, Calendar, BookOpen, AlertCircle, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import type { LucideIcon } from 'lucide-react';

// ── Shared header used across all sub-pages ───────────────────────────────────
function SubPageHeader({
  onBack,
  icon: Icon,
  title,
  subtitle,
}: {
  onBack: () => void;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
      <button
        onClick={onBack}
        className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-white border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
      >
        <ArrowRight className="w-5 h-5" />
      </button>
      <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-none mb-1">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
      </div>
    </header>
  );
}

// Financial Page
export function StudentFinancialPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler loading={isLoading} error={error} data={child} onRetry={refetch}>
          <SubPageHeader
            onBack={() => navigate(`/parent/children/${id}`)}
            icon={CreditCard}
            title={`مصروفات ${child?.name}`}
            subtitle={`${child?.className} • ${child?.academic_year}`}
          />

          {child?.fees?.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {child.fees.sort((a: any, b: any) => (b.year * 12 + b.month) - (a.year * 12 + a.month)).map((f: any) => (
                  <div key={f.id} className="bg-white border border-slate-100 rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center",
                          f.status === 'paid' ? "bg-emerald-50 text-emerald-700" : f.status === 'partial' ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                        )}>
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">شهر {MONTHS_AR[f.month - 1]} {f.year}</p>
                          <p className="text-xs text-slate-400 font-bold">{f.term}</p>
                        </div>
                      </div>
                      <Badge className={cn("border border-slate-100 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-sm",
                        f.status === 'paid' ? "bg-emerald-50 text-emerald-700" : f.status === 'partial' ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                      )}>
                        {f.status === 'paid' ? 'تم السداد' : f.status === 'partial' ? 'سداد جزئي' : 'غير مسدد'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-5 rounded-[24px] bg-slate-50/50 border border-slate-100">
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">المطلوب</p>
                        <p className="text-xl font-black text-slate-900">{f.amount_due} <span className="text-xs text-slate-400">ج.م</span></p>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">المسدد</p>
                        <p className="text-xl font-black text-indigo-600">{f.amount_paid} <span className="text-xs opacity-60">ج.م</span></p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {child.feesRemaining > 0 && (
                <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-8 h-8 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">إجمالي الرسوم المتبقية</h3>
                      <p className="text-white/40 text-sm font-medium">المبلغ الإجمالي لكافة الأشهر غير المسددة</p>
                    </div>
                  </div>
                  <p className="text-4xl font-black">{child.feesRemaining.toLocaleString()} <span className="text-sm opacity-30">ج.م</span></p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
                <CreditCard className="w-10 h-10" />
              </div>
              <p className="text-slate-400 font-bold">لا توجد سجلات مالية مسجلة</p>
            </div>
          )}
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

// Curriculum Page — Month Card Drill-Down (Parent)
export function StudentCurriculumPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Group subjects by term (month)
  const curriculumByMonth = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (child?.curriculum || []).forEach((sub: any) => {
      const termName = sub.term || 'عام';
      if (!groups[termName]) groups[termName] = [];
      groups[termName].push(sub);
    });
    return groups;
  }, [child?.curriculum]);

  const allMonths = useMemo(() => Object.keys(curriculumByMonth), [curriculumByMonth]);

  // If a month is selected — show its subjects full-width
  if (selectedMonth) {
    const subjects = curriculumByMonth[selectedMonth] || [];
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-2 md:px-0" dir="rtl">
          <SubPageHeader
            onBack={() => setSelectedMonth(null)}
            icon={BookOpen}
            title={`مقررات ${selectedMonth}`}
            subtitle={`${child?.name} • ${child?.className}`}
          />

          {subjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((sub: any) => (
                <div key={sub.id} className="bg-white border border-slate-100 rounded-[28px] p-6 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <h4 className="text-base font-black text-slate-900">{sub.subject_name}</h4>
                      {sub.content && (
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">{sub.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-4 bg-white border border-slate-100 rounded-[32px]">
              <BookOpen className="w-10 h-10 mx-auto text-slate-200" />
              <p className="font-bold text-sm text-slate-400">لا توجد مواد مسجلة لهذا الشهر بعد</p>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Main view — month cards grid
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler loading={isLoading} error={error} data={child} onRetry={refetch}>
          <SubPageHeader
            onBack={() => navigate(`/parent/children/${id}`)}
            icon={Layers}
            title={`المنهج الدراسي — ${child?.name}`}
            subtitle={`${child?.className} • ${child?.academic_year || '2025/2026'}`}
          />

          {allMonths.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allMonths.map(month => {
                const count = curriculumByMonth[month]?.length || 0;
                return (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className="group text-right p-6 rounded-[28px] bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/60 transition-all duration-300 active:scale-[0.98] flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition-colors shrink-0">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <FolderOpen className="w-5 h-5 text-slate-200 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base mb-1">📖 {month}</h3>
                      <p className="text-[11px] text-slate-400 font-bold">{count} مادة دراسية</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {curriculumByMonth[month]?.slice(0, 3).map((sub: any) => (
                        <span key={sub.id} className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-lg">
                          {sub.subject_name}
                        </span>
                      ))}
                      {count > 3 && (
                        <span className="text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100 px-2.5 py-1 rounded-lg">+{count - 3}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center space-y-4 bg-white border border-slate-100 rounded-[32px]">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
                <Layers className="w-10 h-10" />
              </div>
              <p className="text-slate-400 font-bold text-base">لم يتم تحديث خطة المنهج لهذا الفصل بعد</p>
            </div>
          )}
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}


// Student Data Page
export function StudentDataPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);

  const infoItems = [
    { label: 'الاسم الكامل', value: child?.name, icon: User },
    { label: 'رقم القيد', value: child?.id?.split('-')[0].toUpperCase(), icon: Hash },
    { label: 'السنة الدراسية', value: child?.academic_year || '2025/2026', icon: Calendar },
    { label: 'هاتف ولي الأمر', value: child?.parent_phone || 'غير مسجل', icon: Phone },
    { label: 'العنوان السكني', value: child?.address || 'غير مسجل', icon: MapPin },
    { label: 'تاريخ الميلاد', value: child?.birth_date ? new Date(child.birth_date).toLocaleDateString('ar-EG') : 'غير مسجل', icon: Calendar },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler loading={isLoading} error={error} data={child} onRetry={refetch}>
          <SubPageHeader
            onBack={() => navigate(`/parent/children/${id}`)}
            icon={User}
            title={`بيانات ${child?.name}`}
            subtitle="المعلومات الشخصية"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {infoItems.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-[28px] p-7 flex items-center gap-6 hover:shadow-md transition-all duration-300">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-900 border border-slate-100 flex items-center justify-center shrink-0">
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-lg font-black text-slate-900 truncate">{item.value || 'غير محدد'}</p>
                </div>
              </div>
            ))}
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}
