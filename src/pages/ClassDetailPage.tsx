import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, BookOpen, Layers, CalendarCheck, MessageSquare
} from 'lucide-react';
import { EditClassModal } from './ClassesPage';
import ClassExamsView from '@/components/dashboard/ClassExamsView';
import ClassMessagesView from '@/components/dashboard/ClassMessagesView';
import { 
  useClass, 
  useClassStudents, 
  useTeachers,
  useDeleteClass,
  useCurriculums,
  useCurriculumSubjects,
  useUpsertCurriculum,
  useUpsertSubject,
  useAssignCurriculumToClass,
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

// Sub-components
import { ClassHero } from '@/components/class-detail/ClassHero';
import { ClassAttendanceView } from '@/components/class-detail/ClassAttendanceView';
import { ClassCurriculumView } from '@/components/class-detail/ClassCurriculumView';
import { CurriculumModals } from '@/components/class-detail/CurriculumModals';

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

  // ── Queries ──
  const { data: classItem, isLoading: classLoading, error: classError, refetch: refetchClass } = useClass(id);
  const { data: students = [] } = useClassStudents(id);
  const { data: allTeachersData, isLoading: teachersLoading } = useTeachers(1, 1000, '', 'الكل');
  const allTeachers = useMemo(() => Array.isArray(allTeachersData?.data) ? allTeachersData.data : [], [allTeachersData]);
  const { data: curriculums = [], refetch: refetchCurriculums } = useCurriculums();
  const { refetch: refetchSubjects } = useCurriculumSubjects(classItem?.curriculum_id || null);

  // ── Mutations ──
  const deleteClassMutation = useDeleteClass();
  const upsertCurriculumMutation = useUpsertCurriculum();
  const upsertSubjectMutation = useUpsertSubject();
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

  const handleAddCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurriculum.name.trim()) return;
    try {
      const curriculum = await upsertCurriculumMutation.mutateAsync({
        name: newCurriculum.name.trim(),
        status: newCurriculum.status,
      });
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

  const isStaff = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-8 lg:gap-10 max-w-[1400px] mx-auto text-right pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 px-3 md:px-0" dir="rtl">
        
        <QueryStateHandler
          loading={classLoading || teachersLoading}
          error={classError}
          data={classItem}
          onRetry={refetchClass}
          loadingMessage="جاري مزامنة سجل الفصل الدراسي..."
        >
          <ClassHero 
            classItem={classItem}
            studentCount={students.length}
            isAdmin={currentUser?.role === 'admin'}
            onEdit={() => setShowEdit(true)}
            onDelete={handleDelete}
            isDeleting={deleteClassMutation.isPending}
          />

          {/* Action Cards */}
          {isStaff && viewMode === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 mt-8">
              <ActionButton 
                onClick={() => setViewMode('attendance')}
                icon={CalendarCheck}
                title="رصد الحضور"
                description="تسجيل حضور وغياب الطلاب"
                color="indigo"
              />
              <ActionButton 
                onClick={() => setViewMode('exams')}
                icon={BookOpen}
                title="الاختبارات والدرجات"
                description="إنشاء اختبارات ورصد الدرجات"
                color="emerald"
              />
              {currentUser?.role === 'teacher' && (
                <ActionButton 
                  onClick={() => setViewMode('messages')}
                  icon={MessageSquare}
                  title="رسائل لأولياء الأمور"
                  description="إرسال رسائل لأولياء أمور طلاب هذا الفصل"
                  color="blue"
                />
              )}
              <ActionButton 
                onClick={() => setViewMode('curriculum')}
                icon={Layers}
                title="إدارة المنهج"
                description={classItem?.curriculum_id ? 'عرض وتغيير المنهج' : 'ربط منهج بالفصل'}
                color="purple"
              />
            </div>
          )}

          {/* Sub-Views */}
          {isStaff && viewMode !== 'details' && (
            <div className="space-y-8 mt-8">
              <button
                onClick={() => setViewMode('details')}
                className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 font-bold transition-colors text-lg"
              >
                <ArrowRight className="w-6 h-6" />
                <span>العودة إلى تفاصيل الفصل</span>
              </button>

              {viewMode === 'exams' && <ClassExamsView classId={id!} className={classItem?.name || ''} />}
              {viewMode === 'messages' && <ClassMessagesView classId={id!} className={classItem?.name || ''} />}
              {viewMode === 'attendance' && <ClassAttendanceView classId={id!} className={classItem?.name || ''} onBack={() => setViewMode('details')} />}
              {viewMode === 'curriculum' && (
                <ClassCurriculumView 
                  classItem={classItem}
                  onAddCurriculum={() => setShowAddCurriculum(true)}
                  onAddSubject={() => setShowAddSubject(true)}
                  onEditSubject={setEditingSubject}
                />
              )}
            </div>
          )}
        </QueryStateHandler>
      </div>

      {showEdit && classItem && (
        <EditClassModal 
          classItem={classItem} 
          teachers={allTeachers as any} 
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); refetchClass(); }}
        />
      )}

      <CurriculumModals 
        showAddCurriculum={showAddCurriculum}
        setShowAddCurriculum={setShowAddCurriculum}
        newCurriculum={newCurriculum}
        setNewCurriculum={setNewCurriculum}
        handleAddCurriculum={handleAddCurriculum}
        isSavingCurriculum={upsertCurriculumMutation.isPending}
        curriculums={curriculums}
        handleChangeCurriculum={handleChangeCurriculum}
        classItem={classItem}
        editingCurriculum={editingCurriculum}
        setEditingCurriculum={setEditingCurriculum}
        handleEditCurriculum={handleEditCurriculum}
        showAddSubject={showAddSubject}
        setShowAddSubject={setShowAddSubject}
        newSubject={newSubject}
        setNewSubject={setNewSubject}
        handleAddSubject={handleAddSubject}
        isSavingSubject={upsertSubjectMutation.isPending}
        editingSubject={editingSubject}
        setEditingSubject={setEditingSubject}
        handleEditSubject={handleEditSubject}
      />
    </AppLayout>
  );
}

function ActionButton({ onClick, icon: Icon, title, description, color }: any) {
  const colors: any = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    blue: "from-blue-500 to-blue-600",
    purple: "from-purple-500 to-purple-600",
  };

  return (
    <button
      onClick={onClick}
      className={`bg-gradient-to-br ${colors[color]} p-10 rounded-[48px] text-white flex flex-col items-center justify-center gap-5 shadow-2xl hover:scale-105 transition-all group min-h-[240px]`}
    >
      <Icon className="w-20 h-20 group-hover:scale-110 transition-transform" />
      <h3 className="text-3xl font-black">{title}</h3>
      <p className="text-base opacity-90">{description}</p>
      <span className="mt-2 px-6 py-2 bg-white/20 rounded-full text-sm font-bold group-hover:bg-white/30 transition-all">
        فتح ←
      </span>
    </button>
  );
}
