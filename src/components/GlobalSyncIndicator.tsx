import { useIsMutating } from '@tanstack/react-query';

export default function GlobalSyncIndicator() {
  const isMutating = useIsMutating();

  // ✅ مؤشر هادئ واحترافي: يظهر فقط أثناء عمليات الحفظ أو التعديل أو الحذف (Mutations)
  // ولا يظهر عند الجلب في الخلفية (Queries/Prefetch) لضمان تجربة تصفح هادئة وسلسة
  if (isMutating === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-[9999] pointer-events-none overflow-hidden bg-transparent"
      role="progressbar"
      aria-label="جاري حفظ التغييرات"
    >
      <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 animate-[shimmer_1.5s_infinite] origin-left shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
    </div>
  );
}

