import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Phone, User, Eye, X, Search, Users, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ParentProfile {
  id: string;
  full_name: string;
  phone: string | null;
  children: { id: string; name: string; class_name?: string }[];
}

export default function ParentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    const { data: roles } = await supabase.from('user_roles')
      .select('user_id')
      .eq('role', 'parent')
      .eq('school_id', user.schoolId);
      
    if (!roles?.length) { setParents([]); setLoading(false); return; }

    const parentIds = roles.map(r => r.user_id);
    const [{ data: profiles }, { data: links }, { data: classes }] = await Promise.all([
      supabase.from('profiles').select('*').eq('school_id', user.schoolId).in('id', parentIds).order('full_name'),
      supabase.from('student_parents')
        .select('parent_id, students!student_parents_student_id_fkey(id, name, class_id)')
        .eq('school_id', user.schoolId),
      supabase.from('classes').select('id, name').eq('school_id', user.schoolId),
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
  }, [user?.schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = parents.filter(p =>
    p.full_name.includes(search) || (p.phone || '').includes(search)
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">سجل أولياء الأمور</h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide">بيانات التواصل والروابط الأسرية</p>
          </div>
          <div className="bg-white border border-slate-100 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-slate-700">{parents.length} ولي أمر</span>
          </div>
        </header>

        {/* Search */}
        <div className="relative group max-w-2xl w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
          <input type="text" placeholder="ابحث باسم ولي الأمر أو رقم الهاتف..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-14 pl-6 py-4 rounded-2xl border border-slate-100 bg-white text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-sm" />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white rounded-[40px] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-medium">جاري تحميل البيانات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-100 p-24 text-center rounded-[40px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <User className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">لا توجد نتائج</h2>
            <p className="text-slate-400 font-medium max-w-sm mx-auto">لم نتمكن من العثور على أي أولياء أمور يطابقون بحثك.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(p => (
              <ParentCard key={p.id} parent={p} onClick={() => navigate(`/parents/${p.id}`)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function ParentCard({ parent, onClick }: { parent: ParentProfile; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col text-right group h-full transition-all">
      <div className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col flex-1 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:translate-y-[-4px] transition-all w-full relative overflow-hidden">
        <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-all">
          <User className="w-6 h-6" />
        </div>
        
        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors">{parent.full_name || '...'}</h3>

        <div className="pt-5 mt-5 border-t border-slate-50 w-full flex justify-center">
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            استعراض الملف الشخصي
          </span>
        </div>
      </div>
    </button>
  );
}
