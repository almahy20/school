import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Shield, Users, Phone, Trash2, Edit2, Ban, CheckCircle, Search, X, Save, UserPlus } from 'lucide-react';
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
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');
      const authData = await callAdminApi('list');

      if (profiles && roles) {
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
  }, [toast]);

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
      case 'admin': return 'مدير';
      case 'teacher': return 'معلم';
      case 'parent': return 'ولي أمر';
    }
  };

  const roleBadgeClass = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'bg-destructive/10 text-destructive';
      case 'teacher': return 'bg-primary/10 text-primary';
      case 'parent': return 'bg-success/10 text-success';
    }
  };

  const filtered = users.filter(u =>
    u.fullName.includes(search) || u.phone.includes(search) || roleLabel(u.role).includes(search)
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-3 pr-9 py-2 rounded-lg border border-input bg-background text-foreground text-sm w-56"
            />
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-4 h-4" />
            إنشاء مستخدم
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg">
            <Users className="w-4 h-4" />
            <span>{users.length} مستخدم</span>
          </div>
        </div>
      </div>

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
                  <th className="text-right p-4 text-sm font-semibold text-foreground">الاسم</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">رقم الموبايل</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">الدور</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground">الحالة</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={`border-b last:border-0 transition-colors ${u.banned ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                    <td className="p-4">
                      {editingId === u.id ? (
                        <input
                          value={editForm.fullName}
                          onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                          className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
                        />
                      ) : (
                        <span className="font-medium text-foreground">
                          {u.fullName || '—'}
                          {u.id === user?.id && <span className="text-xs text-muted-foreground mr-2">(أنت)</span>}
                        </span>
                      )}
                    </td>
                    <td className="p-4" dir="ltr">
                      {editingId === u.id ? (
                        <input
                          value={editForm.phone}
                          onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                          className="px-2 py-1 rounded border border-input bg-background text-foreground text-sm w-full"
                          dir="ltr"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          <Phone className="w-3 h-3 inline-block ml-1" />
                          {u.phone || '—'}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.id === user?.id ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleBadgeClass(u.role)}`}>
                          <Shield className="w-3 h-3 inline-block ml-1" />
                          {roleLabel(u.role)}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value as AppRole)}
                          disabled={actionLoading === u.id}
                          className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm disabled:opacity-50"
                        >
                          <option value="admin">مدير</option>
                          <option value="teacher">معلم</option>
                          <option value="parent">ولي أمر</option>
                        </select>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {u.banned ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">معطّل</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">نشط</span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.id === user?.id ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {editingId === u.id ? (
                            <>
                              <button
                                onClick={() => saveEdit(u.id)}
                                disabled={actionLoading === u.id}
                                className="p-2 rounded-lg hover:bg-success/10 text-success transition-colors disabled:opacity-50"
                                title="حفظ"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                                title="إلغاء"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(u)}
                                className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                title="تعديل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleBanToggle(u.id, u.banned)}
                                disabled={actionLoading === u.id}
                                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${u.banned ? 'hover:bg-success/10 text-success' : 'hover:bg-warning/10 text-warning'}`}
                                title={u.banned ? 'تفعيل' : 'تعطيل'}
                              >
                                {u.banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDelete(u.id)}
                                disabled={actionLoading === u.id}
                                className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-50"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">لا يوجد مستخدمون</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-card rounded-2xl border p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">إنشاء مستخدم جديد</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">الاسم الكامل</label>
                <input
                  value={createForm.fullName}
                  onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                  placeholder="أدخل الاسم"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">رقم الهاتف</label>
                <input
                  value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">كلمة المرور</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                  placeholder="أدخل كلمة المرور"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">الدور</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as AppRole }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                >
                  <option value="parent">ولي أمر</option>
                  <option value="teacher">معلم</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateUser}
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {createLoading ? 'جارٍ الإنشاء...' : 'إنشاء'}
                </button>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1 py-2.5 rounded-lg border border-input bg-background text-foreground font-medium text-sm hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
