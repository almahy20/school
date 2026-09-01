import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, School, BookOpen, Award, User, 
  Trash2, Edit2, CalendarCheck, Info, Loader2,
  Phone, MapPin, Hash, UserCircle, GraduationCap, FolderOpen, ChevronLeft
} from 'lucide-react';
import { EditStudentModal } from './StudentsPage';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  useChildFullDetails,
  useAllClasses,
  useDeleteStudent
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

type Tab = 'info' | 'curriculum' | 'grades' | 'attendance';

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Curriculum drill-down state
  const [curriculumView, setCurriculumView] = useState<'folders' | 'subjects'>('folders');
  const [selectedCurrMonth, setSelectedCurrMonth] = useState<string>('');

  // Grades drill-down state
  const [gradesView, setGradesView] = useState<'folders' | 'list'>('folders');
  const [selectedGradesFolder, setSelectedGradesFolder] = useState<string>('');

  const { data: fullData, isLoading, error, refetch } = useChildFullDetails(id);
  const student = fullData;
  const grades = useMemo(() => fullData?.grades || [], [fullData]);
  const attendance = useMemo(() => fullData?.attendance || [], [fullData]);
  const curriculumSubjects = useMemo(() => fullData?.curriculum || [], [fullData]);

  // Group curriculum by month (term)
  const curriculumByMonth = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (curriculumSubjects as any[]).forEach((sub: any) => {
      const key = (sub.term || 'عام').trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(sub);
    });
    return groups;
  }, [curriculumSubjects]);
  const curriculumMonths = useMemo(() => Object.keys(curriculumByMonth), [curriculumByMonth]);

  // Group grades by exam card title — using exam_templates title for correct card name
  // ترتيب الكروت بالأحدث أولاً بناءً على created_at للـ exam_template
  const { gradesByFolder, gradeFolderKeys } = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const folderDates: Record<string, string> = {};

    (grades as any[]).forEach((g: any) => {
      // نستخدم عنوان الكارت من exam_templates — هو الاسم الصح اللي دخله المعلم
      const key = (
        g.exam_templates?.title ||
        g.exam_templates?.term  ||
        g.term                  ||
        g.title                 ||
        'تقييم شهري'
      ).trim();

      if (!groups[key]) {
        groups[key] = [];
        folderDates[key] = g.created_at || g.date || '';
      }
      // نحتفظ بأحدث تاريخ للكارت
      if ((g.created_at || g.date || '') > folderDates[key]) {
        folderDates[key] = g.created_at || g.date || '';
      }
      groups[key].push(g);
    });

    // ترتيب الكروت بالأحدث أولاً
    const sortedKeys = Object.keys(groups).sort(
      (a, b) => (folderDates[b] > folderDates[a] ? 1 : -1)
    );

    return { gradesByFolder: groups, gradeFolderKeys: sortedKeys };
  }, [grades]);

  const fullGrades = grades; // alias for template compatibility

  const { data: classesData } = useAllClasses();
  const classes = Array.isArray(classesData) ? classesData : [];

  const deleteStudentMutation = useDeleteStudent();

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteStudentMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح' });
      navigate('/students');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Info }[] = [
    { id: 'info', label: 'البيانات الأساسية', icon: Info },
    { id: 'curriculum', label: 'المنهج الدراسي', icon: BookOpen },
    { id: 'grades', label: 'النتائج والدرجات', icon: Award },
    { id: 'attendance', label: 'سجل الحضور', icon: CalendarCheck },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pb-24 px-2 md:px-0 space-y-6 text-right animate-in fade-in duration-500" dir="rtl">

        {/* ── Hero Banner ── */}
        <header className="relative bg-slate-900 rounded-[40px] overflow-hidden p-8 md:p-10 min-h-[200px] flex flex-col justify-between border border-white/5 shadow-2xl">
          {/* Background blobs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/15 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />

          {/* Top row */}
          <div className="flex items-center justify-between gap-4 relative z-10">
            <button
              onClick={() => navigate(currentUser?.role === 'parent' ? '/' : '/students')}
              className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
            </button>

            {currentUser?.role === 'admin' && student && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowEdit(true)}
                  className="h-11 px-5 rounded-xl bg-white text-slate-900 font-black text-xs hover:bg-slate-100 shadow-lg gap-2"
                >
                  <Edit2 className="w-4 h-4 text-indigo-600" />
                  تعديل
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleteStudentMutation.isPending}
                  className="h-11 w-11 bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl flex items-center justify-center transition-all"
                >
                  {deleteStudentMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>

          {/* Student info */}
          {student ? (
            <div className="flex items-end gap-5 relative z-10 mt-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-2xl shadow-indigo-900/40 flex items-center justify-center font-black text-2xl md:text-3xl shrink-0 border border-white/20">
                {student?.name?.trim()?.[0] || '?'}
              </div>
              <div className="space-y-2 min-w-0">
                <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight truncate">
                  {student.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white/10 text-white border border-white/10 font-bold text-[10px] px-3 py-1 rounded-xl">
                    <School className="w-3 h-3 ml-1 inline" />
                    {student?.classes?.name || 'غير مسجل بفصل'}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-bold text-[10px] px-3 py-1 rounded-xl">
                    <GraduationCap className="w-3 h-3 ml-1 inline" />
                    {student?.academic_year || '2025/2026'}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-5 relative z-10 mt-6 animate-pulse">
              <div className="w-16 h-16 bg-white/10 rounded-[24px] shrink-0" />
              <div className="space-y-2 w-56">
                <div className="h-8 bg-white/20 rounded-xl" />
                <div className="h-5 w-36 bg-white/10 rounded-lg" />
              </div>
            </div>
          )}
        </header>

        {/* ── Query wrapper ── */}
        <QueryStateHandler loading={isLoading} error={error} data={student} onRetry={refetch} loadingMessage="جاري تحميل سجل الطالب...">

          {/* ── Tabs ── */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0',
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-white text-slate-400 border border-slate-100 hover:text-slate-700 hover:border-slate-200'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab Content ── */}
          <div className="mt-2">

            {/* INFO TAB */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'الاسم الكامل', value: student?.name, icon: User, color: 'indigo' },
                  { label: 'الفصل', value: student?.classes?.name, icon: School, color: 'purple' },
                  { label: 'معلم الفصل', value: student?.classes?.teacher?.full_name, icon: UserCircle, color: 'emerald' },
                  { label: 'رقم القيد', value: student?.id?.split('-')[0]?.toUpperCase(), icon: Hash, color: 'slate' },
                  { label: 'تاريخ الميلاد', value: student?.birth_date ? new Date(student.birth_date).toLocaleDateString('ar-EG') : null, icon: CalendarCheck, color: 'amber' },
                  { label: 'رقم ولي الأمر', value: student?.parent_phone, icon: Phone, color: 'indigo' },
                  { label: 'العنوان', value: student?.address, icon: MapPin, color: 'slate' },
                  { label: 'السنة الدراسية', value: student?.academic_year || '2025/2026', icon: GraduationCap, color: 'purple' },
                ].map(item => (
                  <InfoCard key={item.label} {...item} />
                ))}
                {student?.notes && (
                  <div className="sm:col-span-2 lg:col-span-3 p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">ملاحظات أكاديمية</p>
                    <p className="text-sm font-bold text-slate-600 leading-relaxed">{student.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* CURRICULUM TAB — Monthly Cards Drill-Down */}
            {activeTab === 'curriculum' && (
              <div className="space-y-4">
                {curriculumSubjects.length === 0 ? (
                  <EmptyState icon={BookOpen} message="لا يوجد محتوى دراسي مسجل لهذا الفصل حالياً." />
                ) : curriculumView === 'folders' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {curriculumMonths.map(month => {
                      const subs = curriculumByMonth[month] || [];
                      return (
                        <button
                          key={month}
                          onClick={() => { setSelectedCurrMonth(month); setCurriculumView('subjects'); }}
                          className="group text-right p-6 rounded-[28px] border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/60 transition-all duration-300 active:scale-[0.98]"
                        >
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition-colors shrink-0">
                              <FolderOpen className="w-6 h-6" />
                            </div>
                            <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 mt-1 shrink-0" />
                          </div>
                          <h3 className="font-black text-slate-900 text-base mb-1.5">📖 {month}</h3>
                          <p className="text-[11px] text-slate-400 font-bold mb-3">{subs.length} مادة مقررة</p>
                          <div className="flex flex-wrap gap-1.5">
                            {subs.slice(0, 4).map((s: any) => (
                              <span key={s.id} className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-lg">{s.subject_name}</span>
                            ))}
                            {subs.length > 4 && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-500 px-2 py-1 rounded-lg">+{subs.length - 4}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCurriculumView('folders')}
                        className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                        المنهج الدراسي
                      </button>
                      <span className="text-slate-200">/</span>
                      <span className="text-sm font-black text-slate-900">{selectedCurrMonth}</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-indigo-600" />
                        <div>
                          <h3 className="text-base font-black text-slate-900">مقررات {selectedCurrMonth}</h3>
                          <p className="text-[11px] text-slate-400 font-bold mt-0.5">{(curriculumByMonth[selectedCurrMonth] || []).length} مادة</p>
                        </div>
                      </div>
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(curriculumByMonth[selectedCurrMonth] || []).map((sub: any) => (
                          <div key={sub.id} className="p-5 rounded-[24px] border border-slate-100 bg-slate-50/50 hover:shadow-md transition-all">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <h4 className="font-black text-slate-900 text-sm">{sub.subject_name}</h4>
                            </div>
                            <div className="bg-white rounded-2xl p-4 text-sm font-bold text-slate-600 leading-relaxed border border-slate-100">
                              {sub.content || 'المحتوى لم يُحدد بعد.'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GRADES TAB — Monthly Cards Drill-Down */}
            {activeTab === 'grades' && (
              <div className="space-y-4">
                {fullGrades.length === 0 ? (
                  <EmptyState icon={Award} message="لم يتم رصد نتائج لهذا الطالب بعد." />
                ) : gradesView === 'folders' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {gradeFolderKeys.map(folder => {
                      const folderGrades = gradesByFolder[folder] || [];
                      const avg = folderGrades
                        .filter((g: any) => !isNaN(Number(g.score)))
                        .reduce((acc: number, g: any, _: any, arr: any[]) => acc + Number(g.score) / arr.length, 0);
                      return (
                        <button
                          key={folder}
                          onClick={() => { setSelectedGradesFolder(folder); setGradesView('list'); }}
                          className="group text-right p-6 rounded-[28px] border border-slate-100 bg-white hover:border-amber-200 hover:shadow-xl hover:shadow-amber-50/60 transition-all duration-300 active:scale-[0.98]"
                        >
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-colors shrink-0">
                              <Award className="w-6 h-6" />
                            </div>
                            <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-amber-500 mt-1 shrink-0" />
                          </div>
                          <h3 className="font-black text-slate-900 text-base mb-1.5">🏆 {folder}</h3>
                          <p className="text-[11px] text-slate-400 font-bold mb-3">{folderGrades.length} مادة دراسية</p>
                          <div className="flex flex-wrap gap-1.5">
                            {folderGrades.slice(0, 4).map((g: any) => (
                              <span key={g.id} className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-lg">
                                {g.exam_templates?.subject || g.subject || 'غير محدد'}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setGradesView('folders')}
                        className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                        الدرجات والنتائج
                      </button>
                      <span className="text-slate-200">/</span>
                      <span className="text-sm font-black text-slate-900">{selectedGradesFolder}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(gradesByFolder[selectedGradesFolder] || []).map((grade: any) => (
                        <div key={grade.id} className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                              <Award className="w-5 h-5" />
                            </div>
                            <h3 className="font-black text-slate-900 text-sm">{grade.exam_templates?.subject || grade.subject || 'غير محدد'}</h3>
                          </div>
                          <div className="px-5 py-2.5 bg-slate-900 rounded-2xl font-black text-white text-base shadow-lg shrink-0">
                            {grade.score}
                            {!isNaN(Number(grade.score)) && (
                              <span className="text-[10px] text-white/30 mr-1">/ {grade.max_score}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ATTENDANCE TAB */}
            {activeTab === 'attendance' && (
              <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-base font-black text-slate-900">المخطط الزمني للحضور</h3>
                  <div className="flex items-center gap-4">
                    <AttendanceLegend label="حاضر" color="bg-emerald-500" />
                    <AttendanceLegend label="متأخر" color="bg-amber-500" />
                    <AttendanceLegend label="غائب" color="bg-rose-500" />
                  </div>
                </div>

                {attendance.length === 0 ? (
                  <EmptyState icon={CalendarCheck} message="لا يوجد سجل حضور مسجل حالياً." />
                ) : (
                  <div className="space-y-8">
                    {Object.entries(
                      attendance
                        .slice()
                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .reduce((groups: any, record: any) => {
                          const date = new Date(record.date);
                          const key = `${date.getFullYear()}-${date.getMonth()}`;
                          if (!groups[key]) {
                            groups[key] = {
                              month: date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
                              records: []
                            };
                          }
                          groups[key].records.push(record);
                          return groups;
                        }, {})
                    ).map(([key, group]: [string, any]) => (
                      <div key={key}>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-px flex-1 bg-slate-100" />
                          <h4 className="text-sm font-black text-slate-400">{group.month}</h4>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-2.5">
                          {group.records.map((record: any) => {
                            const date = new Date(record.date);
                            return (
                              <div
                                key={record.id}
                                title={`${date.toLocaleDateString('ar-EG')} — ${record.status === 'present' ? 'حاضر' : record.status === 'late' ? 'متأخر' : 'غائب'}`}
                                className={cn(
                                  'aspect-square rounded-xl flex flex-col items-center justify-center font-black text-xs transition-all hover:scale-110 cursor-default border',
                                  record.status === 'present'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                    : record.status === 'late'
                                    ? 'bg-amber-50 border-amber-100 text-amber-600'
                                    : 'bg-rose-50 border-rose-100 text-rose-500'
                                )}
                              >
                                <span className="text-[8px] opacity-40">{date.toLocaleDateString('ar-EG', { month: 'short' })}</span>
                                <span>{date.getDate()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
          onSuccess={() => { setShowEdit(false); refetch(); }}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سجل الطالب نهائياً</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف سجل الطالب نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع البيانات المرتبطة بالطالب.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
            >
              {deleteStudentMutation.isPending ? 'جاري الحذف...' : 'حذف نهائي'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function InfoCard({ label, value, icon: Icon, color }: { label: string; value?: string | null; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colorMap[color] || colorMap.slate)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest truncate">{label}</p>
        <p className="text-sm font-black text-slate-900 mt-0.5 truncate">{value || 'غير محدد'}</p>
      </div>
    </div>
  );
}

function AttendanceLegend({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
      <span className="text-[10px] font-black text-slate-400">{label}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="py-20 text-center bg-white border border-dashed border-slate-100 rounded-[32px] space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mx-auto">
        <Icon className="w-8 h-8" />
      </div>
      <p className="text-slate-400 font-bold text-sm">{message}</p>
    </div>
  );
}
