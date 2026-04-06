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
  useUsers,
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
  const { data: classes = [] } = useClasses();
  const { data: allUsers = [] } = useUsers();
  const { data: branding } = useBranding();

  // ── Mutations ──
  const deleteStudentMutation = useDeleteStudent();

  const parents = useMemo(() => allUsers.filter(u => u.role === 'parent'), [allUsers]);

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
          {/* Header Section */}
          <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-10 sm:p-14 rounded-[56px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex items-center gap-6 relative z-10">
              <button 
                onClick={() => navigate(currentUser?.role === 'parent' ? '/' : '/students')}
                className="w-14 h-14 rounded-[22px] bg-white border border-slate-100 text-slate-300 hover:text-slate-900 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
              >
                 <ArrowRight className="w-6 h-6" />
              </button>
              
              <div className="w-20 h-20 rounded-[32px] bg-slate-900 flex items-center justify-center text-white shadow-2xl relative group-hover:rotate-3 transition-transform duration-500 font-black text-3xl">
                 {student?.name?.trim()[0]}
              </div>
              
              <div className="space-y-1">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{student?.name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                   <Badge className="bg-indigo-600 text-white border-none font-black text-[10px] uppercase px-4 py-1 rounded-full shadow-lg shadow-indigo-100">
                      {student?.classes?.name || 'غير مسجل بفصل'}
                   </Badge>
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                      <Clock className="w-4 h-4 text-slate-200" />
                      انضم في {new Date(student?.created_at || '').toLocaleDateString('ar-EG')}
                   </div>
                </div>
              </div>
            </div>
            
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-4 relative z-10">
                <Button 
                  onClick={() => setShowEdit(true)} 
                  variant="outline" 
                  className="h-14 px-8 rounded-2xl border-slate-100 text-slate-900 font-black text-xs hover:bg-slate-50 transition-all gap-3 shadow-xl shadow-slate-100"
                >
                  <Edit2 className="w-4 h-4 text-indigo-600" /> تعديل البيانات
                </Button>
                <Button 
                  onClick={handleDelete} 
                  variant="ghost" 
                  disabled={deleteStudentMutation.isPending}
                  className="h-14 w-14 text-rose-500 hover:bg-rose-50 rounded-2xl flex items-center justify-center transition-all"
                >
                  {deleteStudentMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Trash2 className="w-6 h-6" />}
                </Button>
              </div>
            )}
          </header>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-4 px-2 pb-2">
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
                    "px-8 py-4 rounded-[22px] text-xs font-black transition-all flex items-center gap-3 whitespace-nowrap border-2",
                    activeTab === tab.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xl shadow-slate-200 scale-105" 
                      : "bg-white text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600"
                  )}
               >
                  <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-indigo-400" : "text-slate-200")} />
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
    <div className="p-8 bg-white rounded-[32px] border border-slate-50 shadow-xl shadow-slate-200/20 flex items-center gap-5 group hover:bg-slate-50/50 transition-all">
       <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:rotate-6", colors[color])}>
          <Icon className="w-7 h-7" />
       </div>
       <div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{title}</p>
          <p className="text-base font-black text-slate-900 leading-none mt-1">{value || 'غير محدد'}</p>
       </div>
    </div>
  );
}
