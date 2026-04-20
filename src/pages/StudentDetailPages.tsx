import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { ArrowRight, CreditCard, Layers, User, Phone, Mail, MapPin, Hash, Calendar, BookOpen, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';

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
          <header className="flex items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <button onClick={() => navigate(`/parent/children/${id}`)} className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-white border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-none mb-1">مصروفات {child?.name}</h1>
              <p className="text-xs text-slate-500 font-medium">{child?.className} • {child?.academic_year}</p>
            </div>
          </header>

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

// Curriculum Page
export function StudentCurriculumPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler loading={isLoading} error={error} data={child} onRetry={refetch}>
          <header className="flex items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <button onClick={() => navigate(`/parent/children/${id}`)} className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-white border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-none mb-1">منهج {child?.name}</h1>
              <p className="text-xs text-slate-500 font-medium">{child?.className} • {child?.academic_year}</p>
            </div>
          </header>

          {child?.curriculum?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {child.curriculum.map((sub: any) => (
                <div key={sub.id} className="bg-white border border-slate-100 rounded-[28px] p-8 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center gap-5 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shadow-sm">
                      <BookOpen className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">{sub.subject_name}</h3>
                  </div>
                  <div className="p-6 rounded-[24px] bg-slate-50/50 border border-slate-100 text-slate-600 font-medium leading-relaxed text-sm">
                    {sub.content || 'لا توجد تفاصيل متاحة لهذا المنهج حالياً.'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
                <Layers className="w-10 h-10" />
              </div>
              <p className="text-slate-400 font-bold">لم يتم تحديد المنهج لهذا الفصل بعد</p>
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
          <header className="flex items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <button onClick={() => navigate(`/parent/children/${id}`)} className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-white border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-none mb-1">بيانات {child?.name}</h1>
              <p className="text-xs text-slate-500 font-medium">المعلومات الشخصية</p>
            </div>
          </header>

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
