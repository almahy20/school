import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function DataPagination({
  currentPage,
  totalItems,
  pageSize = 15,
  onPageChange,
  className,
}: DataPaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  // Show max 5 page buttons around current page
  const visiblePages = pages.filter(p => Math.abs(p - currentPage) <= 2);

  return (
    <div className={cn('flex items-center justify-center gap-2 py-4', className)}>
      {/* Prev Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        aria-label="الصفحة السابقة"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* First Page */}
      {visiblePages[0] > 1 && (
        <>
          <PageBtn p={1} current={currentPage} onClick={onPageChange} />
          {visiblePages[0] > 2 && (
            <span className="w-9 h-9 flex items-center justify-center text-slate-300 text-sm font-black">…</span>
          )}
        </>
      )}

      {/* Visible Pages */}
      {visiblePages.map(p => (
        <PageBtn key={p} p={p} current={currentPage} onClick={onPageChange} />
      ))}

      {/* Last Page */}
      {visiblePages[visiblePages.length - 1] < totalPages && (
        <>
          {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
            <span className="w-9 h-9 flex items-center justify-center text-slate-300 text-sm font-black">…</span>
          )}
          <PageBtn p={totalPages} current={currentPage} onClick={onPageChange} />
        </>
      )}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        aria-label="الصفحة التالية"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Summary */}
      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mr-2">
        {currentPage} / {totalPages}
      </span>
    </div>
  );
}

function PageBtn({ p, current, onClick }: { p: number; current: number; onClick: (p: number) => void }) {
  const isActive = p === current;
  return (
    <button
      onClick={() => onClick(p)}
      className={cn(
        'w-9 h-9 rounded-xl text-sm font-black transition-all shadow-sm border',
        isActive
          ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
      )}
    >
      {p}
    </button>
  );
}
