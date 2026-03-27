import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Eye, Edit2, Save, X, Users, GraduationCap, User, Search, ArrowLeft } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  grade_level: string | null;
  teacher_id: string | null;
  teacher_name?: string;
  student_count?: number;
}

export default function ClassesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<ClassItem | null>(null);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('الكل');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: classesData }, { data: profiles }, { data: teacherRoles }, { data: students }] = await Promise.all([
      supabase.from('classes').select('*'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('user_roles').select('user_id').eq('role', 'teacher'),
      supabase.from('students').select('id, class_id'),
    ]);

    const teacherIds = (teacherRoles || []).map(r => r.user_id);
    setTeachers((profiles || []).filter(p => teacherIds.includes(p.id)));

    const enriched = (classesData || []).map(c => ({
      ...c,
      teacher_name: profiles?.find(p => p.id === c.teacher_id)?.full_name || 'غير محدد',
      student_count: (students || []).filter(s => s.class_id === c.id).length,
    }));
    setClasses(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الفصل؟')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    setClasses(prev => prev.filter(c => c.id !== id));
    toast({ title: 'تم الحذف' });
  };

  const gradeLevels = ['الكل', ...new Set(classes.map(c => c.grade_level).filter(Boolean) as string[])];
  const filtered = classes.filter(c => {
    const matchSearch = !search || c.name.includes(search) || (c.teacher_name || '').includes(search);
    const matchLevel = filterLevel === 'الكل' || c.grade_level === filterLevel;
    return matchSearch && matchLevel;
  });

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">منظومة القاعات الدراسية</h1>
            <p className="text-secondary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              تنظيم الحلقات والمراحل التعليمية
            </p>
          </div>
          {user?.role === 'admin' && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0">
              <Plus className="w-5 h-5" /> تأسيس فصل جديد
            </button>
          )}
        </header>

        {/* Search & Filter Section */}
        <div className="flex flex-col xl:flex-row gap-8 items-stretch">
          <div className="relative group flex-1">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/30 group-focus-within:text-primary transition-colors" />
            <input type="text" placeholder="البحث في القاعات (الاسم، المعلم المسؤول)..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-14 pl-6 py-5 rounded-[24px] border-2 border-muted bg-white text-primary font-bold placeholder:text-primary/20 focus:outline-none focus:border-primary transition-all shadow-sm" />
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide shrink-0 items-center">
            {gradeLevels.map(level => (
              <button key={level} onClick={() => setFilterLevel(level)}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 shadow-sm ${
                  filterLevel === level
                    ? 'bg-secondary border-secondary text-primary shadow-secondary/10'
                    : 'bg-white border-muted text-primary/40 hover:bg-muted/50 hover:text-primary'
                }`}>
                {level === 'الكل' ? 'جميع المراحل' : level}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium animate-pulse">جارٍ تحميل الفصول...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-3xl border border-dashed p-20 text-center">
            <GraduationCap className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-bold text-foreground mb-1">لا توجد فصول</p>
            <p className="text-muted-foreground">جرب تغيير الفلتر أو إضافة فصل جديد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-[32px] border-2 border-muted p-8 flex flex-col gap-8 hover:border-primary transition-all duration-500 hover:-translate-y-2 group animate-scale-in relative overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-primary/5 text-right">
                <div className="absolute top-0 left-0 w-32 h-32 bg-secondary/5 rounded-full -ml-16 -mt-16 blur-3xl group-hover:bg-primary/5 transition-colors" />
                
                <div className="flex items-start justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-primary text-secondary flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                      <GraduationCap className="w-8 h-8 font-black" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-primary text-2xl truncate mt-1 tracking-tight leading-tight">{c.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/10">مستمر</span>
                        {c.grade_level && (
                          <span className="text-xs text-primary/40 font-black uppercase tracking-widest">{c.grade_level}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2 relative z-20">
                      <button onClick={() => setEditing(c)} className="w-10 h-10 rounded-xl bg-muted/50 text-primary/40 hover:bg-primary hover:text-white transition-all flex items-center justify-center">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="w-10 h-10 rounded-xl bg-muted/50 text-primary/40 hover:bg-destructive hover:text-white transition-all flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <div className="bg-primary/5 rounded-[24px] p-6 border-2 border-transparent group-hover:border-primary/10 transition-all">
                    <div className="flex items-center gap-2 text-primary/30 mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">الكثافة</span>
                    </div>
                    <p className="text-3xl font-black text-primary italic leading-none">{c.student_count}</p>
                    <p className="text-[10px] font-bold text-primary/20 mt-1">طالب مسجل</p>
                  </div>
                  <div className="bg-secondary/5 rounded-[24px] p-6 border-2 border-transparent group-hover:border-secondary/20 transition-all">
                    <div className="flex items-center gap-2 text-secondary/40 mb-2">
                      <User className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">المشرف</span>
                    </div>
                    <p className="text-sm font-black text-primary truncate leading-tight mt-1">{c.teacher_name}</p>
                    <p className="text-[10px] font-bold text-primary/20 mt-2">عضو هيئة تدريس</p>
                  </div>
                </div>

                <button onClick={() => setSelected(c)}
                  className="w-full h-14 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-3 group/btn active:scale-95 shadow-xl shadow-primary/20 relative z-10">
                  الولوج إلى قائمة الطلاب
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover/btn:-translate-x-2" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <ClassDetailModal classItem={selected} onClose={() => setSelected(null)} />}
      {editing && <EditClassModal classItem={editing} teachers={teachers} onClose={() => { setEditing(null); fetchData(); }} />}
      {showAdd && <AddClassModal teachers={teachers} onClose={() => { setShowAdd(false); fetchData(); }} />}
    </AppLayout>
  );
}

function ClassDetailModal({ classItem, onClose }: { classItem: ClassItem; onClose: () => void }) {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    setLoadingStudents(true);
    supabase.from('students').select('id, name').eq('class_id', classItem.id).order('name')
      .then(({ data }) => { setStudents(data || []); setLoadingStudents(false); });
  }, [classItem.id]);

  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{classItem.name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'المرحلة الدراسية', value: classItem.grade_level || '—' },
            { label: 'المعلم المسؤول', value: classItem.teacher_name || '—' },
            { label: 'عدد الطلاب', value: String(classItem.student_count ?? 0) },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl bg-muted">
              <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
              <p className="font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
        <h3 className="font-semibold text-foreground mb-3">قائمة الطلاب</h3>
        {loadingStudents ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد طلاب</p>
        ) : (
          <div className="space-y-2">
            {students.map(s => (
              <div key={s.id} className="p-3 rounded-xl bg-muted text-sm font-medium text-foreground flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{s.name[0]}</div>
                {s.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditClassModal({ classItem, teachers, onClose }: {
  classItem: ClassItem; teachers: { id: string; full_name: string }[]; onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(classItem.name);
  const [gradeLevel, setGradeLevel] = useState(classItem.grade_level || '');
  const [teacherId, setTeacherId] = useState(classItem.teacher_id || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('classes').update({
      name: name.trim(), grade_level: gradeLevel.trim() || null, teacher_id: teacherId || null,
    }).eq('id', classItem.id);
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else { toast({ title: 'تم الحفظ بنجاح' }); onClose(); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">تعديل الفصل</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">اسم الفصل *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">المرحلة الدراسية</label>
            <input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/30 text-foreground" placeholder="مثال: الصف الأول" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">المعلم المسؤول</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/30 text-foreground">
              <option value="">بدون معلم</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />{loading ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddClassModal({ teachers, onClose }: { teachers: { id: string; full_name: string }[]; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('classes').insert({
      name: name.trim(), grade_level: gradeLevel.trim() || null, teacher_id: teacherId || null,
    });
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else { toast({ title: 'تمت الإضافة بنجاح' }); onClose(); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">إضافة فصل جديد</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">اسم الفصل *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="مثال: 1أ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">المرحلة الدراسية</label>
            <input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/30 text-foreground" placeholder="مثال: الصف الأول" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">المعلم المسؤول</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/30 text-foreground">
              <option value="">بدون معلم</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50">
              {loading ? 'جارٍ الإضافة...' : 'إضافة الفصل'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}
