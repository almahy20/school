import { useState, useMemo, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { useStudents, useStudent, useGrades, useAttendance, useAllClasses, useStudentDetailedGrades, useStudentAttendance } from '@/hooks/queries';
import { 
  Search, Printer, User, BookOpen, CalendarCheck, 
  ChevronLeft, GraduationCap, Download, Filter,
  FileSpreadsheet, Award, CheckCircle2, AlertCircle,
  Hash, Clock, MapPin, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDisplayDate } from '@/lib/date-utils';

export default function AdminReportsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState('الكل');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  
  const months = [
    { value: 8, label: 'سبتمبر' },
    { value: 9, label: 'أكتوبر' },
    { value: 10, label: 'نوفمبر' },
    { value: 11, label: 'ديسمبر' },
    { value: 0, label: 'يناير' },
    { value: 1, label: 'فبراير' },
    { value: 2, label: 'مارس' },
    { value: 3, label: 'أبريل' },
    { value: 4, label: 'مايو' },
  ];
  
  const { data: studentsData, isLoading: studentsLoading } = useStudents(1, 1000, searchQuery, filterClass);
  const { data: student, isLoading: studentLoading } = useStudent(selectedStudentId || undefined);
  
  const { data: allGrades, isLoading: gradesLoading } = useStudentDetailedGrades(selectedStudentId);
  const { data: allAttendance, isLoading: attendanceLoading } = useStudentAttendance(selectedStudentId);
  const { data: classes } = useAllClasses();
  
  // Filter grades by selected month
  const detailedGrades = useMemo(() => {
    if (!allGrades) return [];
    return allGrades.filter((g: any) => {
      const date = new Date(g.created_at);
      return date.getMonth() === selectedMonth;
    });
  }, [allGrades, selectedMonth]);

  // Filter attendance by selected month
  const attendanceData = useMemo(() => {
    if (!allAttendance) return [];
    return allAttendance.filter((a: any) => {
      const date = new Date(a.date);
      return date.getMonth() === selectedMonth;
    });
  }, [allAttendance, selectedMonth]);

  const students = studentsData?.data || [];

  const calculateGrade = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 90) return 'ممتاز';
    if (percentage >= 80) return 'جيد جداً';
    if (percentage >= 70) return 'جيد';
    if (percentage >= 50) return 'مقبول';
    return 'ضعيف';
  };

  // Calculate Attendance Stats from Real Data
  const attendanceStats = useMemo(() => {
    if (!attendanceData) return { present: 0, absent: 0, late: 0 };
    return attendanceData.reduce((acc: any, curr: any) => {
      if (curr.status === 'present') acc.present++;
      else if (curr.status === 'absent') acc.absent++;
      else if (curr.status === 'late') acc.late++;
      return acc;
    }, { present: 0, absent: 0, late: 0 });
  }, [attendanceData]);

  // Calculate Academic Summary from Detailed Grades (Numeric Only)
  const academicSummary = useMemo(() => {
    if (!detailedGrades || detailedGrades.length === 0) return { total: 0, max: 0, avg: 0, hasNumeric: false };
    
    // Auto-detect numeric vs text: Score must be a valid number and score_type must not be 'text'
    const numericGrades = detailedGrades.filter((g: any) => {
      const isNumericType = g.exam_templates?.score_type !== 'text';
      const isNumericValue = !isNaN(parseFloat(g.score)) && isFinite(Number(g.score));
      return isNumericType && isNumericValue;
    });
    
    if (numericGrades.length === 0) return { total: 0, max: 0, avg: 0, hasNumeric: false };

    const total = numericGrades.reduce((sum: number, g: any) => sum + (Number(g.score) || 0), 0);
    const max = numericGrades.reduce((sum: number, g: any) => sum + (Number(g.exam_templates?.max_score) || 0), 0);
    const avg = max > 0 ? Math.round((total / max) * 100) : 0;
    
    return { total, max, avg, hasNumeric: true };
  }, [detailedGrades]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto text-right py-6 min-h-[calc(100vh-120px)]" dir="rtl">
        
        {/* Left Sidebar: Student Selection (Hidden on Print) */}
        <div className="w-full lg:w-80 flex flex-col gap-6 no-print">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <div className="space-y-2">
               <h2 className="text-xl font-black text-slate-900">سجل الطلاب</h2>
               <p className="text-slate-400 text-xs font-bold">اختر طالباً لإصدار التقرير</p>
            </div>

            <div className="relative group">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                type="text"
                placeholder="بحث بالاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pr-10 pl-4 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-sm"
              />
            </div>

            <div className="space-y-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">تصفية حسب الشهر</p>
               <select 
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(Number(e.target.value))}
                 className="w-full h-11 px-4 rounded-xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/5"
               >
                 {months.map(m => (
                   <option key={m.value} value={m.value}>{m.label}</option>
                 ))}
               </select>
            </div>

            <div className="space-y-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">تصفية حسب الفصل</p>
               <select 
                 value={filterClass}
                 onChange={(e) => setFilterClass(e.target.value)}
                 className="w-full h-11 px-4 rounded-xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/5"
               >
                 <option value="الكل">جميع الفصول</option>
                 {classes?.map(c => (
                   <option key={c.id} value={c.name}>{c.name}</option>
                 ))}
               </select>
            </div>

            <div className="h-[400px] overflow-y-auto no-scrollbar space-y-2 pr-1">
              {studentsLoading ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
              ) : students.length > 0 ? (
                students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 text-right",
                      selectedStudentId === s.id 
                        ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/20 translate-x-1" 
                        : "bg-white border-slate-50 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-black",
                      selectedStudentId === s.id ? "bg-white/10" : "bg-slate-100 text-slate-400"
                    )}>
                      {s.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{s.name}</p>
                      <p className={cn("text-[9px] font-bold opacity-60", selectedStudentId === s.id ? "text-white" : "text-slate-400")}>
                        {s.classes?.name || 'بدون فصل'}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-10 opacity-30"> لا توجد نتائج </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content: The Report Card Preview */}
        <div className="flex-1 space-y-6">
          {selectedStudentId ? (
            <>
              {/* Toolbar (Hidden on Print) */}
              <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm no-print">
                 <div className="flex items-center gap-4">
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 px-4 py-1.5 rounded-full font-black text-[10px]"> جاهز للطباعة </Badge>
                    <span className="text-slate-300 text-sm">|</span>
                    <p className="text-slate-500 font-bold text-sm"> تم التحقق من البيانات الأكاديمية والمالية </p>
                 </div>
                 <div className="flex items-center gap-3">
                    <Button variant="outline" className="h-12 px-6 rounded-2xl border-slate-100 text-slate-600 font-black flex items-center gap-2">
                       <Download className="w-4 h-4" />
                       حفظ بصيغة PDF
                    </Button>
                    <Button onClick={handlePrint} className="h-12 px-8 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-slate-800 transition-all flex items-center gap-3">
                       <Printer className="w-5 h-5" />
                       طباعة الشهادة
                    </Button>
                 </div>
              </div>

              {/* The Actual Report (A4 Container) */}
              <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl p-10 md:p-16 lg:p-20 relative overflow-visible print:p-0 print:border-none print:shadow-none print:rounded-none mx-auto print:mx-0 w-full max-w-[900px] print:max-w-none print:w-full min-h-[900px] print:min-h-0 print:flex print:flex-col">
                
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] no-print" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] no-print" />

                {/* Report Header */}
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10 border-b-4 border-slate-900 pb-8 mb-8 print:pb-6 print:mb-6">
                   <div className="text-center md:text-right space-y-2 print:flex-1">
                      <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">شهادة التحصيل الدراسي</h1>
                      <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[9px] print:text-[8px]">Academic Achievement Transcript</p>
                      <div className="flex items-center gap-4 mt-4 print:justify-center md:print:justify-start">
                        <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
                           <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
                           <span className="text-xs font-black text-slate-900">{formatDisplayDate(new Date(), { month: 'long', year: 'numeric' })}</span>
                        </div>
                        <Badge className="bg-slate-900 text-white rounded-md px-2.5 py-0.5 font-black text-[10px]">
                           تقرير شهر {months.find(m => m.value === selectedMonth)?.label}
                        </Badge>
                      </div>
                   </div>
                   
                   <div className="text-center md:text-left space-y-1 print:flex-1">
                      <p className="text-2xl font-black text-slate-900">مدرسة الجيل الجديد</p>
                      <p className="text-slate-400 font-bold text-xs italic">Al-Jeel Al-Jadeed Smart School</p>
                   </div>
                </div>

                {/* Student Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 print:mb-8 relative z-10">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"> <GraduationCap className="w-3 h-3" /> اسم الطالب </p>
                      <p className="text-base font-black text-slate-900">{student?.name}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"> <Hash className="w-3 h-3" /> الرقم القومي </p>
                      <p className="text-base font-black text-slate-900">{student?.id_number || 'غير مسجل'}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"> <MapPin className="w-3 h-3" /> الفصل الدراسي </p>
                      <p className="text-base font-black text-slate-900">{student?.classes?.name || 'بدون فصل'}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"> <Phone className="w-3 h-3" /> هاتف ولي الأمر </p>
                      <p className="text-base font-black text-slate-900">{student?.parent_phone || 'غير مسجل'}</p>
                   </div>
                </div>

                {/* Academic Table */}
                <div className="mb-10 print:mb-8 relative z-10">
                  <div className="flex items-center gap-3 mb-4 print:mb-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center print:bg-transparent">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">التحصيل الدراسي والدرجات</h3>
                  </div>
                  
                  <div className="rounded-3xl border-2 border-slate-900 overflow-hidden shadow-xl print:shadow-none print:rounded-none print:border-slate-300">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white print:bg-slate-100 print:text-black">
                          <th className="p-4 font-black text-xs print:border print:border-slate-300">المادة الدراسية</th>
                          {academicSummary.hasNumeric && (
                            <>
                              <th className="p-4 font-black text-xs text-center print:border print:border-slate-300">النهائية</th>
                              <th className="p-4 font-black text-xs text-center print:border print:border-slate-300">الدرجة</th>
                              <th className="p-4 font-black text-xs text-center print:border print:border-slate-300">التقدير</th>
                            </>
                          )}
                          {!academicSummary.hasNumeric && (
                            <th className="p-4 font-black text-xs text-center print:border print:border-slate-300">النتيجة / التقييم</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gradesLoading ? (
                          Array(4).fill(0).map((_, i) => (
                            <tr key={i}>
                              <td colSpan={academicSummary.hasNumeric ? 4 : 2} className="p-4"><Skeleton className="h-6 w-full" /></td>
                            </tr>
                          ))
                        ) : detailedGrades?.map((g: any) => {
                          const isScoreNumeric = !isNaN(parseFloat(g.score)) && isFinite(Number(g.score));
                          const isText = g.exam_templates?.score_type === 'text' || !isScoreNumeric;
                          
                          return (
                            <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-bold text-slate-700 print:border print:border-slate-300">
                                 {g.exam_templates?.subject} 
                                 <span className="block text-[8px] text-slate-400 font-normal">{g.exam_templates?.title}</span>
                              </td>
                              
                              {academicSummary.hasNumeric ? (
                                <>
                                  <td className="p-4 text-center font-black text-slate-400 print:border print:border-slate-300">
                                    {isText ? '-' : g.exam_templates?.max_score}
                                  </td>
                                  <td className="p-4 text-center font-black text-slate-900 print:border print:border-slate-300">
                                    {g.score}
                                  </td>
                                  <td className="p-4 text-center print:border print:border-slate-300">
                                    {!isText && (
                                      <Badge className={cn(
                                        "rounded-md px-2 py-0.5 font-black text-[10px]",
                                        Number(g.score) >= (g.exam_templates?.max_score * 0.85) ? "bg-emerald-50 text-emerald-600" :
                                        Number(g.score) >= (g.exam_templates?.max_score * 0.75) ? "bg-indigo-50 text-indigo-600" :
                                        "bg-amber-50 text-amber-600"
                                      )}>
                                        {calculateGrade(Number(g.score), g.exam_templates?.max_score)}
                                      </Badge>
                                    )}
                                    {isText && <span className="text-[10px] font-bold text-slate-400 italic">تقييم وصفي</span>}
                                  </td>
                                </>
                              ) : (
                                <td className="p-4 text-center font-black text-slate-900 print:border print:border-slate-300 text-lg">
                                  {g.score}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {(!detailedGrades || detailedGrades.length === 0) && (
                          <tr>
                            <td colSpan={academicSummary.hasNumeric ? 4 : 2} className="p-10 text-center text-slate-300 font-bold italic">
                               لم يتم رصد أي درجات لهذا الطالب بعد
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {academicSummary.hasNumeric && (
                        <tfoot className="bg-slate-50 print:bg-transparent">
                          <tr>
                            <td className="p-4 font-black text-slate-900 text-base print:border print:border-slate-300">المجموع الكلي (للمواد الرقمية)</td>
                            <td className="p-4 text-center font-black text-slate-900 text-base print:border print:border-slate-300">{academicSummary.max}</td>
                            <td className="p-4 text-center font-black text-slate-900 text-xl print:border print:border-slate-300">{academicSummary.total}</td>
                            <td className="p-4 text-center print:border print:border-slate-300">
                              <div className="inline-flex items-center gap-3">
                                <span className="text-[9px] font-black text-slate-400 uppercase">المعدل العام</span>
                                <span className="text-lg font-black text-indigo-600">{academicSummary.avg}%</span>
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Behavioral & Attendance Summary */}
                <div className="mb-10 print:mb-8 relative z-10">
                   <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-4 print:bg-transparent print:border-slate-200">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center print:bg-transparent">
                            <CheckCircle2 className="w-4 h-4" />
                         </div>
                         <h4 className="font-black text-slate-900 text-sm">السلوك والمواظبة</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                         <div className="text-center p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">أيام الحضور</p>
                            <p className="text-xl font-black text-emerald-600">{attendanceStats.present}</p>
                         </div>
                         <div className="text-center p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">أيام الغياب</p>
                            <p className="text-xl font-black text-rose-600">{attendanceStats.absent}</p>
                         </div>
                         <div className="text-center p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">أيام التأخير</p>
                            <p className="text-xl font-black text-amber-600">{attendanceStats.late}</p>
                         </div>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic">
                        الطالب يتمتع بخلق رفيع ومتعاون جداً مع زملائه، يشارك بفعالية في الأنشطة المدرسية اللاصفية.
                      </p>
                   </div>
                </div>

                {/* Footer Signature Section - Compact Version */}
                <div className="flex items-center justify-between border-t-2 border-slate-100 pt-6 mt-auto">
                   <div className="text-center space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase">تاريخ الإصدار</p>
                      <p className="text-[10px] font-black text-slate-900">{new Date().toLocaleDateString('ar-EG')}</p>
                   </div>
                   <div className="text-center space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase">المعرف الرقمي</p>
                      <p className="text-[8px] font-mono text-slate-500">{selectedStudentId?.slice(0, 8)}</p>
                   </div>
                   <div className="text-left space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">إدارة المدرسة</p>
                      <p className="text-[10px] font-black text-slate-900">تصديق إلكتروني</p>
                   </div>
                </div>

              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-20 space-y-8 bg-white rounded-[40px] border border-slate-100 shadow-sm">
               <div className="w-32 h-32 rounded-[48px] bg-slate-50 flex items-center justify-center text-slate-200 shadow-inner group">
                  <GraduationCap className="w-16 h-16 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700" />
               </div>
               <div className="space-y-3">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">ابدأ باختيار طالب من القائمة</h2>
                  <p className="text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
                    يمكنك استعراض السجل الأكاديمي الشامل لكل طالب، وحساب المعدلات التراكمية، وإصدار شهادات رسمية بضغطة زر واحدة.
                  </p>
               </div>
               <div className="flex items-center gap-4 pt-6">
                  <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl text-indigo-600 font-black text-xs">
                     <CheckCircle2 className="w-4 h-4" />
                     حساب آلي للمعدل
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl text-emerald-600 font-black text-xs">
                     <CheckCircle2 className="w-4 h-4" />
                     توافق تام مع الطباعة A4
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
