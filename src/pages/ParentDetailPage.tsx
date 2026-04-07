import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowRight, User, Phone, Users, Info, 
  MapPin, Mail, Shield, ChevronLeft, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  useParent, 
  useAdminParentChildren,
  useDeleteParent
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ParentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── Queries ──
  const { data: parent, isLoading: parentLoading, error: parentError, refetch: refetchParent } = useParent(id);
  const { data: children = [], isLoading: childrenLoading } = useAdminParentChildren(id);
  const deleteParentMutation = useDeleteParent();

  const handleDelete = async () => {
    if (!id || !window.confirm('هل أنت متأكد من حذف حساب ولي الأمر هذا؟ سيؤدي ذلك لإزالة صلاحياته بالكامل.')) return;
    try {
      await deleteParentMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح', description: 'تمت إزالة ولي الأمر من النظام.' });
      navigate('/parents');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const isLoadingTotal = parentLoading || childrenLoading;

  return (
    <AppLayout>
      <div className="flex flex-col gap-12 max-w-[1400px] mx-auto text-right pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700" dir="rtl">
        
        <QueryStateHandler
          loading={parentLoading}
          error={parentError}
          data={parent}
          onRetry={refetchParent}
          loadingMessage="جاري مزامنة بيانات حساب ولي الأمر..."
        >
          {/* Premium Header */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-10 bg-white/40 backdrop-blur-md p-6 md:p-10 rounded-[40px] md:rounded-[56px] border border-white/50 shadow-xl shadow-slate-100/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex items-center gap-4 md:gap-8 relative z-10">
              <button 
                onClick={() => navigate('/parents')}
                className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[28px] bg-white border border-slate-100 text-slate-300 hover:text-slate-900 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm shrink-0"
              >
                 <ArrowRight className="w-6 h-6 md:w-7 md:h-7" />
              </button>
              
              <div className="flex items-center gap-4 md:gap-8">
                 <div className="w-16 h-16 md:w-24 md:h-24 rounded-[28px] md:rounded-[36px] bg-slate-900 text-indigo-400 flex items-center justify-center shadow-2xl relative group-hover:rotate-6 transition-transform duration-700 shrink-0 border-4 border-white">
                    <User className="w-8 h-8 md:w-12 md:h-12" />
                 </div>
                 <div className="space-y-1 md:space-y-2">
                    <h1 className="text-xl md:text-4xl font-black text-slate-900 tracking-tight leading-none mb-1 md:mb-2">{parent?.full_name}</h1>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100/50">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">حساب معتمد</span>
                       </div>
                       <span className="text-slate-400 text-[10px] font-bold border-r pr-4 border-slate-200 tracking-tight">معرف المستخدم: #{parent?.id?.slice(0, 8)}</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="flex items-center gap-4 relative z-10">
               <Button className="h-14 md:h-16 px-6 md:px-10 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 gap-3 text-[10px] md:text-sm">
                  <Mail className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" /> إرسال رسالة تنبيه
               </Button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Main Information Section */}
            <div className="lg:col-span-8 space-y-12">
                <section className="bg-white border border-slate-50 p-6 md:p-12 rounded-[40px] md:rounded-[64px] shadow-xl shadow-slate-100/50 space-y-8 md:space-y-12">
                   <header className="flex items-center gap-5 border-b border-slate-50 pb-6 md:pb-8">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-32 bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner shrink-0">
                         <Info className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <div>
                         <h2 className="text-lg md:text-2xl font-black text-slate-900 mb-1">بيانات التواصل المؤسسية</h2>
                         <p className="text-[9px] md:text-[11px] font-black text-slate-300 uppercase tracking-widest leading-none">إدارة قنوات التواصل الرسمي</p>
                      </div>
                   </header>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <ContactCard 
                        icon={Phone} 
                        label="رقم الهاتف الأساسي" 
                        value={parent?.phone || 'غير مسجل'} 
                        actionText="اتصال هاتفي"
                        color="indigo"
                      />
                      <ContactCard 
                        icon={Mail} 
                        label="البريد الإلكتروني المعتمد" 
                        value={parent?.email || '—'} 
                        actionText="مراسلة إلكترونية"
                        color="slate"
                      />
                   </div>
                </section>

                <section className="bg-white border border-slate-50 p-6 md:p-12 rounded-[40px] md:rounded-[64px] shadow-xl shadow-slate-100/50 space-y-8 md:space-y-12">
                   <header className="flex items-center justify-between border-b border-slate-50 pb-6 md:pb-8">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-32 bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
                            <Users className="w-6 h-6 md:w-8 md:h-8" />
                         </div>
                         <div>
                            <h2 className="text-lg md:text-2xl font-black text-slate-900 mb-1">سجل الأبناء والمنهج</h2>
                            <p className="text-[9px] md:text-[11px] font-black text-slate-300 uppercase tracking-widest leading-none">إجمالي التابعين: {children.length} طلاب</p>
                         </div>
                      </div>
                   </header>

                   {children.length === 0 ? (
                     <div className="p-24 text-center bg-slate-50 rounded-[56px] border border-dashed border-slate-200">
                        <Users className="w-20 h-20 text-slate-200 mx-auto mb-8" />
                        <p className="text-lg font-black text-slate-400">لا يوجد أبناء مرتبطون بهذا الحساب</p>
                        <p className="text-xs text-slate-300 font-medium mt-3">يمكنك ربط الطلاب بهذا الحساب من صفحة إدارة الطلاب.</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {children.map((c: any) => (
                          <div 
                            key={c.id} 
                            onClick={() => navigate(`/students/${c.id}`)}
                            className="p-8 rounded-[40px] bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-3xl hover:translate-y-[-6px] transition-all duration-700 group cursor-pointer flex flex-col gap-8 h-full"
                          >
                             <div className="flex items-start justify-between">
                                <div className="flex items-center gap-5">
                                   <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-slate-50 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                                      <User className="w-7 h-7" />
                                   </div>
                                   <div className="space-y-1">
                                      <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-none mb-1">{c.name}</h3>
                                      <Badge className="bg-indigo-600/10 text-indigo-600 border-none font-bold text-[9px] px-3 py-1">{c.class_name || 'بدون فصل'}</Badge>
                                   </div>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-100 group-hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 border border-slate-100">
                                   <ChevronLeft className="w-6 h-6" />
                                </div>
                             </div>

                             {c.curriculum && (
                                <div className="p-6 rounded-3xl bg-white border border-slate-100/50 space-y-4">
                                   <div className="flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المنهج: {c.curriculum.name}</p>
                                   </div>
                                   <div className="flex flex-wrap gap-2">
                                      {c.curriculum.subjects.slice(0, 3).map((sub: any, idx: number) => (
                                         <span key={idx} className="text-[10px] font-bold text-slate-600 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">{sub.subject_name}</span>
                                      ))}
                                      {c.curriculum.subjects.length > 3 && (
                                         <span className="text-[10px] font-bold text-indigo-400 px-3 py-1.5">+{c.curriculum.subjects.length - 3} مواد أخرى</span>
                                      )}
                                   </div>
                                </div>
                             )}
                          </div>
                        ))}
                     </div>
                   )}
                </section>
            </div>

            {/* Sidebar Governance */}
            <div className="lg:col-span-4 space-y-12">
               <section className="bg-slate-900 rounded-[64px] p-12 space-y-12 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-20" />
                  
                  <div className="flex items-center gap-5 relative z-10">
                     <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 shadow-inner">
                        <Shield className="w-7 h-7" />
                     </div>
                     <h2 className="text-xl font-black text-white leading-none">حوكمة الحساب</h2>
                  </div>

                  <div className="space-y-8 relative z-10">
                     <div className="p-8 rounded-[48px] bg-white/5 border border-white/5 flex items-center justify-between group/card hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                               <CreditCard className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">الوضع المالي</p>
                               <p className="text-sm font-black text-white">منتظم السداد</p>
                            </div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-white/10 group-hover/card:text-emerald-400 transition-all" />
                     </div>

                     <div className="p-8 rounded-[48px] bg-white/5 border border-white/5 flex items-center justify-between group/card hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-400">
                               <MapPin className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">العنوان السكني</p>
                               <p className="text-sm font-black text-white">غير محدد</p>
                            </div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-white/10 group-hover/card:text-indigo-400 transition-all" />
                     </div>
                  </div>

                  <div className="pt-8 border-t border-white/5 relative z-10 space-y-4">
                     <Button className="w-full h-14 md:h-16 rounded-[24px] md:rounded-[28px] bg-indigo-600 text-white font-black hover:bg-slate-100 hover:text-slate-900 transition-all text-xs shadow-3xl shadow-indigo-900/60">تحميل ملف الأسرة (Dossier)</Button>
                     <Button 
                       variant="ghost" 
                       onClick={handleDelete}
                       disabled={deleteParentMutation.isPending}
                       className="w-full h-14 md:h-16 rounded-[24px] md:rounded-[28px] text-rose-400 font-bold hover:bg-rose-500/10 text-xs gap-3"
                     >
                       {deleteParentMutation.isPending ? 'جاري الحذف...' : 'حذف حساب ولي الأمر نهائياً'}
                     </Button>
                  </div>
               </section>

               <div className="p-12 rounded-[56px] bg-emerald-600 text-white flex flex-col items-center gap-8 text-center shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                  <div className="w-24 h-24 bg-white/20 rounded-[40px] flex items-center justify-center relative z-10 transition-transform duration-700 group-hover:scale-110">
                      <Users className="w-12 h-12" />
                  </div>
                  <div className="space-y-3 relative z-10">
                     <h3 className="text-xl font-black">الربط العائلي</h3>
                     <p className="text-[11px] font-bold text-white/70 leading-relaxed italic px-4 uppercase tracking-[0.1em]">
                        يمكن لولي الأمر هذا مراقبة تقدم {children.length} طلاب مسجلين في مستويات تعليمية مختلفة من منصة موحدة.
                     </p>
                  </div>
               </div>
            </div>
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

function ContactCard({ icon: Icon, label, value, actionText, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-600 text-white shadow-3xl shadow-indigo-100",
    slate: "bg-slate-900 text-white shadow-3xl shadow-slate-200",
  };
  return (
    <div className={cn("p-8 rounded-[48px] flex flex-col justify-between h-64 border transition-all duration-500 hover:scale-[1.04]", colors[color])}>
       <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
          <Icon className="w-7 h-7" />
       </div>
       <div className="space-y-4">
          <div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-white/40">{label}</p>
             <p className="text-xl font-black tracking-tight leading-none truncate">{value}</p>
          </div>
          <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:text-white transition-colors group">
             {actionText}
             <ChevronLeft className="w-4 h-4 group-hover:translate-x-[-4px] transition-transform" />
          </button>
       </div>
    </div>
  );
}
