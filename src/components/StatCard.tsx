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
    <div className="stat-card group animate-scale-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">{title}</p>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{value}</p>
        </div>
        <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${colorMap[color]}`}>
          <Icon className="w-7 h-7" />
        </div>
      </div>
    </div>
  );
}
