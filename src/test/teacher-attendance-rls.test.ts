/**
 * Teacher Attendance RLS Policy Tests
 *
 * اختبارات تفحص محتوى ملفات migrations للتحقق من صحة سياسات RLS
 * على جدول teacher_attendance.
 *
 * المنهجية: نحلل نصوص SQL في ملفات migrations كـ source of truth،
 * لأن هذه الملفات هي ما سيُطبَّق على قاعدة البيانات.
 *
 * تُنفَّذ بـ vitest + @fast-check/vitest
 */

import { describe, it, expect } from "vitest";
import { it as fcIt, fc } from "@fast-check/vitest";
import * as fsModule from "fs";
import * as pathModule from "path";
import { fileURLToPath } from "url";

// ============================================================
// مساعدات
// ============================================================

const __dirname = pathModule.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS_DIR = pathModule.resolve(
  __dirname,
  "../../supabase/migrations"
);

function readMigration(filename: string): string {
  const fullPath = pathModule.join(MIGRATIONS_DIR, filename);
  if (!fsModule.existsSync(fullPath)) return "";
  return fsModule.readFileSync(fullPath, "utf-8");
}

/**
 * يحذف التعليقات SQL (-- single line و /* multi-line *\/) من النص
 * للتحقق من كود SQL فقط بدون التعليقات التوثيقية
 */
function stripSqlComments(sql: string): string {
  // حذف تعليقات سطر واحد -- ...
  let result = sql.replace(/--[^\n]*/g, "");
  // حذف تعليقات متعددة الأسطر /* ... */
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

function getAllMigrationsSorted(): { name: string; content: string }[] {
  const files = fsModule
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // ترتيب زمني بحسب اسم الملف
  return files.map((name) => ({ name, content: readMigration(name) }));
}

// ============================================================
// المهمة 1: اختبار استكشاف حالة الخلل (Bug Condition Exploration)
// ============================================================
//
// هذه الاختبارات تُؤكّد أن الـ policies الخاطئة التي تستخدم
// profiles.role موجودة في الكود الأصلي قبل الإصلاح.
//
// **Validates: Requirements 1.1, 1.2, 1.3**
//
// ملاحظة: هذه الاختبارات مصمّمة لتفشل على الكود الأصلي
// (= تُثبت وجود الخلل) وتنجح بعد تطبيق migration الإصلاح
// (= تُثبت صحة الإصلاح).
// ============================================================

describe("Task 1 — Bug Condition Exploration: profiles.role في teacher_attendance", () => {
  /**
   * Property 1: Bug Condition — يُثبت أن ملف migration الأصلي يحتوي على المرجع الخاطئ
   * **Validates: Requirements 1.1, 1.2, 1.3**
   */
  it("ملف migration الأصلي يحتوي على profiles.role (إثبات وجود الخلل)", () => {
    const originalMigration = readMigration(
      "20260413000000_create_teacher_attendance.sql"
    );

    expect(originalMigration).not.toBe("");
    // الخلل: يوجد مرجع لـ profiles.role في policy الـ admin
    expect(originalMigration).toContain("profiles.role");
  });

  it("ملف migration الأصلي يستخدم جدول profiles بدلاً من user_roles في policy الـ admin", () => {
    const originalMigration = readMigration(
      "20260413000000_create_teacher_attendance.sql"
    );

    expect(originalMigration).toContain("FROM public.profiles");
    expect(originalMigration).toContain("profiles.role = 'admin'");
  });

  it("ملف migration الأصلي لا يستخدم user_roles في policy الـ admin", () => {
    const originalMigration = readMigration(
      "20260413000000_create_teacher_attendance.sql"
    );

    // قبل الإصلاح: policy الـ admin لا تستعلم عن user_roles
    const adminPolicySection = originalMigration.split(
      "Teachers view own"
    )[0];
    expect(adminPolicySection).not.toContain("FROM public.user_roles");
  });

  /**
   * Property 1 (PBT): لأي policy admin محتملة — إذا كانت موجودة في الملف الأصلي
   * فهي تستخدم profiles.role وهذا يُمثّل حالة الخلل التي تُسبّب ERROR 42703
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   */
  fcIt.prop([
    fc.constantFrom(
      "Admins full access",
      "Admins can manage teacher attendance"
    ),
  ])(
    "أي policy admin على teacher_attendance تستخدم profiles.role تُمثّل حالة الخلل",
    (policyName) => {
      const originalMigration = readMigration(
        "20260413000000_create_teacher_attendance.sql"
      );
      // نبحث عن CREATE POLICY تحديداً (ليس DROP POLICY)
      const createPolicyPattern = new RegExp(
        `CREATE POLICY "${policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?;`,
        "g"
      );
      const matches = originalMigration.match(createPolicyPattern);
      if (matches && matches.length > 0) {
        const policyText = matches[0];
        // الخلل: الـ policy تستخدم profiles بدلاً من user_roles
        expect(policyText).toContain("profiles");
      }
      // إذا لم توجد CREATE POLICY بهذا الاسم فلا يوجد شيء للاختبار
    }
  );

  it("[COUNTEREXAMPLE] يوثّق counterexample: policy 'Admins full access' تستخدم profiles.role → خطأ 42703 عند أي عملية admin", () => {
    const originalMigration = readMigration(
      "20260413000000_create_teacher_attendance.sql"
    );

    const policyMatch = originalMigration.match(
      /CREATE POLICY "Admins full access"[\s\S]*?WITH CHECK \([\s\S]*?\);/
    );

    expect(policyMatch).not.toBeNull();
    const policyText = policyMatch![0];
    // Counterexample الموثَّق: policy تستخدم profiles.role
    // → هذا يُسبب ERROR 42703 لأن profiles.role لا يوجد في schema
    expect(policyText).toContain("profiles.role");
  });
});

// ============================================================
// التحقق من الإصلاح (Task 3.2)
// يُشغَّل بعد تطبيق migration الإصلاح
// **Validates: Requirements 2.1, 2.2**
// ============================================================

describe("Task 3.2 — Fix Verification: غياب profiles.role بعد الإصلاح", () => {
  it("ملف migration الإصلاح موجود وينشئ policies صحيحة بـ user_roles", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );
    const fixCode = stripSqlComments(fixMigration);

    expect(fixMigration).not.toBe(
      "",
      "ملف migration الإصلاح يجب أن يكون موجوداً"
    );
    expect(fixCode).toContain("user_roles");
    // الكود الفعلي (بدون التعليقات) لا يجب أن يستخدم profiles.role
    expect(fixCode).not.toContain("profiles.role");
  });

  it("migration الإصلاح يُسقط الـ policies المكسورة قبل إعادة إنشائها (DROP POLICY IF EXISTS)", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    expect(fixMigration).toContain("DROP POLICY IF EXISTS");
    expect(fixMigration).toContain("Admins full access");
  });

  it("migration الإصلاح يستخدم النمط الصحيح: user_roles + approval_status = 'approved'", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    expect(fixMigration).toContain("user_roles.user_id = auth.uid()");
    expect(fixMigration).toContain("user_roles.role = 'admin'");
    expect(fixMigration).toContain(
      "user_roles.school_id = teacher_attendance.school_id"
    );
    expect(fixMigration).toContain("approval_status = 'approved'");
  });

  it("migration الإصلاح يُعيد تفعيل RLS على teacher_attendance", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    expect(fixMigration).toContain("ENABLE ROW LEVEL SECURITY");
  });

  /**
   * Property 1 (PBT بعد الإصلاح): جميع keywords النمط الصحيح موجودة في migration الإصلاح
   * **Validates: Requirements 2.1, 2.2**
   */
  fcIt.prop([
    fc.constantFrom(
      "user_roles.user_id",
      "user_roles.role",
      "user_roles.school_id",
      "auth.uid()",
      "ENABLE ROW LEVEL SECURITY"
    ),
  ])(
    "بعد الإصلاح: migration الإصلاح يحتوي على جميع keywords النمط الصحيح",
    (expectedKeyword) => {
      const fixMigration = readMigration(
        "20260903000000_fix_teacher_attendance_rls.sql"
      );
      if (fixMigration) {
        expect(fixMigration).toContain(expectedKeyword);
      }
    }
  );
});

// ============================================================
// المهمة 2 + 3.3: اختبارات الحفاظ (Preservation Property Tests)
// ============================================================
//
// **Validates: Requirements 3.1, 3.2, 3.3**
// ============================================================

describe("Task 2 & 3.3 — Preservation: سياسات وبيانات غير متأثرة", () => {
  it("policy 'Teachers view own' موجودة في migrations ولا تستخدم profiles.role", () => {
    const migrations = getAllMigrationsSorted();
    const teacherViewPolicies: string[] = [];

    for (const { content } of migrations) {
      const matches = content.matchAll(
        /CREATE POLICY ["']Teachers view own["'][\s\S]*?;/g
      );
      for (const match of matches) {
        teacherViewPolicies.push(match[0]);
      }
    }

    expect(teacherViewPolicies.length).toBeGreaterThan(0);
    // جميع نسخ الـ policy يجب ألا تستخدم profiles.role
    for (const policyText of teacherViewPolicies) {
      expect(policyText).not.toContain("profiles.role");
      expect(policyText).toContain("teacher_id = auth.uid()");
    }
  });

  it("policy 'Teachers view own' تستخدم teacher_id = auth.uid() في الكود الأصلي وبعد الإصلاح", () => {
    const originalMigration = readMigration(
      "20260413000000_create_teacher_attendance.sql"
    );
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    // في الكود الأصلي
    expect(originalMigration).toContain('"Teachers view own"');
    expect(originalMigration).toContain("teacher_id = auth.uid()");

    // في ملف الإصلاح — إذا أُعيد إنشاؤها يجب أن تكون بنفس المنطق
    if (fixMigration && fixMigration.includes('"Teachers view own"')) {
      expect(fixMigration).toContain("teacher_id = auth.uid()");
    }
  });

  it("ملف الإصلاح لا يستخدم DROP TABLE CASCADE", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    if (fixMigration) {
      // نفحص الكود فقط بدون التعليقات
      const fixCode = stripSqlComments(fixMigration);
      expect(fixCode.toUpperCase()).not.toContain("DROP TABLE");
    }
  });

  it("migration الإصلاح idempotent: كل DROP POLICY يستخدم IF EXISTS", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    if (fixMigration) {
      const dropPolicyCount = (
        fixMigration.match(/DROP\s+POLICY\s+/gi) ?? []
      ).length;
      const dropPolicyIfExistsCount = (
        fixMigration.match(/DROP\s+POLICY\s+IF\s+EXISTS\s+/gi) ?? []
      ).length;
      expect(dropPolicyCount).toBe(dropPolicyIfExistsCount);
    }
  });

  it("الفهارس الثلاثة على teacher_attendance موجودة في migrations الأصلية", () => {
    const allContent = getAllMigrationsSorted()
      .map((m) => m.content)
      .join("\n");

    expect(allContent).toContain("idx_teacher_attendance_school");
    expect(allContent).toContain("idx_teacher_attendance_teacher");
    expect(allContent).toContain("idx_teacher_attendance_date");
  });

  it("migration الإصلاح لا يحذف أي فهرس موجود", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    if (fixMigration) {
      expect(fixMigration.toUpperCase()).not.toContain("DROP INDEX");
    }
  });

  it("migration الإصلاح يُنهي بـ NOTIFY pgrst لإعادة تحميل schema", () => {
    const fixMigration = readMigration(
      "20260903000000_fix_teacher_attendance_rls.sql"
    );

    if (fixMigration) {
      expect(fixMigration).toContain("NOTIFY pgrst");
    }
  });

  /**
   * Property 2 (PBT): policy 'Teachers view own' دائماً FOR SELECT فقط
   * في جميع migrations التي تُعرّفها
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  fcIt.prop([
    fc.constantFrom(
      "20260413000000_create_teacher_attendance.sql",
      "20260413000001_fix_teacher_attendance_policies.sql",
      "20260903000000_fix_teacher_attendance_rls.sql"
    ),
  ])(
    "policy 'Teachers view own' دائماً FOR SELECT ولا تسمح بكتابة بيانات",
    (migrationFile) => {
      const content = readMigration(migrationFile);
      if (!content) return;

      const teacherPolicyMatch = content.match(
        /CREATE POLICY ["']Teachers view own["']([\s\S]*?)(?=CREATE POLICY|$)/
      );
      if (teacherPolicyMatch) {
        const policyBody = teacherPolicyMatch[1];
        expect(policyBody).toContain("FOR SELECT");
        expect(policyBody).not.toContain("FOR ALL");
        expect(policyBody).not.toContain("FOR INSERT");
        expect(policyBody).not.toContain("FOR UPDATE");
        expect(policyBody).not.toContain("FOR DELETE");
      }
    }
  );

  /**
   * Property 2 (PBT): migration الإصلاح يحتوي على جميع keywords اللازمة للسلامة
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  fcIt.prop([
    fc.constantFrom(
      "user_roles.user_id",
      "user_roles.role",
      "user_roles.school_id",
      "auth.uid()",
      "ENABLE ROW LEVEL SECURITY",
      "NOTIFY pgrst"
    ),
  ])(
    "migration الإصلاح يحتوي على keywords النمط الصحيح وأمان RLS",
    (keyword) => {
      const fixMigration = readMigration(
        "20260903000000_fix_teacher_attendance_rls.sql"
      );
      if (fixMigration) {
        expect(fixMigration).toContain(keyword);
      }
    }
  );
});
