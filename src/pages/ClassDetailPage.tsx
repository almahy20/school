import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, School, Users, Edit2, Trash2, 
  User, ChevronLeft, Calendar, Shield, Activity, 
  Search, Loader2, Printer, BookOpen, Plus, Edit3, Layers,
  CalendarCheck, MessageSquare, Check, X
} from 'lucide-react';
import { EditClassModal } from './ClassesPage';
import ClassExamsView from '@/components/dashboard/ClassExamsView';
import ClassMessagesView from '@/components/dashboard/ClassMessagesView';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  useClass, 
  useClassStudents, 
  useTeachers,
  useDeleteClass,
  useCurriculums,
  useCurriculumSubjects,
  useUpsertCurriculum,
  useDeleteCurriculum,
  useUpsertSubject,
  useDeleteSubject,
  useAssignCurriculumToClass,
  useClassAttendance,
  useUpsertAttendance
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [showEdit, setShowEdit] = useState(false);
  const [viewMode, setViewMode] = useState<'details' | 'exams' | 'curriculum' | 'attendance' | 'messages'>('details');

  // ── Curriculum Management State ──
  const [showAddCurriculum, setShowAddCurriculum] = useState(false);
  const [newCurriculum, setNewCurriculum] = useState({ name: '', status: 'active' as 'active' | 'inactive' });
  const [editingCurriculum, setEditingCurriculum] = useState<any | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState({ subject_name: '', content: '' });
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [selectedCurriculumForClass, setSelectedCurriculumForClass] = useState<string | null>(null);
  const [searchCurriculum, setSearchCurriculum] = useState('');

  // ── Attendance State ──
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: dbAttendanceData, isLoading: attendanceLoading } = useClassAttendance(id || null, attendanceDate);
  const dbAttendance = useMemo(() => dbAttendanceData || [], [dbAttendanceData]);
  const [localAttendance, setLocalAttendance] = useState<any[]>([]);
  const upsertAttendanceMutation = useUpsertAttendance();

  // Sync local attendance with DB
  useEffect(() => {
    if (dbAttendance) {
      setLocalAttendance(dbAttendance);
    }
  }, [dbAttendance]); // Sync local attendance with DB when it changes

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

  const markSelectedPresent = (selectedIds: string[]) => {
    setLocalAttendance(prev => prev.map(a => selectedIds.includes(a.studentId) ? { ...a, status: 'present' } : a));
  };

  const handleSaveAttendance = async () => {
    if (!id || !currentUser?.schoolId) return;
    
    const records = localAttendance
      .filter(a => a.status !== null)
      .map(a => ({
        student_id: a.studentId,
        class_id: id,
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

  // ── Queries ──
  const { data: classItem, isLoading: classLoading, error: classError, refetch: refetchClass } = useClass(id);
  const { data: students = [], isLoading: studentsLoading } = useClassStudents(id);
  
  // Teachers query for display and selection
  const { data: allTeachersData, isLoading: teachersLoading } = useTeachers(1, 1000, '', 'الكل');
  const allTeachers = useMemo(() => Array.isArray(allTeachersData?.data) ? allTeachersData.data : [], [allTeachersData]);

  const teacher = useMemo(() => {
    return allTeachers.find((t: any) => t.id === classItem?.teacher_id);
  }, [allTeachers, classItem?.teacher_id]);

  // Curriculum queries
  const { data: curriculums = [], isLoading: curriculumsLoading, error: curriculumsError, refetch: refetchCurriculums } = useCurriculums();
  const { data: curriculumSubjects = [], isLoading: subjectsLoading, error: subjectsError, refetch: refetchSubjects } = useCurriculumSubjects(classItem?.curriculum_id || null);

  // ── Mutations ──
  const deleteClassMutation = useDeleteClass();
  const upsertCurriculumMutation = useUpsertCurriculum();
  const deleteCurriculumMutation = useDeleteCurriculum();
  const upsertSubjectMutation = useUpsertSubject();
  const deleteSubjectMutation = useDeleteSubject();
  const assignCurriculumMutation = useAssignCurriculumToClass();

   const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا الفصل الدراسي نهائياً؟ سيؤدي هذا لإزالة ارتباط الطلاب به.')) return;
    try {
      await deleteClassMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح' });
      navigate('/classes');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // ── Curriculum Handlers ──
  const handleAddCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurriculum.name.trim()) return;
    try {
      const curriculum = await upsertCurriculumMutation.mutateAsync({
        name: newCurriculum.name.trim(),
        status: newCurriculum.status,
      });
      // Assign the new curriculum to this class
      await assignCurriculumMutation.mutateAsync({
        classId: id!,
        curriculumId: curriculum.id,
      });
      setShowAddCurriculum(false);
      setNewCurriculum({ name: '', status: 'active' });
      toast({ title: 'تم إضافة المنهج وربطه بالفصل بنجاح' });
      refetchClass();
      refetchCurriculums();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurriculum || !editingCurriculum.name.trim()) return;
    try {
      await upsertCurriculumMutation.mutateAsync({
        id: editingCurriculum.id,
        name: editingCurriculum.name.trim(),
        status: editingCurriculum.status,
      });
      setEditingCurriculum(null);
      toast({ title: 'تم تحديث المنهج بنجاح' });
      refetchCurriculums();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCurriculum = async (curriculumId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنهج؟ سيتم إلغاء ربطه من الفصل.')) return;
    try {
      await deleteCurriculumMutation.mutateAsync(curriculumId);
      // Unlink from class
      await assignCurriculumMutation.mutateAsync({
        classId: id!,
        curriculumId: null,
      });
      toast({ title: 'تم حذف المنهج بنجاح' });
      refetchClass();
      refetchCurriculums();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classItem?.curriculum_id || !newSubject.subject_name.trim()) return;
    try {
      await upsertSubjectMutation.mutateAsync({
        curriculum_id: classItem.curriculum_id,
        subject_name: newSubject.subject_name.trim(),
        content: newSubject.content.trim() || null,
      });
      setShowAddSubject(false);
      setNewSubject({ subject_name: '', content: '' });
      toast({ title: 'تم إضافة المادة بنجاح' });
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.subject_name.trim()) return;
    try {
      await upsertSubjectMutation.mutateAsync({
        id: editingSubject.id,
        curriculum_id: editingSubject.curriculum_id,
        subject_name: editingSubject.subject_name.trim(),
        content: editingSubject.content?.trim() || null,
      });
      setEditingSubject(null);
      toast({ title: 'تم تحديث المادة بنجاح' });
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المادة؟')) return;
    if (!classItem?.curriculum_id) return;
    try {
      await deleteSubjectMutation.mutateAsync({ id: subjectId, curriculumId: classItem.curriculum_id });
      toast({ title: 'تم حذف المادة بنجاح' });
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleChangeCurriculum = async (curriculumId: string | null) => {
    try {
      await assignCurriculumMutation.mutateAsync({
        classId: id!,
        curriculumId,
      });
      toast({ title: curriculumId ? 'تم تغيير المنهج بنجاح' : 'تم إلغاء ربط المنهج' });
      refetchClass();
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const isLoadingTotal = classLoading || studentsLoading || teachersLoading;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-8 lg:gap-10 max-w-[1400px] mx-auto text-right pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 px-3 md:px-0" dir="rtl">
        
        <QueryStateHandler
          loading={classLoading}
          error={classError}
          data={classItem}
          onRetry={refetchClass}
          loadingMessage="جاري مزامنة سجل الفصل الدراسي..."
        >
          {/* Ultra-Premium Hero Banner */}
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
                         {students.length} طالب مقيد
                      </Badge>
                    </div>
                 </div>
              </div>
            </div>
            
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-4 md:gap-5 relative z-10 w-full lg:w-auto lg:justify-end mt-6 lg:mt-0">
                <Button 
                  onClick={() => setShowEdit(true)}
                  className="h-14 md:h-16 px-8 rounded-2xl md:rounded-[24px] bg-white text-slate-900 font-black hover:bg-slate-50 transition-all shadow-xl shadow-white/5 gap-3 text-xs md:text-sm"
                >
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" /> تعديل إعدادات الفصل
                </Button>
                <Button 
                  onClick={handleDelete}
                  disabled={deleteClassMutation.isPending}
                  className="h-14 md:h-16 w-14 md:w-16 rounded-2xl md:rounded-[24px] bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all shadow-lg flex items-center justify-center shrink-0 backdrop-blur-md"
                >
                  {deleteClassMutation.isPending ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <Trash2 className="w-6 h-6 md:w-7 md:h-7" />}
                </Button>
              </div>
            )}
          </header>

          {/* Action Cards for Teachers and Admins */}
          {(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && viewMode === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 mt-8">
              {/* Attendance Card */}
              <button
                onClick={() => setViewMode('attendance')}
                className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-10 rounded-[48px] text-white flex flex-col items-center justify-center gap-5 shadow-2xl hover:scale-105 transition-all group min-h-[240px]"
              >
                <CalendarCheck className="w-20 h-20 group-hover:scale-110 transition-transform" />
                <h3 className="text-3xl font-black">رصد الحضور</h3>
                <p className="text-base text-indigo-100">تسجيل حضور وغياب الطلاب</p>
                <span className="mt-2 px-6 py-2 bg-white/20 rounded-full text-sm font-bold group-hover:bg-white/30 transition-all">
                  فتح سجل الحضور ←
                </span>
              </button>

              {/* Exams Card */}
              <button
                onClick={() => setViewMode('exams')}
                className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-10 rounded-[48px] text-white flex flex-col items-center justify-center gap-5 shadow-2xl hover:scale-105 transition-all group min-h-[240px]"
              >
                <BookOpen className="w-20 h-20 group-hover:scale-110 transition-transform" />
                <h3 className="text-3xl font-black">الاختبارات والدرجات</h3>
                <p className="text-base text-emerald-100">إنشاء اختبارات ورصد الدرجات</p>
                <span className="mt-2 px-6 py-2 bg-white/20 rounded-full text-sm font-bold group-hover:bg-white/30 transition-all">
                  إدارة الاختبارات ←
                </span>
              </button>

              {/* Messages Card - Teacher Only */}
              {currentUser?.role === 'teacher' && (
                <button
                  onClick={() => setViewMode('messages')}
                  className="bg-gradient-to-br from-blue-500 to-blue-600 p-10 rounded-[48px] text-white flex flex-col items-center justify-center gap-5 shadow-2xl hover:scale-105 transition-all group min-h-[240px]"
                >
                  <MessageSquare className="w-20 h-20 group-hover:scale-110 transition-transform" />
                  <h3 className="text-3xl font-black">رسائل لأولياء الأمور</h3>
                  <p className="text-base text-blue-100">إرسال رسائل لأولياء أمور طلاب هذا الفصل</p>
                  <span className="mt-2 px-6 py-2 bg-white/20 rounded-full text-sm font-bold group-hover:bg-white/30 transition-all">
                    فتح الرسائل ←
                  </span>
                </button>
              )}

              {/* Curriculum Management Card - Teacher and Admin */}
              <button
                onClick={() => setViewMode('curriculum')}
                className="bg-gradient-to-br from-purple-500 to-purple-600 p-10 rounded-[48px] text-white flex flex-col items-center justify-center gap-5 shadow-2xl hover:scale-105 transition-all group min-h-[240px]"
              >
                <Layers className="w-20 h-20 group-hover:scale-110 transition-transform" />
                <h3 className="text-3xl font-black">إدارة المنهج</h3>
                <p className="text-base text-purple-100">
                  {classItem?.curriculum_id ? 'عرض وتغيير المنهج' : 'ربط منهج بالفصل'}
                </p>
                <span className="mt-2 px-6 py-2 bg-white/20 rounded-full text-sm font-bold group-hover:bg-white/30 transition-all">
                  إدارة المنهج الدراسي ←
                </span>
              </button>
            </div>
          )}

          {/* Exams View for Teachers and Admins */}
          {(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && viewMode === 'exams' && (
            <div className="space-y-8 mt-8">
              {/* Back Button */}
              <button
                onClick={() => setViewMode('details')}
                className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 font-bold transition-colors text-lg"
              >
                <ArrowRight className="w-6 h-6" />
                <span>العودة إلى تفاصيل الفصل</span>
              </button>

              {/* Exams View */}
              <ClassExamsView 
                classId={id!} 
                className={classItem?.name || ''} 
              />
            </div>
          )}

          {/* Messages View for Teachers and Admins */}
          {(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && viewMode === 'messages' && (
            <div className="space-y-8 mt-8">
              {/* Back Button */}
              <button
                onClick={() => setViewMode('details')}
                className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 font-bold transition-colors text-lg"
              >
                <ArrowRight className="w-6 h-6" />
                <span>العودة إلى تفاصيل الفصل</span>
              </button>

              {/* Messages View */}
              <ClassMessagesView 
                classId={id!} 
                className={classItem?.name || ''} 
              />
            </div>
          )}

          {/* Attendance View for Teachers and Admins */}
          {(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && viewMode === 'attendance' && (
            <div className="space-y-8 mt-8">
              {/* Back Button */}
              <button
                onClick={() => setViewMode('details')}
                className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 font-bold transition-colors text-lg"
              >
                <ArrowRight className="w-6 h-6" />
                <span>العودة إلى تفاصيل الفصل</span>
              </button>

              {/* Attendance Section */}
              <section className="bg-white/40 backdrop-blur-md p-10 rounded-[48px] border border-white/50 shadow-xl space-y-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[22px] bg-indigo-600 flex items-center justify-center text-white shadow-xl">
                      <CalendarCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">رصد الحضور والغياب</h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">{classItem?.name || ''}</p>
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
            </div>
          )}
        </QueryStateHandler>

          {/* Curriculum View for Teachers and Admins */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'teacher') && viewMode === 'curriculum' && (
            <div className="space-y-8 mt-8">
              {/* Back Button */}
              <button
                onClick={() => setViewMode('details')}
                className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 font-bold transition-colors text-lg"
              >
                <ArrowRight className="w-6 h-6" />
                <span>العودة إلى تفاصيل الفصل</span>
              </button>

              {/* Curriculum Management Section */}
              <section className="bg-white/40 backdrop-blur-md p-10 rounded-[48px] border border-white/50 shadow-xl space-y-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[22px] bg-indigo-600 flex items-center justify-center text-white shadow-xl">
                      <BookOpen className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">إدارة المنهج الدراسي</h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">إنشاء وإدارة المناهج والمواد التعليمية لهذا الفصل</p>
                    </div>
                  </div>
                </div>

            {/* Curriculum Assignment */}
            <div className="space-y-6">
              <div className="flex items-center justify-between p-8 rounded-[32px] bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-4">
                  <Layers className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="text-sm font-black text-slate-900">المنهج الحالي</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {classItem?.curriculum_id ? 'فصل مرتبط بمنهج دراسي' : 'لا يوجد منهج مربوط بالفصل'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {classItem?.curriculum_id ? (
                    <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-xs px-4 py-2">
                      مربوط بمنهج
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50 font-bold text-xs px-4 py-2">
                      غير مربوط
                    </Badge>
                  )}
                  <Button 
                    onClick={() => setShowAddCurriculum(true)}
                    className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg gap-2 text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    {classItem?.curriculum_id ? 'تغيير المنهج' : 'ربط منهج'}
                  </Button>
                </div>
              </div>

              {/* Subjects List */}
              {classItem?.curriculum_id && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      المواد الدراسية
                    </h3>
                    <Button 
                      onClick={() => setShowAddSubject(true)}
                      className="h-11 px-5 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all shadow-md gap-2 text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة مادة
                    </Button>
                  </div>

                  <QueryStateHandler
                    loading={subjectsLoading}
                    error={subjectsError}
                    data={curriculumSubjects}
                    onRetry={refetchSubjects}
                    loadingMessage="جاري تحميل المواد..."
                    emptyMessage="لا توجد مواد مضافة لهذا المنهج"
                    isEmpty={curriculumSubjects.length === 0}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {curriculumSubjects.map(subject => (
                        <div key={subject.id} className="p-6 rounded-[24px] border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-lg transition-all group">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <BookOpen className="w-6 h-6" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <h4 className="text-base font-black text-slate-900">{subject.subject_name}</h4>
                                {subject.content && (
                                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{subject.content}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setEditingSubject(subject)}
                                className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteSubject(subject.id)}
                                className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </QueryStateHandler>
                </div>
              )}
            </div>
          </section>
        </div>
          )}
      </div>

      {showEdit && classItem && (
        <EditClassModal 
          classItem={classItem} 
          teachers={allTeachers as any} 
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); refetchClass(); }}
        />
      )}

      {/* Curriculum Modals */}
      <Dialog open={showAddCurriculum} onOpenChange={setShowAddCurriculum}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">
              {classItem?.curriculum_id ? 'تغيير المنهج' : 'ربط منهج بالفصل'}
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">
              {classItem?.curriculum_id ? 'اختر منهج جديد لهذا الفصل' : 'أنشئ منهج جديد أو اختر من المناهج الموجودة'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8 space-y-6">
            {/* Create New Curriculum */}
            <form onSubmit={handleAddCurriculum} className="space-y-4 pb-6 border-b border-slate-100">
              <p className="text-xs font-black text-slate-500">إنشاء منهج جديد</p>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
                <Input value={newCurriculum.name} onChange={e => setNewCurriculum({...newCurriculum, name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
                <select value={newCurriculum.status} onChange={e => setNewCurriculum({...newCurriculum, status: e.target.value as 'active' | 'inactive'})} className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg appearance-none">
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
              <Button type="submit" disabled={upsertCurriculumMutation.isPending} className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">
                {upsertCurriculumMutation.isPending ? 'جاري الحفظ...' : 'إنشاء وربط المنهج'}
              </Button>
            </form>

            {/* Or Select Existing */}
            {curriculums.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-500">أو اختر منهج موجود</p>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {curriculums.map(curr => (
                    <button
                      key={curr.id}
                      onClick={() => {
                        handleChangeCurriculum(curr.id);
                        setShowAddCurriculum(false);
                      }}
                      className="w-full p-5 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50 transition-all text-right"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-indigo-600" />
                          <span className="font-black text-slate-900">{curr.name}</span>
                        </div>
                        <Badge variant={curr.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {curr.status === 'active' ? 'نشط' : 'غير نشط'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Unlink Current */}
            {classItem?.curriculum_id && (
              <Button 
                onClick={() => {
                  handleChangeCurriculum(null);
                  setShowAddCurriculum(false);
                }}
                variant="outline" 
                className="w-full h-14 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black"
              >
                إلغاء ربط المنهج الحالي
              </Button>
            )}

            <Button onClick={() => setShowAddCurriculum(false)} variant="ghost" className="w-full h-14 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCurriculum} onOpenChange={() => setEditingCurriculum(null)}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">تعديل المنهج</DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">تعديل البيانات الأساسية للمسار التعليمي.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCurriculum} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
              <Input value={editingCurriculum?.name || ''} onChange={e => setEditingCurriculum({...editingCurriculum!, name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
              <select value={editingCurriculum?.status || 'active'} onChange={e => setEditingCurriculum({...editingCurriculum!, status: e.target.value as 'active' | 'inactive'})} className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg appearance-none">
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={upsertCurriculumMutation.isPending} className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">حفظ التغييرات</Button>
              <Button type="button" onClick={() => setEditingCurriculum(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">إضافة مادة تعليمية</DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">أدخل تفاصيل المادة الجديدة للمنهج.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubject} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
              <Input placeholder="مثال: لغتي الجميلة" value={newSubject.subject_name} onChange={e => setNewSubject({...newSubject, subject_name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى التعليمي</label>
              <Textarea value={newSubject.content} onChange={e => setNewSubject({...newSubject, content: e.target.value})} className="min-h-[120px] px-6 py-4 rounded-2xl bg-slate-50 border-none text-base font-bold resize-none" />
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={upsertSubjectMutation.isPending} className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">إضافة المادة</Button>
              <Button type="button" onClick={() => setShowAddSubject(false)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSubject} onOpenChange={() => setEditingSubject(null)}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">تعديل المادة</DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">تحديث بيانات المادة الدراسية.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubject} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
              <Input value={editingSubject?.subject_name || ''} onChange={e => setEditingSubject({...editingSubject!, subject_name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى التعليمي</label>
              <Textarea value={editingSubject?.content || ''} onChange={e => setEditingSubject({...editingSubject!, content: e.target.value})} className="min-h-[120px] px-6 py-4 rounded-2xl bg-slate-50 border-none text-base font-bold resize-none" />
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={upsertSubjectMutation.isPending} className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">حفظ التعديلات</Button>
              <Button type="button" onClick={() => setEditingSubject(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function StatsCard({ title, value, sub, icon: Icon, color, smallValue }: any) {
  const configs: any = {
    indigo: "bg-slate-900 text-white border-slate-900 shadow-2xl shadow-slate-200",
    emerald: "bg-white text-slate-900 border-slate-50 shadow-xl shadow-slate-100",
    amber: "bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-100",
  };
  
  const iconConfigs: any = {
    indigo: "bg-white/10 text-white",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-white/20 text-white",
  };

  return (
    <div className={cn("premium-card p-10 flex flex-col justify-between border-[0.5px] h-60 rounded-[48px] transition-all hover:scale-[1.03] duration-500", configs[color])}>
       <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", iconConfigs[color])}>
          <Icon className="w-7 h-7" />
       </div>
       <div className="mt-8">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60", color === 'emerald' ? "text-slate-400" : "text-white/40")}>{title}</p>
          <div className="flex flex-col">
          <h3 className={cn("text-3xl md:text-5xl tracking-tighter drop-shadow-sm font-black mt-1", smallValue ? "text-2xl" : "text-slate-900", color === 'indigo' || color === 'amber' ? "text-white" : "")}>
             {value}
          </h3>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-2", color === 'emerald' ? "text-slate-500" : "text-white/60")}>
             {sub}
          </p>
        </div>
      </div>
    </div>
  );
}
