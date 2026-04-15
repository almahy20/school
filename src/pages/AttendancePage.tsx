import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CalendarCheck, Users, Check, X, Clock, Search, 
  Activity, Calendar, Info, UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useBranding, useTeacherAttendance, useUpsertTeacherAttendance } from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import PageHeader from '@/components/layout/PageHeader';

interface TeacherAttendanceRecord {
  teacherId: string;
  teacherName: string;
  status: 'present' | 'absent' | 'late' | 'excused' | null;
}

export default function TeacherAttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  // ── Queries ──
  const { data: branding } = useBranding();
  const { data: dbAttendanceData, isLoading: attendanceLoading, error, refetch, isRefetching } = useTeacherAttendance(date);
  const dbAttendance = useMemo(() => dbAttendanceData || [], [dbAttendanceData]);

  // Local state for pending attendance changes
  const [localAttendance, setLocalAttendance] = useState<TeacherAttendanceRecord[]>([]);

  // Sync local state with DB data
  useEffect(() => {
    if (dbAttendance) {
      setLocalAttendance(dbAttendance);
    }
  }, [dbAttendance]); // Sync local state when database data changes

  // ── Mutations ──
  const upsertMutation = useUpsertTeacherAttendance();

  const updateStatus = (teacherId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setLocalAttendance(prev => prev.map(a => a.teacherId === teacherId ? { ...a, status } : a));
  };

  const handleSave = async () => {
    if (!user?.schoolId) return;
    
    const recordsToPush = localAttendance
      .filter(a => a.status !== null)
      .map(a => ({
        teacher_id: a.teacherId,
        date,
        status: a.status,
        school_id: user.schoolId
      }));

    if (recordsToPush.length === 0) {
      toast({ title: 'تنبيه', description: 'لا توجد سجلات مكتملة لرصدها' });
      return;
    }

    try {
      await upsertMutation.mutateAsync(recordsToPush);
      toast({ title: 'تم الاعتماد بنجاح', description: 'تم رصد سجل حضور المعلمين.' });
    } catch (err: any) {
      toast({ title: 'فشل في الحفظ', description: err.message, variant: 'destructive' });
    }
  };

  const markAllPresent = () => {
    setLocalAttendance(prev => prev.map(a => ({ ...a, status: 'present' })));
  };

  const stats = {
    present: localAttendance.filter(a => a.status === 'present').length,
    absent: localAttendance.filter(a => a.status === 'absent').length,
    late: localAttendance.filter(a => a.status === 'late').length,
    excused: localAttendance.filter(a => a.status === 'excused').length,
    total: localAttendance.length
  };

  const filteredAttendance = localAttendance.filter(a => (a.teacherName || '').toLowerCase().includes((search || '').toLowerCase()));
  const loading = attendanceLoading && !isRefetching;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-8 max-w-[1400px] mx-auto text-right pb-14 animate-in fade-in slide-in-from-bottom-4 duration-1000 px-2 md:px-0">
        <PageHeader
          icon={CalendarCheck}
          title="سجل حضور المعلمين"
          subtitle="متابعة حضور وانصراف الكادر التعليمي يومياً"
          action={
            <div className="relative group">
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="pr-12 pl-6 h-12 rounded-2xl border-none bg-white text-slate-900 font-black text-xs shadow-xl shadow-slate-200/10 focus:ring-4 focus:ring-indigo-600/5 transition-all appearance-none cursor-pointer"
              />
            </div>
          }
        />

        <QueryStateHandler
          loading={loading}
          error={error}
          data={dbAttendance}
          onRetry={refetch}
          isRefetching={isRefetching}
          loadingMessage="جاري مزامنة بيانات المعلمين..."
          emptyMessage="لم يتم العثور على معلمين في المدرسة."
          isEmpty={localAttendance.length === 0}
        >
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start select-none">
            {/* Sidebar Summary */}
            <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-6">
               <section className="bg-slate-900 rounded-[40px] p-8 space-y-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)] pointer-events-none" />
                  <div className="flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-lg font-black text-white leading-none">إحصائيات اليوم</h2>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 relative z-10">
                     <StatTile label="حاضر" value={stats.present} color="emerald" />
                     <StatTile label="غائب" value={stats.absent} color="rose" />
                     <StatTile label="متأخر" value={stats.late} color="orange" />
                     <StatTile label="بعذر" value={stats.excused} color="blue" />
                  </div>

                  <div className="space-y-3 relative z-10 pt-4 border-t border-white/5">
                     <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">نسبة الحضور</span>
                        <span className="text-2xl font-black text-indigo-400">{stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%</span>
                     </div>
                     <Progress value={stats.total > 0 ? (stats.present / stats.total) * 100 : 0} className="h-1.5 bg-white/10" />
                  </div>

                  <div className="flex flex-col gap-3 relative z-10">
                     <Button onClick={markAllPresent} variant="ghost" className="h-11 rounded-xl bg-white/5 text-white font-black hover:bg-white/10 transition-all text-xs gap-3">
                        تعيين الجميع حضور
                     </Button>
                     <Button 
                      onClick={handleSave} 
                      disabled={upsertMutation.isPending} 
                      className="h-13 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-xs shadow-xl shadow-indigo-900/40 gap-3"
                     >
                        {upsertMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-5 h-5" />}
                        {upsertMutation.isPending ? 'جاري الرصد...' : 'اعتماد السجل النهائي'}
                     </Button>
                  </div>
               </section>

               <div className="px-6 space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700">
                     <Info className="w-4 h-4 shrink-0" />
                     <p className="text-[10px] font-black leading-relaxed">يرجى التأكد من رصد حضور جميع المعلمين قبل نهاية اليوم الدراسي.</p>
                  </div>
               </div>
            </div>

            {/* List */}
            <div className="xl:col-span-8 space-y-6">
              <div className="premium-card p-0 overflow-hidden flex flex-col shadow-xl">
                 <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                          <Users className="w-5 h-5" />
                       </div>
                       <div>
                          <h2 className="text-xl font-black text-slate-900 leading-none mb-1">قائمة المعلمين</h2>
                          <div className="flex items-center gap-2 opacity-40 text-[10px] font-black uppercase tracking-widest">
                             <Calendar className="w-3 h-3" /> {new Date(date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                       </div>
                    </div>
                    <div className="relative group w-full sm:w-64">
                       <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                       <input 
                         type="text" 
                         placeholder="بحث بالاسم..." 
                         value={search}
                         onChange={e => setSearch(e.target.value)}
                         className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-100 bg-white text-xs font-bold shadow-sm focus:ring-4 focus:ring-indigo-600/5 transition-all" 
                       />
                    </div>
                 </div>

                 <div className="divide-y divide-slate-50">
                    {filteredAttendance.map((a, idx) => (
                      <div key={a.teacherId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 px-4 sm:px-8 py-5 hover:bg-slate-50/50 transition-all duration-300 group">
                         <div className="flex items-center gap-4 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner shrink-0">
                               {idx + 1}
                            </div>
                            <div className="min-w-0">
                               <h3 className="text-sm font-black text-slate-800 transition-colors truncate">{a.teacherName}</h3>
                               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">معلم</p>
                            </div>
                         </div>

                         <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar max-w-full">
                            <PresenceButton 
                              active={a.status === 'present'} 
                              onClick={() => updateStatus(a.teacherId, 'present')} 
                              variant="present"
                            />
                            <PresenceButton 
                              active={a.status === 'absent'} 
                              onClick={() => updateStatus(a.teacherId, 'absent')} 
                              variant="absent"
                            />
                            <PresenceButton 
                              active={a.status === 'late'} 
                              onClick={() => updateStatus(a.teacherId, 'late')} 
                              variant="late"
                            />
                            <PresenceButton 
                              active={a.status === 'excused'} 
                              onClick={() => updateStatus(a.teacherId, 'excused')} 
                              variant="excused"
                            />
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

function StatTile({ label, value, color }: any) {
  const configs: any = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <div className={cn("p-4 rounded-2xl border text-center transition-all hover:bg-white/5", configs[color])}>
       <span className="block text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</span>
       <h3 className="text-xl font-black">{value}</h3>
    </div>
  );
}

function PresenceButton({ active, onClick, variant }: any) {
  const configs: any = {
    present: active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 active:scale-95" : "bg-white border-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50",
    absent: active ? "bg-rose-600 text-white shadow-lg shadow-rose-900/20 active:scale-95" : "bg-white border-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50",
    late: active ? "bg-amber-500 text-white shadow-lg shadow-amber-900/20 active:scale-95" : "bg-white border-slate-100 text-slate-400 hover:text-amber-500 hover:bg-amber-50",
    excused: active ? "bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95" : "bg-white border-slate-100 text-slate-400 hover:text-blue-500 hover:bg-blue-50",
  };
  const labels: any = { present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'بعذر' };
  const icons: any = { present: Check, absent: X, late: Clock, excused: UserCheck };
  const Icon = icons[variant];

  return (
    <button 
      onClick={onClick}
      className={cn("h-10 px-4 rounded-xl border font-black text-[10px] flex items-center gap-2 transition-all duration-300 min-w-[76px] justify-center", configs[variant])}>
      <Icon className="w-3.5 h-3.5" />
      <span>{labels[variant]}</span>
    </button>
  );
}
