import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAssignments, useCreateAssignment, useDeleteAssignment, useClasses } from '@/hooks/queries';
import { 
  BookOpen, Plus, Search, Calendar, FileText, Trash2, 
  School, ChevronRight, X, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import DataPagination from '@/components/ui/DataPagination';

const PAGE_SIZE = 15;

export default function AssignmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const { data: assignments = [], isLoading } = useAssignments();
  const deleteMutation = useDeleteAssignment();

  const filtered = useMemo(() => assignments.filter(a => 
    a.title.includes(search) || (a.description || '').includes(search)
  ), [assignments, search]);

  const totalItems = filtered.length;
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useState(() => {
    setPage(1);
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الواجب؟ سيتم حذف جميع التسليمات المرتبطة به.')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'تم החذب بنجاح' });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  };

  const isTeacherOrAdmin = user?.role === 'admin' || user?.role === 'teacher';

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">الواجبات والتكليفات</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">إدارة التكليفات الدراسية ومتابعة التسليمات</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
             {isTeacherOrAdmin && (
               <Button onClick={() => setShowAdd(true)} className="h-11 px-6 rounded-2xl bg-slate-900 text-white font-black text-sm shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all gap-3">
                 <Plus className="w-4.5 h-4.5" /> تكليف جديد
               </Button>
             )}
          </div>
        </header>

        <div className="relative group ml-auto w-full max-w-md">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <Input 
            placeholder="ابحث عن واجب..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-300 font-black tracking-widest text-[10px] uppercase">جاري تحميل الواجبات</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <BookOpen className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا توجد واجبات</h2>
            <p className="text-slate-400 font-medium text-sm">لم يتم العثور على أي تكليفات تطابق بحثك أو لم يتم إضافة واجبات بعد.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} واجب — الصفحة {page}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginated.map(a => (
                <div key={a.id} className="group premium-card p-6 border transition-all duration-300 hover:translate-y-[-4px]">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-3 items-center">
                         <div className="w-10 h-10 rounded-[14px] bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                         </div>
                         <div>
                            <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{a.title}</h3>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold mt-0.5">
                               <School className="w-3 h-3" />
                               <span>{a.class_name}</span>
                            </div>
                         </div>
                      </div>
                      
                      {isTeacherOrAdmin && (
                        <button onClick={() => handleDelete(a.id)} className="text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 p-2 rounded-xl">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                   </div>

                   <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 line-clamp-2">
                      {a.description || 'لا يوجد وصف متاح'}
                   </p>

                   <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {a.due_date ? format(new Date(a.due_date), 'dd MMMM yyyy - hh:mm a', { locale: ar }) : 'غير محدد'}
                        </span>
                      </div>
                      <Link to={`/assignments/${a.id}`}>
                        <Button variant="ghost" className="h-8 px-3 rounded-lg text-xs font-black text-indigo-600 hover:bg-indigo-50">
                           التسليمات <ChevronRight className="w-3.5 h-3.5 mr-1" />
                        </Button>
                      </Link>
                   </div>
                </div>
              ))}
            </div>
            
            <DataPagination
              currentPage={page}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {showAdd && (
        <AddAssignmentModal onClose={() => setShowAdd(false)} />
      )}
    </AppLayout>
  );
}

function AddAssignmentModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const createMutation = useCreateAssignment();
  const { data: classes = [] } = useClasses();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !classId) {
      toast({ title: 'يرجى إدخال الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    try {
      await createMutation.mutateAsync({
        title,
        description,
        class_id: classId,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined
      });
      toast({ title: 'تم إضافة الواجب بنجاح' });
      onClose();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[80px]" />
        
        <div className="flex items-center justify-between mb-8 relative z-10">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">إضافة تكليف جديد</h2>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all">
             <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">عنوان الواجب *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" placeholder="مثال: الواجب الأول" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الوصف</label>
            <textarea 
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full min-h-[100px] p-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm resize-none"
              placeholder="تفاصيل الواجب..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل المستهدف *</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full h-12 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none">
                <option value="">اختر الفصل</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">موعد التسليم</label>
              <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={createMutation.isPending}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-primary transition-all text-sm">
              {createMutation.isPending ? 'جاري الإضافة...' : 'نشر التكليف'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
