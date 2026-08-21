import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  Send, ChevronRight, Clock, CheckCircle2, AlertCircle,
  Loader2, User, School, XCircle, Trash2, MessageCircle,
  Phone,
} from 'lucide-react';
import {
  useAdminConversations,
  useConversationMessages,
  useSendConversationMessage,
  useMarkConversationRead,
  useDeleteConversationMessage,
  type ConversationStatus,
} from '@/hooks/queries/useConversations';
import { formatDisplayDate } from '@/lib/date-utils';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string; icon: React.ElementType }> = {
  open:        { label: 'جديدة',         color: 'bg-rose-50 text-rose-600',       icon: AlertCircle  },
  in_progress: { label: 'قيد المتابعة',  color: 'bg-amber-50 text-amber-600',     icon: Clock        },
  resolved:    { label: 'تم الحل',       color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  closed:      { label: 'مغلقة',         color: 'bg-slate-100 text-slate-500',    icon: XCircle      },
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onDelete }: {
  msg: {
    id: string; sender_role: string; sender_name?: string;
    content: string; is_read: boolean; created_at: string;
  };
  onDelete?: (id: string) => void;
}) {
  const isAdminMsg = msg.sender_role === 'admin' || msg.sender_role === 'teacher';
  const [hover, setHover] = useState(false);

  return (
    <div
      className={cn('flex items-end gap-2 mb-3 group', isAdminMsg ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5',
        isAdminMsg ? 'bg-indigo-100' : 'bg-slate-100'
      )}>
        {isAdminMsg
          ? <School className="w-4 h-4 text-indigo-600" />
          : <User className="w-4 h-4 text-slate-500" />
        }
      </div>

      <div className={cn('max-w-[72%] flex flex-col gap-1', isAdminMsg ? 'items-end' : 'items-start')}>
        {/* Sender name */}
        <span className="text-[10px] font-bold text-slate-400 px-1">
          {isAdminMsg
            ? `الإدارة${msg.sender_name ? ` — ${msg.sender_name}` : ''}`
            : (msg.sender_name || 'ولي أمر')}
        </span>

        <div className="flex items-end gap-1.5">
          {/* Delete button (admin only, on hover) */}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className={cn(
                  'p-1 rounded-lg text-slate-300 hover:text-rose-400 transition-all',
                  hover ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl" dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-right font-black">حذف الرسالة</AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    هل أنت متأكد من حذف هذه الرسالة؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogAction
                    onClick={() => onDelete(msg.id)}
                    className="bg-rose-500 hover:bg-rose-600 rounded-xl font-black"
                  >
                    حذف
                  </AlertDialogAction>
                  <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Bubble */}
          <div className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
            isAdminMsg
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'
          )}>
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
        </div>

        {/* Time + read */}
        <div className={cn('flex items-center gap-1 px-1', isAdminMsg ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[9px] text-slate-400">
            {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isAdminMsg && (
            <CheckCircle2 className={cn('w-3 h-3', msg.is_read ? 'text-emerald-400' : 'text-slate-300')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load all conversations to find the one we need
  const { data: conversations = [], isLoading: convsLoading } = useAdminConversations('all', '');
  const conversation = conversations.find(c => c.id === id) ?? null;

  const { data: messages = [], isLoading: msgsLoading } = useConversationMessages(id ?? null);
  const sendMessage = useSendConversationMessage();
  const markRead = useMarkConversationRead();
  const deleteMessage = useDeleteConversationMessage();

  // Mark as read on open
  useEffect(() => {
    if (conversation && conversation.unread_by_admin > 0) {
      markRead.mutate({ conversationId: conversation.id, asRole: 'admin' });
    }
  }, [conversation?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const t = text.trim();
    if (!t || sendMessage.isPending || !id) return;
    setText('');
    try { await sendMessage.mutateAsync({ conversationId: id, content: t }); }
    catch (_) {}
  };

  // ── Loading state ──
  if (convsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      </AppLayout>
    );
  }

  // ── Not found ──
  if (!conversation) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4" dir="rtl">
          <MessageCircle className="w-12 h-12 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">لم يتم العثور على المحادثة</p>
          <Button variant="outline" onClick={() => navigate('/manage-conversations')} className="rounded-2xl font-bold text-sm">
            العودة للقائمة
          </Button>
        </div>
      </AppLayout>
    );
  }

  const cfg = STATUS_CONFIG[conversation.status];
  const StatusIcon = cfg.icon;

  return (
    <AppLayout>
      <div
        className="h-[calc(100vh-5rem)] max-w-[860px] mx-auto flex flex-col animate-in fade-in duration-400 px-4 md:px-0"
        dir="rtl"
      >
        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 py-3 shrink-0">
          <button
            onClick={() => navigate('/manage-conversations')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Sender info */}
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-sm shrink-0">
            {conversation.parent_name?.[0] ?? <User className="w-4 h-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-black text-slate-900 leading-none">{conversation.parent_name}</p>
              {conversation.parent_phone && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                  <Phone className="w-3 h-3" />
                  {conversation.parent_phone}
                </span>
              )}
              {conversation.student_name && (
                <Badge className="px-2 py-0.5 rounded-xl bg-indigo-50 text-indigo-600 text-[9px] font-black border-none">
                  {conversation.student_name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn('px-1.5 py-0 rounded-full text-[9px] font-bold border-none flex items-center gap-0.5', cfg.color)}>
                <StatusIcon className="w-2.5 h-2.5" />
                {cfg.label}
              </Badge>
              <span className="text-[10px] text-slate-400 font-medium truncate">{conversation.subject}</span>
            </div>
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="flex-1 min-h-0 rounded-3xl border border-slate-100 bg-white shadow-xl overflow-hidden flex flex-col mb-4">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50/30">
            {msgsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <MessageCircle className="w-10 h-10 text-slate-200" />
                <p className="text-sm font-bold text-slate-400">لا توجد رسائل بعد</p>
              </div>
            ) : (
              <>
                {/* Date separator — first message */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[9px] font-bold text-slate-400 px-2">
                    {formatDisplayDate(messages[0].created_at, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {messages.map((msg, i) => {
                  const prev = messages[i - 1];
                  const showDate = i > 0 && prev &&
                    new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center gap-3 my-3">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="text-[9px] font-bold text-slate-400 px-2">
                            {new Date(msg.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}
                          </span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>
                      )}
                      <MessageBubble
                        msg={msg}
                        onDelete={(msgId) => deleteMessage.mutate(msgId)}
                      />
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          {conversation.status !== 'closed' ? (
            <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="اكتب ردك هنا..."
                  rows={1}
                  className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-2xl border-slate-100 bg-slate-50 focus:bg-white text-sm font-medium px-4 py-3 transition-all"
                />
                <Button
                  onClick={handleSend}
                  disabled={!text.trim() || sendMessage.isPending}
                  size="icon"
                  className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shrink-0 disabled:opacity-40"
                >
                  {sendMessage.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4 -rotate-45" />
                  }
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center shrink-0">
              <p className="text-xs font-bold text-slate-400">تم إغلاق هذه المحادثة</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
