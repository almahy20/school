import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database, Table, Plus, Trash2, Edit2, Save, X, RefreshCw, Search, ChevronDown } from 'lucide-react';

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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">إدارة قاعدة البيانات</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setAddMode(true); setNewRow({}); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            إضافة سجل
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg border border-input hover:bg-muted transition-colors" title="تحديث">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABLES.map(t => (
          <button
            key={t.name}
            onClick={() => setActiveTable(t.name)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTable === t.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            <Table className="w-4 h-4 inline-block ml-1" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="بحث في البيانات..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-3 pr-9 py-2 rounded-lg border border-input bg-background text-foreground text-sm w-full max-w-md"
        />
      </div>

      {/* Add row form */}
      {addMode && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">إضافة سجل جديد</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tableConfig.columns.filter(c => c.editable).map(c => (
              <div key={c.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{c.label}</label>
                <input
                  value={newRow[c.key] || ''}
                  onChange={e => setNewRow(f => ({ ...f, [c.key]: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm w-full"
                  placeholder={c.label}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd} disabled={actionLoading === 'new'} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-4 h-4 inline-block ml-1" />
              حفظ
            </button>
            <button onClick={() => setAddMode(false)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">
              <X className="w-4 h-4 inline-block ml-1" />
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Data table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  {tableConfig.columns.map(c => (
                    <th key={c.key} className="text-right p-3 text-xs font-semibold text-foreground whitespace-nowrap">{c.label}</th>
                  ))}
                  <th className="text-center p-3 text-xs font-semibold text-foreground">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    {tableConfig.columns.map(c => (
                      <td key={c.key} className="p-3 text-sm text-foreground max-w-[200px] truncate">
                        {editingId === row.id && c.editable ? (
                          <input
                            value={editForm[c.key] || ''}
                            onChange={e => setEditForm(f => ({ ...f, [c.key]: e.target.value }))}
                            className="px-2 py-1 rounded border border-input bg-background text-foreground text-xs w-full"
                          />
                        ) : (
                          <span className="text-xs">{row[c.key]?.toString() || '—'}</span>
                        )}
                      </td>
                    ))}
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {editingId === row.id ? (
                          <>
                            <button onClick={() => saveEdit(row.id)} disabled={actionLoading === row.id} className="p-1.5 rounded-lg hover:bg-success/10 text-success disabled:opacity-50" title="حفظ">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="إلغاء">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary" title="تعديل">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(row.id)} disabled={actionLoading === row.id} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive disabled:opacity-50" title="حذف">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={tableConfig.columns.length + 1} className="p-8 text-center text-muted-foreground">لا توجد بيانات</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground text-center">
            إجمالي السجلات: {filtered.length}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
