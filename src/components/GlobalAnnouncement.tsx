import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Megaphone, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { realtimeEngine } from '@/lib/RealtimeEngine';

interface AnnouncementMessage {
  id: string;
  content: string;
  sender_name: string;
}

export function GlobalAnnouncement() {
  const { user } = useAuth();
  // Message queue: all pending unread messages
  const [queue, setQueue] = useState<AnnouncementMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const markedAsReadRef = useRef<Set<string>>(new Set());

  const addToQueue = useCallback((msg: AnnouncementMessage) => {
    setQueue(prev => {
      // Avoid duplicates
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    setIsOpen(true);
  }, []);

  const handleNewMessage = useCallback(async (payload: any) => {
    const newMsg = payload.new as any;
    if (markedAsReadRef.current.has(newMsg.id)) return;

    // Fetch sender name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', newMsg.sender_id)
      .single();

    addToQueue({
      id: newMsg.id,
      content: newMsg.content,
      sender_name: profile?.full_name || 'الإدارة',
    });
  }, [addToQueue]);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch ALL unread broadcast messages on mount
    const fetchUnread = async () => {
      const { data: messages } = await supabase
        .from('messages')
        .select(`id, content, sender_id, profiles!messages_sender_id_fkey (full_name)`)
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: true }) // oldest first
        .limit(20);

      if (messages && messages.length > 0) {
        const items: AnnouncementMessage[] = messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender_name: (msg.profiles as any)?.full_name || 'الإدارة',
        }));
        setQueue(items);
        setCurrentIndex(0);
        setIsOpen(true);
      }
    };

    fetchUnread();

    // 2. Real-time for NEW messages while user is online
    const unsubscribe = realtimeEngine.subscribe(
      'messages',
      handleNewMessage,
      { event: 'INSERT', filter: `receiver_id=eq.${user.id}` }
    );

    return () => {
      unsubscribe();
    };
  }, [user, handleNewMessage]);

  const markCurrentAsRead = async (id: string) => {
    if (markedAsReadRef.current.has(id)) return;
    markedAsReadRef.current.add(id);
    await supabase.from('messages').update({ is_read: true }).eq('id', id);
  };

  const handleNext = async () => {
    const current = queue[currentIndex];
    if (current) await markCurrentAsRead(current.id);

    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // All messages read
      setIsOpen(false);
      setQueue([]);
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const currentMsg = queue[currentIndex];
  if (!currentMsg) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        // Mark current as read when closing
        if (currentMsg) markCurrentAsRead(currentMsg.id);
        setIsOpen(false);
      }
    }}>
      <DialogContent
        className="sm:max-w-[550px] border-none shadow-[0_32px_120px_rgba(15,23,42,0.3)] p-0 overflow-hidden rounded-[40px] bg-white"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
          <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-20px] left-[-20px] w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-[32px] bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/40 animate-bounce">
              <Megaphone className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight leading-none">
              تنبيه إداري رسمي
            </DialogTitle>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.25em]">
              صادر عن: {currentMsg.sender_name}
            </p>

            {/* Queue indicator if multiple messages */}
            {queue.length > 1 && (
              <div className="flex items-center gap-2 mt-1">
                {queue.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentIndex ? 'w-6 bg-indigo-400' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-10 space-y-8">
          <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-slate-100 relative">
            <div className="absolute -top-4 -right-4 w-10 h-10 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center text-slate-300">
              <Bell className="w-5 h-5" />
            </div>
            <p className="text-slate-900 text-lg leading-relaxed font-bold tracking-tight">
              "{currentMsg.content}"
            </p>
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {queue.length > 1 && currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="flex-1 h-14 rounded-[22px] bg-slate-100 text-slate-600 font-black text-xs gap-2 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
                السابقة
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex-1 h-14 rounded-[22px] bg-slate-900 text-white font-black text-xs flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-900/20"
            >
              {currentIndex < queue.length - 1 ? (
                <>
                  التالية
                  <ChevronLeft className="w-4 h-4" />
                  <span className="px-2 py-0.5 rounded-lg bg-white/10 text-white text-[9px] font-black">
                    {queue.length - currentIndex - 1} متبقية
                  </span>
                </>
              ) : (
                'تأكيد الاستلام والإغلاق'
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
