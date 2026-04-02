import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useParams, useNavigate } from 'react-router-dom';
import { useSubmissions } from '@/hooks/queries';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, FileText, CheckCircle, Clock, Search, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function AssignmentSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('assignments').select('*, classes(name)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: submissions = [], isLoading: submissionsLoading } = useSubmissions(id || '');

  const filtered = useMemo(() => submissions.filter(s => 
    (s.student_name || '').includes(search)
  ), [submissions, search]);

  const isLoading = assignmentLoading || submissionsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        <button onClick={() => navigate('/assignments')} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 w-fit transition-colors font-bold text-sm">
          <ChevronRight className="w-4 h-4" /> العودة للتكليفات
        </button>

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">{assignment?.title}</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4 line-clamp-2">{assignment?.description || 'لا يوجد وصف'}</p>
            <div className="flex flex-wrap gap-2 pr-4 pt-2">
              <Badge variant="outline" className="bg-slate-50 border-slate-100 text-slate-500 rounded-lg">{assignment?.classes?.name}</Badge>
              <Badge variant="outline" className="bg-amber-50 border-amber-100 text-amber-600 rounded-lg flex gap-1">
                <Clock className="w-3 h-3" /> 
                {assignment?.due_date ? format(new Date(assignment.due_date), 'dd MMM yyyy', { locale: ar }) : 'غير محدد'}
              </Badge>
            </div>
          </div>
        </header>

        <div className="relative group w-full max-w-md">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <Input 
            placeholder="ابحث باسم الطالب..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <FileText className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا توجد تسليمات</h2>
            <p className="text-slate-400 font-medium text-sm">لم يقم أي طالب بتسليم هذا التكليف حتى الآن.</p>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">اسم الطالب</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">حالة التسليم</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">تاريخ التسليم</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">الدرجة</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">خيارات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">{s.student_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        {s.status === 'submitted' && <Badge className="bg-emerald-50 text-emerald-600 border-none rounded-lg"><CheckCircle className="w-3 h-3 mr-1" /> تم التسليم</Badge>}
                        {s.status === 'graded' && <Badge className="bg-indigo-50 text-indigo-600 border-none rounded-lg">تم التقييم</Badge>}
                        {s.status === 'late' && <Badge className="bg-rose-50 text-rose-600 border-none rounded-lg">متأخر</Badge>}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">
                        {s.submitted_at ? format(new Date(s.submitted_at), 'dd MMM yyyy - hh:mm a', { locale: ar }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-slate-900">
                        {s.grade ?? '-'}
                      </td>
                      <td className="px-6 py-4">
                         {s.file_url && (
                           <a href={s.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                             <ExternalLink className="w-4 h-4" />
                           </a>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
