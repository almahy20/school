import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, School, Users, Edit2, Trash2, 
  User, ChevronLeft, Calendar, Shield, Activity, 
  Search, Loader2, Printer
} from 'lucide-react';
import { EditClassModal } from './ClassesPage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  useClass, 
  useClassStudents, 
  useTeachers,
  useDeleteClass
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState('');

  // ── Queries ──
  const { data: classItem, isLoading: classLoading, error: classError, refetch: refetchClass } = useClass(id);
  const { data: students = [], isLoading: studentsLoading } = useClassStudents(id);
  const { data: allTeachers = [], isLoading: teachersLoading } = useTeachers();

  // ── Mutations ──
  const deleteClassMutation = useDeleteClass();

  const teacher = useMemo(() => 
    allTeachers.find(t => t.id === classItem?.teacher_id),
    [allTeachers, classItem?.teacher_id]
  );

  const filteredStudents = useMemo(() => 
    students.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا الفصل الدراسي نهائياً؟ سيؤدي هذا لإزالة ارتباط الطلاب به.')) return;
    try {
      await deleteClassMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح' });
      navigate('/classes');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const isLoadingTotal = classLoading || studentsLoading || teachersLoading;

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 max-w-[1400px] mx-auto text-right pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700" dir="rtl">
        
        <QueryStateHandler
          loading={classLoading}
          error={classError}
          data={classItem}
          onRetry={refetchClass}
          loadingMessage="جاري مزامنة سجل الفصل الدراسي..."
        >
          {/* Premium Header */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-10 rounded-[48px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex items-center gap-6 relative z-10">
              <button 
                onClick={() => navigate('/classes')}
                className="w-14 h-14 rounded-[22px] bg-white border border-slate-100 text-slate-300 hover:text-slate-900 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm shrink-0"
              >
                 <ArrowRight className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 rounded-[32px] bg-slate-900 text-white flex items-center justify-center shadow-2xl relative group-hover:rotate-3 transition-transform duration-500 shrink-0">
                    <School className="w-10 h-10" />
                 </div>
                 <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">فصل {classItem?.name}</h1>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-indigo-600/5 text-indigo-600 border-none font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm">
                         {classItem?.grade_level || 'المرحلة الأكاديمية'}
                      </Badge>
                      <span className="text-slate-400 text-[10px] font-bold border-r pr-3 border-slate-200 tracking-tight">معرف الفصل: #{classItem?.id?.slice(0, 8)}</span>
                    </div>
                 </div>
              </div>
            </div>
            
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-4 relative z-10">
                <Button 
                  onClick={() => setShowEdit(true)}
                  className="h-14 px-8 rounded-2xl bg-white border border-slate-100 text-slate-900 font-black hover:bg-slate-50 transition-all shadow-xl shadow-slate-100/50 gap-3 text-xs"
                >
                  <Edit2 className="w-4 h-4 text-indigo-600" /> تعديل الفصل
                </Button>
                <Button 
                  onClick={handleDelete}
                  disabled={deleteClassMutation.isPending}
                  className="h-14 w-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 transition-all shadow-sm flex items-center justify-center shrink-0"
                >
                  {deleteClassMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Trash2 className="w-6 h-6" />}
                </Button>
              </div>
            )}
          </header>

          {/* Key Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <StatsCard title="إحصائيات الطلاب" value={students.length} sub="طالب نشط" icon={Users} color="indigo" />
             <StatsCard title="القيادة التعليمية" value={teacher?.full_name || 'لم يحدد'} sub="المعلم المسؤول" icon={User} color="emerald" smallValue />
             <StatsCard title="الأداء التنظيمي" value="94%" sub="نسبة الحضور" icon={Activity} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-10">
                <section className="bg-white border border-slate-50 p-10 rounded-[56px] shadow-xl shadow-slate-100/50 space-y-10">
                   <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-50 pb-8">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-32 bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner shrink-0">
                            <Users className="w-7 h-7" />
                         </div>
                         <div>
                            <h2 className="text-2xl font-black text-slate-900 mb-1">قائمة طلاب الفصل</h2>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">إجمالي المقيدين: {students.length} شخص</p>
                         </div>
                      </div>
                      
                      <div className="relative group w-full sm:w-80">
                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                          type="text" 
                          placeholder="ابحث عن طالب بالاسم..." 
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="w-full pr-14 pl-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-[12px] focus:ring-indigo-600/5 transition-all text-sm font-bold placeholder:text-slate-200" 
                        />
                      </div>
                   </header>

                   {filteredStudents.length === 0 ? (
                     <div className="p-24 text-center bg-slate-50 rounded-[48px] border border-dashed border-slate-100">
                        <Users className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                        <p className="text-lg font-black text-slate-400">لم يتم العثور على نتائج</p>
                        <p className="text-xs text-slate-300 font-medium mt-2">جرب البحث بكلمات مختلفة أو تأكد من تسجيل الطلاب</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredStudents.map((s, idx) => (
                          <div 
                            key={s.id} 
                            onClick={() => navigate(`/students/${s.id}`)} 
                            className="p-6 rounded-[32px] bg-white border border-slate-50 hover:border-indigo-100 hover:shadow-2xl hover:shadow-slate-200/50 hover:translate-y-[-4px] transition-all duration-500 group flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-5 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[11px] font-black text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm shrink-0">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate mb-1">{s.name}</h3>
                                <div className="flex items-center gap-2">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">طالب منتظم</p>
                                </div>
                              </div>
                            </div>
                            <ChevronLeft className="w-5 h-5 text-slate-100 group-hover:text-indigo-600 transition-all translate-x-2 group-hover:translate-x-0" />
                          </div>
                        ))}
                     </div>
                   )}
                </section>
            </div>

            {/* Sidebar Controls */}
            <div className="lg:col-span-4 space-y-10">
               <section className="bg-slate-900 rounded-[56px] p-10 space-y-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-40" />
                  <div className="flex items-center gap-4 relative z-10">
                     <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
                        <Shield className="w-6 h-6 border-none" />
                     </div>
                     <h2 className="text-xl font-black text-white leading-none">الحوكمة والتقارير</h2>
                  </div>

                  <div className="space-y-8 relative z-10">
                     <div className="p-8 rounded-[40px] bg-white/5 border border-white/5 space-y-6">
                        <header className="flex justify-between items-center">
                           <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">السعة الاستيعابية</p>
                           <Badge className="bg-indigo-600 text-white border-none font-bold text-[9px] px-3">مستقر</Badge>
                        </header>
                        
                        <div className="space-y-4">
                           <div className="flex justify-between items-end">
                              <span className="text-4xl font-black text-white">{students.length} <span className="text-[11px] font-bold text-white/40 tracking-normal mx-1">طالب</span></span>
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">90% ممتلئ</span>
                           </div>
                           <Progress value={90} className="h-2 bg-white/10" />
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-1 gap-4">
                        <div className="p-6 rounded-[32px] bg-white/5 border border-white/5 flex items-center gap-5 hover:bg-white/10 transition-colors cursor-pointer group">
                           <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white group-hover:rotate-6 transition-transform">
                              <Calendar className="w-6 h-6" />
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">الفترة الزمنية</p>
                              <p className="text-[12px] font-bold text-white">العام الدراسي 2024 - 2025</p>
                           </div>
                        </div>
                     </div>

                     <Button className="w-full h-16 rounded-[24px] bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-sm shadow-2xl shadow-indigo-900/60 relative z-10 gap-3 group">
                        <Printer className="w-5 h-5 text-indigo-300 group-hover:text-white transition-colors" />
                        تصدير كشف الفصل الذكي
                     </Button>
                  </div>
               </section>
               
               <div className="p-10 rounded-[48px] bg-white border border-slate-50 flex flex-col items-center gap-6 text-center shadow-lg">
                  <div className="w-20 h-20 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-center text-slate-300">
                      <Users className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">تلميح إداري</p>
                     <p className="text-xs font-bold text-slate-500 leading-relaxed italic">يمكنك تعيين أكثر من معلم لنفس الفصل من خلال نظام الصلاحيات المتقدم في قسم إدارة الكوادر.</p>
                  </div>
               </div>
            </div>
          </div>
        </QueryStateHandler>
      </div>

      {showEdit && classItem && (
        <EditClassModal 
          classItem={classItem} 
          teachers={allTeachers as any} 
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); refetchClass(); }}
        />
      )}
    </AppLayout>
  );
}

function StatsCard({ title, value, sub, icon: Icon, color, smallValue }: any) {
  const configs: any = {
    indigo: "bg-slate-900 text-white border-slate-900 shadow-2xl shadow-slate-200",
    emerald: "bg-white text-slate-900 border-slate-50 shadow-xl shadow-slate-100",
    amber: "bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-100",
  };
  
  const iconConfigs: any = {
    indigo: "bg-white/10 text-white",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-white/20 text-white",
  };

  return (
    <div className={cn("premium-card p-10 flex flex-col justify-between border-[0.5px] h-60 rounded-[48px] transition-all hover:scale-[1.03] duration-500", configs[color])}>
       <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", iconConfigs[color])}>
          <Icon className="w-7 h-7" />
       </div>
       <div className="mt-8">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60", color === 'emerald' ? "text-slate-400" : "text-white/40")}>{title}</p>
          <div className="flex flex-col">
             <h3 className={cn("font-black tracking-tighter leading-none mb-2", smallValue ? "text-2xl" : "text-5xl")}>{value}</h3>
             <span className={cn("text-[11px] font-bold opacity-60", color === 'emerald' ? "text-slate-400" : "text-white/40")}>{sub}</span>
          </div>
       </div>
    </div>
  );
}
