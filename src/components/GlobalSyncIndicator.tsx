import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export default function GlobalSyncIndicator() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isBusy = isFetching > 0 || isMutating > 0;

  if (!isBusy) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-[9999] pointer-events-none overflow-hidden bg-transparent"
      role="progressbar"
      aria-label="جاري مزامنة البيانات"
    >
      <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 animate-[shimmer_1.5s_infinite] origin-left shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
    </div>
  );
}

