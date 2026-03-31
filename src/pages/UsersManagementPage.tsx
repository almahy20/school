import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Shield, Users, Phone, Trash2, Edit2, Ban, CheckCircle, Search, X, Save, UserPlus, ShieldCheck, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManagedUser {
  id: string;
  fullName: string;
  phone: string;
  role: AppRole;
  banned: boolean;
  createdAt: string;
}

async function callAdminApi(action: string, userId?: string, data?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('admin-users', {
    body: { action, userId, data },
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export default function UsersManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', phone: '', password: '', role: 'parent' as AppRole });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('*').eq('school_id', user.schoolId);
      const { data: roles } = await supabase.from('user_roles').select('*').eq('school_id', user.schoolId);
      const authData = await callAdminApi('list');

      if (profiles && roles) {
        const profileIds = new Set(profiles.map(p => p.id));
        const merged: ManagedUser[] = profiles.map((p) => {
          const userRole = roles.find((r) => r.user_id === p.id);
          const authUser = authData?.users?.find((u: any) => u.id === p.id);
          return {
            id: p.id,
            fullName: p.full_name || '',
            phone: p.phone || '',
            role: (userRole?.role as AppRole) || 'parent',
            banned: !!authUser?.banned_until && new Date(authUser.banned_until) > new Date(),
            createdAt: p.created_at,
          };
        });
        setUsers(merged);
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [toast, user?.schoolId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (userId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) return;
    setActionLoading(userId);
    try {
      await callAdminApi('delete', userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: 'تم الحذف', description: 'تم حذف المستخدم بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setActionLoading(userId);
    try {
      await callAdminApi('update_role', userId, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast({ title: 'تم التحديث', description: 'تم تغيير الدور بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleBanToggle = async (userId: string, currentlyBanned: boolean) => {
    setActionLoading(userId);
    try {
      await callAdminApi('ban', userId, { banned: !currentlyBanned });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: !currentlyBanned } : u));
      toast({ title: 'تم التحديث', description: currentlyBanned ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const startEdit = (u: ManagedUser) => {
    setEditingId(u.id);
    setEditForm({ fullName: u.fullName, phone: u.phone });
  };

  const saveEdit = async (userId: string) => {
    setActionLoading(userId);
    try {
      await callAdminApi('update_profile', userId, { full_name: editForm.fullName, phone: editForm.phone });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, fullName: editForm.fullName, phone: editForm.phone } : u));
      setEditingId(null);
      toast({ title: 'تم الحفظ', description: 'تم تحديث البيانات بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleCreateUser = async () => {
    if (!createForm.phone.trim() || !createForm.password.trim()) {
      toast({ title: 'خطأ', description: 'يرجى إدخال رقم الهاتف وكلمة المرور', variant: 'destructive' });
      return;
    }
    setCreateLoading(true);
    try {
      await callAdminApi('create_user', undefined, {
        phone: createForm.phone,
        password: createForm.password,
        full_name: createForm.fullName,
        role: createForm.role,
        school_id: user?.schoolId,
      });
      toast({ title: 'تم الإنشاء', description: 'تم إنشاء المستخدم بنجاح' });
      setShowCreateDialog(false);
      setCreateForm({ fullName: '', phone: '', password: '', role: 'parent' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setCreateLoading(false);
  };

  const roleLabel = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'مدير النظام';
      case 'teacher': return 'معلم';
      case 'parent': return 'ولي أمر';
    }
  };

  const filtered = users.filter(u =>
    u.fullName.includes(search) || u.phone.includes(search) || roleLabel(u.role).includes(search)
  ).sort((a,b) => a.fullName.localeCompare(b.fullName));

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">إدارة المستخدمين</h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide">التحكم في هويات وصلاحيات الدخول للنظام</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold text-slate-900">{users.length}</span>
              <span className="text-xs font-medium text-slate-400">مستخدم</span>
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/10 hover:shadow-xl hover:translate-y-[-2px] transition-all"
            >
              <UserPlus className="w-5 h-5" />
              إضافة مستخدم
            </button>
          </div>
        </header>

        {/* Search */}
        <div className="relative group max-w-2xl w-full">
          <Search className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="ابحث بالاسم، رقم الهاتف، أو الدور..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-14 pl-6 py-4 rounded-2xl border border-slate-100 bg-white text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-sm font-medium">جاري مزامنة قاعدة البيانات...</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 shadow-sm rounded-[40px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest">هوية المستخدم</th>
                    <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest">التواصل</th>
                    <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest">الدور الصلاحيات</th>
                    <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">حالة الحساب</th>
                    <th className="px-8 py-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((u) => (
                    <tr key={u.id} className={`group transition-all ${u.banned ? 'bg-rose-50/20' : 'hover:bg-slate-50/30'}`}>
                      <td className="px-8 py-6">
                        {editingId === u.id ? (
                          <input
                            value={editForm.fullName}
                            onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                            className="w-full px-6 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:border-primary transition-all"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                              {u.fullName || '—'}
                            </span>
                            {u.id === user?.id && <span className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">حسابك الحالي</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6" dir="ltr">
                        {editingId === u.id ? (
                          <input
                            value={editForm.phone}
                            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                            className="w-full px-6 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:border-primary transition-all"
                            dir="ltr"
                          />
                        ) : (
                          <span className="text-base font-medium text-slate-400 group-hover:text-slate-700 transition-colors">
                            {u.phone || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {u.id === user?.id ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-primary/5 text-primary border border-primary/10">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {roleLabel(u.role)}
                          </div>
                        ) : (
                          <div className="relative max-w-[150px]">
                            <select
                              value={u.role}
                              onChange={e => handleRoleChange(u.id, e.target.value as AppRole)}
                              disabled={actionLoading === u.id}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-900 font-bold text-xs focus:outline-none focus:border-primary/20 appearance-none cursor-pointer disabled:opacity-50 hover:bg-white transition-all shadow-inner"
                            >
                              <option value="admin">مدير نظام</option>
                              <option value="teacher">معلم / موظف</option>
                              <option value="parent">ولي أمر</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold ${u.banned ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${u.banned ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                          {u.banned ? 'محظور' : 'نشط'}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        {u.id === user?.id ? (
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">إدارة ذاتية</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            {editingId === u.id ? (
                              <>
                                <button
                                  onClick={() => saveEdit(u.id)}
                                  disabled={actionLoading === u.id}
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
                                  onClick={() => startEdit(u)}
                                  className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                                  title="تعديل"
                                >
                                  <Edit2 className="w-4.5 h-4.5" />
                                </button>
                                <button
                                  onClick={() => handleBanToggle(u.id, u.banned)}
                                  disabled={actionLoading === u.id}
                                  className={`w-10 h-10 rounded-xl transition-all ${u.banned ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white'}`}
                                  title={u.banned ? 'تفعيل' : 'حظر'}
                                >
                                  {u.banned ? <UserCheck className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                                </button>
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  disabled={actionLoading === u.id}
                                  className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                  title="حذف"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-24 text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-50 mx-auto flex items-center justify-center mb-6">
                    <Search className="w-10 h-10 text-slate-200" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">لا توجد نتائج</h3>
                  <p className="text-slate-400 font-medium">لم نتمكن من العثور على مستخدمين يطابقون استفسارك.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreateDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-right animate-in fade-in" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-10 rounded-[32px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 mb-8 tracking-tight">إضافة مستخدم جديد للنظام</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 pr-1">الاسم الكامل *</label>
                <input
                  value={createForm.fullName}
                  onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all shadow-inner"
                  placeholder="الاسم الرباعي للمستخدم"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 pr-1">رقم الهاتف *</label>
                  <input
                    value={createForm.phone}
                    onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all shadow-inner"
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 pr-1">كلمة المرور المؤقتة</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all shadow-inner"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 pr-1">تحديد صلاحية النظام</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as AppRole }))}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all appearance-none shadow-inner"
                >
                  <option value="parent">ولي أمر / مستخدم</option>
                  <option value="teacher">معلم / موظف</option>
                  <option value="admin">مدير نظام</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleCreateUser}
                  disabled={createLoading}
                  className="flex-1 h-16 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:translate-y-[-2px] active:scale-95 transition-all disabled:opacity-50"
                >
                  {createLoading ? 'جاري الإنشاء...' : 'تأكيد إنشاء الحساب'}
                </button>
                <button 
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1 h-16 rounded-2xl bg-slate-50 text-slate-500 font-bold text-sm hover:bg-slate-100 transition-all"
                >إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
