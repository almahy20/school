import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/auth';
import { 
  ShieldCheck, Users, Phone, Trash2, Edit2, Ban, 
  CheckCircle, Search, X, Save, UserPlus, ShieldPlus, 
  UserCheck, ShieldAlert, MoreHorizontal, LinkIcon 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  useUsers, 
  useCreateUser, 
  useDeleteUser, 
  useUpdateUserRole, 
  useUpdateUserStatus,
  useUpdateUserProfile,
  useBranding
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import DataPagination from '@/components/ui/DataPagination';

const PAGE_SIZE = 12;

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '' });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', phone: '', password: '', role: 'parent' as AppRole });
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('الكل');

  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Queries ──
  const { data: branding } = useBranding();
  const { 
    data, 
    isLoading: loading, 
    error, 
    refetch 
  } = useUsers(page, PAGE_SIZE, debouncedSearch, roleFilter);

  const users = data?.data || [];
  const totalItems = data?.count || 0;

  // ── Mutations ──
  const createUserMutation = useCreateUser();
  const deleteUserMutation = useDeleteUser();
  const updateRoleMutation = useUpdateUserRole();
  const updateStatusMutation = useUpdateUserStatus();
  const updateProfileMutation = useUpdateUserProfile();

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleRoleFilter = (val: string) => { setRoleFilter(val); setPage(1); };

  const handleDelete = async (userId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً من قاعدة البيانات والخدمات السحابية؟')) return;
    try {
      await deleteUserMutation.mutateAsync(userId);
      toast({ title: 'تم الحذف بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
      toast({ title: 'تم تغيير الرتبة بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateStatusMutation.mutateAsync({ userId, status });
      toast({ title: status === 'approved' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserMutation.mutateAsync(createForm);
      toast({ title: 'تم إنشاء المستخدم بنجاح' });
      setShowCreateDialog(false);
      setCreateForm({ fullName: '', phone: '', password: '', role: 'parent' });
    } catch (err: any) {
      toast({ title: 'خطأ في الإنشاء', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateProfile = async (userId: string) => {
    try {
      await updateProfileMutation.mutateAsync({ 
        userId, 
        full_name: editForm.fullName, 
        phone: editForm.phone 
      });
      toast({ title: 'تم تحديث البيانات بنجاح' });
      setEditingId(null);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-20">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-10 sm:p-14 rounded-[56px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-4 relative z-10 w-full xl:w-1/2">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                 <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">إدارة المستخدمين والصلاحيات</h1>
            </div>
            <p className="text-slate-500 font-medium text-lg pr-1">تحكم كامل في الكادر التعليمي، الإداري، وأولياء الأمور داخل منظومة {currentUser?.schoolId && 'المدرسة'}.</p>
            
            {/* LINK COPYING SECTION */}
            {branding?.slug && (
               <div className="flex flex-col gap-3 pt-4">
                 <div className="flex items-center gap-2 group/btn cursor-pointer" onClick={() => {
                   navigator.clipboard.writeText(`${window.location.origin}/register/parents/${branding.slug}`);
                   toast({ title: 'تعميم الرابط', description: 'تم نسخ رابط تسجيل أولياء الأمور للمشاركة الدورية.' });
                 }}>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover/btn:scale-110 transition-transform">
                       <LinkIcon className="w-4 h-4" />
                    </div>
                    <div>
                       <p className="text-sm font-black text-slate-800">رابط دعوة أولياء الأمور</p>
                       <p className="text-[10px] font-bold text-slate-400 group-hover/btn:text-indigo-500 transition-colors">اضغط للنسخ والمشاركة</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-2 group/btn cursor-pointer" onClick={() => {
                   navigator.clipboard.writeText(`${window.location.origin}/register/teachers/${branding.slug}`);
                   toast({ title: 'تعميم الرابط', description: 'تم نسخ رابط تسجيل الكادر التعليمي.' });
                 }}>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover/btn:scale-110 transition-transform">
                       <LinkIcon className="w-4 h-4" />
                    </div>
                    <div>
                       <p className="text-sm font-black text-slate-800">رابط دعوة المعلمين</p>
                       <p className="text-[10px] font-bold text-slate-400 group-hover/btn:text-emerald-500 transition-colors">اضغط للنسخ والمشاركة</p>
                    </div>
                 </div>
               </div>
            )}
          </div>

          <div className="flex items-center gap-4 relative z-10 w-full xl:w-auto xl:justify-end">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="h-16 px-8 rounded-3xl bg-slate-900 text-white font-black text-xs hover:scale-105 active:scale-95 transition-all gap-3 shadow-2xl shadow-slate-200">
                  <UserPlus className="w-5 h-5 text-indigo-400" /> إضافة مستخدم جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-[40px] p-0 border-none bg-transparent">
                 <div className="bg-white p-12 space-y-8 text-right rounded-[40px]">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">إنشاء حساب جديد</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-6">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الاسم الكامل</label>
                          <Input value={createForm.fullName} onChange={e => setCreateForm({...createForm, fullName: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" required />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم الهاتف</label>
                          <Input value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" required />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">كلمة المرور</label>
                          <Input type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" required />
                       </div>
                       <div className="space-y-1.5 pt-2">
                          <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest block mb-3">رتبة المستخدم</label>
                          <div className="flex flex-wrap gap-2 justify-end">
                             {['admin', 'teacher', 'parent'].map(r => (
                               <button type="button" key={r} onClick={() => setCreateForm({...createForm, role: r as AppRole})}
                                 className={cn("px-5 py-2 rounded-xl text-[10px] font-black transition-all", createForm.role === r ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                                 {r === 'admin' ? 'إدمن' : r === 'teacher' ? 'معلم' : 'ولي أمر'}
                               </button>
                             ))}
                          </div>
                       </div>
                       <Button type="submit" disabled={createUserMutation.isPending} className="w-full h-14 mt-6 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-xl shadow-indigo-100">
                         {createUserMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الحساب الآن'}
                       </Button>
                    </form>
                 </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6 items-center">
          <div className="relative group w-full lg:max-w-2xl text-right">
             <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
             <Input 
               placeholder="البحث بالاسم أو رقم الهاتف..." 
               value={search}
               onChange={e => handleSearch(e.target.value)}
               className="h-14 pr-14 pl-6 rounded-[28px] border-none bg-white text-base font-bold shadow-xl shadow-slate-200/20 focus:ring-4 focus:ring-indigo-600/5 transition-all text-right" 
             />
          </div>
          
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
             {['الكل', 'admin', 'teacher', 'parent'].map(role => (
               <button key={role} onClick={() => handleRoleFilter(role)}
                 className={cn(
                   "px-6 py-2.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shadow-sm",
                   roleFilter === role ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-white text-slate-400 font-bold"
                 )}>
                 {role === 'admin' ? 'مدراء' : role === 'teacher' ? 'معلمون' : role === 'parent' ? 'أولياء أمور' : 'الكل'}
               </button>
             ))}
          </div>
        </div>

        <QueryStateHandler
          loading={loading}
          error={error}
          data={users}
          onRetry={refetch}
          isEmpty={users.length === 0}
          loadingMessage="جاري مزامنة بيانات الكوادر..."
          emptyMessage="لم يتم العثور على مستخدمين يطابقون بحثك."
        >
          <div className="space-y-10">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} مستخدم متاح — الصفحة {page}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
               {users.map(u => (
                 <ManagedUserCard 
                   key={u.id} 
                   user={u} 
                   currentAdminId={currentUser?.id}
                   onDelete={handleDelete}
                   onRoleChange={handleRoleChange}
                   onStatusChange={handleStatusChange}
                   onEditProfile={(u: any) => { setEditingId(u.id); setEditForm({ fullName: u.fullName, phone: u.phone }); }}
                   isUpdating={deleteUserMutation.isPending || updateRoleMutation.isPending || updateStatusMutation.isPending}
                 />
               ))}
            </div>

            <div className="pt-4">
              <DataPagination
                currentPage={page}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </div>
        </QueryStateHandler>
      </div>

      {editingId && (
        <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
           <DialogContent className="sm:max-w-[450px] rounded-[40px] p-0 border-none bg-transparent">
             <div className="bg-white p-12 space-y-8 text-right rounded-[40px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">تعديل الملف الشخصي</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الاسم الكامل</label>
                      <Input value={editForm.fullName} onChange={e => setEditForm({...editForm, fullName: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم الهاتف</label>
                      <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
                   </div>
                   <div className="flex gap-4 pt-4">
                      <Button onClick={() => handleUpdateProfile(editingId)} disabled={updateProfileMutation.isPending} className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-lg">حفظ التغييرات</Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)} className="flex-1 h-12 rounded-xl font-black text-xs">إلغاء</Button>
                   </div>
                </div>
             </div>
           </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}

function ManagedUserCard({ user, currentAdminId, onDelete, onRoleChange, onStatusChange, onEditProfile, isUpdating }: any) {
  const isMe = user.id === currentAdminId;
  const roleColors: any = {
    admin: "bg-indigo-600 text-white shadow-indigo-100",
    teacher: "bg-emerald-500 text-white shadow-emerald-100",
    parent: "bg-amber-500 text-white shadow-amber-100"
  };

  return (
    <div className="group premium-card p-0 overflow-hidden hover:scale-[1.02] transition-all duration-500 shadow-xl shadow-slate-200/20 text-right">
       <div className={cn("h-1.5 w-full", roleColors[user.role] || "bg-slate-200")} />
       <div className="p-8 space-y-6">
          <div className="flex items-start justify-between">
             <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100 group-hover:rotate-6 transition-transform">
                   <Users className="w-7 h-7" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight mb-1">{user.fullName}</h3>
                   <div className="flex items-center gap-2">
                      <Badge className={cn("rounded-lg px-2.5 py-0.5 font-black text-[8px] uppercase tracking-widest border-none", roleColors[user.role])}>
                         {user.role === 'admin' ? 'مدير نظام' : user.role === 'teacher' ? 'معلم' : 'ولي أمر'}
                      </Badge>
                      {isMe && <Badge className="rounded-lg bg-slate-900 text-white font-black text-[8px] uppercase px-2 py-0.5 border-none">أنت</Badge>}
                   </div>
                </div>
             </div>
             <div className="flex flex-col items-end gap-2">
                <Badge className={cn(
                  "rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase border-none",
                  user.approvalStatus === 'approved' ? "bg-emerald-50 text-emerald-600" : user.approvalStatus === 'pending' ? "bg-amber-50 text-amber-600 animate-pulse" : "bg-rose-50 text-rose-600"
                )}>
                   {user.approvalStatus === 'approved' ? 'مفعل' : user.approvalStatus === 'pending' ? 'قيد الانتظار' : 'مرفوض'}
                </Badge>
             </div>
          </div>

          <div className="space-y-2.5 text-[11px] font-bold text-slate-400">
             <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-200" />
                <span dir="ltr">{user.phone}</span>
             </div>
             <div className="flex items-center gap-3">
                <ShieldPlus className="w-4 h-4 text-slate-200" />
                <span>عضو منذ {new Date(user.createdAt).toLocaleDateString('ar-EG')}</span>
             </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50">
             <Button variant="ghost" onClick={() => onEditProfile(user)} className="h-10 px-4 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-black text-[10px] gap-2">
                <Edit2 className="w-3.5 h-3.5" /> تعديل
             </Button>
             
             {!isMe && (
               <>
                 <Button variant="ghost" 
                   onClick={() => onRoleChange(user.id, user.role === 'teacher' ? 'admin' : user.role === 'parent' ? 'teacher' : 'parent')}
                   disabled={isUpdating}
                   className="h-10 px-4 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all font-black text-[10px] gap-2"
                 >
                    <ShieldAlert className="w-3.5 h-3.5" /> ترقية/تغيير
                 </Button>
                 
                 {user.approvalStatus !== 'approved' ? (
                   <Button variant="ghost" onClick={() => onStatusChange(user.id, 'approved')} disabled={isUpdating}
                     className="h-10 px-4 rounded-xl text-emerald-500 hover:bg-emerald-50 transition-all font-black text-[10px] gap-2">
                      <UserCheck className="w-3.5 h-3.5" /> تفعيل
                   </Button>
                 ) : (
                   <Button variant="ghost" onClick={() => onStatusChange(user.id, 'rejected')} disabled={isUpdating}
                     className="h-10 px-4 rounded-xl text-rose-500 hover:bg-rose-50 transition-all font-black text-[10px] gap-2">
                      <Ban className="w-3.5 h-3.5" /> تعطيل
                   </Button>
                 )}

                 <Button variant="ghost" onClick={() => onDelete(user.id)} disabled={isUpdating}
                   className="h-10 px-4 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all font-black text-[10px] gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> حذف
                 </Button>
               </>
             )}
          </div>
       </div>
    </div>
  );
}
