import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Copy as CopyIcon } from 'lucide-react';

export function RegistrationLinksCard() {
  const { toast } = useToast();
  const { data: branding } = useBranding();
  const slug = branding?.slug || '';

  const copy = (type: 'teachers' | 'parents') => {
    const link = `${window.location.origin}/register/${type}/${slug}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'تم النسخ', description: `تم نسخ رابط تسجيل ${type === 'teachers' ? 'المعلمين' : 'أولياء الأمور'}` });
  };

  return (
    <div className="premium-card border-indigo-100 bg-indigo-50/30 p-6 sm:p-8 space-y-6">
       <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
            <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">روابط التسجيل</h2>
       </div>
       
       <div className="space-y-4">
          <div className="space-y-1.5">
             <label className="text-[9px] sm:text-[10px] font-black text-indigo-600/50 uppercase tracking-widest mr-1">رابط المعلمين</label>
             <div className="flex gap-2">
                <div className="flex-1 h-11 sm:h-12 px-3 sm:px-4 rounded-xl bg-white border border-indigo-100 flex items-center text-[10px] sm:text-xs font-bold text-slate-500 overflow-hidden whitespace-nowrap" dir="ltr">
                   .../register/teachers/{slug}
                </div>
                <Button onClick={() => copy('teachers')} className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white p-0 shrink-0">
                   <CopyIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
             </div>
          </div>

          <div className="space-y-1.5">
             <label className="text-[9px] sm:text-[10px] font-black text-indigo-600/50 uppercase tracking-widest mr-1">رابط أولياء الأمور</label>
             <div className="flex gap-2">
                <div className="flex-1 h-11 sm:h-12 px-3 sm:px-4 rounded-xl bg-white border border-indigo-100 flex items-center text-[10px] sm:text-xs font-bold text-slate-500 overflow-hidden whitespace-nowrap" dir="ltr">
                   .../register/parents/{slug}
                </div>
                <Button onClick={() => copy('parents')} className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white p-0 shrink-0">
                   <CopyIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
             </div>
          </div>
       </div>
       
       <p className="text-[9px] sm:text-[10px] font-bold text-indigo-400 leading-relaxed">
          شارك هذه الروابط مع المعلمين وأولياء الأمور ليتمكنوا من الانضمام لمدرستك مباشرة.
       </p>
    </div>
  );
}
