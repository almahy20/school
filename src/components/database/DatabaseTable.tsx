import { Save, X, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableConfig } from '@/config/database-tables';

interface DatabaseTableProps {
  tableConfig: TableConfig;
  filteredRows: any[];
  editingId: string | null;
  editForm: Record<string, string>;
  setEditForm: (form: any) => void;
  startEdit: (row: any) => void;
  saveEdit: (id: string) => void;
  handleDelete: (id: string) => void;
  cancelEdit: () => void;
  isMutationPending: boolean;
  updatePending: boolean;
  deletePending: boolean;
}

export function DatabaseTable({
  tableConfig,
  filteredRows,
  editingId,
  editForm,
  setEditForm,
  startEdit,
  saveEdit,
  handleDelete,
  cancelEdit,
  isMutationPending,
  updatePending,
  deletePending,
}: DatabaseTableProps) {
  return (
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
            {filteredRows.map((row: any) => (
              <tr key={row.id} className="group hover:bg-slate-50/30 transition-all">
                {tableConfig.columns.map(c => (
                  <td key={c.key} className="px-8 py-6 text-sm font-bold text-slate-600 max-w-[200px] truncate">
                    {editingId === row.id && c.editable ? (
                      <input
                        value={editForm[c.key] || ''}
                        onChange={e => setEditForm({ ...editForm, [c.key]: e.target.value })}
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
                          disabled={updatePending} 
                          className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={cancelEdit} 
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
                          disabled={deletePending}
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
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">إجمالي السجلات: {filteredRows.length}</p>
      </div>
    </div>
  );
}
