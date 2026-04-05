import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, User, Phone, Users, Info
} from 'lucide-react';

interface ParentProfile {
  id: string;
  full_name: string;
  phone: string | null;
}

interface ChildItem {
  id: string;
  name: string;
  class_name?: string;
  curriculum?: {
    name: string;
    subjects: {
      subject_name: string;
      content: string;
    }[];
  } | null;
}

export default function ParentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [{ data: profile, error: pErr }, { data: links }, { data: classes }, { data: curriculums }, { data: curriculumSubjects }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('student_parents')
          .select('parent_id, students!student_parents_student_id_fkey(id, name, class_id)')
          .eq('parent_id', id)
          .eq('school_id', user?.schoolId),
        supabase.from('classes').select('id, name, curriculum_id').eq('school_id', user?.schoolId),
        supabase.from('curriculums').select('*').eq('school_id', user?.schoolId),
        supabase.from('curriculum_subjects').select('*, curriculums!inner(school_id)').eq('curriculums.school_id', user?.schoolId),
      ]);
      if (pErr) throw pErr;
      setParent(profile as unknown as ParentProfile);
      const kids = (links || [])
        .map((l: any) => l.students)
        .filter(Boolean)
        .map((s: any) => {
          const studentClass = classes?.find(c => c.id === s.class_id);
          const studentCurriculum = curriculums?.find(curr => curr.id === studentClass?.curriculum_id);
          const studentCurriculumSubjects = curriculumSubjects?.filter(sub => sub.curriculum_id === studentCurriculum?.id);

          return {
            id: s.id,
            name: s.name,
            class_name: studentClass?.name,
            curriculum: studentCurriculum ? {
              name: studentCurriculum.name,
              subjects: studentCurriculumSubjects?.map(sub => ({
                subject_name: sub.subject_name,
                content: sub.content,
              })) || [],
            } : null,
          };
        });
      setChildren(kids);
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      navigate('/parents');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!parent) return null;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/parents')}
              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 border border-slate-100 flex items-center justify-center transition-all active:scale-95"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-1">
                  {parent.full_name || '...'}
                </h1>
                <p className="text-xs font-medium text-slate-400" dir="ltr">
                  {parent.phone || 'بدون هاتف'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-10">
            <section className="bg-white border border-slate-100 rounded-3xl p-8 space-y-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <Info className="w-5 h-5 text-primary" />
                معلومات التواصل
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-white text-slate-900 flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">رقم الهاتف</p>
                    <p className="text-lg font-bold text-slate-900" dir="ltr">{parent.phone || 'غير متوفر'}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-100 rounded-3xl p-8 space-y-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                الأبناء المرتبطون
              </h2>
              {children.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-slate-300">لا يوجد أبناء مرتبطون بهذا الحساب</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {children.map((c) => (
                    <div key={c.id} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-base font-bold text-slate-700">{c.name}</span>
                        {c.class_name && (
                          <span className="text-[10px] font-bold text-primary px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
                            {c.class_name}
                          </span>
                        )}
                      </div>
                      {c.curriculum && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <h3 className="text-sm font-bold text-slate-600 mb-2">
                            المنهج: {c.curriculum.name}
                          </h3>
                          {c.curriculum.subjects.length > 0 ? (
                            <ul className="space-y-1 text-sm text-slate-500">
                              {c.curriculum.subjects.map((subject, index) => (
                                <li key={index}>
                                  <span className="font-medium">{subject.subject_name}:</span> {subject.content}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500">لا توجد مواد لهذا المنهج.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
