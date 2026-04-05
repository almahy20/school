import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Upload, Palette, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SchoolBrandingSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [branding, setBranding] = useState({
    logo_url: '',
    icon_url: '',
    theme_color: '#1A3C8F'
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'logo' | 'icon' | null>(null);

  useEffect(() => {
    if (!user?.schoolId) return;
    supabase.from('schools')
      .select('logo_url, icon_url, theme_color')
      .eq('id', user.schoolId)
      .single()
      .then(({ data }) => {
        if (data) {
           setBranding({
             logo_url: data.logo_url || '',
             icon_url: data.icon_url || '',
             theme_color: data.theme_color || '#1A3C8F'
           });
        }
        setLoading(false);
      });
  }, [user?.schoolId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'icon') => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setUploading(type);

      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${user?.schoolId}_${type}_${timestamp}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Delete old assets if they exist (optional but cleaner)
      // For now, we'll just upload the new one with a timestamp to ensure uniqueness and bypass cache

      const { error: uploadError } = await supabase.storage
        .from('school_assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school_assets').getPublicUrl(filePath);
      
      // Add a cache buster parameter to the URL immediately
      const finalUrl = `${data.publicUrl}?v=${timestamp}`;
      
      setBranding(prev => ({ ...prev, [`${type}_url`]: finalUrl }));
      toast({ title: 'تم رفع الصورة بنجاح', description: 'سيتم تحديث الشعار في جميع أجزاء النظام بعد الحفظ.' });
    } catch (error: any) {
       toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
       setUploading(null);
    }
  };

  const saveSettings = async () => {
    try {
      if (!user?.schoolId) return;
      const { error } = await supabase
        .from('schools')
        .update(branding)
        .eq('id', user.schoolId);
      
      if (error) throw error;
      toast({ title: 'تم الحفظ بنجاح', description: 'تم تحديث هوية المدرسة.' });
      
      // Reload page to apply new branding (or let the hook do it automatically)
      window.location.reload();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto text-right" dir="rtl">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-black text-slate-900">الهوية البصرية للمدرسة</h2>
         <Button onClick={saveSettings} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 rounded-xl h-12">
            حفظ التغييرات
         </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center gap-3">
               <ImageIcon className="w-5 h-5 text-indigo-600" />
               <h3 className="font-black text-lg">شعار المدرسة (Logo)</h3>
            </div>
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 relative group hover:border-indigo-300 transition-colors">
               {branding.logo_url ? (
                  <img 
                    src={branding.logo_url} 
                    alt="Logo" 
                    className="max-h-32 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      setBranding(prev => ({ ...prev, logo_url: '' }));
                    }}
                  />
               ) : (
                  <div className="text-slate-400 font-bold uppercase text-xs">لا يوجد شعار</div>
               )}
               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/80 backdrop-blur-sm transition-opacity rounded-xl">
                  <label className="cursor-pointer flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-slate-700 font-bold shadow-sm hover:text-indigo-600 transition-colors">
                     {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                     رفع صورة
                     <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} disabled={uploading === 'logo'} />
                  </label>
               </div>
            </div>
         </div>

         <div className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center gap-3">
               <ImageIcon className="w-5 h-5 text-indigo-600" />
               <h3 className="font-black text-lg">أيقونة التطبيق (PWA / Favicon)</h3>
            </div>
            <p className="text-xs font-bold text-slate-400">يفضل صورة مربعة بحجم 80×80</p>
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 relative group hover:border-indigo-300 transition-colors">
               {branding.icon_url ? (
                  <img 
                    src={branding.icon_url} 
                    alt="Icon" 
                    className="w-20 h-20 rounded-2xl object-cover shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      setBranding(prev => ({ ...prev, icon_url: '' }));
                    }}
                  />
               ) : (
                  <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                     <ImageIcon className="w-6 h-6" />
                  </div>
               )}
               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/80 backdrop-blur-sm transition-opacity rounded-xl">
                  <label className="cursor-pointer flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-slate-700 font-bold shadow-sm hover:text-indigo-600 transition-colors">
                     {uploading === 'icon' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                     رفع صورة
                     <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'icon')} disabled={uploading === 'icon'} />
                  </label>
               </div>
            </div>
         </div>

         <div className="md:col-span-2 p-8 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center gap-3">
               <Palette className="w-5 h-5 text-indigo-600" />
               <h3 className="font-black text-lg">لون الثيم الأساسي</h3>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
               <div className="flex items-center gap-4">
                  <input 
                    type="color" 
                    value={branding.theme_color} 
                    onChange={e => setBranding(prev => ({ ...prev, theme_color: e.target.value }))}
                    className="w-16 h-16 rounded-xl cursor-pointer border-0 p-0"
                  />
                  <div className="text-xl font-bold uppercase tracking-widest">{branding.theme_color}</div>
               </div>
               <div className="flex-1 max-w-sm rounded-xl p-4 text-white font-bold" style={{ backgroundColor: branding.theme_color }}>
                  معاينة اللون (شريط المعاينة)
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
