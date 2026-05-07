import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface UnifiedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * UnifiedCard - مكون بطاقة موحد لجميع أنحاء التطبيق
 * يضمن نسبة أبعاد 1:1 (مربع) وتصميم متسق
 */
export function UnifiedCard({ children, className, onClick, size = 'md' }: UnifiedCardProps) {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-slate-100 shadow-sm rounded-2xl',
        'aspect-square flex flex-col justify-between',
        'overflow-hidden relative',
        'hover:shadow-md hover:translate-y-[-4px] transition-all duration-300',
        sizeClasses[size],
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}
