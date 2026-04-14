import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Plus, Send, User, MessageCircle, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  useParentComplaints, 
  useUpsertComplaint, 
  useParentChildren 
} from '@/hooks/queries';
import { formatDisplayDate } from '@/lib/date-utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import DataPagination from '@/components/ui/DataPagination';

const PAGE_SIZE = 5;

export default function ParentComplaintsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // UI State
  const [childId, setChildId] = useState<string>('');
  const [content, setContent] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  // ── Queries ──
  const { 
    data, 
    isLoading: loading, 
    error, 
    refetch 
  } = useParentComplaints(page, PAGE_SIZE);

  const complaints = data?.data || [];
  const totalItems = data?.count || 0;
  
  const { 
    data: children = [], 
    isLoading: childrenLoading 
  } = useParentChildren();

  // ── Mutations ──
  const upsertComplaintMutation = useUpsertComplaint();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) { 
      toast({ title: 'يرجى كتابة نص الشكوى', variant: 'destructive' }); 
      return; 
    }

    try {
      await upsertComplaintMutation.mutateAsync({
        parent_id: user?.id,
        student_id: childId || null,
        content: content.trim(),
      });
      
      toast({ title: 'تم إرسال الشكوى بنجاح' });
      setContent('');
      setChildId('');
      setIsDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const getStatusConfig: any = (status: string) => {
    switch(status) {
      case 'resolved':
        return { label: 'تم الحل', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle };
      case 'in_progress':
      case 'processing':
        return { label: 'قيد المعالجة', color: 'bg-amber-500/10 text-amber-600', icon: Clock };
      default:
        return { label: 'قيد الانتظار', color: 'bg-indigo-500/10 text-indigo-600', icon: AlertCircle };
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-[1200px] mx-auto text-right pb-20 px-4 md:px-0">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/20">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="w-1.5 h-8 sm:w-2 sm:h-10 bg-indigo-600 rounded-full" />
              مركز التواصل والشكاوى
            </h1>
            <p className="text-slate-500 font-medium text-sm sm:text-lg pr-5">نسمع لمقترحاتك ونعمل على حل مشكلاتك لضمان جودة التعليم.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-14 sm:h-16 px-6 sm:px-8 rounded-2xl sm:rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm sm:text-lg shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 gap-3">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                إرسال شكوى جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95%] max-w-[600px] rounded-[24px] sm:rounded-[40px] p-0 overflow-hidden border-none shadow-none bg-transparent outline-none">
              <div className="bg-white p-6 sm:p-10 space-y-6 sm:space-y-8 text-right rounded-[24px] sm:rounded-[40px]">
                <DialogHeader>
                  <DialogTitle className="text-xl sm:text-3xl font-black text-slate-900 leading-tight">شكوى جديدة</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={submit} className="space-y-6 sm:space-y-8">
                  <div className="space-y-4">
                    <label className="text-xs sm:text-sm font-black text-slate-800 mr-2 block">اختر الابن المعني (اختياري)</label>
                    <div className="flex flex-wrap gap-2 sm:gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => setChildId('')}
                        className={cn(
                          "px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border-2 transition-all font-bold text-xs sm:text-sm",
                          childId === '' 
                            ? "border-indigo-600 bg-indigo-50 text-indigo-600 shadow-lg shadow-indigo-100" 
                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        بحث عام
                      </button>
                      {children.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setChildId(c.id)}
                          className={cn(
                            "flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border-2 transition-all font-bold text-xs sm:text-sm",
                            childId === c.id 
                              ? "border-indigo-600 bg-indigo-50 text-indigo-600 shadow-lg shadow-indigo-100" 
                              : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white">
                            <AvatarFallback className="bg-indigo-100 text-indigo-600 text-[8px] sm:text-[10px]">{c.name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          {c.name || 'طالب'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs sm:text-sm font-black text-slate-800 mr-2 block">ما هي مشكلتك؟ *</label>
                    <div className="relative group">
                       <Textarea 
                         value={content} 
                         onChange={e => setContent(e.target.value)} 
                         placeholder="اشرح لنا بالتفصيل لنتمكن من مساعدتك..."
                         className="min-h-[150px] sm:min-h-[180px] rounded-2xl sm:rounded-3xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-600/5 text-sm sm:text-lg font-medium p-4 sm:p-6 transition-all shadow-inner resize-none"
                         required
                       />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="submit" 
                      disabled={upsertComplaintMutation.isPending} 
                      className="flex-1 h-14 sm:h-16 rounded-2xl sm:rounded-3xl bg-slate-900 text-white font-black text-base sm:text-lg shadow-xl shadow-slate-200"
                    >
                      {upsertComplaintMutation.isPending ? 'جاري الإرسال...' : 'إرسال الشكوى الآن'}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <section className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <MessageCircle className="w-7 h-7 text-indigo-600" />
              تاريخ التواصل
            </h2>
          </div>

          <QueryStateHandler
            loading={loading}
            error={error}
            data={complaints}
            onRetry={refetch}
            isEmpty={complaints.length === 0}
            loadingMessage="جاري مزامنة بياناتك..."
            emptyMessage="لا يوجد سجل تواصل بعد. نسمع لك دائماً."
          >
            <div className="space-y-10">
              <div className="grid grid-cols-1 gap-6">
                {complaints.map(c => {
                  const child = children.find(k => k.id === c.student_id);
                  const hasResponse = !!c.admin_response;
                  const statusConfig = getStatusConfig(c.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={c.id} className="group premium-card p-0 overflow-hidden shadow-premium hover:translate-y-[-4px] transition-all duration-500">
                      <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-6 mb-2">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500",
                              hasResponse ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                            )}>
                              <User className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-black text-slate-900 text-lg leading-none">شكوى تابعة لـ {child?.name || 'عامة'}</span>
                                <Badge className={cn(
                                  "rounded-full px-3 py-1 font-black text-[10px] uppercase tracking-tighter flex items-center gap-1.5 border-none",
                                  statusConfig.color
                                )}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {formatDisplayDate(c.created_at, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-slate-700 font-bold text-lg leading-relaxed text-right whitespace-pre-wrap">{c.content}</p>
                        </div>

                        {hasResponse && (
                          <div className="mt-4 animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-3 mb-4 pr-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Send className="w-4 h-4 text-white -rotate-45" />
                              </div>
                              <span className="text-emerald-600 font-black text-xs uppercase tracking-widest leading-none">رد الإدارة المباشر</span>
                            </div>
                            <div className="bg-emerald-50/50 p-8 rounded-[32px] border-2 border-emerald-100/50 relative overflow-hidden group/reply">
                              <p className="text-emerald-900 font-black text-lg leading-relaxed italic pr-4">{c.admin_response}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
        </section>
      </div>
    </AppLayout>
  );
}
