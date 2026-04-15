import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, Users, User, Megaphone, CheckCircle2, AlertCircle, Search, ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  useProfiles, 
  useSendMessage, 
  useBranding 
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function MessagingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // UI State
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Queries ──
  const { data: branding } = useBranding();
  
  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { 
    data: profilesData, 
    isLoading: profilesLoading, 
    error: profilesError, 
    refetch: refetchProfiles 
  } = useProfiles(debouncedSearch, 1, 50); // جلب أول 50 مستخدم مطابق للبحث

  const profiles = profilesData?.data || [];

  // ── Mutations ──
  const sendMessageMutation = useSendMessage();

  const handleSend = async () => {
    if (!content.trim()) {
      toast({ title: 'خطأ', description: 'يرجى كتابة نص الرسالة', variant: 'destructive' });
      return;
    }

    if (targetType === 'specific' && !selectedProfileId) {
      toast({ title: 'خطأ', description: 'يرجى اختيار المستخدم المستهدف', variant: 'destructive' });
      return;
    }

    try {
      let targets: string[];
      
      if (targetType === 'all') {
        // جلب جميع البروفايلات للبث الجماعي
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('school_id', user?.schoolId)
          .neq('id', user?.id);
        
        targets = (allProfiles || []).map(p => p.id);
        
        if (targets.length === 0) {
          toast({ title: 'تنبيه', description: 'لا يوجد مستخدمين آخرين لإرسال الرسالة لهم', variant: 'destructive' });
          return;
        }
      } else {
        targets = [selectedProfileId];
      }

      await sendMessageMutation.mutateAsync({
        targets,
        content: content.trim()
      });

      toast({ 
        title: 'تم الإرسال بنجاح', 
        description: targetType === 'all' ? `تم إرسال الرسالة لـ ${targets.length} مستخدم` : 'تم إرسال الرسالة للمستخدم المختار' 
      });
      setContent('');
      setSelectedProfileId('');
    } catch (err: any) {
      toast({ title: 'خطأ في الإرسال', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 max-w-[1200px] mx-auto text-right animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-8 md:p-12 rounded-[48px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
                 <Megaphone className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none mb-1">مركز البث والرسائل</h1>
                <p className="text-slate-500 font-medium text-sm">تواصل مع الكادر التعليمي وأولياء الأمور عبر البث أو الرسائل الخاصة.</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          {/* Main Messaging Form */}
          <div className="xl:col-span-12">
            <div className="premium-card p-12 space-y-10 relative overflow-hidden">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm transition-transform hover:scale-110">
                       <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                       <h2 className="text-2xl font-black text-slate-900">إرسال تحديث رسمي</h2>
                       <Badge variant="outline" className="mt-1 rounded-lg bg-indigo-50/50 border-indigo-100 text-indigo-600 font-black text-[9px] uppercase tracking-widest px-3">بث من {branding?.name}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex p-1.5 bg-slate-100/50 rounded-2xl w-fit">
                    <button onClick={() => setTargetType('all')}
                      className={cn("px-6 py-2.5 rounded-xl text-xs font-black transition-all", targetType === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                      بث للجميع
                    </button>
                    <button onClick={() => setTargetType('specific')}
                      className={cn("px-6 py-2.5 rounded-xl text-xs font-black transition-all", targetType === 'specific' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                      رسالة خاصة
                    </button>
                  </div>
               </div>

               <div className="space-y-8">
                 {targetType === 'specific' && (
                   <div className="space-y-4 animate-in slide-in-from-top-2 duration-400">
                     <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">اختر المستخدم المستهدف</label>
                     <div className="relative group">
                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                        <Input placeholder="ابحث باسم المستخدم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                           className="h-14 pr-12 pl-6 rounded-2xl bg-slate-50 border-none font-bold text-base focus:bg-white transition-all shadow-inner" />
                     </div>
                     
                     <QueryStateHandler
                       loading={profilesLoading}
                       error={profilesError}
                       data={profiles}
                       onRetry={refetchProfiles}
                       isEmpty={profiles.length === 0}
                       loadingMessage="جاري جلب القائمة..."
                       emptyMessage="لم يتم العثور على مستخدمين."
                     >
                       <div className="flex flex-wrap gap-3 mt-4 max-h-48 overflow-y-auto p-4 bg-white/50 rounded-3xl border border-slate-50 scrollbar-hide">
                          {profiles.map(p => (
                            <button key={p.id} onClick={() => setSelectedProfileId(p.id)}
                              className={cn(
                                "flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-bold border-2 transition-all",
                                selectedProfileId === p.id ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-100 text-slate-600 hover:border-indigo-100"
                              )}>
                               <User className={cn("w-4 h-4", selectedProfileId === p.id ? "text-white" : "text-slate-300")} />
                               {p.full_name}
                            </button>
                          ))}
                       </div>
                     </QueryStateHandler>
                   </div>
                 )}

                 <div className="space-y-4">
                   <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">نص الرسالة</label>
                   <Textarea 
                     placeholder="اكتب رسالتك هنا... (سيصل إشعار فوري لجميع المستهدفين)" 
                     value={content} 
                     onChange={e => setContent(e.target.value)}
                     className="min-h-[220px] p-8 rounded-[40px] bg-slate-50 border-none text-xl font-bold leading-relaxed focus:bg-white transition-all shadow-inner resize-none scrollbar-hide"
                   />
                 </div>

                 <div className="flex items-center justify-between pt-6">
                    <div className="hidden sm:flex items-center gap-3 text-slate-300">
                       <AlertCircle className="w-5 h-5" />
                       <p className="text-[10px] font-bold uppercase tracking-widest leading-none">يتم تشفير جميع الرسائل وفقاً لمعايير الخصوصية.</p>
                    </div>
                    <Button 
                      onClick={handleSend} 
                      disabled={sendMessageMutation.isPending}
                      className="h-16 px-12 rounded-3xl bg-slate-900 text-white font-black text-lg gap-4 shadow-2xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {sendMessageMutation.isPending ? 'جاري الإرسال...' : (
                        <>
                          إرسال الآن
                          <Send className="w-5 h-5 rotate-180" />
                        </>
                      )}
                    </Button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
