import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, CheckCircle2, Loader2, Phone, ArrowLeft,
  BookOpen, Clock, AlertCircle, ExternalLink
} from 'lucide-react';

const PLAN_LABELS: Record<string, { name: string; price: number; days: number }> = {
  monthly:     { name: 'شهرية',        price: 500,  days: 30 },
  half_yearly: { name: 'نصف سنوية',    price: 999,  days: 180 },
  yearly:      { name: 'سنوية',        price: 1799, days: 365 },
};

const DEVELOPER_WHATSAPP = '201029082772';

export default function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) { navigate('/'); return; }
    (supabase as any)
      .from('school_orders')
      .select('*')
      .eq('id', orderId)
      .single()
      .then(({ data, error: err }: any) => {
        if (err || !data) { navigate('/'); return; }
        setOrder(data);
        setLoading(false);
      });
  }, [orderId, navigate]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFile) { setError('يرجى رفع صورة الإيصال'); return; }
    setSubmitting(true);
    setError('');

    try {
      // Upload receipt to Supabase Storage
      const ext = receiptFile.name.split('.').pop();
      const path = `receipts/${orderId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('school-assets')
        .upload(path, receiptFile, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('school-assets').getPublicUrl(path);
      const receiptUrl = urlData.publicUrl;

      // Update order with receipt
      const { error: updateErr } = await (supabase as any)
        .from('school_orders')
        .update({
          receipt_url: receiptUrl,
          receipt_note: receiptNote.trim() || null,
        })
        .eq('id', orderId);

      if (updateErr) throw updateErr;

      // Build WhatsApp notification message for developer
      const plan = PLAN_LABELS[order.plan] || { name: order.plan, price: 0, days: 0 };
      const waMsg = encodeURIComponent(
        `🏫 *طلب مدرسة جديد — إدارة عربية*\n\n` +
        `📌 *المدرسة:* ${order.school_name}\n` +
        `👤 *المدير:* ${order.admin_name}\n` +
        `📱 *الهاتف:* ${order.admin_phone}\n` +
        `💬 *واتساب:* ${order.admin_whatsapp}\n` +
        `📦 *الباقة:* ${plan.name} (${plan.price} ج.م)\n` +
        `🗓️ *المدة:* ${plan.days} يوم\n\n` +
        `🧾 *الإيصال:* ${receiptUrl}\n` +
        (receiptNote ? `📝 *ملاحظة:* ${receiptNote}\n` : '') +
        `\n✅ يرجى مراجعة الطلب وتفعيل المدرسة من لوحة التحكم.`
      );

      // Open WhatsApp for developer notification
      window.open(`https://wa.me/${DEVELOPER_WHATSAPP}?text=${waMsg}`, '_blank');

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ، يرجى المحاولة مجدداً');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-white/40 font-bold">جاري تحميل بيانات الطلب...</p>
        </div>
      </div>
    );
  }

  const planInfo = PLAN_LABELS[order?.plan] || { name: order?.plan, price: 0, days: 0 };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-lg w-full text-center animate-in fade-in zoom-in-95">
          <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4">تم إرسال الطلب بنجاح! 🎉</h1>
          <div className="bg-[#0d1526] border border-white/10 rounded-3xl p-8 mb-8 text-right">
            <div className="flex items-start gap-3 mb-5">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-bold mb-1">جاري مراجعة الدفع</p>
                <p className="text-white/50 text-sm leading-relaxed">
                  سيتم مراجعة إيصال الدفع والتواصل معك على واتساب خلال <strong className="text-white">24 ساعة</strong> لتفعيل المدرسة وإرسال بيانات الدخول.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-bold mb-1">واتساب المطور</p>
                <a
                  href={`https://wa.me/${DEVELOPER_WHATSAPP}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-bold flex items-center gap-1.5 transition-colors"
                >
                  للتواصل المباشر اضغط هنا <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 mb-8">
            <p className="text-indigo-300 text-sm font-medium">
              📋 رقم طلبك: <span className="font-mono text-white">{orderId}</span>
              <br />احتفظ بهذا الرقم للمراجعة.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] py-12 px-6" dir="rtl">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">إتمام الدفع</h1>
            <p className="text-white/40 text-sm font-medium">مدرسة: {order?.school_name}</p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-[#0d1526] border border-white/10 rounded-3xl p-6 mb-6">
          <h2 className="text-white font-black mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black">1</span>
            ملخص الطلب
          </h2>
          <div className="space-y-3">
            {[
              { label: 'المدرسة', value: order?.school_name },
              { label: 'المدير', value: order?.admin_name },
              { label: 'الباقة', value: planInfo.name },
              { label: 'المدة', value: `${planInfo.days} يوم` },
              { label: 'المبلغ المطلوب', value: `${planInfo.price.toLocaleString('ar-EG')} ج.م`, highlight: true },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-white/40 text-sm font-medium">{row.label}</span>
                <span className={`text-sm font-bold ${row.highlight ? 'text-emerald-400 text-base' : 'text-white'}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="bg-gradient-to-br from-emerald-600/10 to-emerald-700/5 border border-emerald-500/20 rounded-3xl p-6 mb-6">
          <h2 className="text-white font-black mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-xs font-black">2</span>
            تعليمات الدفع
          </h2>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-5">
            <p className="text-emerald-300 font-bold text-sm leading-relaxed text-center">
              حوّل المبلغ على <strong className="text-white text-base">فودافون كاش</strong>
              <br />على الرقم:{' '}
              <strong className="text-white text-2xl font-black tracking-wide">01029082772</strong>
              <br />
              <span className="text-white/50 text-xs mt-1 inline-block">باسم: عبدالرحمن سيد فوزي</span>
            </p>
          </div>

          <ul className="space-y-2 text-sm text-white/50 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              تأكد من صحة المبلغ ({planInfo.price.toLocaleString('ar-EG')} ج.م) قبل التحويل
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              احتفظ بصورة الإيصال لرفعها أدناه
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              سيتم التواصل معك خلال 24 ساعة على الواتساب المسجل
            </li>
          </ul>
        </div>

        {/* Receipt Upload Form */}
        <form onSubmit={handleSubmit} className="bg-[#0d1526] border border-white/10 rounded-3xl p-6 space-y-5">
          <h2 className="text-white font-black flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black">3</span>
            رفع إيصال الدفع
          </h2>

          {/* Receipt Upload */}
          <div>
            <label className="block text-xs font-black text-white/50 uppercase tracking-widest mb-2">
              صورة الإيصال *
            </label>
            <label className="cursor-pointer block">
              <div className={`w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
                receiptPreview
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-white/10 bg-white/3 hover:border-indigo-500/50 hover:bg-indigo-500/5'
              }`}>
                {receiptPreview ? (
                  <div className="relative">
                    <img src={receiptPreview} alt="receipt" className="w-full max-h-60 object-contain p-4" />
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      ✓ تم الاختيار
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Upload className="w-8 h-8 text-white/20 mb-3" />
                    <p className="text-white/40 font-bold text-sm">اضغط لرفع صورة الإيصال</p>
                    <p className="text-white/20 text-xs mt-1">PNG, JPG, PDF — حتى 5MB</p>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange} className="hidden" />
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-black text-white/50 uppercase tracking-widest mb-2">
              ملاحظات (اختياري)
            </label>
            <textarea
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
              placeholder="أي ملاحظات إضافية حول عملية الدفع..."
              rows={3}
              className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-medium placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold p-4 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإرسال...</>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                إرسال وإبلاغ المطور على واتساب
              </>
            )}
          </button>

          <p className="text-white/20 text-xs text-center font-medium leading-relaxed">
            بالضغط على الزر ستُفتح نافذة واتساب لإبلاغ المطور تلقائياً بطلبك وصورة الإيصال.
          </p>
        </form>
      </div>
    </div>
  );
}
