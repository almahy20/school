import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, School, BookOpen, Award, User, 
  Trash2, Edit2, CalendarCheck, Info, Loader2,
  Clock, ShieldCheck, UserCircle
} from 'lucide-react';
import { EditStudentModal } from './StudentsPage';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  useStudent, 
  useGrades, 
  useStudentAttendance, 
  useStudentParent, 
  useCurriculumSubjects,
  useClasses,
  useBranding,
  useDeleteStudent
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'curriculum' | 'grades' | 'attendance' | 'info'>('curriculum');
  const [showEdit, setShowEdit] = useState(false);

  // ── Queries ──
  const { data: student, isLoading: studentLoading, error: studentError, refetch: refetchStudent } = useStudent(id);
  const { data: grades = [], isLoading: gradesLoading } = useGrades(id || null);
  const { data: attendance = [], isLoading: attendanceLoading } = useStudentAttendance(id || null);
  const { data: parent, isLoading: parentLoading } = useStudentParent(id || null);
  const { data: curriculumSubjects = [], isLoading: curriculumLoading } = useCurriculumSubjects(student?.classes?.curriculum_id || null);
  
  // For Edit Modal
  const { data: classesData } = useClasses();
  const classes = Array.isArray(classesData?.data) ? classesData.data : 
                  Array.isArray(classesData) ? classesData : [];
  const { data: branding } = useBranding();

  // ── Mutations ──
  const deleteStudentMutation = useDeleteStudent();

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف سجل الطالب نهائياً من قاعدة البيانات؟')) return;
    try {
      await deleteStudentMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح' });
      navigate('/students');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const isLoadingTotal = studentLoading || gradesLoading || attendanceLoading || parentLoading || curriculumLoading;

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 max-w-[1200px] mx-auto text-right pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700" dir="rtl">
        
        <QueryStateHandler
          loading={studentLoading}
          error={studentError}
          data={student}
          onRetry={refetchStudent}
          loadingMessage="جاري استرجاع سجل الطالب وتاريخه الأكاديمي..."
        >
          {/* Ultra-Premium Hero Banner */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 border-[0.5px] border-white/10 shadow-2xl p-10 md:p-14 rounded-[40px] md:rounded-[56px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-0 left-0 w-[25rem] h-[25rem] bg-purple-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 pointer-events-none mix-blend-screen" />
            
            <div className="flex items-center gap-6 md:gap-8 relative z-10 text-right w-full lg:w-2/3">
              <button 
                onClick={() => navigate(currentUser?.role === 'parent' ? '/' : '/students')}
                className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl shrink-0 backdrop-blur-md"
              >
                 <ArrowRight className="w-5 h-5 md:w-7 md:h-7" />
              </button>
              
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-[28px] md:rounded-[40px] bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-2xl shadow-indigo-500/20 flex items-center justify-center font-black text-2xl md:text-4xl group-hover:rotate-3 transition-transform duration-700 shrink-0 border border-white/20">
                 {student?.name?.trim()[0]}
              </div>
              
              <div className="space-y-2 min-w-0">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter drop-shadow-sm mb-1 truncate">{student?.name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                   <Badge className="bg-white/10 text-white border border-white/10 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md shadow-sm">
                      {student?.classes?.name || 'غير مسجل بفصل'}
                   </Badge>
                   <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md">
                      انضم {new Date(student?.created_at || '').toLocaleDateString('ar-EG', { year: 'numeric', month: 'short' })}
                   </Badge>
                </div>
              </div>
            </div>
            
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-4 relative z-10 w-full lg:w-auto lg:justify-end mt-4 lg:mt-0">
                <Button 
                  onClick={() => setShowEdit(true)} 
                  className="h-14 md:h-16 px-8 rounded-2xl md:rounded-[24px] bg-white text-slate-900 font-black text-xs md:text-sm hover:bg-slate-50 transition-all shadow-xl gap-3 flex-1 lg:flex-none"
                >
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" /> تعديل البيانات
                </Button>
                <Button 
                  onClick={handleDelete} 
                  disabled={deleteStudentMutation.isPending}
                  className="h-14 md:h-16 w-14 md:w-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-2xl md:rounded-[24px] flex items-center justify-center transition-all shrink-0"
                >
                  {deleteStudentMutation.isPending ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <Trash2 className="w-5 h-5 md:w-6 md:h-6" />}
                </Button>
              </div>
            )}
          </header>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-3 md:gap-4 px-2 pb-2 -mx-2">
            {[
              { id: 'curriculum', label: 'المنهج الدراسي', icon: BookOpen },
              { id: 'grades', label: 'النتائج والدرجات', icon: Award },
              { id: 'attendance', label: 'سجل الحضور', icon: CalendarCheck },
              { id: 'info', label: 'المعلومات الأساسية', icon: Info }
            ].map(tab => (
               <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-6 md:px-8 py-3.5 md:py-4 rounded-[20px] md:rounded-[22px] text-[10px] md:text-xs font-black transition-all flex items-center gap-2.5 md:gap-3 whitespace-nowrap border-2 shrink-0",
                    activeTab === tab.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200 scale-[1.02]" 
                      : "bg-white text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600"
                  )}
               >
                  <tab.icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4 shrink-0", activeTab === tab.id ? "text-indigo-400" : "text-slate-200")} />
                  {tab.label}
               </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="mt-4">
             {activeTab === 'curriculum' && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {curriculumSubjects.length === 0 ? (
                    <div className="col-span-full p-24 text-center text-slate-400 font-bold bg-white rounded-[48px] border border-dashed border-slate-100 shadow-sm">
                       <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
                          <BookOpen className="w-10 h-10" />
                       </div>
                       لا يوجد محتوى دراسي مسجل لهذا الفصل حالياً.
                    </div>
                 ) : (
                    curriculumSubjects.map((sub: any) => (
                      <div key={sub.id} className="p-8 bg-white rounded-[40px] border border-slate-50 shadow-xl shadow-slate-100/50 flex flex-col gap-5 hover:scale-[1.02] transition-transform duration-500">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                               <BookOpen className="w-6 h-6" />
                            </div>
                            <h3 className="font-black text-slate-900 text-lg leading-none">{sub.subject_name}</h3>
                         </div>
                         <div className="bg-slate-50/50 rounded-2xl p-6 text-sm font-bold text-slate-600 leading-relaxed border border-slate-50">
                            {sub.content || 'المحتوى المطلوب دراسته لم يحدد بعد من قبل المعلم.'}
                         </div>
                      </div>
                    ))
                 )}
               </div>
             )}

             {activeTab === 'grades' && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {grades.length === 0 ? (
                    <div className="col-span-full p-24 text-center text-slate-400 font-bold bg-white rounded-[48px] border border-dashed border-slate-100 shadow-sm">
                       <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
                          <Award className="w-10 h-10" />
                       </div>
                       لم يتم رصد نتائج لهذا الطالب بعد.
                    </div>
                 ) : (
                    grades.map((grade: any) => (
                      <div key={grade.id} className="p-6 bg-white rounded-[32px] border border-slate-50 shadow-xl shadow-slate-100/30 flex items-center justify-between hover:translate-y-[-4px] transition-all duration-300">
                         <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
                               <Award className="w-7 h-7" />
                            </div>
                            <div>
                               <h3 className="font-black text-slate-900 text-base mb-1">{grade.subject}</h3>
                               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{grade.term || grade.exam_type}</p>
                            </div>
                         </div>
                         <div className="px-6 py-3 bg-slate-900 rounded-2xl text-xl font-black text-white shadow-xl shadow-slate-200">
                            {grade.score}
                            {!isNaN(Number(grade.score)) && (
                              <span className="text-[10px] text-white/30 mx-1.5 opacity-60">/ {grade.max_score}</span>
                            )}
                         </div>
                      </div>
                    ))
                 )}
               </div>
             )}

             {activeTab === 'attendance' && (
               <div className="bg-white p-12 rounded-[48px] border border-slate-100 shadow-xl shadow-slate-100/50">
                 <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xl font-black text-slate-900">المخطط الزمني للحضور</h3>
                    <div className="flex items-center gap-6">
                       <AttendanceLegend label="حاضر" color="bg-emerald-500" />
                       <AttendanceLegend label="متأخر" color="bg-amber-500" />
                       <AttendanceLegend label="غائب" color="bg-rose-500" />
                    </div>
                 </div>
                 {attendance.length === 0 ? (
                   <div className="p-12 text-center text-slate-300 font-bold border-2 border-dashed border-slate-50 rounded-[32px]">لا يوجد سجل حضور مسجل حالياً.</div>
                 ) : (
                   <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 gap-3">
                      {attendance.map((record: any) => (
                        <div 
                          key={record.id} 
                          title={`${new Date(record.date).toLocaleDateString('ar-EG')} - ${record.status}`}
                          className={cn(
                            "aspect-square rounded-xl border-2 flex flex-col items-center justify-center font-black transition-all hover:scale-110",
                            record.status === 'present' 
                              ? "bg-emerald-50 border-emerald-100/50 text-emerald-600" 
                              : record.status === 'late'
                              ? "bg-amber-50 border-amber-100/50 text-amber-600"
                              : "bg-rose-50 border-rose-100/50 text-rose-600"
                          )}
                        >
                          <span className="text-[10px] mb-0.5 opacity-40">{new Date(record.date).toLocaleDateString('ar-EG', { month: 'short' })}</span>
                          <span className="text-sm">{new Date(record.date).getDate()}</span>
                        </div>
                      ))}
                   </div>
                 )}
               </div>
             )}

             {activeTab === 'info' && (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InfoCard title="الفصل الدراسي" value={student?.classes?.name} icon={School} color="indigo" />
                  <InfoCard title="معلم الفصل" value={student?.classes?.teacher?.full_name} icon={User} color="emerald" />
                  <InfoCard title="ولي الأمر" value={parent?.full_name || 'لم يتم الربط'} icon={UserCircle} color="amber" />
                  <InfoCard title="تاريخ الميلاد" value={student?.birth_date ? new Date(student.birth_date).toLocaleDateString('ar-EG') : 'غير محدد'} icon={CalendarCheck} color="slate" />
                  <InfoCard title="رقم ولي الأمر" value={parent?.phone || student?.parent_phone || 'غير متاح'} icon={ShieldCheck} color="indigo" />
                  <div className="sm:col-span-2 lg:col-span-1 p-8 bg-white rounded-[32px] border border-slate-50 shadow-sm flex flex-col gap-2">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ملاحظات إضافية</p>
                     <p className="text-sm font-bold text-slate-600 leading-relaxed truncate-3-lines">{student?.notes || 'لا توجد ملاحظات أكاديمية أو سلوكية مسجلة لهذا الطالب.'}</p>
                  </div>
               </div>
             )}
          </div>
        </QueryStateHandler>
      </div>

      {showEdit && student && (
        <EditStudentModal 
          student={student} 
          classes={classes} 
          user={currentUser}
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); refetchStudent(); }}
        />
      )}
    </AppLayout>
  );
}

function AttendanceLegend({ label, color }: { label: string, color: string }) {
   return (
      <div className="flex items-center gap-2">
         <div className={cn("w-3 h-3 rounded-full shadow-sm", color)} />
         <span className="text-[10px] font-black text-slate-400">{label}</span>
      </div>
   );
}

function InfoCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-50 text-slate-600"
  };
  return (
    <div className="p-6 md:p-8 bg-white rounded-[28px] md:rounded-[32px] border border-slate-50 shadow-xl shadow-slate-200/20 flex items-center gap-4 md:gap-5 group hover:bg-slate-50/50 transition-all text-right translate-x-0">
       <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:rotate-6", colors[color])}>
          <Icon className="w-6 h-6 md:w-7 md:h-7" />
       </div>
       <div className="min-w-0">
          <p className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest truncate">{title}</p>
          <p className="text-sm md:text-base font-black text-slate-900 leading-none mt-1 truncate">{value || 'غير محدد'}</p>
       </div>
    </div>
  );
}
