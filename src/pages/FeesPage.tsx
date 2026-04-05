import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, Search, Plus, Filter, Download, 
  TrendingUp, Wallet, Clock, History, User,
  CheckCircle, AlertCircle, ArrowUpRight, ArrowDownRight,
  ChevronLeft, MoreHorizontal, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { sendPushToUser } from '@/utils/pushNotifications';

export default function FeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('الكل');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({ total_due: 0, total_paid: 0, outstanding: 0, rate: 0 });
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const invalidateGlobalFees = () => {
    // This will force all queries that depend on fees to refresh
    queryClient.invalidateQueries({ queryKey: ['parent-children'] });
    queryClient.invalidateQueries({ queryKey: ['child-full-details'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const fetchData = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data: studentsData } = await supabase
      .from('students')
      .select('*, classes(*)')
      .eq('school_id', user.schoolId)
      .order('name');
    const { data: feesData } = await supabase
      .from('fees')
      .select('*')
      .eq('school_id', user.schoolId)
      .eq('month', selectedMonth)
      .eq('year', selectedYear);

    const enriched = (studentsData || []).map(s => ({
      ...s,
      fee: (feesData || []).find(f => f.student_id === s.id)
    }));

    setStudents(enriched);

    let due = 0, paid = 0;
    (feesData || []).forEach(f => {
      due += Number(f.amount_due || 0);
      paid += Number(f.amount_paid || 0);
    });

    setStats({
      total_due: due,
      total_paid: paid,
      outstanding: due - paid,
      rate: due > 0 ? Math.round((paid / due) * 100) : 0
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user?.schoolId, selectedMonth, selectedYear]);

  // Update modals to call invalidateGlobalFees
  const onUpdateSuccess = () => {
    invalidateGlobalFees();
    fetchData();
  };

  const MONTHS_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const status = !s.fee ? 'متأخر' : s.fee.status === 'paid' ? 'مدفوع' : s.fee.status === 'partial' ? 'جزئي' : 'متأخر';
    const matchStatus = filterStatus === 'الكل' || status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">إدارة الشؤون المالية</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">متابعة المصروفات المدرسية لشهر {MONTHS_AR[selectedMonth - 1]} {selectedYear}</p>
          </div>
          
          <div className="flex items-center gap-4">
             <Button onClick={() => setShowGenerateModal(true)} className="h-11 px-6 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-xl shadow-indigo-900/10 hover:scale-[1.02] transition-all gap-3">
               <Plus className="w-4 h-4" /> توليد رسوم الشهر
             </Button>
             <Button className="h-11 px-6 rounded-xl bg-slate-900 text-white font-black text-xs shadow-xl shadow-slate-900/10 hover:scale-[1.02] transition-all gap-3">
               <Download className="w-4 h-4" /> تقرير الإيرادات
             </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <FinanceCard title={`إجمالي سندات ${MONTHS_AR[selectedMonth - 1]}`} value={stats.total_due.toLocaleString()} symbol="ج.م" icon={Wallet} color="indigo" />
           <FinanceCard title="المبالغ المحصلة" value={stats.total_paid.toLocaleString()} symbol="ج.م" icon={CheckCircle} color="emerald" />
           <FinanceCard title="الرسوم المستحقة" value={stats.outstanding.toLocaleString()} symbol="ج.م" icon={Clock} color="rose" />
           <FinanceCard title="نسبة التحصيل" value={`${stats.rate}%`} icon={TrendingUp} color="slate" />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
           <div className="flex items-center gap-4 w-full lg:w-auto">
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="h-12 px-5 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-600/5 appearance-none min-w-[140px]"
              >
                {MONTHS_AR.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              
              <select 
                value={selectedYear} 
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="h-12 px-5 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-600/5 appearance-none min-w-[100px]"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <div className="relative group flex-1 min-w-[300px] text-right">
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                <Input 
                  placeholder="ابحث باسم الطالب..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
                />
              </div>
           </div>
           
           <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              {['الكل', 'مدفوع', 'متأخر', 'جزئي'].map(status => (
                <button key={status} onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border shadow-sm",
                    filterStatus === status ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-white text-slate-400"
                  )}>
                  {status}
                </button>
              ))}
           </div>
        </div>

        {loading ? (
             <div className="p-20 text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-slate-300 uppercase">جاري مزامنة الحسابات</p>
             </div>
        ) : filtered.length === 0 ? (
           <div className="p-32 text-center text-slate-400 font-bold bg-white rounded-[40px] border border-dashed">لا توجد بيانات مصروفات لشهر {MONTHS_AR[selectedMonth-1]}</div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((s) => (
                <StudentFeeCard 
                  key={s.id} 
                  student={s} 
                  monthName={MONTHS_AR[selectedMonth-1]}
                  onAddPayment={() => { setSelectedStudent(s); setShowPaymentModal(true); }}
                  onAddFee={() => { setSelectedStudent(s); setShowAddFeeModal(true); }}
                />
              ))}
           </div>
        )}
      </div>

      {showPaymentModal && selectedStudent && (
        <PaymentModal 
          fee={selectedStudent.fee} 
          studentName={selectedStudent.name}
          user={user}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={onUpdateSuccess}
        />
      )}

      {showAddFeeModal && selectedStudent && (
        <AddFeeModal 
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          user={user}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onClose={() => setShowAddFeeModal(false)}
          onSuccess={onUpdateSuccess}
        />
      )}

      {showGenerateModal && (
        <GenerateMonthlyFeesModal 
          user={user}
          month={selectedMonth}
          year={selectedYear}
          monthName={MONTHS_AR[selectedMonth-1]}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={onUpdateSuccess}
        />
      )}
    </AppLayout>
  );
}

function StudentFeeCard({ student, onAddPayment, onAddFee, monthName }: any) {
  const fee = student.fee;
  const status = !fee ? 'unpaid' : fee.status;
  
  const statusConfig: any = {
    paid: { label: 'مدفوع بالكامل', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle },
    partial: { label: 'سداد جزئي', color: 'bg-amber-50 text-amber-600', icon: Clock },
    unpaid: { label: 'لم يسدد', color: 'bg-rose-50 text-rose-600', icon: AlertCircle },
  };
  const config = statusConfig[status] || statusConfig.unpaid;

  return (
    <div className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right">
       <div className="p-6 space-y-6">
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
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">مصروفات شهر {monthName}</p>
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

          <div className="flex gap-3 pt-2">
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

function PaymentModal({ fee, studentName, user, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (numAmount <= 0) return;
    setLoading(true);
    try {
      const newPaid = Number(fee.amount_paid) + numAmount;
      const remains = Number(fee.amount_due) - newPaid;
      const status = remains <= 0 ? 'paid' : 'partial';

      // 1. Update fee
      const { error: fErr } = await supabase.from('fees').update({ 
        amount_paid: newPaid, 
        status 
      }).eq('id', fee.id);
      if (fErr) throw fErr;

      // 2. Insert payment record
      const { error: pErr } = await supabase.from('fee_payments').insert({
        fee_id: fee.id,
        amount: numAmount,
        payment_method: method,
        school_id: user?.schoolId
      });
      if (pErr) throw pErr;

      toast({ title: 'تم تسجيل الدفعة بنجاح' });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
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
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">طريقة الدفع</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full h-12 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white text-sm font-bold appearance-none">
              <option value="Cash">نقداً</option>
              <option value="Bank Transfer">تحويل بنكي</option>
              <option value="Card">بطاقة مدى / فيزا</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black">
              {loading ? 'جاري الحفظ...' : 'تأكيد العملية'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-400">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddFeeModal({ studentId, studentName, user, selectedMonth, selectedYear, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [due, setDue] = useState('3000');
  const [term, setTerm] = useState('مصروفات دراسية');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('fees').insert({
        student_id: studentId,
        amount_due: Number(due),
        amount_paid: 0,
        term,
        month: selectedMonth,
        year: selectedYear,
        description: term,
        status: 'unpaid',
        school_id: user?.schoolId
      });
      if (error) throw error;
      toast({ title: 'تم إنشاء المطالبة المالية' });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
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
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">البند / الوصف</label>
            <Input value={term} onChange={e => setTerm(e.target.value)} required
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-black">
              {loading ? 'جاري الإنشاء...' : 'حفظ البيانات'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-400">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GenerateMonthlyFeesModal({ user, month, year, monthName, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('3000');
  const [term, setTerm] = useState(`مصروفات شهر ${monthName}`);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.rpc('generate_monthly_fees', {
        p_school_id: user?.schoolId,
        p_month: month,
        p_year: year,
        p_amount: Number(amount),
        p_term: term
      });
      if (error) throw error;
      toast({ title: `تم توليد رسوم شهر ${monthName} لجميع الطلاب` });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95 relative" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 mb-6">توليد رسوم شهرية جماعية</h2>
        <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 mb-6">
           <p className="text-xs font-bold text-indigo-600 leading-relaxed">سيتم إنشاء مطالبة مالية لجميع الطلاب المسجلين في مدرستك لشهر {monthName} {year}.</p>
        </div>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">المبلغ الموحد لكل طالب</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">وصف المطالبة</label>
            <Input value={term} onChange={e => setTerm(e.target.value)} required
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg shadow-slate-900/20">
              {loading ? 'جاري التوليد...' : 'بدء التوليد الآن'}
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
