import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  Send, Loader2, School, MessageCircle, Users, ArrowRight, ChevronLeft,
} from 'lucide-react';
import {
  useParentConversations,
  useConversationMessagesFlat,
  useCreateConversation,
  useSendConversationMessage,
  useMarkConversationRead,
} from '@/hooks/queries/useConversations';
import {
  useParentClassChatRooms,
  useEnsureClassChatRoom,
  useClassChatUnreadCounts,
} from '@/hooks/queries/useClassChat';
import { useParentChildren } from '@/hooks/queries';
import PageHeader from '@/components/layout/PageHeader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateSeparator(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({
  content, isMe, time, senderName, showName,
}: {
  content: string; isMe: boolean; time: string; senderName?: string; showName?: boolean;
}) {
  return (
    <div className={cn('flex mb-1.5', isMe ? 'justify-start' : 'justify-end')}>
      <div className="max-w-[75%]">
        {showName && senderName && !isMe && (
          <p className="text-[10px] font-black text-slate-400 mb-1 px-1 text-left">{senderName}</p>
        )}
        <div className={cn(
          'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          isMe
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-sm',
        )}>
          <p className="whitespace-pre-wrap break-words mb-1">{content}</p>
          <span className={cn('text-[10px] leading-none', isMe ? 'text-indigo-200' : 'text-slate-400')}>
            {new Date(time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Chat View shell — full screen with back button ───────────────────────────

function ChatView({
  onBack,
  headerIcon,
  headerTitle,
  headerSubtitle,
  children,
}: {
  onBack: () => void;
  headerIcon: React.ReactNode;
  headerTitle: string;
  headerSubtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <div
        dir="rtl"
        className={[
          '-mx-4 sm:-mx-6 md:-mx-8 lg:-mx-10',
          '-mt-5 sm:-mt-6',
          '-mb-24 md:-mb-6',
          'flex flex-col',
          'h-[calc(100vh-64px)] xl:h-[calc(100vh-80px)]',
        ].join(' ')}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-100 shadow-sm">
          <button
            onClick={onBack}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="shrink-0">{headerIcon}</div>
          <div>
            <p className="text-sm font-black text-slate-900">{headerTitle}</p>
            <p className="text-[10px] text-slate-400 font-medium">{headerSubtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </AppLayout>
  );
}

// ─── Admin Chat ───────────────────────────────────────────────────────────────

function AdminChatView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [selectedChild, setSelectedChild] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: convsLoading } = useParentConversations();
  const { data: children = [] } = useParentChildren();
  const conversation = conversations[0] ?? null;
  const { data: messages = [], isLoading: msgsLoading, hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage } = useConversationMessagesFlat(conversation?.id ?? null);
  const sendMessage = useSendConversationMessage();
  const markRead = useMarkConversationRead();
  const create = useCreateConversation();

  useEffect(() => {
    if (conversation?.unread_by_parent > 0) {
      markRead.mutate({ conversationId: conversation.id, asRole: 'parent' });
    }
    // تعليم إشعارات هذه المحادثة كمقروءة في جدول notifications
    if (conversation?.id && user?.id) {
      const db = supabase as any;
      db.from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .in('type', ['conversation_admin_reply', 'conversation_new_message'])
        .contains('metadata', { conversation_id: conversation.id });
    }
    // markRead.mutate intentionally excluded — TanStack mutation object reference changes on every render;
    // conversation.id and unread status are the meaningful triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      if (conversation) {
        await sendMessage.mutateAsync({ conversationId: conversation.id, content: t });
      } else {
        const subject = t.length > 60 ? t.slice(0, 60) + '…' : t;
        await create.mutateAsync({ subject, firstMessage: t, studentId: selectedChild || undefined });
        setSelectedChild('');
      }
    } catch (err: unknown) {
      void err; // toast shown by mutation onError
    }
  };

  const isSending = sendMessage.isPending || create.isPending;
  const isLoading = convsLoading || msgsLoading;
  const hasMessages = !!(conversation && messages.length > 0);

  return (
    <ChatView
      onBack={onBack}
      headerIcon={<div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center"><School className="w-4 h-4 text-indigo-600" /></div>}
      headerTitle="إدارة المدرسة"
      headerSubtitle="سيتم الرد عليك في أقرب وقت"
    >
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 md:px-16 lg:px-24 py-4 bg-slate-50/30">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : !hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-indigo-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">ابدأ المحادثة مع إدارة المدرسة</p>
            <p className="text-xs text-slate-400">اكتب رسالتك في الأسفل</p>
          </div>
        ) : (
          <div className="max-w-[720px] mx-auto">
            {/* زر تحميل الرسائل الأقدم */}
            {hasPreviousPage && (
              <div className="flex justify-center mb-3">
                <button
                  onClick={() => fetchPreviousPage()}
                  disabled={isFetchingPreviousPage}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-indigo-500 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-100 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isFetchingPreviousPage
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : '↑'
                  }
                  رسائل أقدم
                </button>
              </div>
            )}
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showDate = i === 0 || (prev && new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString());
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="bg-white/80 text-[10px] font-bold text-slate-400 px-3 py-1 rounded-full shadow-sm border border-slate-100">
                        {dateSeparator(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <Bubble content={msg.content} isMe={msg.sender_id === user?.id} time={msg.created_at} />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 sm:px-8 md:px-16 lg:px-24 py-3 bg-white border-t border-slate-100">
        <div className="max-w-[720px] mx-auto space-y-2">
          {!conversation && (children as any[]).length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">بخصوص</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setSelectedChild('')}
                  className={cn('px-3 py-1 rounded-xl text-xs font-bold border transition-all',
                    !selectedChild ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-100')}>
                  عام
                </button>
                {(children as any[]).map((c: any) => (
                  <button key={c.id} type="button" onClick={() => setSelectedChild(c.id)}
                    className={cn('px-3 py-1 rounded-xl text-xs font-bold border transition-all',
                      selectedChild === c.id ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-100')}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="اكتب رسالتك..."
              rows={1}
              className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-300 text-sm font-medium px-4 py-3 outline-none transition-all"
            />
            <Button onClick={handleSend} disabled={!text.trim() || isSending} size="icon"
              className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shrink-0 disabled:opacity-40">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -rotate-45" />}
            </Button>
          </div>
        </div>
      </div>
    </ChatView>
  );
}



// ─── Chat Card — action card style ───────────────────────────────────────────

function ChatCard({
  icon, title, desc, color, badge, onClick, disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: 'indigo' | 'emerald';
  badge?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', hover: 'hover:border-indigo-300 hover:shadow-indigo-100/80' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', hover: 'hover:border-emerald-300 hover:shadow-emerald-100/80' },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group text-right p-6 rounded-[28px] bg-white border transition-all duration-300 hover:shadow-xl active:scale-[0.98] flex flex-col gap-4 relative',
        c.border, c.hover,
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      {/* Badge */}
      {!!badge && badge > 0 && (
        <span className="absolute top-4 left-4 w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
          {badge}
        </span>
      )}

      <div className="flex items-center justify-between">
        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110', c.bg)}>
          {icon}
        </div>
        <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
      </div>

      <div>
        <h3 className="font-black text-slate-900 text-base">{title}</h3>
        <p className="text-xs text-slate-400 font-bold mt-1 leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ActiveView = { type: 'none' } | { type: 'admin' };

export default function ParentConversationsPage() {
  const [active, setActive] = useState<ActiveView>({ type: 'none' });
  const [openingClassId, setOpeningClassId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: conversations = [] } = useParentConversations();
  const { data: classRooms = [], isLoading: roomsLoading } = useParentClassChatRooms();
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const { data: classChatUnread = {} } = useClassChatUnreadCounts();
  const ensureRoom = useEnsureClassChatRoom();

  const adminConv = conversations[0] ?? null;
  const adminUnread = adminConv?.unread_by_parent || 0;

  // بناء قائمة الفصول من الأبناء — بيضمن ظهور الفصل حتى لو الغرفة ما أُنشئت بعد
  const classEntries = (children as any[])
    .filter((c: any) => c.class_id || c.classId)
    .reduce<{ classId: string; className: string }[]>((acc, c) => {
      const classId = c.class_id || c.classId;
      const className = c.className || c.class_name || 'الفصل';
      if (!acc.find(e => e.classId === classId)) acc.push({ classId, className });
      return acc;
    }, []);

  const handleOpenClass = async (classId: string, className: string) => {
    // لو الغرفة موجودة في الكاش — navigate مباشرة
    const existing = classRooms.find(r => r.class_id === classId);
    if (existing) {
      navigate(`/conversations/class/${existing.id}`);
      return;
    }
    // إلا كدا ensureRoom ثم navigate
    setOpeningClassId(classId);
    try {
      const room = await ensureRoom.mutateAsync({ classId, className });
      navigate(`/conversations/class/${room.id}`);
    } catch (err: unknown) {
      void err; // toast shown by mutation onError
    } finally {
      setOpeningClassId(null);
    }
  };

  // ── Admin chat screen — full page ──
  if (active.type === 'admin') {
    return <AdminChatView onBack={() => setActive({ type: 'none' })} />;
  }

  const isLoadingClasses = roomsLoading || childrenLoading;

  // ── Cards landing ──
  return (
    <AppLayout>
      <div className="max-w-[900px] mx-auto pb-20 px-4 md:px-0 animate-in fade-in duration-500" dir="rtl">
        <div className="pb-6">
          <PageHeader
            icon={MessageCircle}
            title="التواصل"
            subtitle="رسائلك مع المدرسة ودردشة الفصول"
          />
        </div>

        {/* Section: Admin */}
        <section className="mb-8">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
            التواصل مع المدرسة
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ChatCard
              icon={<School className="w-6 h-6 text-indigo-600" />}
              title="التواصل مع الإدارة"
              desc={adminConv?.last_message_preview || 'محادثة خاصة مع إدارة المدرسة'}
              color="indigo"
              badge={adminUnread}
              onClick={() => setActive({ type: 'admin' })}
            />
          </div>
        </section>

        {/* Section: Class Rooms */}
        <section>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
            دردشة الفصول
          </p>
          {isLoadingClasses ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : classEntries.length === 0 ? (
            <div className="text-center py-10 text-sm font-bold text-slate-400 bg-white rounded-[28px] border border-slate-100">
              لا يوجد أبناء مرتبطون بفصول حالياً
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {classEntries.map(({ classId, className }) => {
                const room = classRooms.find(r => r.class_id === classId);
                const unread = room ? (classChatUnread[room.id] || 0) : 0;
                const isOpening = openingClassId === classId;
                return (
                  <ChatCard
                    key={classId}
                    icon={
                      isOpening
                        ? <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                        : <Users className="w-6 h-6 text-emerald-600" />
                    }
                    title={className}
                    desc="دردشة أولياء الأمور"
                    color="emerald"
                    badge={unread}
                    onClick={() => handleOpenClass(classId, className)}
                    disabled={isOpening || ensureRoom.isPending}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
