import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryStatus {
  sent_count: number;
  has_active_subscription: boolean;
  no_device_registered: boolean;
  temporary_outage: boolean;
}

export function useDeliveryStatus(notificationId: string | null | undefined) {
  return useQuery<DeliveryStatus | null>({
    queryKey: ['delivery-status', notificationId],
    enabled: !!notificationId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('notification_delivery_logs')
        .select('sent_count, has_active_subscription, no_device_registered, temporary_outage')
        .eq('notification_id', notificationId!)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
