import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, User, Eye, X, Search, Users } from 'lucide-react';

interface ParentProfile {
  id: string;
  full_name: string;
  phone: string | null;
  children: { id: string; name: string; class_name?: string }[];
}

export default function ParentsPage() {
  const { toast } = useToast();
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ParentProfile | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'parent');
    if (!roles?.length) { setParents([]); setLoading(false); return; }

    const parentIds = roles.map(r => r.user_id);
    const [{ data: profiles }, { data: links }, { data: classes }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', parentIds),
      supabase.from('student_parents')
        .select('parent_id, students!student_parents_student_id_fkey(id, name, class_id)'),
      supabase.from('classes').select('id, name'),
    ]);

    const result: ParentProfile[] = (profiles || []).map(p => {
      const studentLinks = (links || []).filter((l: any) => l.parent_id === p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        children: studentLinks
          .map((l: any) => l.students)
          .filter(Boolean)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            class_name: classes?.find(c => c.id === s.class_id)?.name,
          })),
      };
    });
    setParents(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = parents.filter(p =>
    p.full_name.includes(search) || (p.phone || '').includes(search)
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-header mb-1">أولياء الأمور</h1>
            <p className="text-muted-foreground text-sm">إدارة حسابات أولياء الأمور والطلاب المرتبطين بهم.</p>
          </div>
          <div className="bg-secondary/5 border border-secondary/10 px-4 py-2 rounded-2xl flex items-center gap-2">
            <User className="w-5 h-5 text-secondary" />
            <span className="text-sm font-bold text-secondary">{parents.length} أولياء أمور</span>
          </div>
        </div>

        <div className="relative group max-w-2xl">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input type="text" placeholder="بحث بالاسم أو الرقم..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-4 rounded-2xl border border-input bg-card text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm" />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium animate-pulse">جارٍ تحميل البيانات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-3xl border border-dashed p-20 text-center">
            <Search className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-bold text-foreground mb-1">لا يوجد أولياء أمور</p>
            <p className="text-muted-foreground">جرب البحث بكلمات مختلفة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(p => (
              <ParentCard key={p.id} parent={p} onView={() => setSelected(p)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ParentDetailModal parent={selected} onClose={() => setSelected(null)} />
      )}
    </AppLayout>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function ParentCard({ parent, onView }: { parent: ParentProfile; onView: () => void }) {
  return (
    <div className="bg-card rounded-3xl border shadow-sm p-6 flex flex-col gap-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group animate-scale-in">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-secondary/5 border border-secondary/10 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3">
          <User className="w-7 h-7 text-secondary" />
        </div>
        <div className="min-w-0 pt-1">
          <h3 className="font-bold text-foreground text-lg truncate group-hover:text-primary transition-colors">{parent.full_name || 'بدون اسم'}</h3>
          {parent.phone && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground font-medium" dir="ltr">
              <Phone className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span>{parent.phone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">الأبناء المرتبطون</label>
        <div className="flex flex-wrap gap-2">
          {parent.children.length === 0 ? (
            <span className="text-xs text-muted-foreground italic bg-muted/30 px-3 py-1.5 rounded-lg border border-dashed w-full">لا يوجد أبناء مرتبطون</span>
          ) : (
            <>
              {parent.children.slice(0, 2).map(c => (
                <span key={c.id} className="px-2.5 py-1 rounded-lg bg-secondary/5 text-secondary text-[11px] font-bold border border-secondary/10 flex items-center gap-1">
                  <Users className="w-3 h-3" />{c.name}
                </span>
              ))}
              {parent.children.length > 2 && (
                <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[11px] font-medium">+{parent.children.length - 2}</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-border/50">
        <button onClick={onView}
          className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 group/btn active:scale-95 shadow-sm">
          <Eye className="w-4 h-4 transition-transform group-hover/btn:scale-110" />عرض التفاصيل
        </button>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function ParentDetailModal({ parent, onClose }: { parent: ParentProfile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{parent.full_name || 'بدون اسم'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-muted">
            <p className="text-xs text-muted-foreground mb-0.5">رقم الموبايل</p>
            <p className="font-medium text-foreground" dir="ltr">{parent.phone || '—'}</p>
          </div>

          <div className="p-3 rounded-xl bg-muted">
            <p className="text-xs text-muted-foreground mb-2">الأبناء المرتبطون ({parent.children.length})</p>
            {parent.children.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد أبناء مرتبطون</p>
            ) : (
              <div className="space-y-2">
                {parent.children.map(child => (
                  <div key={child.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background">
                    <span className="text-sm font-medium text-foreground">{child.name}</span>
                    {child.class_name && (
                      <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted">
                        {child.class_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
