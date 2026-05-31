import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/queries';
import { MessageSquare, Search, User, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function ParentMessagesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const { data: messages = [], isLoading, error, refetch } = useMessages();

  // Only show messages received by this parent (not sent)
  const receivedMessages = (messages as any[]).filter(
    (m: any) => m.receiver_id === user?.id
  );

  const filtered = receivedMessages.filter((m: any) =>
    (m.sender?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.content || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div
        className="flex flex-col gap-8 max-w-[800px] mx-auto text-right pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700"
        dir="rtl"
      >
        {/* Header */}
        <header className="flex flex-col gap-4 bg-white/60 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-xl shrink-0">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">رسائلي</h1>
              <p className="text-slate-500 font-medium text-sm mt-1">
                الرسائل الواردة من المدرسة والمعلمين
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="ابحث في الرسائل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 pr-12 rounded-2xl bg-white border-slate-100 font-medium"
            />
          </div>
        </header>

        {/* Messages List */}
        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={receivedMessages}
          onRetry={refetch}
          loadingMessage="جاري تحميل الرسائل..."
          emptyMessage="لا توجد رسائل واردة حتى الآن"
          isEmpty={filtered.length === 0}
        >
          <div className="flex flex-col gap-4">
            {filtered.map((msg: any) => (
              <MessageCard key={msg.id} message={msg} />
            ))}
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

function MessageCard({ message }: { message: any }) {
  const [expanded, setExpanded] = useState(false);
  const senderName = message.sender?.full_name || 'المدرسة';
  const isLong = (message.content || '').length > 150;

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(message.created_at), {
        addSuffix: true,
        locale: ar,
      });
    } catch {
      return '';
    }
  })();

  return (
    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow">
      {/* Sender + time */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-base shrink-0">
            {senderName.charAt(0)}
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm leading-tight">{senderName}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              إدارة المدرسة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{timeAgo}</span>
        </div>
      </div>

      {/* Message content */}
      <div className="bg-slate-50 rounded-2xl p-5">
        <p className="text-slate-700 font-medium text-sm leading-relaxed whitespace-pre-wrap">
          {isLong && !expanded
            ? message.content.substring(0, 150) + '...'
            : message.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-indigo-600 font-black text-xs hover:underline"
          >
            {expanded ? 'عرض أقل' : 'عرض المزيد'}
          </button>
        )}
      </div>

      {/* Unread badge */}
      {!message.is_read && (
        <div className="flex justify-end">
          <Badge className="bg-indigo-100 text-indigo-700 font-black text-[9px] uppercase tracking-widest px-3">
            جديد
          </Badge>
        </div>
      )}
    </div>
  );
}
