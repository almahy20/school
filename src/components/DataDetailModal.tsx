import * as React from "react";
import { 
  X, User, Phone, Mail, MapPin, Calendar, 
  BookOpen, ShieldCheck, Edit3, Trash2, 
  ChevronLeft, GraduationCap, School, Clock,
  FileText, Activity, CreditCard
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number | React.ReactNode;
  className?: string;
}

function DetailItem({ icon: Icon, label, value, className }: DetailItemProps) {
  return (
    <div className={cn("flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 transition-all hover:bg-white hover:shadow-sm", className)}>
      <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <div className="text-sm font-bold text-slate-900 leading-tight">{value || '---'}</div>
      </div>
    </div>
  );
}

interface DataDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  data: {
    label: string;
    value: string | number | React.ReactNode;
    icon: React.ElementType;
    fullWidth?: boolean;
  }[];
  actions?: {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  }[];
  badge?: {
    label: string;
    variant?: "default" | "destructive" | "outline" | "secondary";
  };
}

export default function DataDetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: HeaderIcon = User,
  data,
  actions,
  badge
}: DataDetailModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-[32px]" dir="rtl">
        {/* Header Section */}
        <div className="relative p-8 pb-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100px] -translate-y-8 translate-x-8 pointer-events-none" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-[24px] bg-slate-900 flex items-center justify-center text-white shadow-xl rotate-3">
                <HeaderIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">{title}</DialogTitle>
                  {badge && (
                    <Badge variant={badge.variant || "secondary"} className="rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {badge.label}
                    </Badge>
                  )}
                </div>
                {subtitle && <DialogDescription className="text-slate-500 font-bold text-sm">{subtitle}</DialogDescription>}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {data.map((item, idx) => (
              <DetailItem 
                key={idx}
                icon={item.icon}
                label={item.label}
                value={item.value}
                className={item.fullWidth ? "sm:col-span-2" : ""}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-0 flex flex-wrap items-center justify-end gap-3 bg-slate-50/50 mt-2 border-t border-slate-100/50">
          <div className="flex-1 hidden sm:block">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3 h-3" /> تم التحديث في {new Date().toLocaleDateString('ar-EG')}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {actions?.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || "outline"}
                onClick={action.onClick}
                className={cn(
                  "flex-1 sm:flex-none h-12 px-6 rounded-2xl font-black text-xs gap-2 transition-all active:scale-95 shadow-sm",
                  action.variant === 'destructive' ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100' : ''
                )}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </Button>
            ))}
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="h-12 px-6 rounded-2xl font-black text-xs text-slate-400 hover:bg-slate-100"
            >
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
