import { useState, useMemo, useEffect } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useClassAttendance, useUpsertAttendance } from '@/hooks/queries';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ClassAttendanceViewProps {
  classId: string;
  className: string;
  onBack: () => void;
}

export function ClassAttendanceView({ classId, className, onBack }: ClassAttendanceViewProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: dbAttendanceData } = useClassAttendance(classId, attendanceDate);
  const dbAttendance = useMemo(() => dbAttendanceData || [], [dbAttendanceData]);
  const [localAttendance, setLocalAttendance] = useState<any[]>([]);
  const upsertAttendanceMutation = useUpsertAttendance();

  useEffect(() => {
    if (dbAttendance) {
      setLocalAttendance(dbAttendance);
    }
  }, [dbAttendance]);

  const updateAttendanceStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setLocalAttendance(prev => prev.map(a => a.studentId === studentId ? { ...a, status } : a));
  };

  const markAllPresent = () => {
    setLocalAttendance(prev => prev.map(a => ({ ...a, status: 'present' })));
    toast({ title: 'تم التغيير', description: 'تم تعيين جميع الطلاب حاضر (محلياً)' });
  };

  const markAllAbsent = () => {
    setLocalAttendance(prev => prev.map(a => ({ ...a, status: 'absent' })));
    toast({ title: 'تم التغيير', description: 'تم تعيين جميع الطلاب غائب (محلياً)' });
  };

  const handleSaveAttendance = async () => {
    if (!classId || !currentUser?.schoolId) return;
    
    const records = localAttendance
      .filter(a => a.status !== null)
      .map(a => ({
        student_id: a.studentId,
        class_id: classId,
        date: attendanceDate,
        status: a.status,
        school_id: currentUser.schoolId
      }));

    if (records.length === 0) {
      toast({ title: 'تنبيه', description: 'لا توجد سجلات مكتملة' });
      return;
    }

    try {
      await upsertAttendanceMutation.mutateAsync(records);
      toast({ title: 'تم الاعتماد بنجاح', description: 'تم رصد سجل الحضور للفصل' });
    } catch (err: any) {
      toast({ title: 'فشل في الحفظ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <section className="bg-white/40 backdrop-blur-md p-10 rounded-[48px] border border-white/50 shadow-xl space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[22px] bg-indigo-600 flex items-center justify-center text-white shadow-xl">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">رصد الحضور والغياب</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">{className}</p>
          </div>
        </div>
        <div className="relative group">
          <input 
            type="date" 
            value={attendanceDate} 
            onChange={e => setAttendanceDate(e.target.value)}
            className="pr-12 pl-6 h-12 rounded-2xl border-none bg-white text-slate-900 font-black text-xs shadow-xl focus:ring-4 focus:ring-indigo-600/5 transition-all cursor-pointer" 
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 p-4 sm:p-6 rounded-2xl text-center border border-emerald-100 shadow-sm">
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{localAttendance.filter(a => a.status === 'present').length}</p>
          <p className="text-[10px] sm:text-xs font-bold text-emerald-700 mt-1 uppercase tracking-wider">حاضر</p>
        </div>
        <div className="bg-rose-50 p-4 sm:p-6 rounded-2xl text-center border border-rose-100 shadow-sm">
          <p className="text-2xl sm:text-3xl font-black text-rose-600">{localAttendance.filter(a => a.status === 'absent').length}</p>
          <p className="text-[10px] sm:text-xs font-bold text-rose-700 mt-1 uppercase tracking-wider">غائب</p>
        </div>
        <div className="bg-amber-50 p-4 sm:p-6 rounded-2xl text-center border border-amber-100 shadow-sm">
          <p className="text-2xl sm:text-3xl font-black text-amber-600">{localAttendance.filter(a => a.status === 'late').length}</p>
          <p className="text-[10px] sm:text-xs font-bold text-amber-700 mt-1 uppercase tracking-wider">متأخر</p>
        </div>
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl text-center border border-slate-200 shadow-sm">
          <p className="text-2xl sm:text-3xl font-black text-slate-600">{localAttendance.length}</p>
          <p className="text-[10px] sm:text-xs font-bold text-slate-700 mt-1 uppercase tracking-wider">الإجمالي</p>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={markAllPresent}
          className="flex-1 sm:flex-none px-6 h-12 rounded-2xl bg-emerald-500 text-white font-black hover:bg-emerald-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
        >
          تحديد الكل حاضر
        </button>
        <button
          onClick={markAllAbsent}
          className="flex-1 sm:flex-none px-6 h-12 rounded-2xl bg-rose-500 text-white font-black hover:bg-rose-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
        >
          تحديد الكل غائب
        </button>
      </div>

      {/* Students List */}
      <div className="space-y-4">
        {localAttendance.map((record) => (
          <div key={record.studentId} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  {record.studentName.charAt(0)}
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">{record.studentName}</h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto pb-1 sm:pb-0 no-scrollbar max-w-full">
                <button
                  onClick={() => updateAttendanceStatus(record.studentId, 'present')}
                  className={`px-4 sm:px-6 h-10 rounded-xl font-bold text-[10px] sm:text-xs transition-all whitespace-nowrap border ${
                    record.status === 'present'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200'
                      : 'bg-white text-slate-400 border-slate-100 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  حاضر
                </button>
                <button
                  onClick={() => updateAttendanceStatus(record.studentId, 'late')}
                  className={`px-4 sm:px-6 h-10 rounded-xl font-bold text-[10px] sm:text-xs transition-all whitespace-nowrap border ${
                    record.status === 'late'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200'
                      : 'bg-white text-slate-400 border-slate-100 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  متأخر
                </button>
                <button
                  onClick={() => updateAttendanceStatus(record.studentId, 'absent')}
                  className={`px-4 sm:px-6 h-10 rounded-xl font-bold text-[10px] sm:text-xs transition-all whitespace-nowrap border ${
                    record.status === 'absent'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200'
                      : 'bg-white text-slate-400 border-slate-100 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  غائب
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveAttendance}
        disabled={upsertAttendanceMutation.isPending}
        className="w-full h-16 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50"
      >
        {upsertAttendanceMutation.isPending ? 'جاري الحفظ...' : 'حفظ الحضور'}
      </button>
    </section>
  );
}
