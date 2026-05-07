import { BookOpen, Layers, Plus, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useCurriculumSubjects, useDeleteSubject } from '@/hooks/queries';
import { useToast } from '@/components/ui/use-toast';

interface ClassCurriculumViewProps {
  classItem: any;
  onAddCurriculum: () => void;
  onAddSubject: () => void;
  onEditSubject: (subject: any) => void;
}

export function ClassCurriculumView({ 
  classItem, 
  onAddCurriculum, 
  onAddSubject, 
  onEditSubject 
}: ClassCurriculumViewProps) {
  const { toast } = useToast();
  const { 
    data: curriculumSubjects = [], 
    isLoading: subjectsLoading, 
    error: subjectsError, 
    refetch: refetchSubjects 
  } = useCurriculumSubjects(classItem?.curriculum_id || null);

  const deleteSubjectMutation = useDeleteSubject();

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

  return (
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
              onClick={onAddCurriculum}
              className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              {classItem?.curriculum_id ? 'تغيير المنهج' : 'ربط منهج'}
            </Button>
          </div>
        </div>

        {classItem?.curriculum_id && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                المواد الدراسية
              </h3>
              <Button 
                onClick={onAddSubject}
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
                          onClick={() => onEditSubject(subject)}
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
  );
}
