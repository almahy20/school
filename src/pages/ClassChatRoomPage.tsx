import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Loader2, Users, ArrowRight } from 'lucide-react';
import {
  useClassChatMessages,
  useEnsureClassChatRoom,
  useSendClassChatMessage,
  useMarkClassChatRoomRead,
  useParentClassChatRooms,
  useAdminClassChatRooms,
} from '@/hooks/queries/useClassChat';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateSeparator(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({
  content, isMe, time, senderName, showName,
}: {
  content: string;
  isMe: boolean;
  time: string;
  senderName?: string;
  showName?: boolean;
}) {
  return (
    <div className={cn('flex mb-1.5', isMe ? 'justify-start' : 'justify-end')}>
      <div className="max-w-[75%]">
        {showName && senderName && !isMe && (
          <p className="text-[10px] font-black text-slate-400 mb-1 px-1 text-left">
            {senderName}
          </p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassChatRoomPage() {
  const { roomId, classId, className: classNameParam } = useParams<{
    roomId?: string;
    classId?: string;
    className?: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(roomId ?? null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const charCount = text.length;
  const overLimit = charCount > 500;

  const isParent = user?.role === 'parent';
  const isAdmin  = user?.role === 'admin' || user?.role === 'teacher';

  // Hook results — always called
  const { data: parentRooms = [] } = useParentClassChatRooms();
  const { data: adminRooms  = [] } = useAdminClassChatRooms();
  const ensureRoom = useEnsureClassChatRoom();

  // جلب الرسائل باستخدام الـ roomId المحلول
  const { data: messages = [], isLoading: msgsLoading } = useClassChatMessages(resolvedRoomId);
  const sendMsg = useSendClassChatMessage();
  const markRead = useMarkClassChatRoomRead();

  // إذا جاء classId بدلاً من roomId — نحتاج نعمل ensure room أولاً
  useEffect(() => {
    if (resolvedRoomId) return;
    if (!classId) return;

    const decodedName = classNameParam ? decodeURIComponent(classNameParam) : 'الفصل';

    // ابحث في الـ rooms المجلوبة أولاً
    const allRooms = isParent ? parentRooms : adminRooms;
    const existing = allRooms.find(r => r.class_id === classId);
    if (existing) {
      setResolvedRoomId(existing.id);
      return;
    }

    // إنشاء/جلب الغرفة
    ensureRoom.mutateAsync({ classId, className: decodedName })
      .then(room => setResolvedRoomId(room.id))
      .catch(() => {});
  }, [classId, parentRooms.length, adminRooms.length, resolvedRoomId]);

  // تعليم كمقروء عند فتح الغرفة
  useEffect(() => {
    if (resolvedRoomId) markRead.mutate(resolvedRoomId);
  }, [resolvedRoomId]);

  // scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // اسم الغرفة من الكاش
  const allRooms = isParent ? parentRooms : adminRooms;
  const currentRoom = resolvedRoomId
    ? allRooms.find(r => r.id === resolvedRoomId)
    : classId
    ? allRooms.find(r => r.class_id === classId)
    : null;

  const roomName = currentRoom?.class_name
    || currentRoom?.name
    || (classNameParam ? decodeURIComponent(classNameParam) : 'دردشة الفصل');

  const handleSend = async () => {
    const t = text.trim();
    if (!t || !resolvedRoomId || overLimit) return;
    setText('');
    try { await sendMsg.mutateAsync({ roomId: resolvedRoomId, content: t }); }
    catch (_) {}
  };

  const isInitializing = !resolvedRoomId || ensureRoom.isPending;

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
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors shrink-0"
            aria-label="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">{roomName}</p>
            <p className="text-[10px] text-slate-400 font-medium">دردشة أولياء الأمور</p>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 md:px-16 lg:px-24 py-4 bg-slate-50/30">
          {isInitializing || msgsLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">لا توجد رسائل بعد</p>
              <p className="text-xs text-slate-400">كن أول من يبدأ المحادثة</p>
            </div>
          ) : (
            <div className="max-w-[720px] mx-auto">
              {messages.map((msg, i) => {
                const prev = messages[i - 1];
                const showDate =
                  i === 0 ||
                  (prev &&
                    new Date(msg.created_at).toDateString() !==
                    new Date(prev.created_at).toDateString());
                const isMe = msg.sender_id === user?.id;
                const showName = !isMe && prev?.sender_id !== msg.sender_id;
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="bg-white/80 text-[10px] font-bold text-slate-400 px-3 py-1 rounded-full shadow-sm border border-slate-100">
                          {dateSeparator(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <Bubble
                      content={msg.content}
                      isMe={isMe}
                      time={msg.created_at}
                      senderName={msg.sender_name || 'ولي أمر'}
                      showName={showName}
                    />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 sm:px-8 md:px-16 lg:px-24 py-3 bg-white border-t border-slate-100">
          <div className="max-w-[720px] mx-auto space-y-1">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="اكتب رسالتك... (حد أقصى 500 حرف)"
                rows={1}
                maxLength={520}
                disabled={isInitializing}
                className={cn(
                  'flex-1 min-h-[44px] max-h-[120px] resize-none rounded-2xl bg-slate-50 text-sm font-medium px-4 py-3 outline-none border transition-all focus:bg-white',
                  overLimit
                    ? 'border-rose-300 focus:border-rose-400'
                    : 'border-slate-200 focus:border-emerald-300',
                  isInitializing && 'opacity-50 cursor-not-allowed',
                )}
              />
              <Button
                onClick={handleSend}
                disabled={!text.trim() || overLimit || sendMsg.isPending || isInitializing}
                size="icon"
                className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shrink-0 disabled:opacity-40"
              >
                {sendMsg.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4 -rotate-45" />}
              </Button>
            </div>
            {charCount > 400 && (
              <p className={cn('text-[9px] font-black text-left px-1', overLimit ? 'text-rose-500' : 'text-slate-400')}>
                {charCount}/500
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
