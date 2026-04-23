import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Upload, Palette, Image as ImageIcon, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding, useUpdateSchool } from '@/hooks/queries';
import { compressImage } from '@/lib/utils';

export default function SchoolBrandingSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: brandingData, isLoading: loading } = useBranding();
  const updateSchoolMutation = useUpdateSchool();

  const [branding, setBranding] = useState({
    logo_url: '',
    name: ''
  });
  const [uploading, setUploading] = useState<'logo' | 'icon' | null>(null);

  useEffect(() => {
    if (brandingData) {
      setBranding({
        logo_url: brandingData.logo_url || '',
        name: brandingData.name || ''
      });
    }
  }, [brandingData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'icon') => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      if (!user?.schoolId) return;
      
      const file = e.target.files[0];
      setUploading(type);

      // ✅ Optimization: Compress image before upload
      const compressedBlob = await compressImage(file, 800, 0.7);
      const finalFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });

      const fileExt = 'jpg'; // We compress to jpeg
      const timestamp = Date.now();
      const fileName = `${user.schoolId}_${type}_${timestamp}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('school_assets')
        .upload(filePath, finalFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school_assets').getPublicUrl(filePath);
      const finalUrl = `${data.publicUrl}?v=${timestamp}`;
      
      setBranding(prev => ({ ...prev, [`${type}_url`]: finalUrl }));
      toast({ title: 'تم رفع الصورة بنجاح', description: 'تم استلام الشعار الجديد، يرجى الحفظ لتأكيد التغيير.' });
    } catch (error: any) {
       toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
       setUploading(null);
    }
  };

  const saveSettings = async () => {
    if (!user?.schoolId) return;
    try {
      await updateSchoolMutation.mutateAsync({ 
        id: user.schoolId, 
        name: branding.name,
        logo_url: branding.logo_url 
      });
      toast({ title: 'تم الحفظ بنجاح', description: 'تم تحديث هوية المدرسة البصرية.' });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">جاري استرجاع إعدادات الهوية...</p>
    </div>
  );

  return (
    <div className="space-y-10 max-w-4xl mx-auto text-right animate-in fade-in slide-in-from-bottom-2 duration-500" dir="rtl">
      <header className="flex items-center justify-between bg-white/40 backdrop-blur-md p-8 rounded-[32px] border border-white/50 shadow-sm">
         <div className="space-y-1">
           <h2 className="text-2xl font-black text-slate-900 tracking-tight">الهوية البصرية للمدرسة</h2>
           <p className="text-xs font-medium text-slate-400">إدارة الرموز والشعارات التي تمثل مدرستك في النظام.</p>
         </div>
         <Button 
           onClick={saveSettings} 
           disabled={updateSchoolMutation.isPending}
           className="bg-slate-900 hover:bg-indigo-600 text-white font-black px-10 rounded-2xl h-14 shadow-xl shadow-slate-200 transition-all gap-3"
         >
            {updateSchoolMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ الهوية الجديدة
         </Button>
      </header>

      <div className="bg-white p-10 border border-slate-100 rounded-[40px] shadow-sm space-y-6">
         <div className="space-y-2">
            <h3 className="font-black text-xl text-slate-900">الاسم الرسمي للمدرسة</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">سيظهر هذا الاسم في جميع التقارير، الواجهات، وتطبيقات الطلاب.</p>
         </div>
         <input 
            type="text"
            value={branding.name}
            onChange={(e) => setBranding(prev => ({ ...prev, name: e.target.value }))}
            placeholder="مثال: مدارس الأوائل الأهلية"
            className="w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-black text-xl text-slate-900 shadow-inner focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-slate-300 placeholder:font-medium"
         />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="p-10 bg-white border border-slate-100 rounded-[40px] shadow-sm space-y-8 group">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <ImageIcon className="w-6 h-6" />
               </div>
               <h3 className="font-black text-xl text-slate-900">شعار المدرسة (Logo)</h3>
            </div>
            
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50 relative overflow-hidden transition-all hover:bg-white hover:border-indigo-200">
               {branding.logo_url ? (
                  <img 
                    src={branding.logo_url} 
                    alt="Logo" 
                    className="max-h-40 object-contain drop-shadow-2xl transition-transform group-hover:scale-105 duration-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      setBranding(prev => ({ ...prev, logo_url: '' }));
                    }}
                  />
               ) : (
                  <div className="flex flex-col items-center gap-4 py-10 opacity-30">
                     <ImageIcon className="w-16 h-16 text-slate-400" />
                     <p className="text-xs font-black uppercase tracking-widest">لم يتم رفع شعار بعد</p>
                  </div>
               )}
               
               <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-slate-900/40 backdrop-blur-[2px] transition-all duration-500 rounded-[30px]">
                  <label className="cursor-pointer flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black shadow-2xl hover:scale-110 active:scale-95 transition-all">
                     {uploading === 'logo' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 text-indigo-600" />}
                     تغيير الشعار
                     <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} disabled={uploading === 'logo'} />
                  </label>
               </div>
            </div>
         </div>

         <div className="md:col-span-1 p-10 bg-indigo-600 rounded-[40px] shadow-2xl shadow-indigo-100 flex flex-col justify-between text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="space-y-6 relative z-10">
               <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Palette className="w-7 h-7" />
               </div>
               <h3 className="font-black text-2xl tracking-tight">تكامل الهوية المؤسسية</h3>
               <p className="text-sm font-medium text-indigo-100 leading-relaxed">
                  يتم استخدام هذا الشعار في التقارير المدرسية، شهادات الطلاب، واجهات تسجيل الدخول، وتطبيقات الهواتف المخصصة لمدرستك.
               </p>
            </div>
            
            <div className="pt-10 flex items-center gap-3 opacity-60 relative z-10">
               <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">سيتم دعم تخصيص الألوان قريباً</span>
            </div>
         </div>
      </div>
    </div>
  );
}
// Force HMR reload
