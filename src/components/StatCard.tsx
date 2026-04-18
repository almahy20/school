import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'primary' | 'secondary' | 'accent' | 'success';
}

const colorMap = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  accent: 'bg-accent/10 text-accent border-accent/20',
  success: 'bg-success/10 text-success border-success/20',
};

export default function StatCard({ title, value, icon: Icon, color }: Props) {
  return (
    <div className="premium-card group hover:scale-[1.02] active:scale-[0.98] cursor-default bg-white border border-slate-100 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl transition-all duration-500 group-hover:rotate-6 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-100" />
        </div>
      </div>
      <div>
        <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-primary transition-colors">{title}</h3>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-primary tracking-tighter">{value}</p>
          <span className="text-[10px] font-bold text-slate-300">سجل</span>
        </div>
      </div>
    </div>
  );
}
