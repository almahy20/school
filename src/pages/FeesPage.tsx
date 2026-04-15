import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, Search, Plus, TrendingUp, Wallet, Clock, User,
  CheckCircle, AlertCircle, Download, MoreHorizontal, Calendar,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useStudents, useFees, useUpsertFee, useGenerateFees, useBranding, useClasses } from '@/hooks/queries';
import DataPagination from '@/components/ui/DataPagination';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import PageHeader from '@/components/layout/PageHeader';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function FeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Monthly system
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const [selectedTerm, setSelectedTerm] = useState(`شهر ${MONTHS_AR[currentMonthIdx]} ${currentYear}`);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('الكل');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Queries ──
  const { data: branding } = useBranding();
  const { data: classesData } = useClasses();
  const classes = (classesData?.data || []) as Array<{id: string; name: string}>;
  
  // نستخدم useFees المطور الذي يجلب الطلاب ورسومهم لهذا الترم
  const { 
    data, 
    isLoading: feesLoading, 
    error, 
    refetch, 
    isRefetching 
  } = useFees(selectedTerm, page, PAGE_SIZE, debouncedSearch, selectedClassId);

  const studentsData = useMemo(() => data?.data || [], [data]);
  const totalItems = data?.count || 0;
  const termStats = useMemo(() => data?.stats || { total_due: 0, total_paid: 0 }, [data]);

  // ── Derived Data ──
  const stats = useMemo(() => {
    const due = termStats.total_due;
    const paid = termStats.total_paid;
    return {
      total_due: due,
      total_paid: paid,
      outstanding: due - paid,
      rate: due > 0 ? Math.round((paid / due) * 100) : 0
    };
  }, [termStats]);

  const loading = feesLoading && !isRefetching;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleClassChange = (val: string) => { setSelectedClassId(val); setPage(1); };
  const handleTermChange = (val: string) => { setSelectedTerm(val); setPage(1); };
  const handleStatusChange = (val: string) => { setFilterStatus(val); setPage(1); };

  // ملاحظة: فلترة الحالة "الكل/مدفوع/متأخر" ما زالت تحتاج لفلترة خادم إذا زادت البيانات، 
  // ولكن حالياً نقوم بفلترة الصفحة الحالية فقط إذا كان filterStatus غير "الكل"
  // أو الأفضل إضافتها لـ useFees كبارامتر.
  const displayStudents = useMemo(() => {
    if (filterStatus === 'الكل') return studentsData;
    return studentsData.filter(s => {
      const status = !s.fee ? 'متأخر' : s.fee.status === 'paid' ? 'مدفوع' : s.fee.status === 'partial' ? 'جزئي' : 'متأخر';
      return status === filterStatus;
    });
  }, [studentsData, filterStatus]);

  const TERMS = useMemo(() => {
    const list = [];
    // Last 6 months and next 6 months
    for (let i = -6; i <= 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      list.push(`شهر ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`);
    }
    return list;
  }, []);

  const onUpdateSuccess = () => {
    toast({ title: 'تم التحديث بنجاح', description: 'تم تحديث سجل الرسوم المالية.' });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto text-right pt-2 md:pt-6 pb-24 px-4 md:px-6">
        <PageHeader
          icon={CreditCard}
          title="إدارة الرسوم المالية"
          subtitle="متابعة الأقساط المدرسية وسجلات التحصيل للفترات الدراسية"
          action={
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <select value={selectedClassId} onChange={e => handleClassChange(e.target.value)}
                  className="pr-10 pl-6 h-12 rounded-2xl border-none bg-white text-slate-900 font-black text-xs shadow-xl shadow-slate-200/10 focus:ring-4 focus:ring-indigo-600/5 transition-all appearance-none cursor-pointer">
                  <option value="all">جميع الفصول</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <Button onClick={() => setShowGenerateModal(true)} className="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-xs shadow-xl gap-3">
                <TrendingUp className="w-4 h-4" /> توليد رسوم جماعية
              </Button>
            </div>
          }
        />

        <QueryStateHandler
          loading={loading}
          error={error}
          data={studentsData}
          onRetry={refetch}
          isRefetching={isRefetching}
          loadingMessage="جاري مزامنة الحسابات المالية..."
          emptyMessage="لم يتم العثور على طلاب مسجلين لتحصيل رسوم منهم."
          isEmpty={studentsData.length === 0}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
             <FinanceCard title={`مستحقات ${selectedTerm}`} value={stats.total_due.toLocaleString()} symbol="ج.م" icon={Wallet} color="indigo" />
             <FinanceCard title="المحصلة" value={stats.total_paid.toLocaleString()} symbol="ج.م" icon={CheckCircle} color="emerald" />
             <FinanceCard title="المتبقية" value={stats.outstanding.toLocaleString()} symbol="ج.م" icon={Clock} color="rose" />
             <FinanceCard title="النسبة" value={`${stats.rate}%`} icon={TrendingUp} color="slate" />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/40 backdrop-blur-md p-4 sm:p-6 rounded-[24px] sm:rounded-[30px] border border-white/50 shadow-sm">
             <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
               <div className="relative group w-full sm:min-w-[240px]">
                 <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                 <select value={selectedTerm} onChange={e => handleTermChange(e.target.value)}
                   className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-600/5 appearance-none w-full cursor-pointer">
                   {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
               </div>

               <div className="relative group w-full sm:min-w-[300px] text-right">
                 <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                 <Input 
                   placeholder="ابحث باسم الطالب..." 
                   value={search}
                   onChange={e => handleSearch(e.target.value)}
                   className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
                 />
               </div>
            </div>
            
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar w-full lg:w-auto justify-start lg:justify-end">
               {['الكل', 'مدفوع', 'متأخر', 'جزئي'].map(status => (
                 <button key={status} onClick={() => handleStatusChange(status)}
                   className={cn(
                     "px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shadow-sm",
                     filterStatus === status ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-white text-slate-400 font-bold"
                   )}>
                   {status}
                 </button>
               ))}
            </div>
          </div>

          <div className="space-y-10">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} سجل مالي متاح — الصفحة {page}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayStudents.map((s) => (
                  <StudentFeeCard 
                    key={s.id} 
                    student={s} 
                    term={selectedTerm}
                    onAddPayment={() => { setSelectedStudent(s); setShowPaymentModal(true); }}
                    onAddFee={() => { setSelectedStudent(s); setShowAddFeeModal(true); }}
                  />
                ))}
            </div>

            <div className="pt-4">
              <DataPagination
                currentPage={page}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </div>
        </QueryStateHandler>
      </div>

      {showPaymentModal && selectedStudent && (
        <PaymentModal 
          fee={selectedStudent.fee} 
          studentName={selectedStudent.name}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={onUpdateSuccess}
        />
      )}

      {showAddFeeModal && selectedStudent && (
        <AddFeeModal 
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          user={user}
          selectedTerm={selectedTerm}
          onClose={() => setShowAddFeeModal(false)}
          onSuccess={onUpdateSuccess}
        />
      )}

      {showGenerateModal && (
        <GenerateTermFeesModal 
          user={user}
          term={selectedTerm}
          students={studentsData}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={onUpdateSuccess}
        />
      )}
    </AppLayout>
  );
}

function StudentFeeCard({ student, onAddPayment, onAddFee, term }: any) {
  const fee = student.fee;
  const status = !fee ? 'unpaid' : fee.status;
  
  const statusConfig: any = {
    paid: { label: 'مدفوع بالكامل', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle },
    partial: { label: 'سداد جزئي', color: 'bg-amber-50 text-amber-600', icon: Clock },
    unpaid: { label: 'لم يسدد', color: 'bg-rose-50 text-rose-600', icon: AlertCircle },
  };
  const config = statusConfig[status] || statusConfig.unpaid;

  return (
    <div className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right h-full flex flex-col">
       <div className="p-6 space-y-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
             <Badge className={cn("px-3 py-1 rounded-lg font-black text-[9px] border-none", config.color)}>
                {config.label}
             </Badge>
             <span className="text-[9px] font-black text-slate-300 uppercase">{student.classes?.name || 'فصل عام'}</span>
          </div>

          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner">
                <User className="w-6 h-6" />
             </div>
             <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 truncate mb-1">{student.name}</h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{term}</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">المبلغ المطلوب</p>
                <p className="text-sm font-black text-slate-900">{Number(fee?.amount_due || 0).toLocaleString()} <span className="text-[9px] opacity-40">ج.م</span></p>
             </div>
             <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50">
                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">المبلغ المسدد</p>
                <p className="text-sm font-black text-indigo-600">{Number(fee?.amount_paid || 0).toLocaleString()} <span className="text-[9px] opacity-40">ج.م</span></p>
             </div>
          </div>

          <div className="flex gap-3 pt-2 mt-auto">
             {fee ? (
               <Button onClick={onAddPayment} className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black hover:bg-indigo-600 transition-all text-xs gap-2">
                  <Plus className="w-4 h-4" /> إضافة دفعة
               </Button>
             ) : (
               <Button onClick={onAddFee} className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-xs gap-2">
                  <CreditCard className="w-4 h-4" /> إنشاء مطالبة مالية
               </Button>
             )}
             <Button variant="ghost" className="h-11 px-4 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all">
                <MoreHorizontal className="w-5 h-5" />
             </Button>
          </div>
       </div>
    </div>
  );
}

function PaymentModal({ fee, studentName, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [paid, setPaid] = useState('');
  const upsertMutation = useUpsertFee();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPaid = Number(paid);
    if (numPaid <= 0) return;
    
    try {
      const newPaid = Number(fee.amount_paid) + numPaid;
      const status = newPaid >= Number(fee.amount_due) ? 'paid' : 'partial';

      await upsertMutation.mutateAsync({
        id: fee.id,
        amount_paid: newPaid,
        status,
        term: fee.term,
        student_id: fee.student_id
      });

      toast({ title: 'تم تسجيل الدفعة بنجاح' });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95 relative" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 mb-6">تسجيل دفعة مالية</h2>
        <div className="p-4 bg-slate-50 rounded-2xl mb-6">
           <p className="text-[10px] font-black text-slate-400 uppercase mb-1">اسم الطالب</p>
           <p className="text-sm font-black text-slate-900">{studentName}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">المبلغ المدفوع</label>
            <Input type="number" value={paid} onChange={e => setPaid(e.target.value)} required
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={upsertMutation.isPending} className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black">
              {upsertMutation.isPending ? 'جاري الحفظ...' : 'تأكيد العملية'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-400">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddFeeModal({ studentId, studentName, user, selectedTerm, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [due, setDue] = useState('3000');
  const upsertMutation = useUpsertFee();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertMutation.mutateAsync({
        student_id: studentId,
        amount_due: Number(due),
        amount_paid: 0,
        term: selectedTerm,
        status: 'unpaid',
        school_id: user?.schoolId,
      });
      toast({ title: 'تم إنشاء المطالبة المالية' });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95 relative" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 mb-6">إنشاء مطالبة مالية جديدة</h2>
        <div className="p-4 bg-slate-50 rounded-2xl mb-6">
           <p className="text-[10px] font-black text-slate-400 uppercase mb-1">اسم الطالب</p>
           <p className="text-sm font-black text-slate-900">{studentName}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">إجمالي المبلغ المطلوب</label>
            <Input type="number" value={due} onChange={e => setDue(e.target.value)} required
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={upsertMutation.isPending} className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-black">
              {upsertMutation.isPending ? 'جاري الإنشاء...' : 'حفظ البيانات'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-400">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GenerateTermFeesModal({ user, term, students, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('3000');
  const generateMutation = useGenerateFees();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await generateMutation.mutateAsync({
        students,
        term,
        amount: Number(amount)
      });
      toast({ title: `تم توليد رسوم ${term} لجميع الطلاب` });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95 relative" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 mb-6">توليد رسوم جماعية</h2>
        <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 mb-6">
           <p className="text-xs font-bold text-indigo-600 leading-relaxed">سيتم إنشاء مطالبة مالية لجميع الطلاب المسجلين في مدرستك لـ {term}.</p>
        </div>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">المبلغ الموحد لكل طالب</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={generateMutation.isPending} className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg shadow-slate-900/20">
              {generateMutation.isPending ? 'جاري التوليد...' : 'بدء التوليد الآن'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-400">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FinanceCard({ title, value, symbol, icon: Icon, color }: any) {
  const configs: any = {
    indigo: "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200",
    emerald: "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-200",
    rose: "bg-rose-600 text-white border-rose-600 shadow-xl shadow-rose-200",
    slate: "bg-white text-slate-900 border-slate-100",
  };
  return (
    <div className={cn("premium-card p-6 flex flex-col justify-between border h-40", configs[color])}>
       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", color === 'slate' ? "bg-slate-50 text-slate-400" : "bg-white/20 text-white")}>
          <Icon className="w-5 h-5" />
       </div>
       <div className="mt-4">
          <p className={cn("text-[8px] font-black uppercase tracking-widest mb-0.5", color === 'slate' ? "text-slate-400" : "opacity-60")}>{title}</p>
          <h3 className="text-2xl font-black tracking-tight leading-none">
            {value} {symbol && <span className="text-[10px] font-bold opacity-40 mr-1">{symbol}</span>}
          </h3>
       </div>
    </div>
  );
}
