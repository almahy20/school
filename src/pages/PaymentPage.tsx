import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, CheckCircle2, Loader2, Phone, ArrowLeft,
  BookOpen, Clock, AlertCircle, ExternalLink, ShieldCheck
} from 'lucide-react';
import { useOrder, useUpdateOrder } from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

const PLAN_LABELS: Record<string, { name: string; price: number; days: number }> = {
  monthly:     { name: 'الباقة الشهرية',        price: 500,  days: 30 },
  half_yearly: { name: 'الباقة النصف سنوية',    price: 999,  days: 180 },
  yearly:      { name: 'الباقة السنوية',        price: 1799, days: 365 },
};

const DEVELOPER_WHATSAPP = '201029082772';

export default function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Queries ──
  const { data: order, isLoading, error: orderError, refetch } = useOrder(orderId);
  const updateOrderMutation = useUpdateOrder();

  const planInfo = useMemo(() => 
    order?.plan ? PLAN_LABELS[order.plan] : { name: order?.package_type || 'باقة مخصصة', price: 0, days: 0 },
    [order?.plan, order?.package_type]
  );

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFile) { setErrorMessage('يرجى اختيار صورة الإيصال أولاً لإتمام العملية.'); return; }
    if (!orderId) return;

    setErrorMessage('');

    try {
      // 1. Upload receipt to Storage
      const ext = receiptFile.name.split('.').pop();
      const path = `receipts/${orderId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('school-assets')
        .upload(path, receiptFile, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('school-assets').getPublicUrl(path);
      const receiptUrl = urlData.publicUrl;

      // 2. Update order with receipt metadata
      await updateOrderMutation.mutateAsync({
        id: orderId,
        receipt_url: receiptUrl,
        receipt_note: receiptNote.trim() || null,
      });

      // 3. Build & Send WhatsApp notification
      const waMsg = encodeURIComponent(
        `🏫 *طلب مدرسة جديد تم دفعه*\n\n` +
        `📌 *المدرسة:* ${order?.school_name}\n` +
        `👤 *المدير:* ${order?.admin_name}\n` +
        `📱 *الهاتف:* ${order?.admin_phone}\n` +
        `📦 *الباقة:* ${planInfo.name} (${planInfo.price} ج.م)\n\n` +
        `🧾 *رابط الإيصال:* ${receiptUrl}\n` +
        (receiptNote ? `📝 *ملاحظة:* ${receiptNote}\n` : '') +
        `\n⚠️ يرجى التفعيل من لوحة تحكم السوبر أدمن.`
      );

      window.open(`https://wa.me/${DEVELOPER_WHATSAPP}?text=${waMsg}`, '_blank');
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية الإرسال، يرجى المحاولة مرة أخرى أو التواصل مع الدعم التقني.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#060a14] flex items-center justify-center p-8 sm:p-12" dir="rtl">
        <div className="max-w-xl w-full text-center space-y-10 animate-in fade-in zoom-in-95 duration-700">
          <div className="w-32 h-32 rounded-[40px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            <CheckCircle2 className="w-16 h-16 text-emerald-400" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-white tracking-tight">تم إرسال الطلب بنجاح!</h1>
            <p className="text-white/40 font-medium text-lg">سجلنا طلبك وسنقوم بفحص إيصال الدفع فوراً.</p>
          </div>

          <div className="bg-[#0b1221] border border-white/5 rounded-[40px] p-10 text-right space-y-8 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
             
             <div className="flex items-start gap-5 group">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/10">
                   <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white font-black text-lg mb-1.5">مرحلة المراجعة</p>
                  <p className="text-white/40 text-sm leading-relaxed">
                    يتم مراجعة الدفعات يدوياً لضمان أعلى مستويات الأمان. سيتم تفعيل حساب مدرستك خلال <strong className="text-emerald-400">2-4 ساعات</strong> كحد أقصى.
                  </p>
                </div>
             </div>

             <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/10">
                   <Phone className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white font-black text-lg mb-1.5">الدعم الفني المباشر</p>
                  <a
                    href={`https://wa.me/${DEVELOPER_WHATSAPP}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-white text-sm font-black flex items-center gap-2 transition-all group"
                  >
                    للتواصل المباشر مع فريق التفعيل اضغط هنا <ExternalLink className="w-4 h-4 group-hover:translate-x-[-4px]" />
                  </a>
                </div>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 px-8 py-4 rounded-2xl bg-white/5 border border-white/5 text-pink-400 font-mono text-sm">
               رقم العملية: {orderId?.slice(0, 8).toUpperCase()}
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-8 h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all flex items-center gap-3 active:scale-95 shadow-xl"
            >
              <ArrowLeft className="w-5 h-5" /> العودة للرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060a14] py-16 px-6 sm:px-12" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-12">
        <QueryStateHandler
          loading={isLoading}
          error={orderError}
          data={order}
          onRetry={refetch}
          loadingMessage="جاري جلب تفاصيل طلب المدرسة المعتمد..."
          primaryColor="indigo"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-10 border-b border-white/5 relative">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-[28px] bg-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.3)]">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-black text-white tracking-tight">إكمال عملية الدفع</h1>
                <div className="flex items-center gap-2">
                   <p className="text-white/30 text-sm font-bold uppercase tracking-widest leading-none">مدرسة {order?.school_name}</p>
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                </div>
              </div>
            </div>
            <Badge className="bg-white/5 border-white/10 text-white/40 font-black text-[9px] px-4 py-2 rounded-xl">نظام تفعيل المدرسة 2025</Badge>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* 1. Summary Card */}
            <div className="bg-[#0b1221] border border-white/5 rounded-[48px] p-10 space-y-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <h2 className="text-xl font-black text-white flex items-center gap-4">
                <span className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-600/20">1</span>
                بيانات التعاقد
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <SummaryItem label="مدير النظام" value={order?.admin_name} />
                <SummaryItem label="الباقة المختارة" value={planInfo.name} highlight />
                <SummaryItem label="فترة التراخيص" value={`${planInfo.days} يوم بصلاحيات كاملة`} />
                <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center justify-center gap-1">
                   <p className="text-[10px] font-black text-emerald-400/50 uppercase tracking-widest mb-1">المبلغ المطلوب سداده</p>
                   <p className="text-3xl font-black text-emerald-400">{planInfo.price.toLocaleString('ar-EG')} <span className="text-sm">ج.م</span></p>
                </div>
              </div>
            </div>

            {/* 2. Payment Instructions */}
            <div className="bg-indigo-600 rounded-[48px] p-10 text-white shadow-2xl shadow-indigo-900/40 relative overflow-hidden group border-4 border-indigo-500/20">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
              <h2 className="text-xl font-black text-white mb-10 flex items-center gap-4 relative z-10">
                <span className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-sm font-black border border-white/20">2</span>
                منصة التحويل الفوري
              </h2>

              <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 space-y-8 relative z-10 mb-8 hover:scale-[1.02] transition-transform duration-500 text-center">
                <div className="space-y-4">
                  <p className="text-indigo-100 font-bold text-sm tracking-widest uppercase">حوّل المبلغ عبر فودافون كاش على</p>
                  <p className="text-5xl font-black text-white tracking-widest font-mono">01029082772</p>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] font-medium leading-relaxed">باسم: عبدالرحمن سيد فوزي</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                 <InstructionStep text="تأكد من صحة المبلغ قبل التحويل" />
                 <InstructionStep text="احتفظ بلقطة شاشة للإيصال فوراً" />
                 <InstructionStep text="سيتم التفعيل بعد رفع الصورة أدناه" />
              </div>
            </div>

            {/* 3. Upload Form */}
            <form onSubmit={handleSubmit} className="bg-[#0b1221] border border-white/5 rounded-[56px] p-10 sm:p-12 space-y-10 shadow-3xl">
              <h2 className="text-2xl font-black text-white flex items-center gap-4">
                <span className="w-10 h-10 rounded-[14px] bg-indigo-600 flex items-center justify-center text-base font-black shadow-xl shadow-indigo-600/30">3</span>
                توثيق عملية الدافع
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">صورة إيصال التحويل المعتمدة *</label>
                  <label className="cursor-pointer block group">
                    <div className={cn(
                      "w-full rounded-[40px] border-4 border-dashed transition-all duration-700 min-h-[300px] flex items-center justify-center p-4",
                      receiptPreview 
                        ? "border-emerald-500/20 bg-emerald-500/[0.02]" 
                        : "border-white/5 bg-white/[0.02] hover:border-indigo-500/30 hover:bg-indigo-500/[0.03]"
                    )}>
                      {receiptPreview ? (
                        <div className="relative w-full h-full flex items-center justify-center max-h-[400px]">
                          <img src={receiptPreview} alt="Receipt preview" className="max-w-full max-h-[350px] object-contain rounded-2xl shadow-2xl" />
                          <div className="absolute -top-4 -right-4 bg-emerald-500 text-white p-3 rounded-2xl shadow-xl animate-in zoom-in-0 duration-500">
                             <CheckCircle2 className="w-6 h-6" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-4">
                           <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-white/20 mx-auto group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                              <Upload className="w-10 h-10" />
                           </div>
                           <div>
                              <p className="text-white font-black">اسحب أو اضغط لرفع الإيصال</p>
                              <p className="text-white/20 text-xs font-bold mt-1 uppercase tracking-widest">يدعم الصور والـ PDF حتى 10 ميجا</p>
                           </div>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange} className="hidden" />
                  </label>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">ملاحظات المراجعة (اختياري)</label>
                  <textarea
                    value={receiptNote}
                    onChange={(e) => setReceiptNote(e.target.value)}
                    placeholder="هل قمت بالتحويل من محفظة برقم مختلف؟ اكتب الملاحظة هنا..."
                    rows={3}
                    className="w-full px-8 py-6 rounded-3xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/10 focus:outline-none focus:ring-[12px] focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all resize-none text-sm leading-relaxed"
                  />
                </div>

                {errorMessage && (
                  <div className="flex items-center gap-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-3xl animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-6 h-6 shrink-0" />
                    <p className="text-sm font-black leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={updateOrderMutation.isPending}
                  className="w-full h-20 rounded-[28px] bg-indigo-600 hover:bg-slate-100 text-white hover:text-slate-900 font-black text-lg shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 group"
                >
                  {updateOrderMutation.isPending ? (
                    <><Loader2 className="w-7 h-7 animate-spin" /> جاري التوثيق...</>
                  ) : (
                    <>
                      إرسال الطلب وتشغيل الواتساب
                      <ArrowLeft className="w-6 h-6 border-none" />
                    </>
                  )}
                </button>
                
                <p className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-relaxed">
                   سيتم توجيهك لتطبيق واتساب لتأكيد الاستلام من قبل الدعم الفني فور الإرسال.
                </p>
              </div>
            </form>
          </div>
        </QueryStateHandler>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, highlight }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</p>
      <p className={cn("text-base font-black text-white", highlight && "text-indigo-400")}>{value}</p>
    </div>
  );
}

function InstructionStep({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors">
       <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
       <span className="text-[10px] font-black text-indigo-100 leading-tight uppercase tracking-tight">{text}</span>
    </div>
  );
}
