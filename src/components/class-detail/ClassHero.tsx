import { useNavigate } from 'react-router-dom';
import { ArrowRight, School, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ClassHeroProps {
  classItem: any;
  studentCount: number;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function ClassHero({ 
  classItem, 
  studentCount, 
  isAdmin, 
  onEdit, 
  onDelete, 
  isDeleting 
}: ClassHeroProps) {
  const navigate = useNavigate();

  return (
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 border-[0.5px] border-white/10 shadow-2xl p-8 md:p-12 rounded-[48px] relative overflow-hidden group">
      {/* Ambient Animated Glows */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-emerald-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 pointer-events-none mix-blend-screen" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none mix-blend-overlay" />
      
      <div className="flex items-start lg:items-center gap-6 md:gap-8 relative z-10 w-full lg:w-2/3">
        <button 
          onClick={() => navigate('/classes')}
          className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl shrink-0 backdrop-blur-md"
        >
           <ArrowRight className="w-5 h-5 md:w-7 md:h-7" />
        </button>
        
        <div className="flex items-center gap-5 md:gap-8 min-w-0">
           <div className="w-16 h-16 md:w-24 md:h-24 rounded-[28px] md:rounded-[40px] bg-gradient-to-tr from-indigo-500 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:rotate-[5deg] group-hover:scale-105 transition-all duration-700 shrink-0 border border-white/20">
              <School className="w-8 h-8 md:w-12 md:h-12 drop-shadow-md" />
           </div>
           <div className="space-y-2 min-w-0">
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter drop-shadow-sm mb-1 truncate">{classItem?.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-white/10 text-white border border-white/10 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md shadow-sm">
                   {classItem?.grade_level || 'المرحلة الأكاديمية'}
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md">
                   {studentCount} طالب مقيد
                </Badge>
              </div>
           </div>
        </div>
      </div>
      
      {isAdmin && (
        <div className="flex items-center gap-4 md:gap-5 relative z-10 w-full lg:w-auto lg:justify-end mt-6 lg:mt-0">
          <Button 
            onClick={onEdit}
            className="h-14 md:h-16 px-8 rounded-2xl md:rounded-[24px] bg-white text-slate-900 font-black hover:bg-slate-50 transition-all shadow-xl shadow-white/5 gap-3 text-xs md:text-sm"
          >
            <Edit2 className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" /> تعديل إعدادات الفصل
          </Button>
          <Button 
            onClick={onDelete}
            disabled={isDeleting}
            className="h-14 md:h-16 w-14 md:w-16 rounded-2xl md:rounded-[24px] bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all shadow-lg flex items-center justify-center shrink-0 backdrop-blur-md"
          >
            {isDeleting ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <Trash2 className="w-6 h-6 md:w-7 md:h-7" />}
          </Button>
        </div>
      )}
    </header>
  );
}
