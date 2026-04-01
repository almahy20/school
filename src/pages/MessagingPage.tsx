import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, Users, User, Megaphone, CheckCircle2, AlertCircle, Search, ShieldCheck
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
        .eq('school_id', user?.schoolId)
        .neq('id', user?.id)
        .order('full_name');
      
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
        school_id: user?.schoolId
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
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1200px] mx-auto text-right">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">مركز البث الإداري</h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide">إرسال التعميمات والرسائل الفورية للمستخدمين</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 rotate-3 shrink-0">
            <Megaphone className="w-8 h-8 text-white" />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 flex flex-col gap-8">
            <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm relative flex flex-col">
              <div className="flex bg-slate-50 border-b border-slate-100 p-2">
                <button 
                  onClick={() => setTargetType('all')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-bold transition-all ${
                    targetType === 'all' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  تعميم للجميع
                </button>
                <button 
                  onClick={() => setTargetType('specific')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-bold transition-all ${
                    targetType === 'specific' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <User className="w-5 h-5" />
                  مستخدم محدد
                </button>
              </div>

              <div className="p-10 flex flex-col gap-10">
                {targetType === 'specific' && (
                  <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-4 duration-500">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المستلم المستهدف</label>
                    <div className="relative group">
                      <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                      <input 
                        type="text"
                        className="w-full h-16 pr-16 pl-6 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all shadow-inner"
                        placeholder="ابحث عن اسم المستخدم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-3xl p-3 space-y-1.5 bg-white custom-scrollbar shadow-sm">
                      {filteredProfiles.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProfileId(p.id)}
                          className={`w-full text-right px-6 py-4 rounded-2xl text-sm font-black transition-all ${
                            selectedProfileId === p.id 
                              ? 'bg-slate-900 text-white shadow-xl translate-x-[-4px]' 
                              : 'text-slate-600 hover:bg-slate-50 hover:translate-x-[-2px]'
                          }`}
                        >
                          {p.full_name}
                        </button>
                      ))}
                      {filteredProfiles.length === 0 && (
                        <div className="py-12 text-center text-slate-300 font-bold italic">
                          <p className="text-xs">لا توجد نتائج مطابقة لبحثك</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">محتوى الرسالة / التعميم</label>
                  <Textarea 
                    placeholder="اكتب رسالتك هنا... سيتم إرسالها فوراً للمستهدفين."
                    className="min-h-[250px] rounded-[32px] border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all p-8 text-xl font-bold leading-relaxed text-slate-900 placeholder:text-slate-300 shadow-inner resize-none"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-6 pt-4">
                   <button 
                    onClick={handleSend}
                    disabled={loading}
                    className="flex-1 h-20 rounded-3xl bg-slate-900 text-white font-black text-lg shadow-2xl shadow-slate-900/20 hover:translate-y-[-4px] active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-5 group"
                  >
                    {loading ? (
                      <div className="w-8 h-8 border-[4px] border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="tracking-tight">إرسال وبث الرسالة الآن</span>
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                          <Send className="w-5 h-5 text-white" />
                        </div>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-8">
            <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-50" />
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-8">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-6 relative z-10">قواعد البث الآمن</h3>
              <ul className="space-y-6 relative z-10 text-right">
                {[
                  'تظهر هذه الرسالة كتبيه منبثق للمستخدمين فور دخولهم النظام.',
                  'يتم تسجيل وقت الإرسال وهوية الراسل في سجلات النظام الرسمية.',
                  'يرجى التأكد من دقة المعلومات قبل البث الشامل للجميع.'
                ].map((text, i) => (
                  <li key={i} className="flex gap-4 text-xs font-medium leading-relaxed text-slate-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-primary" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-8 rounded-[40px]">
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-bold text-sm">ملاحظة أمنية</h4>
              </div>
              <p className="text-xs font-medium text-amber-900/60 leading-relaxed">
                استخدم خاصية "التعميم للجميع" فقط للإعلانات الهامة جداً لضمان عدم إزعاج المستخدمين والحفاظ على فاعلية التنبيهات.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
