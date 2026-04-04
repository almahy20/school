import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  BookOpen, Users, GraduationCap, MessageSquare, CalendarCheck, ClipboardList,
  ShieldCheck, Zap, Globe, CheckCircle2, ArrowLeft, Star, Phone, Building2,
  ChevronDown, Sparkles, BarChart3, Bell, Lock, X, Upload, Loader2, Eye, EyeOff
} from 'lucide-react';

const PLANS = [
  {
    id: 'monthly',
    name: 'شهرية',
    price: 500,
    period: '/شهر',
    days: 30,
    color: 'from-slate-800 to-slate-900',
    badge: null,
    features: ['إدارة طلاب غير محدودة', 'إدارة معلمين', 'نظام الحضور', 'الرسائل والإشعارات', 'دعم فني'],
  },
  {
    id: 'half_yearly',
    name: 'نصف سنوية',
    price: 999,
    period: '/6 أشهر',
    days: 180,
    color: 'from-indigo-600 to-violet-700',
    badge: 'الأكثر طلبًا',
    features: ['كل مميزات الشهرية', 'تقارير متقدمة', 'إدارة الرسوم الدراسية', 'دعم أولوية', 'نسخة احتياطية يومية'],
  },
  {
    id: 'yearly',
    name: 'سنوية',
    price: 1799,
    period: '/سنة',
    days: 365,
    color: 'from-amber-500 to-orange-600',
    badge: 'وفّر 22%',
    features: ['كل مميزات نصف السنوية', 'أيقونة مدرسة مخصصة', 'إشعارات Push للجوال', 'تطبيق PWA مخصص', 'دعم مباشر على واتساب'],
  },
];

const FEATURES = [
  { icon: Users, title: 'إدارة الطلاب', desc: 'سجل بيانات الطلاب، تابع أداءهم، وربطهم بأولياء أمورهم بضغطة واحدة.' },
  { icon: GraduationCap, title: 'إدارة المعلمين', desc: 'أضف المعلمين، وزّع الفصول، وتابع أداء الكادر التعليمي بالكامل.' },
  { icon: CalendarCheck, title: 'نظام الحضور', desc: 'سجّل حضور الطلاب يومياً واستخرج تقارير الغياب والحضور فورياً.' },
  { icon: MessageSquare, title: 'الرسائل والتواصل', desc: 'تواصل مع أولياء الأمور والمعلمين وأرسل تعميمات فورية للجميع.' },
  { icon: ClipboardList, title: 'الرسوم الدراسية', desc: 'تتبع المصروفات والرسوم الدراسية مع تقارير مالية شاملة.' },
  { icon: BarChart3, title: 'تقارير وإحصائيات', desc: 'لوحة تحكم ذكية مع إحصائيات فورية عن كل جوانب المدرسة.' },
  { icon: Bell, title: 'إشعارات فورية', desc: 'إشعارات Push تصل للجوال حتى لو التطبيق مغلق. يعمل على Android و iPhone.' },
  { icon: Lock, title: 'أمان وعزل تام', desc: 'كل مدرسة معزولة تماماً. لا أحد يرى بيانات مدرسة أخرى.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[0] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handlePlanSelect = (plan: (typeof PLANS)[0]) => {
    setSelectedPlan(plan);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-cairo overflow-x-hidden" dir="rtl">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black text-white tracking-tight">النظام الذكي</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-white/50 hover:text-white text-sm font-bold transition-colors hidden md:block">المميزات</a>
            <a href="#pricing" className="text-white/50 hover:text-white text-sm font-bold transition-colors hidden md:block">الأسعار</a>
            <button
              onClick={() => navigate('/login')}
              className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all"
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-indigo-300 text-sm font-bold">منصة إدارة المدارس المتكاملة</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tight leading-[1.1]">
            أدر مدرستك بذكاء <br /> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">في مكان واحد</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
            نظام سحابي متكامل لإدارة الطلاب، المعلمين، الحضور، والدرجات مع نظام إشعارات فورية وتواصل مباشر مع أولياء الأمور.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#pricing"
              className="group h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-base shadow-2xl shadow-indigo-600/30 hover:bg-indigo-500 hover:scale-[1.02] transition-all flex items-center gap-3"
            >
              <span>ابدأ الآن مجاناً</span>
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </a>
            <a
              href="#features"
              className="h-14 px-8 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-base hover:bg-white/10 transition-all flex items-center gap-3"
            >
              <span>اعرف أكثر</span>
              <ChevronDown className="w-5 h-5" />
            </a>
          </div>

          {/* Stats bar */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { n: '١٠٠٠+', l: 'طالب مسجل' },
              { n: '٥٠+', l: 'مدرسة نشطة' },
              { n: '٩٩.٩٪', l: 'وقت التشغيل' },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-3xl font-black text-white mb-1">{s.n}</div>
                <div className="text-white/40 text-xs font-bold">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Demo Video Section */}
          <div className="mt-24 relative max-w-5xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-900 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl aspect-video flex items-center justify-center group cursor-pointer">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700"></div>
               <div className="relative z-10 w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/40">
                    <Zap className="w-8 h-8 text-white fill-current" />
                  </div>
               </div>
               <div className="absolute bottom-8 right-8 left-8 flex justify-between items-end z-10">
                  <div className="text-right">
                     <p className="text-white font-black text-2xl mb-1">شاهد كيف يعمل النظام</p>
                     <p className="text-white/60 text-sm font-medium">فيديو توضيحي للمميزات الرئيسية (دقيقتين)</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest">
                     Demo Video
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Real Screenshots ── */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">واجهة عصرية تليق بمدرستك</h2>
            <p className="text-white/40 text-lg font-medium">تصميم يركز على تجربة المستخدم وسهولة الوصول للمعلومة</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
               <div className="p-8 rounded-[32px] bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20">
                  <h3 className="text-2xl font-black text-white mb-4">لوحة تحكم ولي الأمر</h3>
                  <p className="text-white/50 leading-relaxed font-medium mb-6">متابعة دقيقة لمسيرة الطالب التعليمية، الجدول الأسبوعي، والأنشطة اليومية في صفحة واحدة مبسطة.</p>
                  <ul className="space-y-3">
                     {['شريط تقدم المنهج لكل مادة', 'الجدول الأسبوعي التفاعلي', 'تتبع الحضور والغياب اللحظي'].map(f => (
                        <li key={f} className="flex items-center gap-3 text-sm font-bold text-indigo-300">
                           <CheckCircle2 className="w-4 h-4" /> {f}
                        </li>
                     ))}
                  </ul>
               </div>
               <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/10">
                  <h3 className="text-2xl font-black text-white mb-4">إدارة المنهج الدراسي</h3>
                  <p className="text-white/50 leading-relaxed font-medium mb-6">بناء هيكل تعليمي متكامل يبدأ من الصفوف وصولاً إلى الدروس والوحدات الزمنية.</p>
               </div>
            </div>
            <div className="relative group">
               <div className="absolute -inset-4 bg-indigo-600/20 rounded-[48px] blur-2xl group-hover:bg-indigo-600/30 transition-all"></div>
               <img 
                 src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
                 alt="System Screenshot" 
                 className="relative rounded-[40px] border border-white/10 shadow-2xl group-hover:translate-y-[-8px] transition-transform duration-700"
               />
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">لماذا "إدارة عربية"؟</h2>
            <p className="text-white/40 text-lg font-medium">مقارنة سريعة توضح الفارق في الجودة والسهولة</p>
          </div>
          
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] backdrop-blur-md">
             <table className="w-full text-right">
                <thead>
                   <tr className="border-b border-white/10 bg-white/5">
                      <th className="p-6 text-sm font-black uppercase tracking-widest text-white/40">الميزة</th>
                      <th className="p-6 text-sm font-black text-indigo-400 text-center">إدارة عربية</th>
                      <th className="p-6 text-sm font-black text-white/40 text-center">الأنظمة التقليدية</th>
                   </tr>
                </thead>
                <tbody className="text-sm font-bold">
                   {[
                      ['سرعة التنفيذ', 'لحظي (Real-time)', 'بطيء / تحديث يدوي'],
                      ['واجهة المستخدم', 'عصرية / Tailwind', 'قديمة / معقدة'],
                      ['المنهج الدراسي', 'متكامل ومفصل', 'أساسي فقط'],
                      ['الدخول للجوال', 'تطبيق PWA متكامل', 'نسخة ويب غير متجاوبة'],
                      ['التكلفة', 'باقات مرنة', 'عقود سنوية ضخمة']
                   ].map(([feature, us, them], idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                         <td className="p-6 text-white/70">{feature}</td>
                         <td className="p-6 text-center text-emerald-400">{us}</td>
                         <td className="p-6 text-center text-white/20">{them}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
           <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-white mb-4">قالوا عن المنصة</h2>
              <p className="text-white/40 text-lg font-medium">ثقة شركائنا هي سر نجاحنا</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { name: 'د. أحمد سالم', school: 'مدارس النخبة الدولية', text: 'أفضل استثمار قمنا به لتنظيم شؤون مدرستنا. سهولة الاستخدام لا تُصدق.' },
                { name: 'أ. مريم علي', school: 'مدرسة براعم الغد', text: 'أولياء الأمور سعداء جداً بمتابعة أبنائهم عبر الجوال. النظام سريع وموثوق.' },
                { name: 'م. خالد حسن', school: 'أكاديمية المستقبل', text: 'الدعم الفني متميز، والنظام يتطور باستمرار بميزات ذكية فعلاً.' }
              ].map((t, idx) => (
                <div key={idx} className="p-8 rounded-[32px] bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 transition-all">
                   <div className="flex gap-1 mb-4">
                      {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-amber-500 fill-current" />)}
                   </div>
                   <p className="text-white/60 font-medium leading-relaxed mb-6 italic">"{t.text}"</p>
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-black">
                         {t.name[0]}
                      </div>
                      <div>
                         <p className="text-white font-black text-sm">{t.name}</p>
                         <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">{t.school}</p>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 px-6 relative">
         <div className="max-w-4xl mx-auto p-12 sm:p-20 rounded-[64px] bg-gradient-to-br from-indigo-600 to-violet-700 text-center relative overflow-hidden shadow-2xl shadow-indigo-600/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
               <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">ابدأ رحلة التميز اليوم</h2>
               <p className="text-white/70 text-lg font-medium mb-12 max-w-xl mx-auto">انضم إلى أكثر من ٥٠ مدرسة تستخدم النظام حالياً لتطوير العملية التعليمية.</p>
               <button 
                 onClick={() => handlePlanSelect(PLANS[1])}
                 className="h-16 px-12 rounded-2xl bg-white text-indigo-600 font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
               >
                  جرب مجاناً لمدة ١٤ يوم
               </button>
            </div>
         </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">كل ما تحتاجه في مكان واحد</h2>
            <p className="text-white/40 text-lg font-medium">أدوات متكاملة لإدارة مدرستك بكفاءة عالية</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-3xl bg-white/3 border border-white/8 hover:bg-white/6 hover:border-indigo-500/30 transition-all duration-500 cursor-default"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:bg-indigo-600/20 transition-all">
                  <f.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-white font-black text-base mb-2">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">اختر الباقة المناسبة</h2>
            <p className="text-white/40 text-lg font-medium">باقات مرنة تناسب كل احتياجات مدرستك</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-3xl overflow-hidden border transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl ${
                  plan.id === 'half_yearly'
                    ? 'border-indigo-500/50 shadow-xl shadow-indigo-600/20'
                    : 'border-white/10'
                }`}
              >
                {plan.badge && (
                  <div className="absolute top-4 left-4 z-10">
                    <span className="inline-flex items-center gap-1 bg-indigo-500 text-white text-[10px] font-black px-3 py-1 rounded-full">
                      <Star className="w-3 h-3" /> {plan.badge}
                    </span>
                  </div>
                )}

                <div className={`bg-gradient-to-br ${plan.color} p-8`}>
                  <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-black text-white">{plan.price.toLocaleString('ar-EG')}</span>
                    <span className="text-white/60 font-bold mb-2">ج.م{plan.period}</span>
                  </div>
                  <p className="text-white/50 text-sm mt-1">{plan.days} يوم اشتراك</p>
                </div>

                <div className="bg-[#0d1526] p-8 flex flex-col gap-6">
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-white/70 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePlanSelect(plan)}
                    className={`w-full h-14 rounded-2xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95 ${
                      plan.id === 'half_yearly'
                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                    }`}
                  >
                    اختر هذه الباقة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: ShieldCheck, title: 'أمان عالي', desc: 'كل مدرسة معزولة تماماً بنظام RLS على Supabase' },
            { icon: Zap, title: 'سريع جداً', desc: 'واجهة تفاعلية سريعة تعمل على الجوال والكمبيوتر' },
            { icon: Globe, title: 'PWA جاهز', desc: 'أضف التطبيق لشاشتك الرئيسية كتطبيق أصيل' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4 p-6 rounded-2xl bg-white/3 border border-white/8">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-black mb-1">{item.title}</h3>
                <p className="text-white/40 text-sm font-medium leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-black">إدارة عربية</span>
        </div>
        <p className="text-white/30 text-sm font-medium">
          تطوير وتصميم:{' '}
          <span className="text-indigo-400 font-bold">عبدالرحمن سيد فوزي</span>
          {' '}· جميع الحقوق محفوظة © {new Date().getFullYear()}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <a
            href="https://wa.me/201029082772"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-bold transition-colors"
          >
            <Phone className="w-4 h-4" />
            تواصل معنا على واتساب
          </a>
        </div>
      </footer>

      {/* ── School Registration Modal ── */}
      {showForm && selectedPlan && (
        <SchoolOrderModal
          plan={selectedPlan}
          onClose={() => setShowForm(false)}
          onSuccess={(orderId: string) => {
            setShowForm(false);
            navigate(`/payment/${orderId}`);
          }}
        />
      )}
    </div>
  );
}

// ─── School Order Modal ──────────────────────────────────────────────────────
function SchoolOrderModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: (typeof PLANS)[0];
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}) {
  const [schoolName, setSchoolName] = useState('');
  const [schoolSlug, setSchoolSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleNameChange = (val: string) => {
    setSchoolName(val);
    let slug = val
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-') // replace spaces with hyphens
      .replace(/[^\w\u0600-\u06FF-]/g, '') // allow Arabic letters, English letters, numbers, and hyphens
      .replace(/-+/g, '-') // remove consecutive hyphens
      .replace(/^-|-$/g, ''); // remove leading/trailing hyphens
    
    if (!slug) slug = `school-${Math.floor(Math.random() * 10000)}`;
    setSchoolSlug(slug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !adminName.trim() || !adminPhone.trim() || !adminWhatsapp.trim() || !adminPassword.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (adminPassword.length < 6) {
      setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    setError('');

    try {
      let logoUrl = '';
      // Upload logo if provided
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logos/${schoolSlug}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('school-assets')
          .upload(path, logoFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('school-assets').getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      // Insert order
      const { data, error: insertErr } = await (supabase as any)
        .from('school_orders')
        .insert({
          school_name: schoolName.trim(),
          school_slug: schoolSlug,
          admin_name: adminName.trim(),
          admin_phone: adminPhone.trim(),
          admin_whatsapp: adminWhatsapp.trim(),
          admin_password: adminPassword.trim(),
          plan: plan.id,
          logo_url: logoUrl || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      onSuccess(data.id);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ، يرجى المحاولة مجدداً');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4" dir="rtl">
      <div className="bg-[#0d1526] border border-white/10 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className={`bg-gradient-to-r ${plan.color} p-6 rounded-t-3xl flex items-center justify-between`}>
          <div>
            <h2 className="text-xl font-black text-white">بيانات مدرستك</h2>
            <p className="text-white/70 text-sm mt-1">باقة {plan.name} — {plan.price.toLocaleString('ar-EG')} ج.م</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Logo Upload */}
          <div className="flex items-center gap-4">
            <label className="cursor-pointer group">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border-2 border-dashed border-white/20 group-hover:border-indigo-500/50 flex items-center justify-center overflow-hidden transition-all">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-6 h-6 text-white/30" />
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            <div>
              <p className="text-white font-bold text-sm">أيقونة المدرسة</p>
              <p className="text-white/40 text-xs mt-0.5">اختياري — PNG أو JPG حتى 2MB</p>
            </div>
          </div>

          {/* School Name */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white/50 uppercase tracking-widest">اسم المدرسة *</label>
            <input
              value={schoolName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="مثال: مدرسة النور الابتدائية"
              className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              required
            />
            {schoolSlug && (
              <p className="text-white/30 text-xs font-mono pr-1">الرابط: /{schoolSlug}</p>
            )}
          </div>

          {/* Admin Name */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white/50 uppercase tracking-widest">اسم مدير المدرسة *</label>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="الاسم الكامل"
              className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              required
            />
          </div>

          {/* Phone & WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-black text-white/50 uppercase tracking-widest">رقم الهاتف *</label>
              <input
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-white/50 uppercase tracking-widest">واتساب *</label>
              <input
                value={adminWhatsapp}
                onChange={(e) => setAdminWhatsapp(e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
              />
            </div>
          </div>

          {/* Admin Password */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white/50 uppercase tracking-widest">كلمة المرور (للدخول لاحقاً) *</label>
            <div className="relative group">
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="اختر كلمة مرور قوية"
                className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-center"
                dir="ltr"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                dir="rtl"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold p-4 rounded-xl text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> جاري المعالجة...</>
            ) : (
              'التالي — الانتقال للدفع →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
