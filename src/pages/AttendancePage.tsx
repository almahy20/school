import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, Check, Calendar, Search, Users } from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface StudentAttendance {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  existingId?: string;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('classes').select('*').eq('teacher_id', user.id).then(({ data }) => {
      setClasses(data || []);
      if (data?.length) setSelectedClass(data[0].id);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedClass || !date) return;
    const fetchData = async () => {
      const { data: studentsData } = await supabase.from('students').select('id, name')
        .eq('class_id', selectedClass).order('name');
      if (!studentsData?.length) { setStudents([]); return; }

      const studentIds = studentsData.map(s => s.id);
      const { data: attendance } = await supabase.from('attendance').select('*')
        .in('student_id', studentIds).eq('date', date);

      setStudents(studentsData.map(s => {
        const existing = attendance?.find(a => a.student_id === s.id);
        return {
          studentId: s.id,
          studentName: s.name,
          status: (existing?.status as AttendanceStatus) || 'present',
          existingId: existing?.id,
        };
      }));
      setSaved(false);
    };
    fetchData();
  }, [selectedClass, date]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStudents(prev => prev.map(s =>
      s.studentId === studentId ? { ...s, status } : s
    ));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const records = students.map(s => ({
      student_id: s.studentId,
      date,
      status: s.status,
    }));
    const { error } = await supabase.from('attendance').upsert(records, {
      onConflict: 'student_id,date',
    });
    if (!error) {
      setSaved(true);
      const studentIds = students.map(s => s.studentId);
      const { data: attendance } = await supabase.from('attendance').select('*')
        .in('student_id', studentIds).eq('date', date);
      setStudents(prev => prev.map(s => {
        const existing = attendance?.find(a => a.student_id === s.studentId);
        return { ...s, existingId: existing?.id };
      }));
    }
    setSaving(false);
  };

  const counts = {
    present: students.filter(s => s.status === 'present').length,
    absent: students.filter(s => s.status === 'absent').length,
    late: students.filter(s => s.status === 'late').length,
  };

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';
  const dateFormatted = new Date(date).toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const filteredStudents = students.filter(s =>
    s.studentName.includes(searchQuery)
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">سجل الحضور اليومي</h1>
            <p className="text-secondary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {selectedClassName ? `توثيق حضور: ${selectedClassName}` : 'بانتظار تحديد القاعة الدراسية…'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group">
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                className="pr-6 pl-12 py-4 rounded-[20px] border-2 border-muted bg-white text-primary text-xs font-black uppercase tracking-widest focus:border-primary transition-all shadow-sm cursor-pointer appearance-none min-w-[200px]">
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 pointer-events-none" />
            </div>
            
            <div className="relative group">
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="pr-6 pl-12 py-4 rounded-[20px] border-2 border-muted bg-white text-primary text-xs font-black uppercase tracking-widest focus:border-primary transition-all shadow-sm cursor-pointer min-w-[200px]" />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 pointer-events-none" />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium animate-pulse">جارٍ تحميل قائمة الطلاب...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-card rounded-3xl border border-dashed p-20 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-bold text-foreground mb-1">لا توجد فصول</p>
            <p className="text-muted-foreground">لم يتم تعيين فصول لك بعد أو لا يوجد بيانات.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
            {/* Left Column: Stats & Search */}
            <div className="xl:col-span-4 space-y-8 lg:sticky lg:top-8">
              <div className="bg-white rounded-[32px] border-2 border-muted overflow-hidden animate-scale-in shadow-sm relative">
                <div className="absolute top-0 right-0 w-full h-1.5 bg-primary" />
                <div className="bg-muted/30 p-6 border-b-2 border-muted">
                  <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] text-center">{dateFormatted}</p>
                </div>
                <div className="p-8 grid grid-cols-3 gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-600 font-black text-2xl shadow-sm">
                      {counts.present}
                    </div>
                    <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">حاضر</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center text-destructive font-black text-2xl shadow-sm">
                      {counts.absent}
                    </div>
                    <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">غائب</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-secondary/10 border-2 border-secondary/20 flex items-center justify-center text-secondary font-black text-2xl shadow-sm">
                      {counts.late}
                    </div>
                    <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">متأخر</span>
                  </div>
                </div>
              </div>

              <div className="relative group">
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/30 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="البحث في القائمة..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-14 pl-6 py-5 rounded-[24px] border-2 border-muted bg-white text-primary font-bold placeholder:text-primary/20 focus:outline-none focus:border-primary transition-all shadow-sm"
                />
              </div>

              {students.length > 0 && (
                <button onClick={handleSave} disabled={saving || saved}
                  className={`w-full flex items-center justify-center gap-4 h-16 rounded-[24px] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${
                    saved
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20 disabled:opacity-50'
                  }`}>
                  {saving ? (
                    <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : saved ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Check className="w-5 h-5 font-black" />
                  )}
                  {saving ? 'جارٍ المزامنة...' : saved ? 'تم اعتماد التقرير' : 'اعتماد تقرير الحضور'}
                </button>
              )}
            </div>

            {/* Right Column: Student List */}
            <div className="xl:col-span-8 space-y-6">
              {filteredStudents.length === 0 ? (
                <div className="bg-white rounded-[40px] border-2 border-dashed border-muted p-32 text-center">
                  <div className="w-20 h-20 rounded-[32px] bg-muted/50 flex items-center justify-center mx-auto mb-8 text-primary/10">
                    <Users className="w-10 h-10" />
                  </div>
                  <p className="text-primary/30 font-black text-xs uppercase tracking-widest">لا توجد تطابقات في سجل الحضور اليومي</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredStudents.map((s) => (
                    <div key={s.studentId} className="bg-white rounded-[32px] border-2 border-muted p-6 flex flex-col gap-6 hover:border-primary transition-all duration-300 group animate-scale-in shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-24 h-24 bg-primary/5 rounded-full -ml-12 -mt-12 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex items-center gap-5 relative z-10 text-right">
                        <div className="w-14 h-14 rounded-2xl bg-primary text-secondary flex items-center justify-center text-lg font-black shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                          {s.studentName[0]}
                        </div>
                        <h3 className="font-black text-primary text-lg truncate leading-tight tracking-tight">{s.studentName}</h3>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 relative z-10">
                        {(['present', 'absent', 'late'] as AttendanceStatus[]).map(status => {
                          const config = {
                            present: { 
                              label: 'حاضر', 
                              active: 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20', 
                              inactive: 'bg-white border-muted text-primary/30 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200' 
                            },
                            absent: { 
                              label: 'غائب', 
                              active: 'bg-destructive text-white border-destructive shadow-lg shadow-destructive/20', 
                              inactive: 'bg-white border-muted text-primary/30 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20' 
                            },
                            late: { 
                              label: 'متأخر', 
                              active: 'bg-secondary text-primary border-secondary shadow-lg shadow-secondary/20', 
                              inactive: 'bg-white border-muted text-primary/30 hover:bg-secondary/5 hover:text-secondary hover:border-secondary/20' 
                            },
                          }[status];
                          return (
                            <button
                              key={status}
                              onClick={() => setStudentStatus(s.studentId, status)}
                              className={`h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                s.status === status ? config.active : config.inactive
                              }`}
                            >
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
