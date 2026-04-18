import { useState, useMemo } from 'react';
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
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function FeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Monthly system
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const [selectedTerm, setSelectedTerm] = useState(`شهر ${MONTHS_AR[currentMonthIdx]} ${currentYear}`);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('الكل');
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // ── Queries ──
  const { data: branding } = useBranding();
  const { data: classes = [] } = useClasses();
  const { data: studentsData = [], isLoading: studentsLoading } = useStudents();
  const { data: feesData = [], isLoading: feesLoading, error, refetch, isRefetching } = useFees(selectedTerm);

  // ── Derived Data ──
  const enrichedStudents = useMemo(() => {
    return studentsData.map(s => ({
      ...s,
      fee: feesData.find(f => f.student_id === s.id)
    }));
  }, [studentsData, feesData]);

  const stats = useMemo(() => {
    let due = 0, paid = 0;
    feesData.forEach(f => {
      due += Number(f.amount_due || 0);
      paid += Number(f.amount_paid || 0);
    });
    return {
      total_due: due,
      total_paid: paid,
      outstanding: due - paid,
      rate: due > 0 ? Math.round((paid / due) * 100) : 0
    };
  }, [feesData]);

  const filtered = enrichedStudents.filter(s => {
    const matchSearch = s.name.toLocaleLowerCase('ar-EG').includes(search.toLocaleLowerCase('ar-EG'));
    const matchClass = selectedClassId === 'all' || s.class_id === selectedClassId;
    
    const status = !s.fee ? 'متأخر' : s.fee.status === 'paid' ? 'مدفوع' : s.fee.status === 'partial' ? 'جزئي' : 'متأخر';
    const matchStatus = filterStatus === 'الكل' || status === filterStatus;
    
    return matchSearch && matchClass && matchStatus;
  });

  const loading = studentsLoading || (feesLoading && !isRefetching);

  const TERMS = useMemo(() => {
    const list = [];
    // Last 6 months and next 6 months
    for (let i = -6; i <= 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      list.push(`شهر ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`);
    }
    return list;
  }, [MONTHS_AR]);

  const onUpdateSuccess = () => {
    toast({ title: 'تم التحديث بنجاح', description: 'تم تحديث سجل الرسوم المالية.' });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="flex items-center gap-6 text-right">
            <div className="w-16 h-16 rounded-[24px] bg-white p-3 shadow-lg shadow-indigo-100/50 flex items-center justify-center border border-indigo-50 overflow-hidden shrink-0">
               {branding?.logo_url ? (
                 <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
               ) : (
                 <CreditCard className="w-8 h-8 text-indigo-600" />
               )}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3">
                 <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight truncate">{branding?.name || 'إدارة الرسوم المالية'}</h1>
                 <Badge variant="outline" className="rounded-lg bg-indigo-50 border-indigo-100 text-indigo-600 font-black text-[8px] md:text-[9px] uppercase px-2 md:px-3 whitespace-nowrap">منصة المحاسبة</Badge>
              </div>
              <p className="text-slate-500 font-medium text-xs md:text-sm truncate">متابعة الأقساط المدرسية والإيرادات للفترات الدراسية</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:gap-4 flex-1 justify-end">
             <div className="relative group flex-1 md:flex-none md:min-w-[160px]">
               <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
               <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                 className="w-full pr-10 pl-6 h-12 rounded-2xl border-none bg-white text-slate-900 font-black text-xs shadow-xl shadow-slate-200/10 focus:ring-4 focus:ring-indigo-600/5 transition-all appearance-none cursor-pointer">
                 <option value="all">جميع الفصول</option>
                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
             </div>
             
             <Button onClick={() => setShowGenerateModal(true)} className="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-xs shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all gap-3 w-full md:w-auto">
               <TrendingUp className="w-4.5 h-4.5" /> توليد رسوم جماعية
             </Button>
          </div>
        </header>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <FinanceCard title={`إجمالي مستحقات ${selectedTerm}`} value={stats.total_due.toLocaleString()} symbol="ج.م" icon={Wallet} color="indigo" />
             <FinanceCard title="المبالغ المحصلة" value={stats.total_paid.toLocaleString()} symbol="ج.م" icon={CheckCircle} color="emerald" />
             <FinanceCard title="الرسوم المستحقة" value={stats.outstanding.toLocaleString()} symbol="ج.م" icon={Clock} color="rose" />
             <FinanceCard title="نسبة التحصيل" value={`${stats.rate}%`} icon={TrendingUp} color="slate" />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/40 backdrop-blur-md p-6 rounded-[30px] border border-white/50 shadow-sm">
             <div className="flex items-center gap-4 w-full lg:w-auto">
               <div className="relative group min-w-[240px]">
                 <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                 <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
                   className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-600/5 appearance-none w-full cursor-pointer">
                   {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
               </div>

               <div className="relative group flex-1 min-w-[300px] text-right">
                 <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                 <Input 
                   placeholder="ابحث باسم الطالب في جميع الفصول..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
                 />
               </div>
            </div>
            
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
               {['الكل', 'مدفوع', 'متأخر', 'جزئي'].map(status => (
                 <button key={status} onClick={() => setFilterStatus(status)}
                   className={cn(
                     "px-6 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shadow-sm",
                     filterStatus === status ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-white text-slate-400 font-bold"
                   )}>
                   {status}
                 </button>
               ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((s) => (
                <StudentFeeCard 
                  key={s.id} 
                  student={s} 
                  term={selectedTerm}
                  onAddPayment={() => { setSelectedStudent(s); setShowPaymentModal(true); }}
                  onAddFee={() => { setSelectedStudent(s); setShowAddFeeModal(true); }}
                />
              ))}
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
