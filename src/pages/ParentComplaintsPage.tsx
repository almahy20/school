import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Users, Plus, Send, User, ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function ParentComplaintsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [childId, setChildId] = useState<string>('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const [{ data: links }, { data: cmps }] = await Promise.all([
      (supabase as any).from('student_parents').select('students!student_parents_student_id_fkey(id, name)').eq('school_id', user.schoolId).eq('parent_id', user.id),
      (supabase as any).from('complaints').select('*').eq('school_id', user.schoolId).eq('parent_id', user.id).order('created_at', { ascending: false }),
    ]);
    const kids = (links || []).map((l: any) => l.students).filter(Boolean);
    setChildren(kids || []);
    setComplaints(cmps || []);
    setLoading(false);
  }, [user?.id, user?.schoolId]);

  useEffect(() => { loadData(); }, [loadData]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) { toast({ title: 'يرجى كتابة نص الشكوى' }); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from('complaints').insert({
      parent_id: user?.id,
      student_id: childId || null,
      content: content.trim(),
      school_id: user?.schoolId,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم إرسال الشكوى' });
      setContent('');
      setChildId('');
      loadData();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-[1200px] mx-auto text-right pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/20">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="w-2 h-10 bg-primary rounded-full" />
              مركز الشكاوي
            </h1>
            <p className="text-slate-500 font-medium text-lg pr-5">نحن هنا لنسمعك، ونطور خدماتنا من أجلك</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="h-16 px-8 rounded-3xl bg-primary hover:bg-primary/90 text-white font-bold text-lg shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 gap-3">
                <Plus className="w-6 h-6" />
                إرسال شكوى جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[40px] p-0 overflow-hidden border-none shadow-none bg-transparent">
              <div className="bg-white p-10 space-y-8 text-right">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black text-slate-900 leading-tight">شكوى جديدة</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={submit} className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-800 mr-2 block">اختر الابن المعني (اختياري)</label>
                    <div className="flex flex-wrap gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => setChildId('')}
                        className={cn(
                          "px-6 py-3 rounded-2xl border-2 transition-all font-bold text-sm",
                          childId === '' 
                            ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10" 
                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        بدون تحديد
                      </button>
                      {children.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setChildId(c.id)}
                          className={cn(
                            "flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all font-bold text-sm",
                            childId === c.id 
                              ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10" 
                              : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <Avatar className="w-6 h-6 border-2 border-white">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{c.name[0]}</AvatarFallback>
                          </Avatar>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-800 mr-2 block">ما هي مشكلتك؟ *</label>
                    <div className="relative group">
                       <Textarea 
                         value={content} 
                         onChange={e => setContent(e.target.value)} 
                         placeholder="اشرح لنا بالتفصيل لنتمكن من مساعدتك..."
                         className="min-h-[180px] rounded-3xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 text-lg font-medium p-6 transition-all"
                       />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="submit" 
                      disabled={submitting} 
                      className="flex-1 h-16 rounded-3xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20"
                    >
                      {submitting ? 'جاري الإرسال...' : 'إرسال الآن'}
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
              <MessageCircle className="w-7 h-7 text-primary" />
              تاريخ التواصل
            </h2>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 font-bold border-slate-200 text-slate-500 bg-white">
              {complaints.length} شكاوى
            </Badge>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-primary rounded-full animate-spin" />
              <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">جاري مزامنة بياناتك</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="bg-white/40 backdrop-blur-md border-2 border-dashed border-slate-200 p-24 text-center rounded-[40px] shadow-sm">
              <div className="w-24 h-24 rounded-[36px] bg-slate-50 flex items-center justify-center mx-auto mb-8 text-slate-200">
                <MessageSquare className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3">لا يوجد سجل تواصل بعد</h3>
              <p className="text-slate-400 font-medium text-lg max-w-sm mx-auto">
                عند إرسال شكوى جديدة، ستتمكن من متابعة الردود هنا مباشرةً
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {complaints.map(c => {
                const child = children.find(k => k.id === c.student_id);
                const hasResponse = !!c.admin_response;
                return (
                  <div key={c.id} className="group premium-card p-0 overflow-hidden shadow-premium">
                    <div className="p-8 space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-6 mb-2">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500",
                            hasResponse ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                          )}>
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-black text-slate-900 text-lg leading-none">شكوى تابعة لـ {child?.name || 'عامة'}</span>
                              <Badge className={cn(
                                "rounded-full px-3 py-0.5 font-black text-[10px] uppercase tracking-tighter",
                                hasResponse ? "bg-indigo-500/10 text-indigo-600" : "bg-amber-500/10 text-amber-600"
                              )}>
                                {hasResponse ? 'تم الرد' : 'قيد الانتظار'}
                              </Badge>
                            </div>
                            <p className="text-slate-300 font-bold text-[11px] uppercase tracking-widest leading-none">
                              {new Date(c.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-slate-700 font-bold text-lg leading-relaxed text-right">{c.content}</p>
                      </div>

                      {hasResponse && (
                        <div className="mt-4 animate-in slide-in-from-top-4 duration-500">
                          <div className="flex items-center gap-3 mb-4 pr-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                              <Send className="w-4 h-4 text-white -rotate-45" />
                            </div>
                            <span className="text-emerald-600 font-black text-xs uppercase tracking-widest">رد الإدارة المباشر</span>
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
          )}
        </section>
      </div>
    </AppLayout>
  );
}
