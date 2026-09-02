import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowRight, BookOpen, Layers, CalendarCheck, MessageSquare, ChevronLeft, Users, ClipboardList
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
import { cn } from '@/lib/utils';

// Sub-components
import { ClassHero } from '@/components/class-detail/ClassHero';
import { ClassAttendanceView } from '@/components/class-detail/ClassAttendanceView';
import { ClassCurriculumView } from '@/components/class-detail/ClassCurriculumView';
import { CurriculumModals } from '@/components/class-detail/CurriculumModals';
import ElectronicExamsView from '@/components/class-detail/ElectronicExamsView';

type ViewMode = 'details' | 'exams' | 'curriculum' | 'attendance' | 'messages' | 'electronic-exams';

const VIEW_LABELS: Record<ViewMode, string> = {
  details: 'تفاصيل الفصل',
  exams: 'الاختبارات والدرجات',
  curriculum: 'إدارة المنهج',
  attendance: 'رصد الحضور',
  messages: 'رسائل الفصل',
  'electronic-exams': 'الاختبارات الإلكترونية',
};

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [showEdit, setShowEdit] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('details');

  // Curriculum State
  const [showAddCurriculum, setShowAddCurriculum] = useState(false);
  const [newCurriculum, setNewCurriculum] = useState({ name: '', status: 'active' as 'active' | 'inactive' });
  const [editingCurriculum, setEditingCurriculum] = useState<any | null>(null);

  // Queries
  const { data: classItem, isLoading: classLoading, error: classError, refetch: refetchClass } = useClass(id);
  const { data: students = [] } = useClassStudents(id);
  const { data: allTeachersData, isLoading: teachersLoading } = useTeachers(1, 1000, '', 'الكل', { enabled: showEdit });
  const allTeachers = useMemo(() => Array.isArray(allTeachersData?.data) ? allTeachersData.data : [], [allTeachersData]);
  const { data: curriculums = [], refetch: refetchCurriculums } = useCurriculums();
  const { refetch: refetchSubjects } = useCurriculumSubjects(classItem?.curriculum_id || null);

  // Mutations
  const deleteClassMutation = useDeleteClass();
  const upsertCurriculumMutation = useUpsertCurriculum();
  const upsertSubjectMutation = useUpsertSubject();
  const assignCurriculumMutation = useAssignCurriculumToClass();

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا الفصل نهائياً؟')) return;
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
      await assignCurriculumMutation.mutateAsync({ classId: id!, curriculumId: curriculum.id });
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
    if (!editingCurriculum?.name?.trim()) return;
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

  const handleChangeCurriculum = async (curriculumId: string | null) => {
    try {
      await assignCurriculumMutation.mutateAsync({ classId: id!, curriculumId });
      toast({ title: curriculumId ? 'تم تغيير المنهج بنجاح' : 'تم إلغاء ربط المنهج' });
      refetchClass();
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const isStaff = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  const actionCards = [
    { mode: 'attendance' as ViewMode, icon: CalendarCheck, title: 'رصد الحضور', desc: 'تسجيل حضور وغياب الطلاب', color: 'indigo' },
    { mode: 'exams' as ViewMode, icon: BookOpen, title: 'الاختبارات والدرجات', desc: 'إنشاء اختبارات ورصد الدرجات', color: 'emerald' },
    { mode: 'electronic-exams' as ViewMode, icon: ClipboardList, title: 'الاختبارات الإلكترونية', desc: 'اختبارات تفاعلية مؤقتة للطلاب', color: 'violet' },
    ...(currentUser?.role === 'teacher' ? [{ mode: 'messages' as ViewMode, icon: MessageSquare, title: 'رسائل الفصل', desc: 'إرسال رسائل لأولياء الأمور', color: 'blue' }] : []),
    { mode: 'curriculum' as ViewMode, icon: Layers, title: 'إدارة المنهج', desc: classItem?.curriculum_id ? 'عرض وتعديل المقررات الشهرية' : 'ربط منهج بالفصل', color: 'purple' },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-right pb-24 animate-in fade-in duration-500 px-3 md:px-0" dir="rtl">

        <QueryStateHandler
          loading={classLoading}
          error={classError}
          data={classItem}
          onRetry={refetchClass}
          loadingMessage="جاري مزامنة سجل الفصل..."
        >
          <div className="flex flex-col gap-6">
            {/* Hero */}
            <ClassHero
              classItem={classItem}
              studentCount={students.length}
              isAdmin={currentUser?.role === 'admin'}
              onEdit={() => setShowEdit(true)}
              onDelete={handleDelete}
              isDeleting={deleteClassMutation.isPending}
            />

            {/* ── Details View: Action Cards ── */}
            {isStaff && viewMode === 'details' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {actionCards.map(card => (
                  <ActionCard key={card.mode} {...card} onClick={() => setViewMode(card.mode)} />
                ))}
              </div>
            )}

            {/* ── Sub Views ── */}
            {isStaff && viewMode !== 'details' && (
              <div className="space-y-5">
                {/* Breadcrumb */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewMode('details')}
                    className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    {classItem?.name}
                  </button>
                  <span className="text-slate-200">/</span>
                  <span className="text-sm font-black text-slate-900">{VIEW_LABELS[viewMode]}</span>
                </div>

                {viewMode === 'exams' && <ClassExamsView classId={id!} className={classItem?.name || ''} />}
                {viewMode === 'electronic-exams' && <ElectronicExamsView classId={id!} className={classItem?.name || ''} />}
                {viewMode === 'messages' && <ClassMessagesView classId={id!} className={classItem?.name || ''} />}
                {viewMode === 'attendance' && (
                  <ClassAttendanceView classId={id!} className={classItem?.name || ''} onBack={() => setViewMode('details')} />
                )}
                {viewMode === 'curriculum' && (
                  <ClassCurriculumView classItem={classItem} onAddCurriculum={() => setShowAddCurriculum(true)} />
                )}
              </div>
            )}
          </div>
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
      />
    </AppLayout>
  );
}

// ─── Action Card Component ────────────────────────────────────────────────────
function ActionCard({ onClick, icon: Icon, title, desc, color }: {
  onClick: () => void; icon: any; title: string; desc: string; color: string;
}) {
  const colorMap: Record<string, { bg: string; icon: string; border: string; hover: string }> = {
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100', hover: 'hover:border-indigo-300 hover:shadow-indigo-100/80' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', hover: 'hover:border-emerald-300 hover:shadow-emerald-100/80' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100', hover: 'hover:border-blue-300 hover:shadow-blue-100/80' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100', hover: 'hover:border-purple-300 hover:shadow-purple-100/80' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100', hover: 'hover:border-violet-300 hover:shadow-violet-100/80' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-right p-6 rounded-[28px] bg-white border transition-all duration-300 hover:shadow-xl active:scale-[0.98] flex flex-col gap-4',
        c.border, c.hover
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110', c.bg, c.icon)}>
          <Icon className="w-6 h-6" />
        </div>
        <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
      </div>
      <div>
        <h3 className="font-black text-slate-900 text-base">{title}</h3>
        <p className="text-xs text-slate-400 font-bold mt-1 leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}
