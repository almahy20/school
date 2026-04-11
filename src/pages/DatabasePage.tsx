import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { Database, Table, Plus, Trash2, Edit2, Save, X, RefreshCw, Search, CheckCircle2 } from 'lucide-react';
import { 
  useTableData, 
  useInsertRow, 
  useUpdateRow, 
  useDeleteRow 
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { cn } from '@/lib/utils';

type TableName = 'students' | 'classes' | 'grades' | 'attendance' | 'student_parents' | 'exam_templates';

const TABLES: { name: TableName; label: string; columns: { key: string; label: string; editable: boolean }[] }[] = [
  {
    name: 'students',
    label: 'الطلاب',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'name', label: 'الاسم', editable: true },
      { key: 'class_id', label: 'معرف الفصل', editable: true },
      { key: 'birth_date', label: 'تاريخ الميلاد', editable: true },
      { key: 'notes', label: 'ملاحظات', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'classes',
    label: 'الفصول',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'name', label: 'اسم الفصل', editable: true },
      { key: 'grade_level', label: 'المرحلة', editable: true },
      { key: 'teacher_id', label: 'معرف المعلم', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'grades',
    label: 'الدرجات',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'student_id', label: 'معرف الطالب', editable: true },
      { key: 'subject', label: 'المادة', editable: true },
      { key: 'score', label: 'الدرجة', editable: true },
      { key: 'max_score', label: 'الدرجة القصوى', editable: true },
      { key: 'term', label: 'الفصل الدراسي', editable: true },
      { key: 'date', label: 'التاريخ', editable: true },
    ],
  },
  {
    name: 'attendance',
    label: 'الحضور',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'student_id', label: 'معرف الطالب', editable: true },
      { key: 'date', label: 'التاريخ', editable: true },
      { key: 'status', label: 'الحالة', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'student_parents',
    label: 'ربط الطلاب بأولياء الأمور',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'student_id', label: 'معرف الطالب', editable: true },
      { key: 'parent_id', label: 'معرف ولي الأمر', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'exam_templates',
    label: 'قوالب الامتحانات',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'title', label: 'العنوان', editable: true },
      { key: 'subject', label: 'المادة', editable: true },
      { key: 'class_id', label: 'معرف الفصل', editable: true },
      { key: 'teacher_id', label: 'معرف المعلم', editable: true },
      { key: 'max_score', label: 'الدرجة القصوى', editable: true },
      { key: 'exam_type', label: 'نوع الامتحان', editable: true },
      { key: 'term', label: 'الفصل', editable: true },
    ],
  },
];

export default function DatabasePage() {
  const { toast } = useToast();
  const [activeTable, setActiveTable] = useState<TableName>('students');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [addMode, setAddMode] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});

  const tableConfig = useMemo(() => TABLES.find(t => t.name === activeTable)!, [activeTable]);

  // ── Queries ──
  const { data: rows = [], isLoading: loading, error, refetch } = useTableData(activeTable);

  // ── Mutations ──
  const insertRowMutation = useInsertRow(activeTable);
  const updateRowMutation = useUpdateRow(activeTable);
  const deleteRowMutation = useDeleteRow(activeTable);

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
      await deleteRowMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const startEdit = (row: any) => {
    setEditingId(row.id);
    const form: Record<string, string> = {};
    tableConfig.columns.filter(c => c.editable).forEach(c => {
      form[c.key] = row[c.key]?.toString() || '';
    });
    setEditForm(form);
  };

  const saveEdit = async (id: string) => {
    const updates: Record<string, any> = { id };
    tableConfig.columns.filter(c => c.editable).forEach(c => {
      const val = editForm[c.key];
      updates[c.key] = val === '' ? null : val;
    });
    try {
      await updateRowMutation.mutateAsync(updates);
      setEditingId(null);
      toast({ title: 'تم حفظ التغييرات بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleAdd = async () => {
    const record: Record<string, any> = {};
    tableConfig.columns.filter(c => c.editable).forEach(c => {
      const val = newRow[c.key];
      if (val && val.trim()) record[c.key] = val;
    });
    try {
      await insertRowMutation.mutateAsync(record);
      setAddMode(false);
      setNewRow({});
      toast({ title: 'تمت إضافة السجل بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter((row: any) => 
      Object.values(row).some(v => v?.toString().toLowerCase().includes(search.toLowerCase()))
    );
  }, [rows, search]);

  const isMutationPending = insertRowMutation.isPending || updateRowMutation.isPending || deleteRowMutation.isPending;

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-14">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">إدارة قاعدة البيانات الرئيسية</h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide">التحكم المباشر في سجلات وجداول النظام لعمليات التدقيق والتصحيح.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => refetch()} 
              disabled={loading}
              className={cn("w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-indigo-600 transition-all shadow-sm", loading && "opacity-50")}
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
            <button 
              onClick={() => { setAddMode(true); setNewRow({}); }} 
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-900/10 hover:shadow-xl hover:translate-y-[-2px] transition-all"
            >
              <Plus className="w-5 h-5 text-indigo-400" />
              إضافة سجل جديد
            </button>
          </div>
        </header>

        {/* Table Selector */}
        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar lg:flex-wrap">
          {TABLES.map(t => (
            <button
              key={t.name}
              onClick={() => { setActiveTable(t.name); setEditingId(null); setAddMode(false); }}
              className={cn(
                "px-6 py-3 rounded-2xl text-[10px] font-black whitespace-nowrap transition-all border shadow-sm uppercase tracking-widest",
                activeTable === t.name 
                ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' 
                : 'bg-white border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              )}
            >
              <Table className={cn("w-3.5 h-3.5 inline-block ml-2", activeTable === t.name ? 'text-indigo-400' : 'text-slate-200')} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative group max-w-2xl w-full">
          <Search className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            placeholder="ابحث في السجلات..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-14 pl-6 py-4 rounded-3xl border border-slate-100 bg-white text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all shadow-sm text-right"
          />
        </div>

        {/* Add Row Form */}
        {addMode && (
          <div className="bg-slate-900 rounded-[40px] p-10 relative overflow-hidden animate-in slide-in-from-top-4 duration-500 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-8 pr-2 flex items-center gap-3">
              <Plus className="w-6 h-6 text-indigo-400" />
              إضافة سجل جديد في {tableConfig.label}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
              {tableConfig.columns.filter(c => c.editable).map(c => (
                <div key={c.key} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 pr-1 uppercase tracking-widest">{c.label}</label>
                  <input
                    value={newRow[c.key] || ''}
                    onChange={e => setNewRow(f => ({ ...f, [c.key]: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/10 text-right"
                    placeholder={`أدخل ${c.label}...`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-10">
              <button 
                onClick={handleAdd} 
                disabled={insertRowMutation.isPending} 
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {insertRowMutation.isPending ? 'جاري الحفظ...' : 'حفظ السجل الجديد'}
              </button>
              <button 
                onClick={() => setAddMode(false)} 
                className="px-8 py-4 rounded-2xl bg-white/5 text-white/60 font-black text-xs hover:bg-white/10 transition-all"
              >إلغاء</button>
            </div>
          </div>
        )}

        {/* Table Data */}
        <QueryStateHandler
          loading={loading}
          error={error}
          data={rows}
          onRetry={refetch}
          isEmpty={filtered.length === 0}
          loadingMessage="جاري مزامنة بيانات الجداول..."
          emptyMessage="لا توجد بيانات متاحة في هذا الجدول حالياً."
        >
          <div className="bg-white border border-slate-100 shadow-xl shadow-slate-200/20 rounded-[40px] overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    {tableConfig.columns.map(c => (
                      <th key={c.key} className="px-8 py-6 text-[10px] font-black text-slate-400 thick-border-b uppercase tracking-widest">{c.label}</th>
                    ))}
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 thick-border-b uppercase tracking-widest text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((row: any) => (
                    <tr key={row.id} className="group hover:bg-slate-50/30 transition-all">
                      {tableConfig.columns.map(c => (
                        <td key={c.key} className="px-8 py-6 text-sm font-bold text-slate-600 max-w-[200px] truncate">
                          {editingId === row.id && c.editable ? (
                            <input
                              value={editForm[c.key] || ''}
                              onChange={e => setEditForm(f => ({ ...f, [c.key]: e.target.value }))}
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black focus:outline-none focus:border-indigo-600 transition-all text-right"
                            />
                          ) : (
                            <span className="group-hover:text-slate-900 transition-colors">{row[c.key]?.toString() || '—'}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2">
                          {editingId === row.id ? (
                            <>
                              <button 
                                onClick={() => saveEdit(row.id)} 
                                disabled={updateRowMutation.isPending} 
                                className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => setEditingId(null)} 
                                className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-200 transition-all"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => startEdit(row)} 
                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                title="تعديل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(row.id)} 
                                disabled={deleteRowMutation.isPending}
                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={cn("w-4 h-4", isMutationPending ? "text-slate-200 animate-pulse" : "text-emerald-500")} />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">مزامنة البيانات الحية نشطة</span>
              </div>
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">إجمالي السجلات: {filtered.length}</p>
            </div>
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}
