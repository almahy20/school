import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, ClipboardList, Check, Trash2, Users } from 'lucide-react';

interface ExamTemplate {
  id: string;
  class_id: string;
  subject: string;
  exam_type: string;
  max_score: number;
  weight: number;
  term: string;
  title: string;
  created_at: string;
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  score: string;
  gradeId?: string;
}

const EXAM_TYPES = [
  { value: 'daily', label: 'يومي', color: 'bg-info/10 text-info' },
  { value: 'monthly', label: 'شهري', color: 'bg-warning/10 text-warning' },
  { value: 'final', label: 'نهائي', color: 'bg-primary/10 text-primary' },
];

export default function GradesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExamTemplate | null>(null);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  // Load classes
  useEffect(() => {
    if (!user) return;
    supabase.from('classes').select('*').eq('teacher_id', user.id).then(({ data }) => {
      setClasses(data || []);
      if (data?.length) setSelectedClass(data[0].id);
      setLoading(false);
    });
  }, [user]);

  // Load templates for selected class
  useEffect(() => {
    if (!selectedClass || !user) return;
    supabase.from('exam_templates').select('*')
      .eq('class_id', selectedClass)
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates((data as ExamTemplate[]) || []);
        setSelectedTemplate(null);
        setStudentGrades([]);
      });
  }, [selectedClass, user]);

  // Load students & grades when template selected
  useEffect(() => {
    if (!selectedTemplate) { setStudentGrades([]); return; }
    const fetchStudentsGrades = async () => {
      const { data: students } = await supabase.from('students').select('id, name').eq('class_id', selectedTemplate.class_id).order('name');
      if (!students?.length) { setStudentGrades([]); return; }

      const studentIds = students.map(s => s.id);
      const { data: grades } = await supabase.from('grades').select('*')
        .in('student_id', studentIds)
        .eq('exam_template_id', selectedTemplate.id);

      setStudentGrades(students.map(s => {
        const existing = grades?.find(g => g.student_id === s.id);
        return {
          studentId: s.id,
          studentName: s.name,
          score: existing ? String(existing.score) : '',
          gradeId: existing?.id,
        };
      }));
    };
    fetchStudentsGrades();
  }, [selectedTemplate]);

  const handleScoreChange = (studentId: string, value: string) => {
    setStudentGrades(prev => prev.map(sg =>
      sg.studentId === studentId ? { ...sg, score: value } : sg
    ));
  };

  const handleSaveAll = async () => {
    if (!selectedTemplate || !user) return;
    setSaving(true);

    const toUpsert = studentGrades
      .filter(sg => sg.score !== '')
      .map(sg => ({
        ...(sg.gradeId ? { id: sg.gradeId } : {}),
        student_id: sg.studentId,
        teacher_id: user.id,
        subject: selectedTemplate.subject,
        score: Number(sg.score),
        max_score: selectedTemplate.max_score,
        term: selectedTemplate.term,
        exam_template_id: selectedTemplate.id,
      }));

    if (toUpsert.length > 0) {
      await supabase.from('grades').upsert(toUpsert, { onConflict: 'id' });
    }

    // Refresh grades
    const studentIds = studentGrades.map(sg => sg.studentId);
    const { data: grades } = await supabase.from('grades').select('*')
      .in('student_id', studentIds)
      .eq('exam_template_id', selectedTemplate.id);

    setStudentGrades(prev => prev.map(sg => {
      const existing = grades?.find(g => g.student_id === sg.studentId);
      return { ...sg, score: existing ? String(existing.score) : sg.score, gradeId: existing?.id };
    }));

    setSaving(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await supabase.from('grades').delete().eq('exam_template_id', templateId);
    await supabase.from('exam_templates').delete().eq('id', templateId);
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate(null);
      setStudentGrades([]);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto text-right">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">منظومة الدرجات والتقييم</h1>
            <p className="text-secondary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              رصد التحصيل الأكاديمي والتقارير الدورية
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group">
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                className="pr-6 pl-12 py-4 rounded-[20px] border-2 border-muted bg-white text-primary text-xs font-black uppercase tracking-widest focus:border-primary transition-all shadow-sm cursor-pointer appearance-none min-w-[200px]">
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 pointer-events-none" />
            </div>
            
            {selectedClass && (
              <button onClick={() => setShowCreateTemplate(true)}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0">
                <Plus className="w-5 h-5" /> تأسيس تقييم جديد
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6 bg-muted/10 rounded-[40px] border-2 border-dashed border-muted/50">
            <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-primary/40 font-black text-xs uppercase tracking-[0.3em] animate-pulse">جارٍ استرجاع سجلات التحصيل الفيدرالية…</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-white border-2 border-muted p-24 text-center rounded-[40px]">
            <div className="w-24 h-24 rounded-[32px] bg-muted/50 flex items-center justify-center mx-auto mb-8 text-muted-foreground/30">
              <ClipboardList className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-primary mb-3 italic tracking-tight">لا توجد سجلات متاحة</h2>
            <p className="text-muted-foreground font-bold max-w-sm mx-auto leading-relaxed">لم يتم تعيين أي فصول دراسية لهويتك الأكاديمية بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Column: Templates */}
            <div className="lg:col-span-4 space-y-6">
              <div className="flex items-center justify-between px-4">
                <h2 className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">سجل ملفات التقييم</h2>
                <span className="text-[9px] font-black text-primary bg-secondary/20 px-3 py-1 rounded-full uppercase tracking-widest">{templates.length} ملف</span>
              </div>
              
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <div className="bg-white rounded-[32px] border-2 border-dashed border-muted p-12 text-center">
                    <ClipboardList className="w-10 h-10 text-primary/10 mx-auto mb-4" />
                    <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest">لا توجد قوالب نشطة</p>
                  </div>
                ) : templates.map(t => {
                  const typeInfo = EXAM_TYPES.find(et => et.value === t.exam_type) || EXAM_TYPES[1];
                  const isSelected = selectedTemplate?.id === t.id;
                  return (
                    <div key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`bg-white rounded-[28px] border-2 p-6 cursor-pointer transition-all duration-500 animate-scale-in group relative overflow-hidden ${
                        isSelected 
                          ? 'border-primary shadow-2xl shadow-primary/10' 
                          : 'border-muted hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5'
                      }`}>
                      {isSelected && <div className="absolute right-0 top-0 bottom-0 w-2 bg-primary" />}
                      
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0">
                          <h3 className={`font-black tracking-tight leading-tight transition-colors ${isSelected ? 'text-primary text-xl' : 'text-primary/60 text-lg'}`}>
                            {t.title || t.subject}
                          </h3>
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                          className="w-10 h-10 rounded-xl text-primary/20 hover:bg-destructive/10 hover:text-destructive transition-all flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                          t.exam_type === 'final' ? 'bg-primary text-white' : 'bg-secondary text-primary'
                        }`}>
                          {typeInfo.label}
                        </span>
                        <div className="flex items-center gap-2 py-1 px-3 rounded-xl bg-muted text-primary/40 text-[9px] font-black uppercase tracking-widest">
                          <BookOpen className="w-3.5 h-3.5" />
                          {t.subject}
                        </div>
                        <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">· {t.max_score} درجة</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Grade entry */}
            <div className="lg:col-span-8">
              {!selectedTemplate ? (
                <div className="bg-white rounded-[40px] border-2 border-dashed border-muted p-32 text-center animate-scale-in">
                  <div className="w-24 h-24 bg-muted/30 rounded-[32px] flex items-center justify-center mx-auto mb-8 text-primary/10">
                    <ClipboardList className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-black text-primary mb-3 italic tracking-tight">جاهز لرصد النتائج؟</h3>
                  <p className="text-muted-foreground font-bold max-w-sm mx-auto leading-relaxed">اختر أحد ملفات التقييم من القائمة الجانبية للبدء في توثيق النتائج الأكاديمية.</p>
                </div>
              ) : (
                <div className="bg-white rounded-[40px] border-2 border-muted shadow-sm overflow-hidden animate-scale-in relative">
                  <div className="absolute top-0 right-0 w-full h-1.5 bg-primary" />
                  <div className="p-10 border-b-2 border-muted bg-muted/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                      <div>
                        <div className="flex items-center gap-4 mb-3">
                          <h2 className="text-3xl font-black text-primary italic tracking-tight leading-none">{selectedTemplate.title || selectedTemplate.subject}</h2>
                          <span className="px-4 py-1.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">{selectedTemplate.term}</span>
                        </div>
                        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-primary/40">
                          <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> {selectedTemplate.subject}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                          <span>الدرجة العظمى: <span className="text-primary">{selectedTemplate.max_score}</span></span>
                        </div>
                      </div>
                      
                      <button onClick={handleSaveAll} disabled={saving}
                        className="flex items-center gap-4 h-16 px-10 rounded-[24px] bg-primary text-white text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 group">
                        {saving ? (
                          <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-5 h-5 font-black transition-transform group-hover:scale-110" />
                        )}
                        {saving ? 'جارٍ المزامنة...' : 'اعتماد النتائج'}
                      </button>
                    </div>
                  </div>

                  <div className="p-0">
                    {studentGrades.length === 0 ? (
                      <div className="p-32 text-center">
                        <Users className="w-16 h-16 text-primary/10 mx-auto mb-6" />
                        <p className="text-primary/30 font-black text-xs uppercase tracking-widest">لا يوجد سجل طلاب نشط لهذه القاعة</p>
                      </div>
                    ) : (
                      <div className="divide-y-2 divide-muted">
                        <div className="grid grid-cols-12 gap-4 px-10 py-6 bg-muted/30 text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] border-b-2 border-muted">
                          <div className="col-span-1">الرقم</div>
                          <div className="col-span-11 sm:col-span-7">الاسم الأكاديمي</div>
                          <div className="hidden sm:block sm:col-span-4 text-left">الدرجة النهائية</div>
                        </div>
                        {studentGrades.map((sg, idx) => (
                          <div key={sg.studentId} className="grid grid-cols-12 gap-8 items-center px-10 py-8 hover:bg-primary/5 transition-all duration-300 group">
                            <div className="col-span-1 text-sm font-black text-primary/20">{String(idx + 1).padStart(2, '0')}</div>
                            <div className="col-span-11 sm:col-span-7">
                              <p className="text-lg font-black text-primary group-hover:text-primary transition-colors tracking-tight leading-none">{sg.studentName}</p>
                            </div>
                            <div className="col-span-12 sm:col-span-4">
                              <div className="relative group/input">
                                <input
                                  type="number"
                                  min="0"
                                  max={selectedTemplate.max_score}
                                  value={sg.score}
                                  onChange={e => handleScoreChange(sg.studentId, e.target.value)}
                                  placeholder="0.0"
                                  className="w-full h-16 px-8 rounded-[20px] border-2 border-muted bg-white text-primary font-black text-xl text-center focus:outline-none focus:border-primary transition-all group-hover:border-primary/40"
                                />
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/20 uppercase pointer-events-none tracking-widest">
                                  / {selectedTemplate.max_score}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreateTemplate && (
        <CreateTemplateModal
          classId={selectedClass}
          teacherId={user!.id}
          onClose={() => setShowCreateTemplate(false)}
          onCreated={(t) => {
            setTemplates(prev => [t, ...prev]);
            setSelectedTemplate(t);
            setShowCreateTemplate(false);
          }}
        />
      )}
    </AppLayout>
  );
}

function CreateTemplateModal({ classId, teacherId, onClose, onCreated }: {
  classId: string; teacherId: string;
  onClose: () => void;
  onCreated: (t: ExamTemplate) => void;
}) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState('monthly');
  const [maxScore, setMaxScore] = useState('100');
  const [weight, setWeight] = useState('1');
  const [term, setTerm] = useState('الفصل الأول');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.from('exam_templates').insert({
      class_id: classId,
      teacher_id: teacherId,
      subject: subject.trim(),
      exam_type: examType,
      max_score: Number(maxScore),
      weight: Number(weight),
      term,
      title: title.trim() || subject.trim(),
    }).select().single();

    if (!error && data) {
      onCreated(data as ExamTemplate);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-foreground mb-6">إنشاء قالب تقييم</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">عنوان التقييم</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground"
              placeholder="مثال: اختبار الفترة الأولى" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">المادة *</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground"
              placeholder="مثال: الرياضيات" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">نوع التقييم</label>
              <select value={examType} onChange={e => setExamType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground">
                <option value="daily">يومي</option>
                <option value="monthly">شهري</option>
                <option value="final">نهائي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">الفصل الدراسي</label>
              <select value={term} onChange={e => setTerm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground">
                <option value="الفصل الأول">الفصل الأول</option>
                <option value="الفصل الثاني">الفصل الثاني</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">الدرجة العظمى</label>
              <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">الوزن (%)</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50">
              {loading ? 'جارٍ الإنشاء...' : 'إنشاء'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}
