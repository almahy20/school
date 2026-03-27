import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Phone, User, GraduationCap, Eye, Edit2, Save, X, Search } from 'lucide-react';

interface TeacherProfile {
  id: string;
  full_name: string;
  phone: string | null;
  classes: { id: string; name: string }[];
}

export default function TeachersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TeacherProfile | null>(null);
  const [editing, setEditing] = useState<TeacherProfile | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
    if (!roles?.length) { setTeachers([]); setLoading(false); return; }

    const teacherIds = roles.map(r => r.user_id);
    const [{ data: profiles }, { data: classesData }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', teacherIds),
      supabase.from('classes').select('id, name, teacher_id'),
    ]);

    const result: TeacherProfile[] = (profiles || []).map(p => ({
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      classes: (classesData || []).filter(c => c.teacher_id === p.id).map(c => ({ id: c.id, name: c.name })),
    }));
    setTeachers(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = teachers.filter(t =>
    t.full_name.includes(search) || (t.phone || '').includes(search)
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">سجل الهيئة التدريسية</h1>
            <p className="text-secondary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              إدارة الكادر التعليمي وتوزيع الحصص
            </p>
          </div>
          <div className="flex items-center gap-4 px-8 py-4 rounded-[24px] bg-secondary text-primary shadow-xl shadow-secondary/10">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black opacity-50 uppercase tracking-widest leading-none mb-1">العدد الحالي</p>
              <p className="text-xl font-black italic">{teachers.length} معلم</p>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <div className="relative group max-w-2xl">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/30 group-focus-within:text-primary transition-colors" />
          <input type="text" placeholder="البحث في سجل المعلمين (الاسم، التخصص، أو رقم الهاتف)..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-14 pl-6 py-5 rounded-[24px] border-2 border-muted bg-white text-primary font-bold placeholder:text-primary/20 focus:outline-none focus:border-primary transition-all shadow-sm" />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium animate-pulse">جارٍ تحميل البيانات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-3xl border border-dashed p-20 text-center">
            <Search className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-bold text-foreground mb-1">لا يوجد معلمون</p>
            <p className="text-muted-foreground">جرب البحث بكلمات مختلفة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(t => (
              <TeacherCard key={t.id} teacher={t} isAdmin={user?.role === 'admin'}
                onView={() => setSelected(t)}
                onEdit={() => setEditing(t)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <TeacherDetailModal teacher={selected} onClose={() => setSelected(null)} />
      )}
      {editing && (
        <EditTeacherModal teacher={editing}
          onClose={() => { setEditing(null); fetchData(); }}
        />
      )}
    </AppLayout>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function TeacherCard({ teacher, isAdmin, onView, onEdit }: {
  teacher: TeacherProfile; isAdmin?: boolean; onView: () => void; onEdit: () => void;
}) {
  return (
    <div className="bg-white rounded-[32px] border-2 border-muted p-8 flex flex-col gap-6 hover:border-primary transition-all duration-500 hover:-translate-y-2 group animate-scale-in relative overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-primary/5">
      <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/5 transition-colors" />
      
      <div className="flex items-start gap-5 relative z-10 text-right">
        <div className="w-16 h-16 rounded-2xl bg-secondary text-primary flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
          <User className="w-8 h-8 font-black" />
        </div>
        <div className="min-w-0 pt-1">
          <h3 className="font-black text-primary text-xl truncate mt-1 tracking-tight leading-tight">{teacher.full_name}</h3>
          {teacher.phone && (
            <div className="mt-2 flex items-center gap-2 text-primary/40 font-bold" dir="ltr">
              <Phone className="w-3.5 h-3.5" />
              <span className="text-sm tracking-tighter">{teacher.phone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] mb-2 leading-none">الفصول المُسندة</p>
        {teacher.classes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {teacher.classes.slice(0, 3).map(c => (
              <span key={c.id} className="px-3 py-1.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-primary/10">
                <GraduationCap className="w-3 h-3" />{c.name}
              </span>
            ))}
            {teacher.classes.length > 3 && (
              <span className="px-3 py-1.5 rounded-xl bg-muted text-primary/40 text-[10px] font-black">+{teacher.classes.length - 3}</span>
            )}
          </div>
        ) : (
          <div className="px-4 py-3 rounded-2xl bg-muted/30 border-2 border-dashed border-muted text-center italic text-xs text-primary/30 font-bold">
            لم يتم إسناد فصول بعد
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-auto pt-6 border-t-2 border-muted relative z-10">
        <button onClick={onView}
          className="flex-1 h-12 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-primary/80 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-primary/10">
          <Eye className="w-4 h-4" /> السيرة الذاتية
        </button>
        {isAdmin && (
          <button onClick={onEdit} className="w-12 h-12 rounded-2xl border-2 border-muted hover:border-secondary hover:text-secondary flex items-center justify-center transition-all bg-white shadow-sm active:scale-90" title="تعديل البيانات">
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function TeacherDetailModal({ teacher, onClose }: { teacher: TeacherProfile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{teacher.full_name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-muted">
            <p className="text-xs text-muted-foreground mb-0.5">رقم الموبايل</p>
            <p className="font-medium text-foreground" dir="ltr">{teacher.phone || '—'}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted">
            <p className="text-xs text-muted-foreground mb-2">الفصول المُسنَدة ({teacher.classes.length})</p>
            {teacher.classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد فصول مُسندة</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {teacher.classes.map(c => (
                  <span key={c.id} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal (admin only — updates profile) ────────────────────────────────
function EditTeacherModal({ teacher, onClose }: { teacher: TeacherProfile; onClose: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(teacher.full_name);
  const [phone, setPhone] = useState(teacher.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      phone: phone.trim().replace(/\D/g, '') || null,
    }).eq('id', teacher.id);
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
          <h2 className="text-xl font-bold text-foreground">تعديل بيانات المعلم</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">الاسم الكامل *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">رقم الموبايل</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground"
              placeholder="05xxxxxxxx" />
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
