import { cn } from '@/lib/utils';

interface DataCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { 
    value: number; 
    label: string;
  };
  className?: string;
  onClick?: () => void;
}

/**
 * Unified Data/Stat Card Component
 * Used for displaying metrics and statistics across dashboards
 */
export default function DataCard({ 
  title, 
  value, 
  icon, 
  trend, 
  className,
  onClick 
}: DataCardProps) {
  return (
    <div 
      className={cn(
        "bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6",
        "hover:shadow-md transition-all duration-300",
        onClick && "cursor-pointer hover:-translate-y-0.5 active:translate-y-0",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-sm text-slate-500 font-medium truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {value}
          </p>
          {trend && (
            <p className={cn(
              "text-xs font-semibold",
              trend.value >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
