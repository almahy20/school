import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Send, Loader2, School, MessageCircle,
} from 'lucide-react';
import {
  useParentConversations,
  useConversationMessages,
  useCreateConversation,
  useSendConversationMessage,
  useMarkConversationRead,
} from '@/hooks/queries/useConversations';
import { useParentChildren } from '@/hooks/queries';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateSeparator(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ content, isMe, time }: { content: string; isMe: boolean; time: string }) {
  return (
    <div className={cn('flex mb-2', isMe ? 'justify-start' : 'justify-end')}>
      <div className={cn(
        'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
        isMe
          ? 'bg-indigo-600 text-white rounded-br-md'
          : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-md'
      )}>
        <p className="whitespace-pre-wrap break-words mb-1">{content}</p>
        <span className={cn('text-[10px] leading-none', isMe ? 'text-indigo-100' : 'text-slate-400')}>
          {new Date(time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ParentConversationsPage() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [selectedChild, setSelectedChild] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: convsLoading } = useParentConversations();
  const { data: children = [] } = useParentChildren();
  
  // Get the first (or only) conversation
  const conversation = conversations[0] ?? null;

  const { data: messages = [], isLoading: msgsLoading } = useConversationMessages(conversation?.id ?? null);
  const sendMessage = useSendConversationMessage();
  const markRead = useMarkConversationRead();
  const create = useCreateConversation();

  // Mark as read
  useEffect(() => {
    if (conversation && conversation.unread_by_parent > 0) {
      markRead.mutate({ conversationId: conversation.id, asRole: 'parent' });
    }
  }, [conversation?.id]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const t = text.trim();
    if (!t) return;

    setText('');

    try {
      if (conversation) {
        // Send to existing conversation
        await sendMessage.mutateAsync({ conversationId: conversation.id, content: t });
      } else {
        // Create new conversation
        const subject = t.length > 60 ? t.slice(0, 60) + '…' : t;
        await create.mutateAsync({ subject, firstMessage: t, studentId: selectedChild || undefined });
        setSelectedChild('');
      }
    } catch (_) {}
  };

  const isSending = sendMessage.isPending || create.isPending;

  return (
    <AppLayout>
      <div
        className="h-[calc(100vh-5rem)] max-w-[900px] mx-auto flex flex-col rounded-2xl overflow-hidden border border-slate-100 shadow-lg bg-white mx-4 md:mx-0"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <School className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">إدارة المدرسة</p>
            <p className="text-xs text-slate-500">سيتم الرد عليك في أقرب وقت</p>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/30">
          {convsLoading || msgsLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !conversation || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-indigo-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">ابدأ المحادثة مع إدارة المدرسة</p>
              <p className="text-xs text-slate-400">اكتب رسالتك في الأسفل وسنرد عليك</p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => {
                const prev = messages[i - 1];
                const showDate = i === 0 || (prev &&
                  new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString());
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="bg-white/80 text-[10px] font-bold text-slate-400 px-3 py-1 rounded-full shadow-sm border border-slate-100">
                          {dateSeparator(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <Bubble content={msg.content} isMe={isMe} time={msg.created_at} />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0">
          {/* Child selector (only when no conversation yet) */}
          {!conversation && children.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">بخصوص (اختياري)</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedChild('')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                    !selectedChild
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                      : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'
                  )}
                >
                  عام
                </button>
                {children.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChild(c.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                      selectedChild === c.id
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message input */}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder={conversation ? "اكتب رسالتك..." : "اكتب رسالتك لإدارة المدرسة..."}
              rows={1}
              className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-2xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium px-4 py-3 transition-all"
            />
            <Button
              onClick={handleSend}
              disabled={!text.trim() || isSending}
              size="icon"
              className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shrink-0 disabled:opacity-40"
            >
              {isSending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4 -rotate-45" />
              }
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
