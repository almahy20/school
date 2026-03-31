import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, MessageSquare, Plus, X, Search, User, Shield, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Msg {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  student_id: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

interface Student {
  id: string;
  name: string;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [studentsMap, setStudentsMap] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [newTo, setNewTo] = useState('');
  const [newText, setNewText] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [replyStudentId, setReplyStudentId] = useState('');
  const [threadStudents, setThreadStudents] = useState<Student[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ─── Load messages + profiles ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: msgs } = await (supabase as any)
        .from('messages')
        .select('*')
        .eq('school_id', user.schoolId)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (msgs?.length) {
        setMessages(msgs as Msg[]);
        const ids: string[] = [...new Set((msgs as Msg[]).flatMap(m => [m.sender_id, m.receiver_id]))].filter((id): id is string => id !== null && id !== user.id);
        const studentIds = [...new Set((msgs as Msg[]).map(m => m.student_id).filter(Boolean))] as string[];

        if (ids.length) {
          const { data: profs } = await supabase.from('profiles').select('id, full_name').eq('school_id', user.schoolId).in('id', ids);
          const map: Record<string, Profile> = {};
          profs?.forEach(p => { map[p.id] = p; });
          setProfiles(map);
        }
        if (studentIds.length) {
          const { data: studs } = await supabase.from('students').select('id, name').eq('school_id', user.schoolId).in('id', studentIds);
          const smap: Record<string, string> = {};
          studs?.forEach(s => { smap[s.id] = s.name; });
          setStudentsMap(smap);
        }
      }
      setLoading(false);
    })();
  }, [user]);

  // ─── Load contacts + students for new message ─────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      let contactIds: string[] = [];
      let studs: Student[] = [];

      if (user.role === 'teacher') {
        const { data: classes } = await supabase.from('classes').select('id').eq('school_id', user.schoolId).eq('teacher_id', user.id);
        if (!classes?.length) return;
        const classIds = classes.map(c => c.id);
        const { data: students } = await supabase.from('students').select('id, name').eq('school_id', user.schoolId).in('class_id', classIds);
        studs = (students || []) as Student[];
        const { data: links } = await supabase.from('student_parents').select('parent_id').eq('school_id', user.schoolId).in('student_id', studs.map(s => s.id));
        contactIds = [...new Set((links || []).map(l => l.parent_id))];
      } else if (user.role === 'parent') {
        const { data: links } = await supabase.from('student_parents').select('student_id').eq('school_id', user.schoolId).eq('parent_id', user.id);
        if (!links?.length) return;
        const studentIds = links.map(l => l.student_id);
        const { data: students } = await supabase.from('students').select('id, name, class_id').eq('school_id', user.schoolId).in('id', studentIds);
        studs = (students || []) as Student[];
        const classIds = [...new Set((students || []).map(s => (s as any).class_id).filter(Boolean))] as string[];
        if (!classIds.length) return;
        const { data: classes } = await supabase.from('classes').select('teacher_id').eq('school_id', user.schoolId).in('id', classIds);
        contactIds = [...new Set((classes || []).map(c => c.teacher_id).filter(Boolean))] as string[];
      }

      if (!contactIds.length) return;
      const { data: profs } = await supabase.from('profiles').select('id, full_name').eq('school_id', user.schoolId).in('id', contactIds);
      setContacts(profs || []);
      setAvailableStudents(studs);
      setProfiles(prev => {
        const next = { ...prev };
        profs?.forEach(p => { next[p.id] = p; });
        return next;
      });
      setStudentsMap(prev => {
        const next = { ...prev };
        studs.forEach(s => { next[s.id] = s.name; });
        return next;
      });
    })();
  }, [user]);

  // ─── Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('msgs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Msg;
        if (msg.sender_id !== user.id && msg.receiver_id !== user.id) return;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        supabase.from('profiles').select('id, full_name').eq('id', otherId).single().then(({ data }) => {
          if (data) setProfiles(prev => prev[data.id] ? prev : { ...prev, [data.id]: data });
        });
        if (msg.student_id && !studentsMap[msg.student_id]) {
          supabase.from('students').select('id, name').eq('id', msg.student_id).single().then(({ data }) => {
            if (data) setStudentsMap(prev => ({ ...prev, [data.id]: data.name }));
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Msg;
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, studentsMap]);

  // ─── Mark as read + scroll ────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !user) return;
    const unread = messages.filter(
      m => m.sender_id === selectedId && m.receiver_id === user.id && !m.is_read
    );
    if (unread.length) {
      supabase.from('messages').update({ is_read: true }).in('id', unread.map(m => m.id));
      setMessages(prev =>
        prev.map(m => unread.some(u => u.id === m.id) ? { ...m, is_read: true } : m)
      );
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [selectedId, messages.length, user]);

  // ─── Build thread students for reply selector ──────────────────────
  useEffect(() => {
    if (!selectedId || !user) return;
    const thread = messages.filter(
      m =>
        (m.sender_id === selectedId && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === selectedId)
    );
    const sIds = [...new Set(thread.map(m => m.student_id).filter(Boolean))] as string[];
    const knownStudents = availableStudents.filter(s => sIds.includes(s.id));
    setThreadStudents(knownStudents.length ? knownStudents : availableStudents);
    setReplyStudentId('');
  }, [selectedId, availableStudents, messages, user]);

  // ─── Derived conversations ────────────────────────────────────────
  const conversations = (() => {
    if (!user) return [];
    const map: Record<string, { msgs: Msg[]; unread: number }> = {};
    messages.forEach(m => {
      const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!map[other]) map[other] = { msgs: [], unread: 0 };
      map[other].msgs.push(m);
      if (m.receiver_id === user.id && !m.is_read) map[other].unread++;
    });
    return Object.entries(map)
      .map(([id, { msgs, unread }]) => ({
        contactId: id,
        contact: profiles[id],
        lastMsg: msgs[msgs.length - 1],
        unread,
      }))
      .filter(c => c.contact)
      .sort((a, b) =>
        new Date(b.lastMsg?.created_at ?? 0).getTime() - new Date(a.lastMsg?.created_at ?? 0).getTime()
      );
  })();

  const filtered = conversations.filter(c => !search || c.contact?.full_name?.includes(search));

  const thread = selectedId
    ? messages.filter(
        m =>
          (m.sender_id === selectedId && m.receiver_id === user?.id) ||
          (m.sender_id === user?.id && m.receiver_id === selectedId)
      )
    : [];

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const contactLabel = user?.role === 'teacher' ? 'ولي أمر' : 'معلم';

  // ─── Actions ──────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!input.trim() || !selectedId || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedId,
      content: input.trim(),
      student_id: replyStudentId || null,
      school_id: user.schoolId
    });
    if (error) toast({ title: 'خطأ', description: 'تعذر إرسال الرسالة', variant: 'destructive' });
    else setInput('');
    setSending(false);
  };

  const sendNew = async () => {
    if (!newText.trim() || !newTo || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: newTo,
      content: newText.trim(),
      student_id: newStudentId || null,
      school_id: user.schoolId
    });
    if (!error) {
      setShowNew(false);
      setNewTo('');
      setNewText('');
      setNewStudentId('');
      setSelectedId(newTo);
    } else {
      toast({ title: 'خطأ', description: 'تعذر إرسال الرسالة', variant: 'destructive' });
    }
    setSending(false);
  };

  // ─── Formatters ───────────────────────────────────────────────────
  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const fmtDate = (s: string) => {
    const d = new Date(s);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'اليوم';
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'أمس';
    return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
  };

  return (
    <AppLayout>
      <div className="flex bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden h-[calc(100vh-10rem)] animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right">
        {/* ── Conversations list ── */}
        <div
          className={`flex flex-col border-e border-slate-50 w-full sm:w-96 shrink-0 ${
            selectedId ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">الرسائل</h1>
              {totalUnread > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-primary text-white text-[10px] font-bold">
                  {totalUnread} جديدة
                </span>
              )}
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-6 shrink-0">
            <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-primary transition-colors" />
              <input
                placeholder="ابحث في المحادثات..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pr-11 pl-4 py-3.5 text-sm font-medium bg-slate-50 border-0 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center text-slate-300">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-bold opacity-30">لا توجد محادثات</p>
              </div>
            ) : (
              filtered.map(conv => (
                <button
                  key={conv.contactId}
                  onClick={() => setSelectedId(conv.contactId)}
                  className={`w-full text-right p-5 rounded-3xl flex items-center gap-4 transition-all duration-300 group ${
                    selectedId === conv.contactId 
                      ? 'bg-primary/5 border border-primary/10 shadow-sm' 
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                      selectedId === conv.contactId ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {conv.contact?.full_name?.[0] || '?'}
                    </div>
                    {conv.unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 border-2 border-white text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <p className={`text-base font-bold truncate ${selectedId === conv.contactId ? 'text-primary' : 'text-slate-900'}`}>
                        {conv.contact?.full_name || '...'}
                      </p>
                      <span className={`text-[10px] font-medium shrink-0 pt-1 ${selectedId === conv.contactId ? 'text-primary/60' : 'text-slate-300'}`}>
                        {fmtDate(conv.lastMsg.created_at)}
                      </span>
                    </div>
                    <p className={`text-xs font-medium truncate ${selectedId === conv.contactId ? 'text-slate-500' : 'text-slate-400'}`}>
                      {conv.lastMsg.sender_id === user?.id && <span className="opacity-40">أنت: </span>}
                      {conv.lastMsg.content}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Thread view ── */}
        <div
          className={`flex-1 flex flex-col min-w-0 bg-slate-50/10 ${selectedId ? 'flex' : 'hidden sm:flex'}`}
        >
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-200">
              <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-400">اختر محادثة للبدء</h3>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-6 md:p-8 border-b border-slate-50 flex items-center gap-4 shrink-0 bg-white/80 backdrop-blur-md relative z-10">
                <button
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                >
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
                <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center font-bold text-xl">
                  {profiles[selectedId]?.full_name?.[0] || '?'}
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">
                    {profiles[selectedId]?.full_name || '...'}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{contactLabel} · متصل حالياً</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 custom-scrollbar">
                {thread.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.id;
                  const showDateSep =
                    idx === 0 ||
                    new Date(msg.created_at).toDateString() !==
                      new Date(thread[idx - 1].created_at).toDateString();
                  const studentName = msg.student_id ? studentsMap[msg.student_id] : null;
                  return (
                    <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {showDateSep && (
                        <div className="flex justify-center my-8 relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-100/50" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-white/50 px-4 py-1 rounded-full relative z-10 backdrop-blur-sm">
                            {fmtDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className={`max-w-[80%] md:max-w-[70%] px-6 py-4 rounded-[28px] shadow-sm transition-all duration-300 ${
                            isMe
                              ? 'bg-primary text-white rounded-tr-lg'
                              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-lg'
                          }`}
                        >
                          {studentName && (
                            <div
                              className={`inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest mb-2 px-3 py-1.5 rounded-xl w-fit ${
                                isMe ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-500'
                              }`}
                            >
                              <User className="w-3 h-3" />
                              {studentName}
                            </div>
                          )}
                          <p className="text-sm font-medium leading-relaxed break-words">{msg.content}</p>
                          <div className={`mt-2 flex items-center gap-2 ${isMe ? 'text-white/40' : 'text-slate-300'}`}>
                            <span className="text-[9px] font-bold">{fmtTime(msg.created_at)}</span>
                            {isMe && <div className={`w-1 h-1 rounded-full ${msg.is_read ? 'bg-emerald-400' : 'bg-white/20'}`} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-6 md:p-8 bg-white border-t border-slate-50 relative z-10">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                  {threadStudents.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                      <User className="w-3.5 h-3.5 text-slate-300" />
                      <select
                        value={replyStudentId}
                        onChange={e => setReplyStudentId(e.target.value)}
                        className="text-[10px] font-bold text-slate-500 bg-transparent border-0 focus:outline-none cursor-pointer"
                      >
                        <option value="">رسالة عامة</option>
                        {threadStudents.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-end gap-4">
                    <div className="flex-1 relative group">
                      <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendReply();
                          }
                        }}
                        placeholder="اكتب رسالتك هنا..."
                        rows={1}
                        className="w-full resize-none rounded-3xl border border-slate-100 bg-slate-50 px-6 py-4 text-sm font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all max-h-32 shadow-inner"
                      />
                    </div>
                    <button
                      onClick={sendReply}
                      disabled={!input.trim() || sending}
                      className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-20 shrink-0 group"
                    >
                      <Send className="w-5 h-5 group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New message modal */}
      {showNew && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 text-right animate-in fade-in" 
             onClick={() => { setShowNew(false); setNewTo(''); setNewText(''); setNewStudentId(''); }}>
          <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-10 rounded-[32px] animate-in zoom-in-95 relative overflow-hidden" 
               onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 mb-8 tracking-tight">بدء محادثة جديدة</h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 pr-1">المستقبل ({contactLabel}) *</label>
                {contacts.length === 0 ? (
                  <div className="px-6 py-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 font-bold text-xs">
                    لا يوجد جهات اتصال مسجلة لمؤهلاتك حالياً
                  </div>
                ) : (
                  <select
                    value={newTo}
                    onChange={e => setNewTo(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:border-primary/20 appearance-none transition-all"
                  >
                    <option value="">اختر {contactLabel}...</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {availableStudents.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 pr-1">الطالب المرتبط (اختياري)</label>
                  <select
                    value={newStudentId}
                    onChange={e => setNewStudentId(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:border-primary/20 appearance-none transition-all"
                  >
                    <option value="">مراسلة عامة</option>
                    {availableStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 pr-1">نص الرسالة *</label>
                <textarea
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  placeholder="اكتب رسالتك الرسمية هنا..."
                  rows={4}
                  className="w-full px-6 py-4 rounded-[24px] border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-primary/20 transition-all resize-none shadow-inner"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={sendNew}
                  disabled={!newText.trim() || !newTo || sending || contacts.length === 0}
                  className="flex-1 h-16 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:translate-y-[-2px] active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-3"
                >
                  <Send className="w-5 h-5" />
                  إرسال الرسالة
                </button>
                <button 
                  onClick={() => { setShowNew(false); setNewTo(''); setNewText(''); setNewStudentId(''); }}
                  className="flex-1 h-16 rounded-2xl bg-slate-50 text-slate-500 font-bold text-sm hover:bg-slate-100 transition-all"
                >إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
