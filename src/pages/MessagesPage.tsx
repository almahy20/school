import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, MessageSquare, Plus, X, Search, User } from 'lucide-react';
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
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (msgs?.length) {
        setMessages(msgs as Msg[]);
        const ids = [...new Set(msgs.flatMap(m => [m.sender_id, m.receiver_id]))].filter(id => id !== user.id);
        const studentIds = [...new Set(msgs.map(m => m.student_id).filter(Boolean))] as string[];

        if (ids.length) {
          const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
          const map: Record<string, Profile> = {};
          profs?.forEach(p => { map[p.id] = p; });
          setProfiles(map);
        }
        if (studentIds.length) {
          const { data: studs } = await supabase.from('students').select('id, name').in('id', studentIds);
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
        const { data: classes } = await supabase.from('classes').select('id').eq('teacher_id', user.id);
        if (!classes?.length) return;
        const classIds = classes.map(c => c.id);
        const { data: students } = await supabase.from('students').select('id, name').in('class_id', classIds);
        studs = (students || []) as Student[];
        const { data: links } = await supabase.from('student_parents').select('parent_id').in('student_id', studs.map(s => s.id));
        contactIds = [...new Set((links || []).map(l => l.parent_id))];
      } else if (user.role === 'parent') {
        const { data: links } = await supabase.from('student_parents').select('student_id').eq('parent_id', user.id);
        if (!links?.length) return;
        const studentIds = links.map(l => l.student_id);
        const { data: students } = await supabase.from('students').select('id, name, class_id').in('id', studentIds);
        studs = (students || []) as Student[];
        const classIds = [...new Set((students || []).map(s => (s as any).class_id).filter(Boolean))] as string[];
        if (!classIds.length) return;
        const { data: classes } = await supabase.from('classes').select('teacher_id').in('id', classIds);
        contactIds = [...new Set((classes || []).map(c => c.teacher_id).filter(Boolean))] as string[];
      }

      if (!contactIds.length) return;
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', contactIds);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, messages.length]);

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
    // fallback: use all available students if none yet tagged
    setThreadStudents(knownStudents.length ? knownStudents : availableStudents);
    setReplyStudentId('');
  }, [selectedId, availableStudents, messages]);

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

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="flex border rounded-2xl overflow-hidden bg-card shadow-sm h-[calc(100vh-8rem)]">
        {/* ── Conversations list ── */}
        <div
          className={`flex flex-col border-e w-full sm:w-80 shrink-0 ${
            selectedId ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-foreground text-lg">الرسائل</h1>
              {totalUnread > 0 && (
                <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b shrink-0">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="بحث..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-sm bg-muted/50 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground mb-3">لا توجد محادثات بعد</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  ابدأ محادثة جديدة
                </button>
              </div>
            ) : (
              filtered.map(conv => (
                <button
                  key={conv.contactId}
                  onClick={() => setSelectedId(conv.contactId)}
                  className={`w-full text-right p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors border-b border-border/30 ${
                    selectedId === conv.contactId ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {conv.contact?.full_name?.[0] || '?'}
                    </div>
                    {conv.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p
                        className={`text-sm truncate ${
                          conv.unread > 0
                            ? 'font-bold text-foreground'
                            : 'font-medium text-foreground'
                        }`}
                      >
                        {conv.contact?.full_name || '...'}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ms-1">
                        {fmtDate(conv.lastMsg.created_at)}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate mt-0.5 ${
                        conv.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {conv.lastMsg.sender_id === user?.id && 'أنت: '}
                      {conv.lastMsg.student_id && studentsMap[conv.lastMsg.student_id] && (
                        <span className="text-primary font-semibold">
                          [{studentsMap[conv.lastMsg.student_id]}]{' '}
                        </span>
                      )}
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
          className={`flex-1 flex flex-col min-w-0 ${selectedId ? 'flex' : 'hidden sm:flex'}`}
        >
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full">
              <MessageSquare className="w-14 h-14 text-muted-foreground/15 mb-4" />
              <p className="text-muted-foreground text-sm">اختر محادثة لعرضها</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-4 border-b flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {profiles[selectedId]?.full_name?.[0] || '?'}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {profiles[selectedId]?.full_name || '...'}
                  </p>
                  <p className="text-xs text-muted-foreground">{contactLabel}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/5">
                {thread.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">ابدأ المحادثة بإرسال رسالة</p>
                  </div>
                )}
                {thread.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.id;
                  const showDateSep =
                    idx === 0 ||
                    new Date(msg.created_at).toDateString() !==
                      new Date(thread[idx - 1].created_at).toDateString();
                  const studentName = msg.student_id ? studentsMap[msg.student_id] : null;
                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex justify-center my-3">
                          <span className="text-[11px] text-muted-foreground bg-background border px-3 py-1 rounded-full">
                            {fmtDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                            isMe
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background border text-foreground'
                          }`}
                        >
                          {/* Student tag */}
                          {studentName && (
                            <div
                              className={`flex items-center gap-1 text-[11px] font-semibold mb-1.5 px-2 py-0.5 rounded-lg w-fit ${
                                isMe
                                  ? 'bg-primary-foreground/20 text-primary-foreground'
                                  : 'bg-primary/10 text-primary'
                              }`}
                            >
                              <User className="w-3 h-3" />
                              {studentName}
                            </div>
                          )}
                          <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}
                          >
                            {fmtTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t shrink-0 space-y-2">
                {/* Student selector for reply */}
                {threadStudents.length > 0 && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <select
                      value={replyStudentId}
                      onChange={e => setReplyStudentId(e.target.value)}
                      className="flex-1 text-xs rounded-lg border border-input bg-muted/40 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    >
                      <option value="">بدون تحديد طالب</option>
                      {threadStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="اكتب رسالتك..."
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-input bg-muted/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-28"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!input.trim() || sending}
                    className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
                  >
                    <Send className="w-4 h-4" style={{ transform: 'scaleX(-1)' }} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New message modal ── */}
      {showNew && (
        <div
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => { setShowNew(false); setNewTo(''); setNewText(''); setNewStudentId(''); }}
        >
          <div
            className="bg-background rounded-2xl border shadow-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">رسالة جديدة</h2>
              <button
                onClick={() => { setShowNew(false); setNewTo(''); setNewText(''); setNewStudentId(''); }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Recipient */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  إرسال إلى ({contactLabel})
                </label>
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted rounded-xl p-3">
                    لا يوجد جهات اتصال متاحة حالياً
                  </p>
                ) : (
                  <select
                    value={newTo}
                    onChange={e => setNewTo(e.target.value)}
                    className="w-full rounded-xl border border-input bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">اختر {contactLabel}...</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Student selector */}
              {availableStudents.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    بخصوص الطالب <span className="text-muted-foreground font-normal">(اختياري)</span>
                  </label>
                  <select
                    value={newStudentId}
                    onChange={e => setNewStudentId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">بدون تحديد طالب</option>
                    {availableStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">الرسالة</label>
                <textarea
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  rows={4}
                  className="w-full rounded-xl border border-input bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <button
                onClick={sendNew}
                disabled={!newText.trim() || !newTo || sending || contacts.length === 0}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4" style={{ transform: 'scaleX(-1)' }} />
                إرسال الرسالة
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
