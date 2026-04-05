import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database, Table, Plus, Trash2, Edit2, Save, X, RefreshCw, Search, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [addMode, setAddMode] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const tableConfig = TABLES.find(t => t.name === activeTable)!;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from(activeTable).select('*').order('created_at', { ascending: false }).limit(500);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [activeTable, toast]);

  useEffect(() => {
    fetchData();
    setEditingId(null);
    setAddMode(false);
    setSearch('');
  }, [activeTable, fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    setActionLoading(id);
    const { error } = await supabase.from(activeTable).delete().eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.filter(r => r.id !== id));
      toast({ title: 'تم الحذف' });
    }
    setActionLoading(null);
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
    setActionLoading(id);
    const updates: Record<string, any> = {};
    tableConfig.columns.filter(c => c.editable).forEach(c => {
      const val = editForm[c.key];
      updates[c.key] = val === '' ? null : val;
    });
    const { error } = await supabase.from(activeTable).update(updates).eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      setEditingId(null);
      toast({ title: 'تم الحفظ' });
    }
    setActionLoading(null);
  };

  const handleAdd = async () => {
    setActionLoading('new');
    const record: Record<string, any> = {};
    tableConfig.columns.filter(c => c.editable).forEach(c => {
      const val = newRow[c.key];
      if (val && val.trim()) record[c.key] = val;
    });
    const { data, error } = await supabase.from(activeTable).insert(record as any).select().single();
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => [data, ...prev]);
      setAddMode(false);
      setNewRow({});
      toast({ title: 'تمت الإضافة' });
    }
    setActionLoading(null);
  };

  const filtered = rows.filter(row => {
    if (!search) return true;
    return Object.values(row).some(v => v?.toString().includes(search));
  });

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-14">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">إدارة قاعدة البيانات</h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide">التحكم المباشر في سجلات وجداول النظام</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={fetchData} 
              className={`w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-primary transition-all shadow-sm ${loading ? 'opacity-50' : ''}`}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => { setAddMode(true); setNewRow({}); }} 
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-900/10 hover:shadow-xl hover:translate-y-[-2px] transition-all"
            >
              <Plus className="w-5 h-5 text-primary" />
              إضافة سجل جديد
            </button>
          </div>
        </header>

        {/* Table Selector */}
        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar lg:flex-wrap">
          {TABLES.map(t => (
            <button
              key={t.name}
              onClick={() => setActiveTable(t.name)}
              className={`px-6 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                activeTable === t.name 
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' 
                : 'bg-white border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Table className={`w-4 h-4 inline-block ml-2 ${activeTable === t.name ? 'text-white' : 'text-slate-200'}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative group max-w-2xl w-full">
          <Search className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="ابحث في السجلات..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-14 pl-6 py-4 rounded-3xl border border-slate-100 bg-white text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-sm"
          />
        </div>

        {/* Add Row Form (Minimalist View) */}
        {addMode && (
          <div className="bg-slate-900 rounded-[40px] p-10 relative overflow-hidden animate-in slide-in-from-top-4 duration-500 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-8 pr-2 flex items-center gap-3">
              <Plus className="w-6 h-6 text-primary" />
              إضافة سجل جديد في {tableConfig.label}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tableConfig.columns.filter(c => c.editable).map(c => (
                <div key={c.key} className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 pr-1">{c.label}</label>
                  <input
                    value={newRow[c.key] || ''}
                    onChange={e => setNewRow(f => ({ ...f, [c.key]: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-medium focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                    placeholder={`أدخل ${c.label}...`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-10">
              <button 
                onClick={handleAdd} 
                disabled={actionLoading === 'new'} 
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                حفظ وإضافة السجل
              </button>
              <button 
                onClick={() => setAddMode(false)} 
                className="px-8 py-4 rounded-2xl bg-white/5 text-white/60 font-bold text-sm hover:bg-white/10 transition-all"
              >إلغاء</button>
            </div>
          </div>
        )}

        {/* Table Data */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[40px] border border-slate-100">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-sm font-medium">جاري مزامنة بيانات الجدول...</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 shadow-sm rounded-[40px] overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    {tableConfig.columns.map(c => (
                      <th key={c.key} className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest">{c.label}</th>
                    ))}
                    <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(row => (
                    <tr key={row.id} className="group hover:bg-slate-50/30 transition-all">
                      {tableConfig.columns.map(c => (
                        <td key={c.key} className="px-8 py-6 text-sm font-medium text-slate-600 max-w-[200px] truncate">
                          {editingId === row.id && c.editable ? (
                            <input
                              value={editForm[c.key] || ''}
                              onChange={e => setEditForm(f => ({ ...f, [c.key]: e.target.value }))}
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:border-primary transition-all"
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
                                disabled={actionLoading === row.id} 
                                className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-emerald-500/10"
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
                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-primary hover:bg-primary/5 transition-all"
                                title="تعديل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(row.id)} 
                                disabled={actionLoading === row.id} 
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
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={tableConfig.columns.length + 1} className="py-32 text-center">
                        <div className="w-20 h-20 rounded-full bg-slate-50 mx-auto flex items-center justify-center mb-6">
                          <Database className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">الجدول فارغ</h3>
                        <p className="text-slate-400 font-medium">لم يتم العثور على أي بيانات في هذا الجدول حالياً.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">مزامنة البيانات نشطة</span>
              </div>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">إجمالي السجلات: {filtered.length}</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
