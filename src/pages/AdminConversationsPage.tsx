import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MessageSquare, Clock, CheckCircle2, AlertCircle, Loader2,
  Search, User, XCircle, Users2, ChevronLeft,
  Megaphone, Send, ShieldCheck, Users, School,
} from 'lucide-react';
import {
  useAdminConversations,
  useUnreadConversationsCount,
  type Conversation,
  type ConversationStatus,
} from '@/hooks/queries/useConversations';
import {
  useAdminClassChatRooms,
} from '@/hooks/queries/useClassChat';
import { useProfiles, useSendMessage, useBranding } from '@/hooks/queries';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/layout/PageHeader';
import { QueryStateHandler } from '@/components/QueryStateHandler';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'conversations' | 'class-chat' | 'broadcast';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string; icon: React.ElementType }> = {
  open:        { label: 'جديدة',         color: 'bg-rose-50 text-rose-600',       icon: AlertCircle  },
  in_progress: { label: 'قيد المتابعة',  color: 'bg-amber-50 text-amber-600',     icon: Clock        },
  resolved:    { label: 'تم الحل',       color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  closed:      { label: 'مغلقة',         color: 'bg-slate-100 text-slate-500',    icon: XCircle      },
};

const FILTERS = [
  { value: 'all',         label: 'الكل'          },
  { value: 'open',        label: 'جديدة'         },
  { value: 'in_progress', label: 'قيد المتابعة' },
  { value: 'resolved',    label: 'تم الحل'      },
  { value: 'closed',      label: 'مغلقة'        },
];

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({ conv, onClick }: { conv: Conversation; onClick: () => void }) {
  const cfg = STATUS_CONFIG[conv.status];
  const StatusIcon = cfg.icon;
  const hasUnread = conv.unread_by_admin > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-right px-5 py-4 flex items-center gap-4 transition-all border-b border-slate-50 last:border-0 hover:bg-slate-50/70 group"
    >
      <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-sm shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
        {conv.parent_name?.[0] ?? <User className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={cn('text-sm truncate', hasUnread ? 'font-black text-slate-900' : 'font-semibold text-slate-700')}>
            {conv.parent_name}
          </p>
          <span className="text-[9px] text-slate-400 shrink-0 font-medium">
            {new Date(conv.last_message_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 truncate font-medium mb-1">{conv.subject}</p>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-400 truncate font-medium flex-1">
            {conv.last_message_preview || '—'}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {conv.student_name && (
              <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-lg">
                {conv.student_name}
              </span>
            )}
            <Badge className={cn('px-1.5 py-0 rounded-full text-[9px] font-bold border-none flex items-center gap-0.5', cfg.color)}>
              <StatusIcon className="w-2.5 h-2.5" />
              {cfg.label}
            </Badge>
            {hasUnread && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {conv.unread_by_admin}
              </span>
            )}
          </div>
        </div>
      </div>

      <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
    </button>
  );
}

// ─── Conversations Tab ────────────────────────────────────────────────────────

function ConversationsTab() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: conversations = [], isLoading, error, refetch } = useAdminConversations(filter, debouncedSearch);
  const { data: unreadCount = 0 } = useUnreadConversationsCount();

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم ولي الأمر أو موضوع الرسالة..."
            className="h-11 pr-10 rounded-2xl border-slate-100 bg-slate-50 text-sm font-medium focus:bg-white"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shrink-0',
                  filter === f.value
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
              {conversations.length} محادثة
            </span>
            {unreadCount > 0 && (
              <Badge className="bg-rose-500/10 text-rose-600 font-black text-[9px] border-none px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {unreadCount} جديدة
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <QueryStateHandler
          loading={isLoading} error={error} data={conversations}
          onRetry={refetch} isEmpty={false}
          loadingMessage="جاري التحميل..." emptyMessage=""
        >
          {conversations.map(conv => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              onClick={() => navigate(`/manage-conversations/${conv.id}`)}
            />
          ))}
        </QueryStateHandler>

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Users2 className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-500">
              {search ? 'لم نجد نتائج' : 'لا توجد رسائل بعد'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Broadcast Tab ────────────────────────────────────────────────────────────

function BroadcastTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: branding } = useBranding();

  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: profilesData, isLoading: profilesLoading, error: profilesError, refetch: refetchProfiles } =
    useProfiles(debouncedSearch, 1, 50);
  const profiles = profilesData?.data || [];

  const { data: allProfilesCache } = useQuery({
    queryKey: ['all-profiles', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('school_id', user.schoolId)
        .neq('id', user.id);
      return (data || []).map((p: any) => p.id);
    },
    enabled: !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

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
      const targets: string[] = targetType === 'all'
        ? (allProfilesCache || [])
        : [selectedProfileId];

      if (targetType === 'all' && targets.length === 0) {
        toast({ title: 'تنبيه', description: 'لا يوجد مستخدمين آخرين', variant: 'destructive' });
        return;
      }

      await sendMessageMutation.mutateAsync({ targets, content: content.trim() });

      toast({
        title: 'تم الإرسال بنجاح',
        description: targetType === 'all'
          ? `تم إرسال الرسالة لـ ${targets.length} مستخدم`
          : 'تم إرسال الرسالة للمستخدم المختار',
      });
      setContent('');
      setSelectedProfileId('');
    } catch (err: any) {
      toast({ title: 'خطأ في الإرسال', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">إرسال تحديث رسمي</h2>
            <Badge variant="outline" className="mt-1 rounded-lg bg-indigo-50/50 border-indigo-100 text-indigo-600 font-black text-[9px] uppercase tracking-widest px-3">
              بث من {branding?.name}
            </Badge>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex p-1.5 bg-slate-100/60 rounded-2xl w-fit shrink-0">
          <button
            onClick={() => setTargetType('all')}
            className={cn('px-5 py-2 rounded-xl text-xs font-black transition-all',
              targetType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600')}
          >
            بث للجميع
          </button>
          <button
            onClick={() => setTargetType('specific')}
            className={cn('px-5 py-2 rounded-xl text-xs font-black transition-all',
              targetType === 'specific' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600')}
          >
            رسالة خاصة
          </button>
        </div>
      </div>

      {/* User selector */}
      {targetType === 'specific' && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اختر المستخدم</label>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <Input
              placeholder="ابحث باسم المستخدم..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-11 pr-10 rounded-2xl bg-slate-50 border-slate-100 font-medium text-sm focus:bg-white"
            />
          </div>

          <QueryStateHandler
            loading={profilesLoading} error={profilesError} data={profiles}
            onRetry={refetchProfiles} isEmpty={profiles.length === 0}
            loadingMessage="جاري جلب القائمة..." emptyMessage="لم يتم العثور على مستخدمين."
          >
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-100 scrollbar-hide">
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all',
                    selectedProfileId === p.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-100'
                  )}
                >
                  <User className={cn('w-3.5 h-3.5', selectedProfileId === p.id ? 'text-white' : 'text-slate-300')} />
                  {p.full_name}
                </button>
              ))}
            </div>
          </QueryStateHandler>
        </div>
      )}

      {/* Message textarea */}
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نص الرسالة</label>
        <Textarea
          placeholder="اكتب رسالتك هنا..."
          value={content}
          onChange={e => setContent(e.target.value)}
          className="min-h-[180px] p-5 rounded-2xl bg-slate-50 border-slate-100 text-base font-medium leading-relaxed focus:bg-white transition-all resize-none"
        />
      </div>

      {/* Send */}
      <div className="flex justify-end">
        <Button
          onClick={handleSend}
          disabled={sendMessageMutation.isPending}
          className="h-12 px-8 rounded-2xl bg-slate-900 text-white font-black gap-3 hover:bg-slate-800 transition-all"
        >
          {sendMessageMutation.isPending ? 'جاري الإرسال...' : (
            <>
              إرسال الآن
              <Send className="w-4 h-4 rotate-180" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Class Chat Tab ───────────────────────────────────────────────────────────

function ClassChatTab() {
  const navigate = useNavigate();
  const { data: rooms = [], isLoading } = useAdminClassChatRooms();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Users className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-black text-slate-500">لا توجد غرف دردشة بعد</p>
        <p className="text-xs text-slate-400 max-w-xs">ستظهر الغرف تلقائياً عندما يبدأ أولياء الأمور التحدث في فصولهم</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Count header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          غرف الفصول
        </p>
        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-xl">
          {rooms.length} غرفة
        </span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => navigate(`/manage-conversations/class/${room.id}`)}
            className="group text-right p-5 rounded-[24px] bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50/60 transition-all duration-300 active:scale-[0.98] flex flex-col gap-4"
          >
            {/* Icon + arrow */}
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>

            {/* Name */}
            <div>
              <h3 className="font-black text-slate-900 text-sm leading-snug">
                {room.class_name || room.name}
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-1">
                دردشة أولياء الأمور
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminConversationsPage() {
  const [tab, setTab] = useState<Tab>('conversations');
  const { data: unreadCount = 0 } = useUnreadConversationsCount();

  return (
    <AppLayout>
      <div
        className={cn(
          'max-w-[900px] mx-auto animate-in fade-in duration-500 px-4 md:px-0',
          tab === 'class-chat' ? '' : 'pb-20',
        )}
        dir="rtl"
      >

        {/* Page header */}
        <div className="pb-4">
          <PageHeader
            icon={MessageSquare}
            title="مركز الرسائل"
            subtitle="رسائل أولياء الأمور وبث التحديثات الرسمية"
          />
        </div>

        {/* Tab switcher */}
        <div className="flex p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 w-fit">
          <button
            onClick={() => setTab('conversations')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all',
              tab === 'conversations' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700',
            )}
          >
            <MessageSquare className="w-4 h-4" />
            رسائل أولياء الأمور
            {unreadCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('class-chat')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all',
              tab === 'class-chat' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700',
            )}
          >
            <Users className="w-4 h-4" />
            دردشة الفصول
          </button>
          <button
            onClick={() => setTab('broadcast')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all',
              tab === 'broadcast' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700',
            )}
          >
            <Megaphone className="w-4 h-4" />
            بث رسالة
          </button>
        </div>

        {/* Tab content */}
        {tab === 'conversations' && <ConversationsTab />}
        {tab === 'class-chat' && <ClassChatTab />}
        {tab === 'broadcast' && <BroadcastTab />}
      </div>
    </AppLayout>
  );
}
