import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, Users, User, Megaphone, CheckCircle2, AlertCircle, Search
} from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

export default function MessagingPage() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .neq('id', user?.id);
      
      if (data) setProfiles(data as any);
    };
    fetchProfiles();
  }, [user]);

  const handleSend = async () => {
    if (!content.trim()) {
      toast.error('يرجى كتابة نص الرسالة');
      return;
    }

    if (targetType === 'specific' && !selectedProfileId) {
      toast.error('يرجى اختيار المستخدم المستهدف');
      return;
    }

    setLoading(true);
    try {
      const targets = targetType === 'all' 
        ? profiles.map(p => p.id)
        : [selectedProfileId];

      const messages = targets.map(targetId => ({
        sender_id: user?.id,
        receiver_id: targetId,
        content: content.trim(),
        is_read: false,
      }));

      const { error } = await supabase.from('messages').insert(messages);

      if (error) throw error;

      toast.success(targetType === 'all' ? 'تم بث الرسالة للجميع بنجاح' : 'تم إرسال الرسالة بنجاح');
      setContent('');
      setSelectedProfileId('');
    } catch (err: any) {
      toast.error('فشل في إرسال الرسالة: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1200px] mx-auto text-right">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">منظومة البث الإداري</h1>
            <p className="text-secondary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              المركز الرئيسي للتحكم في التواصل والتعميمات
            </p>
          </div>
          <div className="w-20 h-20 rounded-[32px] bg-primary flex items-center justify-center shadow-2xl rotate-3 shrink-0">
            <Megaphone className="w-10 h-10 text-white" />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[40px] border-2 border-muted overflow-hidden shadow-sm relative">
              <div className="absolute top-0 right-0 w-full h-1.5 bg-primary" />
              <div className="flex bg-muted/30 border-b-2 border-muted p-2">
                <button 
                  onClick={() => setTargetType('all')}
                  className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[24px] text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                    targetType === 'all' 
                      ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[0.98]' 
                      : 'text-primary/30 hover:bg-white hover:text-primary'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  تعميم شامل (للجميع)
                </button>
                <button 
                  onClick={() => setTargetType('specific')}
                  className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[24px] text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                    targetType === 'specific' 
                      ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[0.98]' 
                      : 'text-primary/30 hover:bg-white hover:text-primary'
                  }`}
                >
                  <User className="w-5 h-5" />
                  تحويل لمستخدم محدد
                </button>
              </div>

              <div className="p-10 space-y-8 text-right">
                {targetType === 'specific' && (
                  <div className="space-y-4 animate-scale-in">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] pr-2">تحديد المستهدف من السجل الفيدرالي</label>
                    <div className="relative group">
                      <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/20 group-focus-within:text-primary transition-colors" />
                      <input 
                        type="text"
                        className="w-full h-16 pr-14 pl-6 rounded-2xl border-2 border-muted bg-muted/10 text-primary font-black placeholder:text-primary/10 focus:outline-none focus:border-primary transition-all"
                        placeholder="ابحث عن هويّة المستخدم…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto border-2 border-muted rounded-[24px] p-3 space-y-2 bg-muted/5 custom-scrollbar">
                      {filteredProfiles.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProfileId(p.id)}
                          className={`w-full text-right px-6 py-4 rounded-xl font-black text-sm transition-all duration-300 ${
                            selectedProfileId === p.id 
                              ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                              : 'text-primary/40 hover:bg-white hover:text-primary border-transparent hover:border-muted border-2'
                          }`}
                        >
                          {p.full_name}
                        </button>
                      ))}
                      {filteredProfiles.length === 0 && (
                        <div className="py-12 text-center opacity-20 italic">
                          <Users className="w-10 h-10 mx-auto mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest">لا توجد بيانات مطابقة</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] pr-2">محتوى البرقية الإدارية</label>
                  <Textarea 
                    placeholder="اكتب التعميم الذي سيظهر فوراً كإشعار منبثق للمستهدفين…"
                    className="min-h-[250px] rounded-[32px] border-2 border-muted bg-muted/10 focus:bg-white focus:border-primary transition-all p-8 font-black text-xl leading-relaxed text-primary placeholder:text-primary/10"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <button 
                  onClick={handleSend}
                  disabled={loading}
                  className="w-full h-20 text-xs font-black uppercase tracking-[0.4em] rounded-[24px] bg-primary text-white shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 group flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="flex items-center gap-5">
                      <span className="mt-1">بث وإرسال التعميم الفوري</span>
                      <Send className="w-6 h-6 rotate-[180deg] group-hover:translate-x-[-10px] transition-transform" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-primary rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl shadow-primary/20">
              <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-white/5 rounded-full blur-3xl" />
              <h3 className="text-xl font-black italic mb-6 relative z-10 tracking-tight">بروتوكول البث</h3>
              <ul className="space-y-6 relative z-10">
                {[
                  'ستظهر الرسالة كنافذة منبثقة (Modal) فورية فور تزامن دخول المستخدم.',
                  'يتم تفعيل تنبيه مرئي وسمعي لضمان لفت انتباه المستخدم للتعميم.',
                  'تُحفظ البرقيات كمستندات رسمية في سجل الرسائل الفيدرالي لضمان الأرشفة.'
                ].map((text, i) => (
                  <li key={i} className="flex gap-4 text-xs font-black leading-relaxed text-white/70">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-secondary" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-secondary/10 border-2 border-secondary/20 p-8 rounded-[40px] animate-pulse">
              <div className="flex items-center gap-3 mb-4 text-secondary">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-black text-xs uppercase tracking-widest">توجيه أمني</h4>
              </div>
              <p className="text-[10px] font-black text-secondary-foreground leading-relaxed uppercase tracking-widest">
                يُرجى قصر استخدام ميزة البث الشامل على الإعلانات الاستراتيجية لضمان فعالية الانتباه الأكاديمي.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
