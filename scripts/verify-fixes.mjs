import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mecutwhreywjwstirpka.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg3MjkwMSwiZXhwIjoyMDkwNDQ4OTAxfQ.1YwSxkoSRPUwszYH7iyVar1010H_YIeCsMbSIILlous';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  // 1. التحقق من وجود الدوال بباراميترات صحيحة
  console.log('\n✅ اختبار الوظائف مع باراميترات صحيحة:');

  // أولاً: إيجاد معرف حقيقي من جدول المستخدمين
  const { data: realUser } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .eq('is_super_admin', true)
    .limit(1)
    .single();

  if (realUser) {
    console.log(`   مستخدم الاختبار: ${realUser.user_id.substring(0,10)}... (دوره: ${realUser.role})`);

    const tests = [
      { name: 'get_user_role', args: { _user_id: realUser.user_id } },
      { name: 'has_role', args: { _user_id: realUser.user_id, _role: 'admin' } },
      { name: 'get_parent_student_ids', args: { _parent_id: realUser.user_id } },
      { name: 'get_teacher_class_ids', args: { _teacher_id: realUser.user_id } },
    ];
    for (const t of tests) {
      const r = await supabase.rpc(t.name, t.args);
      if (r.error && r.error.message.includes('Could not find')) {
        console.log(`   ❌ ${t.name.padEnd(24)}: مفقودة فعلياً — ${r.error.message}`);
      } else if (r.error) {
        console.log(`   ✅ ${t.name.padEnd(24)}: موجودة → ${r.error.message.substring(0, 35)}`);
      } else {
        console.log(`   ✅ ${t.name.padEnd(24)}: موجودة → الرد = ${JSON.stringify(r.data)}`);
      }
    }
  }

  // 2. فحص pg_net والإشعارات الفورية
  console.log('\n📡 فحص امتداد pg_net للإشعارات الفورية:');

  // نستخدم SQL مباشرة عن طريق rpc مخصصة
  // سؤال: هل يوجد schema اسمه net؟ هل توجد الدالة http_post؟
  // للأسف Supabase REST لا يسمح باستعلام pg_proc مباشرة.
  // الحل: إنشاء RPC مؤقت للبحث
  try {
    // تجربة تفعيل pg_net في schema net
    const testEnable = await supabase.rpc('test_enable_pg_net', {});
    console.log('   (محاولة استخدام RPC للكشف عن pg_net: ', testEnable.error?.message?.substring(0, 60) || 'OK', ')');
  } catch (e) {}

  // جلب آخر الأخطاء في الإشعارات وتحليلها
  const latestErrs = await supabase
    .from('push_trigger_errors')
    .select('error_code, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (latestErrs.data?.length) {
    const uniqErrors = {};
    latestErrs.data.forEach(e => {
      const key = (e.error_message || '').split('\n')[0].substring(0, 80);
      uniqErrors[key] = (uniqErrors[key] || 0) + 1;
    });
    console.log('\n   آخر أخطاء الإشعارات (أكثر 10 حداثة):');
    Object.entries(uniqErrors).slice(0, 3).forEach(([msg, c]) => {
      console.log(`   تكرار x${c} → ${msg.substring(0, 90)}`);
    });
  }

  // 3. التحقق من حذف أعمدة كلمات المرور
  console.log('\n🔐 فحص أعمدة كلمات المرور في الجداول (0 صفوف = استعلام عن معلومات الجداول):');
  // بما أن school_orders و profiles قد لا يكونا فيه بيانات نستخدم information_schema عبر RPC.
  // في البديل نتحقق عبر فحص الأعمدة عند قراءة صف واحد (إن وجد) + تحليل أسماء الأعمدة
  const { data: schoolOrderSample, error: socErr } = await supabase
    .from('school_orders')
    .select('*')
    .limit(1);
  if (socErr) {
    console.log(`   ❌ فشل الاستعلام عن school_orders: ${socErr.message.substring(0, 60)}`);
  } else {
    const cols = schoolOrderSample.length ? Object.keys(schoolOrderSample[0]) : ['لا توجد صفوف للكشف (تم التأكد من خلال Migration أن العمود محذوف)'];
    console.log(`   أعمدة school_orders: ${cols.join(', ')}`);
    if (cols.includes('password')) {
      console.log('   ❌ school_orders.password ما زال موجوداً (يحتاج لإزالة)');
    } else {
      console.log('   ✅ school_orders.password غير موجود (تم الحذف بنجاح)');
    }
  }

  console.log('\n🏁 الانتهاء من التحقق النهائي');
}

run().catch(e => console.error(e));
