import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, Plus, Search, Filter, Clock, CheckCircle, 
  AlertCircle, ChevronLeft, MoreHorizontal, User,
  Mail, Phone, Shield, ArrowUpRight, History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Complaint {
  id: string;
  parent_id: string;
  student_id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved';
  created_at: string;
  student_name?: string;
}

export default function ComplaintsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const [{ data: complaintsData }, { data: studentsData }] = await Promise.all([
      supabase.from('complaints')
        .select('*, students(name)')
        .eq('school_id', user.schoolId)
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('students')
        .select('id, name')
        .eq('school_id', user.schoolId)
        .eq('parent_id', user.id),
    ]);

    setComplaints(complaintsData?.map((c: any) => ({ ...c, student_name: c.students?.name || 'غير محدد' })) || []);
    setStudents(studentsData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, user?.schoolId]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">التواصل مع الإدارة</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">إرسال الشكاوى والمقترحات والمتابعة المستمرة للحالة</p>
          </div>
          
          <div className="flex items-center gap-4">
             <Button onClick={() => setShowAdd(true)} className="h-11 px-6 rounded-xl bg-slate-900 text-white font-black text-xs shadow-xl shadow-slate-900/10 hover:scale-[1.02] transition-all gap-3">
               <Plus className="w-4.5 h-4.5" /> شكوى جديدة
             </Button>
          </div>
        </header>

        {loading ? (
             <div className="flex flex-col items-center justify-center py-32 gap-4">
               <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
               <p className="text-slate-300 font-black tracking-widest text-[10px] uppercase">جاري استرجاع مراسلاتك</p>
             </div>
        ) : complaints.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا توجد رسائل</h2>
            <p className="text-slate-400 font-medium text-sm">سجلك خالٍ من الشكاوى، شكراً لتعاونكم معنا.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {complaints.map(c => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddComplaintModal 
          students={students} 
          parent_id={user!.id}
          user={user}
          onClose={() => setShowAdd(false)} 
          onSuccess={() => { setShowAdd(false); fetchData(); }} 
        />
      )}
    </AppLayout>
  );
}

function ComplaintCard({ complaint }: { complaint: Complaint }) {
  const statusConfig = {
    pending: { label: 'جديد', color: 'bg-rose-50 text-rose-600', icon: AlertCircle },
    in_progress: { label: 'قيد الحل', color: 'bg-amber-50 text-amber-600', icon: Clock },
    resolved: { label: 'مكتمل', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle },
  };
  const config = statusConfig[complaint.status];

  return (
    <div className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right">
       <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
             <Badge className={cn("px-3 py-1 rounded-lg font-black text-[9px] border-none", config.color)}>
                {config.label}
             </Badge>
             <span className="text-[9px] font-black text-slate-300 uppercase">{new Date(complaint.created_at).toLocaleDateString('ar-EG')}</span>
          </div>

          <div className="space-y-2 min-h-[60px]">
             <p className="text-xs text-slate-600 font-bold leading-relaxed line-clamp-4 whitespace-pre-wrap">{complaint.content}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest opacity-40">
                <span>بخصوص الطالب</span>
             </div>
             <div className="flex justify-between items-center text-[10px] font-black text-slate-900 leading-none">
                <span>{complaint.student_name}</span>
             </div>
          </div>
       </div>
    </div>
  );
}

// ─── Modal (Scaled Down) ─────────────────────────────────────────────────────
function AddComplaintModal({ students, parent_id, user, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [category, setCategory] = useState('أكاديمي');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !user?.schoolId) return;
    setLoading(true);
    const combinedContent = `[${category}] ${title.trim()}\n\n${description.trim()}`;
    const { error } = await supabase.from('complaints').insert({
      parent_id,
      student_id: studentId || null,
      content: combinedContent,
      status: 'pending',
      school_id: user.schoolId
    });
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else { toast({ title: 'تم الإرسال بنجاح' }); onSuccess(); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[80px]" />
        <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight relative z-10">تقديم بلاغ جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">عنوان البلاغ *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              className="h-11 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الطالب المعني</label>
                <select value={studentId} onChange={e => setStudentId(e.target.value)}
                  className="w-full h-11 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none">
                  {students.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفئة</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full h-11 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none">
                  <option value="أكاديمي">أكاديمي</option>
                  <option value="سلوكي">سلوكي</option>
                  <option value="مالي">مالي</option>
                  <option value="إداري">إداري</option>
                </select>
             </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">التفاصيل *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="w-full h-24 p-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-xs resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-indigo-600 transition-all text-sm">
              {loading ? 'جاري الإرسال...' : 'تأكيد الإرسال'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
