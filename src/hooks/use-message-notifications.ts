import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { realtimeEngine } from '@/lib/RealtimeEngine';

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const times = [0, 0.18];
    const freqs = [880, 1100];
    times.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freqs[i];
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.35);
    });
  } catch (_) {
    // silently fail if AudioContext not available
  }
}

function vibrate() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
  } catch (_) {
    // Vibration not supported or failed
  }
}

async function showDesktopNotification(senderName: string, content: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission === 'granted') {
    new Notification(`رسالة من ${senderName}`, {
      body: content,
      icon: '/favicon.ico',
      dir: 'rtl',
    });
  }
}

export function useMessageNotifications() {
  const { user } = useAuth();
  const location = useLocation();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const handleNewMessage = useCallback(async (payload: any) => {
    const msg = payload.new as {
      id: string;
      sender_id: string;
      receiver_id: string;
      content: string;
    };

    // Only notify if we are the receiver and NOT on the messages page
    if (msg.receiver_id !== user?.id) return;
    if (locationRef.current === '/messages') return;

    // Fetch sender name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', msg.sender_id)
      .single();

    const senderName = profile?.full_name || 'مستخدم';

    // playChime(); // Disabled sound by request
    vibrate();
    showDesktopNotification(senderName, msg.content);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = realtimeEngine.subscribe(
      'messages',
      handleNewMessage,
      { event: 'INSERT' }
    );

    return () => {
      unsubscribe();
    };
  }, [user, handleNewMessage]);
}
