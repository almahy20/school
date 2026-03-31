import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, Megaphone, X } from 'lucide-react';

export function GlobalAnnouncement() {
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState<{ id: string; content: string; sender_name: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    // 1. Initial Check for unread messages from 'admin'
    const fetchLatest = async () => {
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          profiles!messages_sender_id_fkey (full_name)
        `)
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (messages && messages.length > 0) {
        const msg = messages[0];
        setAnnouncement({
          id: msg.id,
          content: msg.content,
          sender_name: (msg.profiles as any)?.full_name || 'الإدارة',
        });
        setIsOpen(true);
      }
    };

    fetchLatest();

    // 2. Real-time subscription for new messages
    const channel = supabase
      .channel('admin-broadcasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new;
          if (newMsg.receiver_id === user.id) {
            // Fetch sender name
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newMsg.sender_id)
              .single();

            setAnnouncement({
              id: newMsg.id as string,
              content: newMsg.content as string,
              sender_name: profile?.full_name || 'الإدارة',
            });
            setIsOpen(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleClose = async () => {
    if (announcement) {
      // Mark as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', announcement.id);
    }
    setIsOpen(false);
    setAnnouncement(null);
  };

  if (!announcement) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[550px] border-none shadow-[0_32px_120px_rgba(15,23,42,0.3)] p-0 overflow-hidden rounded-[40px] animate-scale-in bg-white">
        <div className="bg-primary p-12 text-white relative overflow-hidden">
          <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20px] left-[-20px] w-48 h-48 bg-secondary/20 rounded-full blur-2xl" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-[32px] bg-white text-primary flex items-center justify-center mb-6 shadow-2xl animate-bounce duration-1000">
              <Megaphone className="w-10 h-10" />
            </div>
            <DialogTitle className="text-3xl font-black mb-3 italic tracking-tight leading-none">تنبيه إداري رسمي</DialogTitle>
            <div className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-[0.3em]">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              صادر عن: {announcement.sender_name}
            </div>
          </div>
        </div>
        
        <div className="p-10 text-right">
          <div className="bg-muted/30 p-8 rounded-[32px] border-2 border-muted mb-10 relative group">
            <div className="absolute -top-4 -right-4 w-10 h-10 bg-white border-2 border-muted rounded-full flex items-center justify-center text-primary/20">
              <Bell className="w-5 h-5" />
            </div>
            <p className="text-primary text-xl leading-relaxed font-black tracking-tight italic">
              "{announcement.content}"
            </p>
          </div>
          
          <button 
            onClick={handleClose}
            className="w-full h-20 rounded-[28px] bg-primary text-white text-xs font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-primary/20"
          >
            تأكيد الاستلام والإغلاق
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
