import { useDeliveryStatus } from '@/hooks/useDeliveryStatus';

interface DeliveryStatusBadgeProps {
  notificationId: string;
  isPrivileged: boolean;
}

export function DeliveryStatusBadge({ notificationId, isPrivileged }: DeliveryStatusBadgeProps) {
  const { data: status } = useDeliveryStatus(notificationId);

  // Badge visibility rule:
  // show ⟺ isPrivileged=true AND no_device_registered=true AND has_active_subscription=false AND temporary_outage=false
  if (
    !isPrivileged ||
    !status ||
    !status.no_device_registered ||
    status.has_active_subscription ||
    status.temporary_outage
  ) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
      title="لم يفعّل المستلم الإشعارات"
    >
      <span>⚠</span>
      <span>لم يفعّل المستلم الإشعارات</span>
    </span>
  );
}

export default DeliveryStatusBadge;
