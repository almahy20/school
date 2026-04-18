import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  /** Icon bg color class, defaults to 'bg-slate-900' */
  iconColor?: string;
}

/**
 * Unified page header used across ALL listing pages.
 * Ensures consistent padding, border-radius, typography, and layout.
 */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
  iconColor = 'bg-slate-900',
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col md:flex-row md:items-center justify-between gap-6',
        'bg-white/40 backdrop-blur-md p-8 md:p-12',
        'rounded-[48px] border border-white/50 shadow-xl shadow-slate-200/10',
        'relative overflow-hidden group',
        className
      )}
    >
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="flex items-center gap-5 relative z-10">
        <div
          className={cn(
            'w-14 h-14 rounded-[22px] flex items-center justify-center text-white',
            'shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0',
            iconColor
          )}
        >
          <Icon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none mb-1">
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-500 font-medium text-sm">{subtitle}</p>
          )}
        </div>
      </div>

      {action && (
        <div className="relative z-10 flex items-center gap-4 w-full md:w-auto justify-start md:justify-end">
          {action}
        </div>
      )}
    </header>
  );
}
