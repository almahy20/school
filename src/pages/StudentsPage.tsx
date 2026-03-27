import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Plus, Trash2, Eye, Edit2, Phone, User, GraduationCap,
  AlertTriangle, CheckCircle, XCircle, Clock, UserPlus, Save, X,
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  birth_date: string | null;
  class_id: string | null;
  notes: string | null;
  parent_phone?: string | null;
  class_name?: string;
}

interface ClassOption { id: string; name: string }

export default function StudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: studentsData }, { data: classesData }] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('classes').select('id, name'),
    ]);
    const enriched = ((studentsData as any[]) || []).map((s: any) => ({
      ...s,
      class_name: classesData?.find(c => c.id === s.class_id)?.name || '',
    }));
    setStudents(enriched);
    setClasses(classesData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = students.filter(s =>
    s.name.includes(search) || (s.class_name || '').includes(search)
  );

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطالب نهائياً؟')) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    setStudents(prev => prev.filter(s => s.id !== id));
    toast({ title: 'تم الحذف بنجاح' });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">
              {user?.role === 'teacher' ? 'سجل طلابي' : 'سجل الطلاب المركزي'}
            </h1>
            <p className="text-primary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              البيانات الأكاديمية والاتصال
            </p>
          </div>
          {user?.role === 'admin' && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0">
              <Plus className="w-5 h-5" /> إضافة طالب للمنظومة
            </button>
          )}
        </header>

        {/* Search & Statistics Bar */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          <div className="relative group flex-1">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30 group-focus-within:text-secondary transition-colors" />
            <input type="text" placeholder="البحث في السجلات (الاسم، الفصل، أو رقم الهوية)..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-14 pl-6 py-5 rounded-[24px] border-2 border-muted bg-white text-primary font-bold placeholder:text-primary/20 focus:outline-none focus:border-secondary transition-all shadow-sm" />
          </div>
          <div className="flex items-center gap-4 px-8 rounded-[24px] bg-primary text-white min-w-[200px] shadow-lg shadow-primary/10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-[10px] font-black opacity-50 uppercase tracking-widest leading-none mb-1">الإجمالي</p>
              <p className="text-xl font-black italic">{filtered.length} طالب</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6 bg-muted/10 rounded-[40px] border-2 border-dashed border-muted/50">
            <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-primary/40 font-black text-xs uppercase tracking-[0.3em] animate-pulse">جارٍ استرجاع سجلات الطلاب من قاعدة البيانات الفيدرالية…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-muted p-24 text-center rounded-[40px]">
            <div className="w-24 h-24 rounded-[32px] bg-muted/50 flex items-center justify-center mx-auto mb-8 text-muted-foreground/30">
              <Search className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-primary mb-3 italic tracking-tight">لا توجد تطابقات في السجل</h2>
            <p className="text-muted-foreground font-bold max-w-sm mx-auto leading-relaxed">
              لم نتمكن من العثور على أي سجلات تطابق بحثك. تأكد من تهجئة الاسم بشكل صحيح أو جرب استخدام معايير بحث أوسع.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filtered.map(s => (
              <StudentCard key={s.id} student={s} isAdmin={user?.role === 'admin'}
                onView={() => setSelectedStudent(s)}
                onEdit={() => setEditStudent(s)}
                onDelete={() => handleDelete(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedStudent && (
        <StudentDetailModal student={selectedStudent} isAdmin={user?.role === 'admin'}
          onClose={() => setSelectedStudent(null)} onRefresh={fetchData} />
      )}
      {editStudent && (
        <EditStudentModal student={editStudent} classes={classes}
          onClose={() => { setEditStudent(null); fetchData(); }} />
      )}
      {showAdd && (
        <AddStudentModal classes={classes}
          onClose={() => { setShowAdd(false); fetchData(); }} />
      )}
    </AppLayout>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function StudentCard({ student, isAdmin, onView, onEdit, onDelete }: {
  student: Student; isAdmin?: boolean;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-[32px] border-2 border-muted p-8 flex flex-col gap-6 hover:border-secondary transition-all duration-500 hover:-translate-y-2 group animate-scale-in relative overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-secondary/5">
      <div className="absolute top-0 left-0 w-24 h-24 bg-primary/5 rounded-full -ml-12 -mt-12 blur-2xl group-hover:bg-secondary/10 transition-colors" />
      
      <div className="flex items-start gap-5 relative z-10 text-right">
        <div className="w-16 h-16 rounded-2xl bg-primary text-secondary flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
          <User className="w-8 h-8 font-black" />
        </div>
        <div className="min-w-0 pt-1">
          <h3 className="font-black text-primary text-xl truncate mt-1 tracking-tight leading-tight">{student.name}</h3>
          {student.class_name && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/10 text-secondary w-fit">
              <GraduationCap className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">{student.class_name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 relative z-10">
        {student.birth_date && (
          <div className="flex items-center gap-3 text-sm text-primary/60 font-bold">
            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">📅</div>
            <span>{student.birth_date}</span>
          </div>
        )}
        {(student as any).parent_phone && (
          <div className="flex items-center gap-3 text-sm text-primary/60 font-bold">
            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
               <Phone className="w-4 h-4 text-secondary" />
            </div>
            <span dir="ltr">{(student as any).parent_phone}</span>
          </div>
        )}
        {student.notes && (
          <div className="bg-muted/30 p-4 rounded-2xl">
            <p className="text-xs text-primary/40 font-bold leading-relaxed line-clamp-2">
              {student.notes}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-auto pt-6 border-t-2 border-muted relative z-10">
        <button onClick={onView}
          className="flex-1 h-12 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-primary/10">
          <Eye className="w-4 h-4" /> عرض الملف
        </button>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={onEdit} className="w-12 h-12 rounded-2xl border-2 border-muted hover:border-secondary hover:text-secondary flex items-center justify-center transition-all bg-white shadow-sm active:scale-90" title="تعديل السجل">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="w-12 h-12 rounded-2xl border-2 border-muted hover:border-destructive hover:text-destructive flex items-center justify-center transition-all bg-white shadow-sm active:scale-90" title="حذف السجل">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function StudentDetailModal({ student, isAdmin, onClose, onRefresh }: {
  student: Student; isAdmin?: boolean; onClose: () => void; onRefresh: () => void;
}) {
  const [grades, setGrades] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [showLinkParent, setShowLinkParent] = useState(false);

  const loadDetails = useCallback(async () => {
    const [g, a, p] = await Promise.all([
      supabase.from('grades').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
      supabase.from('attendance').select('*').eq('student_id', student.id).order('date', { ascending: false }).limit(20),
      supabase.from('student_parents').select('parent_id, profiles!student_parents_parent_id_fkey(full_name, phone)').eq('student_id', student.id),
    ]);
    setGrades(g.data || []);
    setAttendance(a.data || []);
    setParents(p.data || []);
  }, [student.id]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{student.name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'الفصل', value: student.class_name || '—' },
            { label: 'تاريخ الميلاد', value: student.birth_date || '—' },
            { label: 'رقم ولي الأمر', value: (student as any).parent_phone || '—' },
            { label: 'ملاحظات', value: student.notes || '—' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl bg-muted">
              <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
              <p className="font-medium text-foreground text-sm" dir={item.label === 'رقم ولي الأمر' ? 'ltr' : undefined}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Parents */}
        {isAdmin && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">أولياء الأمور المرتبطون</h3>
              <button onClick={() => setShowLinkParent(v => !v)}
                className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
                <UserPlus className="w-4 h-4" />ربط ولي أمر
              </button>
            </div>
            {parents.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم يتم ربط أي ولي أمر بعد</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {parents.map((p: any) => (
                  <span key={p.parent_id} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                    {p.profiles?.full_name || p.profiles?.phone}
                  </span>
                ))}
              </div>
            )}
            {showLinkParent && (
              <LinkParentModal studentId={student.id} onClose={() => { setShowLinkParent(false); loadDetails(); }} />
            )}
          </div>
        )}

        {/* Attendance */}
        <h3 className="font-semibold text-foreground mb-3">سجل الحضور ({attendance.length})</h3>
        <div className="flex flex-wrap gap-2 mb-6">
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد سجل حضور</p>
          ) : attendance.map((a: any) => (
            <div key={a.id} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
              a.status === 'present' ? 'bg-success/10 text-success' :
              a.status === 'late' ? 'bg-warning/10 text-warning' :
              'bg-destructive/10 text-destructive'
            }`}>
              {a.status === 'present' ? <CheckCircle className="w-3 h-3" /> :
               a.status === 'late' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {a.date?.slice(5)}
            </div>
          ))}
        </div>

        {/* Grades */}
        <h3 className="font-semibold text-foreground mb-3">الدرجات ({grades.length})</h3>
        {grades.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد درجات مسجلة</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {grades.map((g: any) => (
              <div key={g.id} className="p-3 rounded-xl bg-muted">
                <p className="text-xs text-muted-foreground">{g.subject} — {g.term}</p>
                <p className="text-lg font-bold text-foreground">{g.score}/{g.max_score}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ classes, onClose }: { classes: ClassOption[]; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [birthDate, setBirthDate] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Parent phone warning state
  const [warningParent, setWarningParent] = useState<{ name: string; id: string } | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  const doSave = async (existingParentId?: string) => {
    setLoading(true);
    const normalized = parentPhone.trim().replace(/\D/g, '');

    // 1. Insert student (include parent_phone for future auto-linking)
    const { data: student, error: insertErr } = await (supabase.from('students') as any)
      .insert({
        name: name.trim(),
        class_id: classId || null,
        birth_date: birthDate || null,
        notes: notes.trim() || null,
        parent_phone: normalized || null,
      })
      .select()
      .single();

    if (insertErr) {
      setError('حدث خطأ أثناء إضافة الطالب');
      setLoading(false);
      return;
    }

    // 2. If an existing parent was confirmed, link immediately
    if (existingParentId && student) {
      await supabase.from('student_parents').insert({ student_id: student.id, parent_id: existingParentId });
    }

    setLoading(false);
    toast({ title: 'تمت الإضافة بنجاح', description: `تم إضافة ${name.trim()}` });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('يرجى إدخال اسم الطالب'); return; }
    setError('');

    const normalized = parentPhone.trim().replace(/\D/g, '');
    if (!normalized) {
      // No phone — just save student
      await doSave();
      return;
    }

    // Check if phone already exists in profiles
    const { data: existing } = await supabase.from('profiles').select('id, full_name').eq('phone', normalized).maybeSingle();
    if (existing) {
      // Show warning — phone already in use
      setWarningParent({ name: existing.full_name || normalized, id: existing.id });
      setConfirmPending(true);
      return;
    }

    // Phone not found → save student with parent_phone (will auto-link when parent registers)
    await doSave();
  };

  // User confirmed to link to existing parent
  const handleConfirmLink = () => {
    if (warningParent) doSave(warningParent.id);
  };

  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">إضافة طالب جديد</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        {/* Warning: phone already in use */}
        {confirmPending && warningParent && (
          <div className="mb-5 p-4 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">رقم الهاتف مستخدم بالفعل</p>
                <p className="text-sm text-muted-foreground mt-1">
                  رقم <span className="font-medium text-foreground" dir="ltr">{parentPhone}</span> مسجل لدى: <span className="font-medium text-foreground">{warningParent.name}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">هل تريد ربط الطالب بهذا الحساب؟</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleConfirmLink} disabled={loading}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                    {loading ? '...' : 'نعم، اربط'}
                  </button>
                  <button onClick={() => { setConfirmPending(false); setWarningParent(null); }}
                    className="flex-1 py-2 rounded-lg bg-muted text-foreground text-sm">
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!confirmPending && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">اسم الطالب *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="الاسم الكامل" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">الفصل</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground">
                <option value="">بدون فصل</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">تاريخ الميلاد</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                رقم هاتف ولي الأمر
                <span className="text-xs text-muted-foreground mr-2">(سيتم ربط الطالب تلقائياً)</span>
              </label>
              <div className="relative">
                <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-input bg-background text-foreground"
                  placeholder="05xxxxxxxx" dir="ltr" />
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">ملاحظات</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground resize-none"
                placeholder="ملاحظات إضافية..." />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={loading}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50">
                {loading ? 'جارٍ الإضافة...' : 'إضافة الطالب'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium">إلغاء</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Edit Student Modal ───────────────────────────────────────────────────────
function EditStudentModal({ student, classes, onClose }: { student: Student; classes: ClassOption[]; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: student.name,
    class_id: student.class_id || '',
    birth_date: student.birth_date || '',
    parent_phone: (student as any).parent_phone || '',
    notes: student.notes || '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    const { error } = await (supabase.from('students') as any)
      .update({
        name: form.name.trim(),
        class_id: form.class_id || null,
        birth_date: form.birth_date || null,
        parent_phone: form.parent_phone.trim().replace(/\D/g, '') || null,
        notes: form.notes.trim() || null,
      })
      .eq('id', student.id);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ بنجاح' });
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">تعديل بيانات الطالب</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">الاسم *</label>
            <input value={form.name} onChange={set('name')}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">الفصل</label>
            <select value={form.class_id} onChange={set('class_id')}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground">
              <option value="">بدون فصل</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">تاريخ الميلاد</label>
            <input type="date" value={form.birth_date} onChange={set('birth_date')}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">رقم هاتف ولي الأمر</label>
            <input type="tel" value={form.parent_phone} onChange={set('parent_phone')} dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground"
              placeholder="05xxxxxxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />{loading ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Link Parent Modal ────────────────────────────────────────────────────────
function LinkParentModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    const normalized = phone.trim().replace(/\D/g, '');
    const { data: parent } = await supabase.from('profiles').select('id, full_name').eq('phone', normalized).maybeSingle();
    if (!parent) { setError('لم يتم العثور على حساب بهذا الرقم'); setLoading(false); return; }
    const { error: linkErr } = await supabase.from('student_parents').insert({ student_id: studentId, parent_id: parent.id });
    if (linkErr) {
      setError(linkErr.code === '23505' ? 'ولي الأمر مرتبط بالفعل' : 'حدث خطأ');
      setLoading(false);
      return;
    }
    toast({ title: 'تم الربط بنجاح', description: parent.full_name });
    onClose();
  };

  return (
    <div className="mt-4 p-4 rounded-xl border bg-muted/50">
      <h4 className="font-semibold text-foreground mb-3">ربط ولي أمر برقم الهاتف</h4>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="05xxxxxxxx" dir="ltr"
            className="w-full px-3 py-2 pr-9 rounded-lg border border-input bg-background text-foreground text-sm" />
          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <button type="submit" disabled={loading}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {loading ? '...' : 'ربط'}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm">إلغاء</button>
      </form>
      {error && <p className="text-destructive text-xs mt-2">{error}</p>}
    </div>
  );
}
