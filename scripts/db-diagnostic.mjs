import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mecutwhreywjwstirpka.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg3MjkwMSwiZXhwIjoyMDkwNDQ4OTAxfQ.1YwSxkoSRPUwszYH7iyVar1010H_YIeCsMbSIILlous';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  'schools', 'profiles', 'user_roles', 'students', 'classes',
  'student_parents', 'attendance', 'grades', 'exam_templates',
  'electronic_exams', 'exam_questions', 'exam_attempts',
  'teacher_attendance', 'complaints', 'messages', 'notifications',
  'conversations', 'conversation_messages', 'push_subscriptions',
  'push_delivery_log', 'push_trigger_errors', 'notification_delivery_logs',
  'fees', 'fee_payments', 'class_chat_rooms', 'class_chat_messages',
  'audit_logs', 'school_orders', 'curriculums', 'curriculum_subjects',
];

function section(title) {
  console.log('\n' + '='.repeat(80));
  console.log('  ' + title);
  console.log('='.repeat(80));
}

function subSection(title) {
  console.log('\n  ── ' + title + ' ──');
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

async function getCount(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return { error: error.message };
  return { count };
}

async function getSample(table, limit = 3) {
  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) return { error: error.message };
  return { data };
}

async function checkNulls(table, column) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .is(column, null);
  if (error) return { error: error.message };
  return { nullCount: count };
}

async function checkFKOrphans(childTable, fkColumn, parentTable, parentPk = 'id') {
  const { data, error, count } = await supabase
    .from(childTable)
    .select(`${fkColumn}`, { count: 'exact' })
    .not(fkColumn, 'is', null);
  if (error) return { error: error.message };
  const fkValues = [...new Set(data.map(r => r[fkColumn]).filter(Boolean))];
  if (fkValues.length === 0) return { orphanCount: 0, checked: 0 };
  const chunkSize = 500;
  let orphans = new Set();
  for (let i = 0; i < fkValues.length; i += chunkSize) {
    const chunk = fkValues.slice(i, i + chunkSize);
    const { data: parents, error: perr } = await supabase
      .from(parentTable)
      .select(parentPk)
      .in(parentPk, chunk);
    if (perr) return { error: perr.message };
    const existing = new Set(parents.map(p => p[parentPk]));
    chunk.forEach(v => { if (!existing.has(v)) orphans.add(v); });
  }
  return { orphanCount: orphans.size, orphanSamples: [...orphans].slice(0, 5), checked: count };
}

async function checkDuplicate(table, column) {
  const { data, error } = await supabase.rpc('check_duplicates_fn', {
    _tbl: table, _col: column
  });
  if (error) {
    return { skipped: true, reason: error.message };
  }
  return { duplicates: data || 0 };
}

async function run() {
  console.log('\n🔍 فحص قاعدة بيانات Supabase — إدارة عربية');
  console.log(`   Project: ${SUPABASE_URL}`);
  console.log(`   وقت الفحص: ${new Date().toLocaleString('ar-EG')}`);

  // ── 1. عدد الصفوف لكل جدول ──
  section('1. إحصائيات الجداول (عدد الصفوف)');
  const tableStats = {};
  for (const t of TABLES) {
    const r = await getCount(t);
    tableStats[t] = r;
    if (r.error) {
      fail(`${t.padEnd(30)} خطأ: ${r.error}`);
    } else {
      const sym = r.count === 0 ? '⚠️' : (r.count > 1000 ? '📊' : '✅');
      console.log(`  ${sym} ${t.padEnd(30)} ${String(r.count).padStart(6)} صف`);
    }
  }

  // ── 2. فحص الأعمدة الحساسة ──
  section('2. فحص الأعمدة الأمنية الحساسة');

  subSection('تخزين كلمات المرور بنص عادي');
  const plainPassCheck = await supabase
    .from('profiles')
    .select('id, full_name, plain_password', { count: 'exact' })
    .not('plain_password', 'is', null);
  if (plainPassCheck.error) {
    warn(`فشل فحص profiles.plain_password: ${plainPassCheck.error.message}`);
  } else if (plainPassCheck.count > 0) {
    fail(`تم العثور على ${plainPassCheck.count} مستخدم يخزن كلمة المرور كنص عادي في profiles.plain_password`);
    plainPassCheck.data.slice(0, 5).forEach(p => {
      console.log(`     - ${p.full_name} (id: ${p.id.substring(0,8)}...) → pass="${p.plain_password.substring(0, 15)}..."`);
    });
  } else {
    pass('لا توجد كلمات مرور في profiles.plain_password');
  }

  const orderPassCheck = await supabase
    .from('school_orders')
    .select('school_name, password', { count: 'exact' })
    .not('password', 'is', null);
  if (orderPassCheck.error) {
    warn(`فشل فحص school_orders.password: ${orderPassCheck.error.message}`);
  } else if (orderPassCheck.count > 0) {
    fail(`تم العثور على ${orderPassCheck.count} طلب يخزن كلمة المرور في school_orders.password`);
    orderPassCheck.data.slice(0, 3).forEach(o => {
      if (o.password) console.log(`     - مدرسة: ${o.school_name}, pass="${o.password.substring(0, 10)}..."`);
    });
  } else {
    pass('لا توجد كلمات مرور في school_orders.password');
  }

  subSection('تكرار slug المدارس');
  const slugDup = await checkDuplicate('schools', 'slug');
  if (slugDup.skipped) {
    info(`RPC check_duplicates_fn غير متوفر. فحص يدوي...`);
    const { data, error } = await supabase.from('schools').select('slug, name');
    if (!error) {
      const counts = {};
      data.forEach(s => { if (s.slug) counts[s.slug] = (counts[s.slug]||0) + 1; });
      const dups = Object.entries(counts).filter(([,c]) => c > 1);
      if (dups.length) fail(`تكرار في slug المدارس: ${JSON.stringify(dups)}`);
      else pass('slug المدارس غير مكررة');
    }
  } else if (slugDup.duplicates > 0) {
    fail(`تكرار في slug المدارس: ${slugDup.duplicates}`);
  } else {
    pass('slug المدارس غير مكررة');
  }

  // ── 3. سلامة المفاتيح الخارجية ──
  section('3. فحص سلامة العلاقات (Orphaned Foreign Keys)');
  const fkChecks = [
    ['profiles', 'school_id', 'schools'],
    ['user_roles', 'school_id', 'schools'],
    ['user_roles', 'user_id', null],
    ['students', 'school_id', 'schools'],
    ['students', 'class_id', 'classes'],
    ['classes', 'school_id', 'schools'],
    ['classes', 'teacher_id', 'profiles'],
    ['classes', 'curriculum_id', 'curriculums'],
    ['student_parents', 'school_id', 'schools'],
    ['student_parents', 'student_id', 'students'],
    ['student_parents', 'parent_id', 'profiles'],
    ['attendance', 'school_id', 'schools'],
    ['attendance', 'student_id', 'students'],
    ['attendance', 'class_id', 'classes'],
    ['grades', 'school_id', 'schools'],
    ['grades', 'student_id', 'students'],
    ['grades', 'exam_template_id', 'exam_templates'],
    ['grades', 'teacher_id', 'profiles'],
    ['exam_templates', 'school_id', 'schools'],
    ['exam_templates', 'class_id', 'classes'],
    ['exam_templates', 'teacher_id', 'profiles'],
    ['complaints', 'school_id', 'schools'],
    ['complaints', 'student_id', 'students'],
    ['messages', 'school_id', 'schools'],
    ['messages', 'student_id', 'students'],
    ['notifications', 'school_id', 'schools'],
    ['conversations', 'school_id', 'schools'],
    ['conversations', 'parent_id', 'profiles'],
    ['conversations', 'student_id', 'students'],
    ['conversation_messages', 'conversation_id', 'conversations'],
    ['conversation_messages', 'sender_id', 'profiles'],
    ['push_subscriptions', 'school_id', 'schools'],
    ['push_delivery_log', 'notification_id', 'notifications'],
    ['notification_delivery_logs', 'notification_id', 'notifications'],
    ['fees', 'school_id', 'schools'],
    ['fees', 'student_id', 'students'],
    ['fee_payments', 'fee_id', 'fees'],
    ['fee_payments', 'school_id', 'schools'],
    ['electronic_exams', 'school_id', 'schools'],
    ['electronic_exams', 'class_id', 'classes'],
    ['electronic_exams', 'teacher_id', 'profiles'],
    ['exam_questions', 'exam_id', 'electronic_exams'],
    ['exam_questions', 'school_id', 'schools'],
    ['exam_attempts', 'exam_id', 'electronic_exams'],
    ['exam_attempts', 'student_id', 'students'],
    ['exam_attempts', 'parent_id', 'profiles'],
    ['teacher_attendance', 'school_id', 'schools'],
    ['teacher_attendance', 'teacher_id', 'profiles'],
    ['class_chat_rooms', 'school_id', 'schools'],
    ['class_chat_rooms', 'class_id', 'classes'],
    ['class_chat_messages', 'room_id', 'class_chat_rooms'],
    ['audit_logs', 'school_id', 'schools'],
    ['curriculums', 'school_id', 'schools'],
    ['curriculum_subjects', 'curriculum_id', 'curriculums'],
    ['curriculum_subjects', 'school_id', 'schools'],
  ];

  for (const [child, col, parent] of fkChecks) {
    if (!parent) { info(`تخطى ${child}.${col} — parent=auth.users غير قابلة للفحص عبر REST`); continue; }
    const r = await checkFKOrphans(child, col, parent);
    if (r.error) {
      warn(`${child}.${col} → ${parent}: فشل الفحص — ${r.error.substring(0,80)}`);
    } else if (r.orphanCount > 0) {
      const samples = r.orphanSamples?.map(s => s.substring(0,8)).join(',') || '';
      fail(`${child}.${col} → ${parent}: ${r.orphanCount} قيمة يتيمة (من ${r.checked} مفحوصة). نماذج: ${samples}`);
    } else {
      pass(`${child}.${col} → ${parent}: سليم (${r.checked} سجل)`);
    }
  }

  // ── 4. فحص user_roles مقابل profiles ──
  section('4. فحص اتساق المستخدمين (profiles ↔ user_roles ↔ auth)');

  const { data: profiles, error: pe } = await supabase.from('profiles').select('id');
  const { data: roles, error: re } = await supabase.from('user_roles').select('user_id, role, school_id, is_super_admin, approval_status');
  if (pe || re) {
    warn(`تعذر فحص اتساق المستخدمين: ${pe?.message || re?.message}`);
  } else {
    const profileIds = new Set(profiles.map(p => p.id));
    const userWithRoles = new Set(roles.map(r => r.user_id));
    const profilesNoRole = [...profileIds].filter(id => !userWithRoles.has(id));
    const rolesNoProfile = roles.filter(r => !profileIds.has(r.user_id));

    info(`عدد profiles: ${profileIds.size}`);
    info(`عدد user_roles: ${roles.length}`);
    if (profilesNoRole.length > 0) {
      fail(`${profilesNoRole.length} ملف تعريف بدون دور (user_roles مفقود): ${profilesNoRole.slice(0,5).map(s=>s.substring(0,8)).join(', ')}...`);
    } else pass('كل الملفات الشخصية لها دور');
    if (rolesNoProfile.length > 0) {
      fail(`${rolesNoProfile.length} دور بدون ملف تعريف (profiles مفقود): ${rolesNoProfile.slice(0,3).map(r=>r.user_id.substring(0,8)).join(', ')}...`);
    } else pass('كل الأدوار لها ملف تعريف مقابل');

    const superAdmins = roles.filter(r => r.is_super_admin);
    info(`عدد Super Admins: ${superAdmins.length}`);
    if (superAdmins.length === 0) warn('⚠️ لا يوجد أي Super Admin في النظام!');
    const roleCounts = {};
    roles.forEach(r => { roleCounts[r.role] = (roleCounts[r.role]||0) + 1; });
    info(`توزيع الأدوار: ${JSON.stringify(roleCounts)}`);
    const pending = roles.filter(r => r.approval_status === 'pending');
    if (pending.length > 0) info(`المستخدمون قيد الموافقة: ${pending.length}`);
  }

  // ── 5. فحص بيانات المدارس ──
  section('5. بيانات المدارس');
  const { data: schools, error: se } = await supabase.from('schools').select('id, name, slug, status, plan, subscription_end_date, settings, created_at');
  if (se) fail(`خطأ في جلب المدارس: ${se.message}`);
  else {
    info(`عدد المدارس: ${schools.length}`);
    for (const s of schools) {
      console.log(`\n   مدرسة: ${s.name} (slug: ${s.slug})`);
      console.log(`     الحالة: ${s.status} | الخطة: ${s.plan || 'غير محددة'}`);
      console.log(`     الاشتراك ينتهي: ${s.subscription_end_date || 'غير محدد'}`);
      console.log(`     الإعدادات JSON: ${s.settings ? Object.keys(s.settings).join(', ') || '{}' : '{}'}`);
      console.log(`     الإنشاء: ${s.created_at}`);
      // عدّل الطلاب والمستخدمين في هذه المدرسة
      const sc = await getCount('students');
      if (!sc.error) {
        const { count: stuInSchool } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', s.id);
        const { count: prfInSchool } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', s.id);
        info(`     الطلاب في المدرسة: ${stuInSchool} | المستخدمون: ${prfInSchool}`);
      }
    }
  }

  // ── 6. فحص الإشعارات والأخطاء ──
  section('6. فحص الإشعارات والأخطاء');
  const pushErrByCode = {};
  const { data: perrs } = await supabase.from('push_trigger_errors').select('error_code');
  if (perrs && perrs.length) {
    perrs.forEach(e => pushErrByCode[e.error_code] = (pushErrByCode[e.error_code]||0) + 1);
    info(`أخطاء trigger الإشعارات: ${perrs.length} — ${JSON.stringify(pushErrByCode)}`);
  } else pass('لا توجد أخطاء في Push Triggers');

  const pushDelStatus = { withError: 0, success: 0 };
  const { data: pdl } = await supabase.from('push_delivery_log').select('error_message', { count: 'exact' });
  if (pdl) {
    pdl.forEach(p => p.error_message ? pushDelStatus.withError++ : pushDelStatus.success++);
    info(`سجل تسليم الإشعارات: ${pdl.length} إجمالاً | ناجح: ${pushDelStatus.success} | فاشل: ${pushDelStatus.withError}`);
  }

  const recentPErrs = await supabase.from('push_trigger_errors').select('error_code, error_message, created_at').order('created_at', {ascending:false}).limit(5);
  if (recentPErrs.data?.length) {
    subSection('آخر 5 أخطاء إشعارات');
    recentPErrs.data.forEach(e => console.log(`   [${e.created_at?.substring(0,16)}] ${e.error_code}: ${(e.error_message||'').substring(0,100)}`));
  }

  // ── 7. فحص بيانات الامتحانات الإلكترونية ──
  section('7. فحص الامتحانات الإلكترونية والمحاولات');
  const { data: exams, error: ee } = await supabase
    .from('electronic_exams')
    .select('id, title, status, duration_minutes, class_id, teacher_id, available_from, available_until, language');
  if (ee) fail(`خطأ electronic_exams: ${ee.message}`);
  else if (exams.length === 0) warn('لا توجد امتحانات إلكترونية');
  else {
    info(`الامتحانات: ${exams.length} — الحالات: ${JSON.stringify(exams.reduce((a,e)=>{a[e.status]=(a[e.status]||0)+1;return a;},{}))}`);
    for (const ex of exams.slice(0, 5)) {
      const { count: qc } = await supabase.from('exam_questions').select('*',{count:'exact',head:true}).eq('exam_id', ex.id);
      const { count: ac } = await supabase.from('exam_attempts').select('*',{count:'exact',head:true}).eq('exam_id', ex.id);
      console.log(`   امتحان: ${ex.title} [${ex.status}] | ${ex.language} | الأسئلة: ${qc} | المحاولات: ${ac}`);
    }
  }

  const highTabSwitches = await supabase
    .from('exam_attempts')
    .select('id, student_id, exam_id, tab_switches_count, score, total_score')
    .gt('tab_switches_count', 5);
  if (highTabSwitches.data?.length > 0) {
    warn(`${highTabSwitches.data.length} محاولة مع تغيير تبويب > 5 مرات (مؤشر غش محتمل):`);
    highTabSwitches.data.slice(0,8).forEach(a =>
      console.log(`   - طالب ${a.student_id.substring(0,8)}, امتحان ${a.exam_id.substring(0,8)}: ${a.tab_switches_count} تبديل, الدرجة ${a.score}/${a.total_score}`)
    );
  } else pass('لا توجد محاولات عالية التبديل (>5)');

  // ── 8. فحص الحضور ──
  section('8. فحص الحضور');
  const attCounts = await supabase.from('attendance').select('status', { count: 'exact' });
  if (attCounts.data) {
    const byStatus = attCounts.data.reduce((a,x)=>{a[x.status]=(a[x.status]||0)+1;return a;},{});
    info(`الحضور حسب الحالة: ${JSON.stringify(byStatus)}`);
  }

  // ── 9. فحص بوليصة الأقساط والمدفوعات ──
  section('9. فحص الأقساط المالية');
  const { data: feesRows, error: fe } = await supabase.from('fees').select('id, amount_due, amount_paid, status, term');
  if (fe) fail(`خطأ fees: ${fe.message}`);
  else if (feesRows.length === 0) warn('لا توجد بيانات أقساط');
  else {
    const totalDue = feesRows.reduce((a,f)=>a + (+f.amount_due||0), 0);
    const totalPaid = feesRows.reduce((a,f)=>a + (+f.amount_paid||0), 0);
    const unpaid = feesRows.filter(f => f.status === 'unpaid' || f.amount_due > f.amount_paid).length;
    info(`إجمالي المستحق: ${totalDue} ج.م | المدفوع: ${totalPaid} ج.م | المتبقي: ${(totalDue-totalPaid).toFixed(2)} ج.م`);
    info(`عدد السجلات: ${feesRows.length} | غير مدفوع كلياً/جزئياً: ${unpaid}`);
    info(`حالة الأقساط: ${JSON.stringify(feesRows.reduce((a,f)=>{a[f.status]=(a[f.status]||0)+1;return a;},{}))}`);
  }

  // ── 10. فحص الـ NULLs في حقول إلزامية ظاهرياً ──
  section('10. فحص قيم NULL في حقول حساسة');
  const nullChecks = [
    ['profiles', 'full_name'],
    ['students', 'name'],
    ['schools', 'name'],
    ['user_roles', 'user_id'],
    ['user_roles', 'role'],
  ];
  for (const [t, c] of nullChecks) {
    const r = await checkNulls(t, c);
    if (r.error) warn(`${t}.${c}: فشل الفحص`);
    else if (r.nullCount > 0) fail(`${t}.${c}: ${r.nullCount} قيمة NULL`);
    else pass(`${t}.${c}: لا NULLs`);
  }

  // ── 11. فحص المحادثات ──
  section('11. فحص المحادثات والرسائل');
  const { count: convCount } = await getCount('conversations');
  const { count: msgCount } = await getCount('conversation_messages');
  const { count: msgOldCount } = await getCount('messages');
  info(`المحادثات: ${convCount} | رسائل المحادثات: ${msgCount} | رسائل قديمة (messages): ${msgOldCount}`);
  if (msgOldCount > 0) warn('لا تزال هناك رسائل في الجدول القديم messages — قد تحتاج للترحيل');

  const ccByStatus = await supabase.from('conversations').select('status');
  if (ccByStatus.data) {
    const statuses = ccByStatus.data.reduce((a,c)=>{a[c.status]=(a[c.status]||0)+1;return a;},{});
    info(`حالات المحادثات: ${JSON.stringify(statuses)}`);
  }

  // ── 12. فحص الأخطاء في الإشعارات الأخيرة ──
  section('12. فحص صحة الوظائف المخزنة (RPC) الأساسية');
  const rpcTests = [
    { name: 'get_user_role', args: null },
    { name: 'has_role', args: null },
    { name: 'is_super_admin', args: null },
    { name: 'get_auth_school_id', args: null },
  ];
  for (const rpc of rpcTests) {
    try {
      const r = await supabase.rpc(rpc.name, rpc.args || {});
      if (r.error && !r.error.message.includes('function') && !r.error.message.includes('permission') && !r.error.message.includes('not set')) {
        warn(`RPC ${rpc.name}: أخطا — ${r.error.message.substring(0,100)}`);
      } else {
        pass(`RPC ${rpc.name}: موجود وقابل للاستدعاء (${r.error ? 'ملاحظة: ' + r.error.message.substring(0,50) : 'OK'})`);
      }
    } catch (e) {
      warn(`RPC ${rpc.name}: استثناء — ${e.message?.substring(0,80) || e}`);
    }
  }

  section('🏁 نهاية الفحص');
  console.log('\n  للحصول على أحدث أنواع TypeScript:');
  console.log('  npx supabase gen types typescript --project-id mecutwhreywjwstirpka --schema public > src/integrations/supabase/types.ts\n');
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
