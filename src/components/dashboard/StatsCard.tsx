import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'primary' | 'emerald' | 'amber' | 'indigo' | 'white' | 'rose' | 'blue';
  trend?: string;
  subValue?: string;
}

export function StatsCard({ title, value, icon: Icon, color, trend, subValue }: StatsCardProps) {
  const colors: Record<string, string> = {
    primary: "bg-slate-900 text-white border-slate-800 shadow-slate-200/50",
    emerald: "bg-emerald-500 text-white border-emerald-400/20 shadow-emerald-100",
    amber: "bg-amber-500 text-white border-amber-400/20 shadow-emerald-100",
    indigo: "bg-indigo-600 text-white border-indigo-500/20 shadow-indigo-100",
    white: "bg-white text-slate-900 border-slate-100 shadow-slate-200/20",
    rose: "bg-rose-500 text-white border-rose-400/20 shadow-rose-100",
    blue: "bg-blue-600 text-white border-blue-500/20 shadow-blue-100"
  };

  return (
    <div className={cn(
      "group premium-card flex flex-col justify-between border shadow-sm hover:shadow-md transition-all duration-300 p-5 md:p-6",
      colors[color || 'white']
    )}>
      <div className="flex items-start justify-between">
        <div className={cn(
          "w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-3",
          color === 'white' ? 'bg-slate-50 text-slate-400' : 'bg-white/20 text-white'
        )}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        {trend && (
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[8px] md:text-[10px] font-bold flex items-center gap-1",
            color === 'white' ? 'bg-emerald-50 text-emerald-600' : 'bg-white/20 text-white'
          )}>
            {trend}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className={cn("text-[9px] md:text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70")}>{title}</p>
        <h3 className="text-xl md:text-2xl font-bold leading-none tracking-tight">{value}</h3>
        {subValue && <p className="text-[8px] md:text-[10px] mt-1.5 opacity-80 font-medium">{subValue}</p>}
      </div>
    </div>
  );
}
