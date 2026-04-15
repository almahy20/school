import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useLastSeenUpdate() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const updateLastSeen = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating last_seen:', error);
      }
    };

    // Update immediately on mount
    updateLastSeen();

    // Then every 1 minute if tab is active (was 5m)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
    }, 1 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id]);
}
