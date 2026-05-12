import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CurriculumModalsProps {
  showAddCurriculum: boolean;
  setShowAddCurriculum: (show: boolean) => void;
  newCurriculum: any;
  setNewCurriculum: (val: any) => void;
  handleAddCurriculum: (e: React.FormEvent) => void;
  isSavingCurriculum: boolean;
  curriculums: any[];
  handleChangeCurriculum: (id: string | null) => void;
  classItem: any;
  editingCurriculum: any;
  setEditingCurriculum: (val: any) => void;
  handleEditCurriculum: (e: React.FormEvent) => void;
  showAddSubject: boolean;
  setShowAddSubject: (show: boolean) => void;
  newSubject: any;
  setNewSubject: (val: any) => void;
  handleAddSubject: (e: React.FormEvent) => void;
  isSavingSubject: boolean;
  editingSubject: any;
  setEditingSubject: (val: any) => void;
  handleEditSubject: (e: React.FormEvent) => void;
}

export function CurriculumModals({
  showAddCurriculum,
  setShowAddCurriculum,
  newCurriculum,
  setNewCurriculum,
  handleAddCurriculum,
  isSavingCurriculum,
  curriculums,
  handleChangeCurriculum,
  classItem,
  editingCurriculum,
  setEditingCurriculum,
  handleEditCurriculum,
  showAddSubject,
  setShowAddSubject,
  newSubject,
  setNewSubject,
  handleAddSubject,
  isSavingSubject,
  editingSubject,
  setEditingSubject,
  handleEditSubject,
}: CurriculumModalsProps) {
  return (
    <>
      <Dialog open={showAddCurriculum} onOpenChange={setShowAddCurriculum}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">
              {classItem?.curriculum_id ? 'تغيير المنهج' : 'ربط منهج بالفصل'}
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">
              {classItem?.curriculum_id ? 'اختر منهج جديد لهذا الفصل' : 'أنشئ منهج جديد أو اختر من المناهج الموجودة'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8 space-y-6">
            <form onSubmit={handleAddCurriculum} className="space-y-4 pb-6 border-b border-slate-100">
              <p className="text-xs font-black text-slate-500">إنشاء منهج جديد</p>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
                <Input value={newCurriculum.name} onChange={e => setNewCurriculum({...newCurriculum, name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
                <select value={newCurriculum.status} onChange={e => setNewCurriculum({...newCurriculum, status: e.target.value as 'active' | 'inactive'})} className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg appearance-none">
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
              <Button type="submit" disabled={isSavingCurriculum} className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">
                {isSavingCurriculum ? 'جاري الحفظ...' : 'إنشاء وربط المنهج'}
              </Button>
            </form>

            {curriculums.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-500">أو اختر منهج موجود</p>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {curriculums.map(curr => (
                    <button
                      key={curr.id}
                      onClick={() => {
                        handleChangeCurriculum(curr.id);
                        setShowAddCurriculum(false);
                      }}
                      className="w-full p-5 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50 transition-all text-right"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-indigo-600" />
                          <span className="font-black text-slate-900">{curr.name}</span>
                        </div>
                        <Badge variant={curr.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {curr.status === 'active' ? 'نشط' : 'غير نشط'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {classItem?.curriculum_id && (
              <Button 
                onClick={() => {
                  handleChangeCurriculum(null);
                  setShowAddCurriculum(false);
                }}
                variant="outline" 
                className="w-full h-14 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black"
              >
                إلغاء ربط المنهج الحالي
              </Button>
            )}

            <Button onClick={() => setShowAddCurriculum(false)} variant="ghost" className="w-full h-14 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCurriculum} onOpenChange={() => setEditingCurriculum(null)}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">تعديل المنهج</DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">تعديل البيانات الأساسية للمسار التعليمي.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCurriculum} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
              <Input value={editingCurriculum?.name || ''} onChange={e => setEditingCurriculum({...editingCurriculum!, name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
              <select value={editingCurriculum?.status || 'active'} onChange={e => setEditingCurriculum({...editingCurriculum!, status: e.target.value as 'active' | 'inactive'})} className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg appearance-none">
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSavingCurriculum} className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">حفظ التغييرات</Button>
              <Button type="button" onClick={() => setEditingCurriculum(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">إضافة مادة تعليمية</DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">أدخل تفاصيل المادة الجديدة للمنهج.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubject} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
              <Input placeholder="مثال: لغتي الجميلة" value={newSubject.subject_name} onChange={e => setNewSubject({...newSubject, subject_name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى التعليمي</label>
              <Textarea value={newSubject.content} onChange={e => setNewSubject({...newSubject, content: e.target.value})} className="min-h-[120px] px-6 py-4 rounded-2xl bg-slate-50 border-none text-base font-bold resize-none" />
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSavingSubject} className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">إضافة المادة</Button>
              <Button type="button" onClick={() => setShowAddSubject(false)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSubject} onOpenChange={() => setEditingSubject(null)}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">تعديل المادة</DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">تحديث بيانات المادة الدراسية.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubject} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
              <Input value={editingSubject?.subject_name || ''} onChange={e => setEditingSubject({...editingSubject!, subject_name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى التعليمي</label>
              <Textarea value={editingSubject?.content || ''} onChange={e => setEditingSubject({...editingSubject!, content: e.target.value})} className="min-h-[120px] px-6 py-4 rounded-2xl bg-slate-50 border-none text-base font-bold resize-none" />
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSavingSubject} className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">حفظ التعديلات</Button>
              <Button type="button" onClick={() => setEditingSubject(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
