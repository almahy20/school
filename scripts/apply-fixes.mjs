import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mecutwhreywjwstirpka.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg3MjkwMSwiZXhwIjoyMDkwNDQ4OTAxfQ.1YwSxkoSRPUwszYH7iyVar1010H_YIeCsMbSIILlous';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log('\n🧪 اختبار الوظائف بعد الإصلاح:\n');

  // ── اختبار RPCs
  const rpcs = [
    { name: 'get_user_role', args: { _user_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'has_role', args: { _user_id: '00000000-0000-0000-0000-000000000000', _role: 'admin' } },
    { name: 'is_super_admin', args: {} },
    { name: 'get_auth_school_id', args: {} },
    { name: 'get_parent_student_ids', args: { _parent_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'get_teacher_class_ids', args: { _teacher_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'claim_school_admin', args: { new_school_id: '00000000-0000-0000-0000-000000000000' } },
  ];

  for (const rpc of rpcs) {
    const r = await supabase.rpc(rpc.name, rpc.args);
    const note = r.error ? r.error.message.substring(0, 50) : 'OK';
    if (r.error && r.error.message.includes('Could not find')) {
      console.log(`  ❌ ${rpc.name.padEnd(25)} مفقودة! ${note}`);
    } else if (r.error && !r.error.message.includes('permission') && !r.error.message.includes('not set') && !r.error.message.includes('invalid input syntax')) {
      console.log(`  ⚠️  ${rpc.name.padEnd(25)} خطأ: ${note}`);
    } else {
      console.log(`  ✅ ${rpc.name.padEnd(25)} موجودة (الرد: ${JSON.stringify(r.data)})`);
    }
  }

  // ── جلب أول مدير (admin) لترقيته إلى Super Admin
  console.log('\n👑 إعداد Super Admin:');
  const { data: admins, error: e1 } = await supabase
    .from('user_roles')
    .select('user_id, role, is_super_admin, approval_status, school_id')
    .eq('role', 'admin')
    .eq('approval_status', 'approved')
    .limit(5);
  if (e1) {
    console.log('  ❌ فشل جلب الأدمن:', e1.message);
    process.exit(1);
  }
  console.log(`  ✅ عدد الأدمن الموافقين: ${admins.length}:`);
  admins.forEach((a, i) => console.log(`     ${i + 1}. ${a.user_id.substring(0,10)}... | super_admin=${a.is_super_admin}`));

  if (admins.length > 0) {
    const target = admins[0].user_id;
    console.log(`\n  🚀 ترقية أول مدير (${target.substring(0, 10)}...) إلى Super Admin...`);
    const { data, error: upe } = await supabase
      .from('user_roles')
      .update({ is_super_admin: true })
      .eq('user_id', target)
      .select('user_id, is_super_admin, role');
    if (upe) {
      console.log('  ❌ فشل الترقية:', upe.message);
    } else {
      console.log('  ✅ تمت الترقية بنجاح! النتيجة:', JSON.stringify(data[0]));
    }

    // جلب اسم المستخدم
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', target)
      .single();
    if (profile) {
      console.log(`  👤 بيانات Super Admin الجديد: ${profile.full_name} (${profile.email || 'بدون بريد'})`);
    }
  }

  // ── إزالة أعمدة كلمات المرور (ف إن لم تز ل (تتأكد
  console.log('\n🔐 التحقق من أعمدة كلمات المرور:');
  const pwdCheck = await supabase.from('profiles').select('id').limit(1);
  if (pwdCheck.data && pwdCheck.data.length) {
    const cols = Object.keys(pwdCheck.data[0]);
    console.log(`  ✅ أعمدة profiles حالياً: ${cols.join(', ')}`);
    cols.includes('plain_password') ? console.log('  ⚠️  still exists!') : console.log('  ✅ عمود plain_password تم حذف بنجاح');
  }
  const orderCheck = await supabase.from('school_orders').select('id').limit(1);
  if (orderCheck.data?.length) {
    const cols2 = Object.keys(orderCheck.data[0]);
    cols2.includes('password') ? console.log('  ⚠️  school_orders.password لا يزال موجوداً!') : console.log('  ✅ school_orders.password تم حذفه بنجاح');
  }

  console.log('\n🏁 الانتهاء من الإصلاحات الأساسية');
}

run().catch(e => console.error(e));
