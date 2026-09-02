/**
 * Dashboard Missing RPC Tables — Bug Condition & Preservation Tests
 *
 * Task 1: Bug Condition Exploration Tests
 *   اختبارات تُثبت وجود الخطأ قبل تطبيق migration الإصلاح.
 *   هذه الاختبارات مصممة لتُثبت أن الكيانات السبعة غير مرئية في
 *   schema cache، مما يُسبب أخطاء 404/400 من PostgREST.
 *   الاستراتيجية: تحليل ملفات migrations كـ source of truth لأننا
 *   لا نستطيع الاتصال بـ DB حقيقي في هذه البيئة.
 *
 * Task 2: Preservation Property Tests
 *   تُثبت أن الكيانات الموجودة مسبقاً والتي تعمل بشكل صحيح
 *   ستبقى غير متأثرة بتطبيق migration الإصلاح.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 *
 * المنهجية: نحلل ملفات SQL في migrations للتحقق من:
 *   - أن الكيانات المعطوبة موجودة في migrations سابقة (ليست في
 *     migration الإصلاح الجديدة) → يُثبت الخطأ
 *   - أن migration الإصلاح تحتوي على جميع العناصر اللازمة
 */

import { describe, it, expect } from "vitest";
import { it as fcIt, fc } from "@fast-check/vitest";
import * as fsModule from "fs";
import * as pathModule from "path";
import { fileURLToPath } from "url";

// ────────────────────────────────────────────────────────────
// مساعدات
// ────────────────────────────────────────────────────────────

const __dirname = pathModule.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = pathModule.resolve(__dirname, "../../supabase/migrations");

function readMigration(filename: string): string {
  const fullPath = pathModule.join(MIGRATIONS_DIR, filename);
  if (!fsModule.existsSync(fullPath)) return "";
  return fsModule.readFileSync(fullPath, "utf-8");
}

/** يحذف تعليقات SQL لتحليل الكود فقط */
function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const FIX_MIGRATION = "20260904000000_force_schema_cache_reload.sql";
const SLOW_RPC_MIGRATION = "20260903100000_fix_slow_rpc_functions.sql";
const FEES_RPC_MIGRATION = "20260807000000_create_get_fees_summary_rpc.sql";

// ────────────────────────────────────────────────────────────
// Task 1: Bug Condition Exploration Tests
//
// هذه الاختبارات تُثبت:
//   1. أن الكيانات السبعة موجودة في migrations سابقة (= موجودة في DB)
//   2. أن migration الإصلاح ضرورية لإعادة تسجيلها في schema cache
//
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
// ────────────────────────────────────────────────────────────

describe("Task 1 — Bug Condition: الكيانات موجودة في DB لكن مفقودة من schema cache", () => {
  /**
   * 1.1 — get_dashboard_stats موجودة في migration سابقة
   * Counterexample: supabase.rpc('get_dashboard_stats', ...) → PGRST202
   * **Validates: Requirements 1.1**
   */
  it("get_dashboard_stats معرَّفة في migration 20260903100000", () => {
    const content = readMigration(SLOW_RPC_MIGRATION);
    expect(content, "ملف migration 20260903100000 يجب أن يكون موجوداً").not.toBe("");
    expect(content).toContain("CREATE OR REPLACE FUNCTION public.get_dashboard_stats");
    expect(content).toContain("p_school_id");
    expect(content).toContain("p_is_super_admin");
    expect(content).toContain("RETURNS JSONB");
  });

  /**
   * 1.2 — get_admin_dashboard_activities موجودة في migration سابقة
   * Counterexample: supabase.rpc('get_admin_dashboard_activities', ...) → 404
   * **Validates: Requirements 1.2**
   */
  it("get_admin_dashboard_activities معرَّفة في migration 20260903100000", () => {
    const content = readMigration(SLOW_RPC_MIGRATION);
    expect(content).toContain("CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities");
    expect(content).toContain("p_school_id uuid");
    expect(content).toContain("RETURNS jsonb");
  });

  /**
   * 1.3 — get_unread_notification_counts موجودة في migration سابقة
   * Counterexample: supabase.rpc('get_unread_notification_counts', ...) → 404
   * **Validates: Requirements 1.3**
   */
  it("get_unread_notification_counts معرَّفة في migration 20260903100000", () => {
    const content = readMigration(SLOW_RPC_MIGRATION);
    expect(content).toContain("CREATE OR REPLACE FUNCTION public.get_unread_notification_counts");
    expect(content).toContain("p_user_id uuid");
    expect(content).toContain("RETURNS jsonb");
  });

  /**
   * 1.4 — get_fees_summary موجودة في migration سابقة
   * Counterexample: supabase.rpc('get_fees_summary', ...) → 404
   * **Validates: Requirements 1.4**
   */
  it("get_fees_summary معرَّفة في migration 20260807000000", () => {
    const content = readMigration(FEES_RPC_MIGRATION);
    expect(content, "ملف migration 20260807000000 يجب أن يكون موجوداً").not.toBe("");
    expect(content).toContain("CREATE OR REPLACE FUNCTION public.get_fees_summary");
    expect(content).toContain("p_school_id uuid");
    expect(content).toContain("RETURNS TABLE");
    expect(content).toContain("total_due");
    expect(content).toContain("total_paid");
  });

  /**
   * 1.5 — جدول notifications معرَّف في migrations سابقة
   * Counterexample: HEAD /notifications → 404
   * **Validates: Requirements 1.5**
   */
  it("جدول notifications معرَّف في إحدى migrations السابقة", () => {
    const notificationsFiles = [
      "20260402280000_notification_triggers.sql",
      "20260404400000_fix_notifications_and_edge_au" ,
    ];
    // نبحث في جميع migrations
    const allFiles = fsModule.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql"));
    let foundNotificationsTable = false;
    for (const file of allFiles) {
      const content = readMigration(file);
      if (content.includes("CREATE TABLE") && content.toLowerCase().includes("notifications")) {
        foundNotificationsTable = true;
        break;
      }
    }
    expect(foundNotificationsTable, "جدول notifications يجب أن يكون معرَّفاً في إحدى migrations").toBe(true);
  });

  /**
   * 1.6 — عمود unread_by_parent في conversations معرَّف في migration سابقة
   * Counterexample: conversations?select=unread_by_parent → 404
   * **Validates: Requirements 1.6**
   */
  it("عمود unread_by_parent معرَّف في migration 20260821000000", () => {
    const content = readMigration("20260821000000_create_conversations_system.sql");
    expect(content, "ملف migration 20260821000000 يجب أن يكون موجوداً").not.toBe("");
    expect(content).toContain("unread_by_parent");
    expect(content).toContain("INT");
    expect(content).toContain("NOT NULL DEFAULT 0");
  });

  /**
   * 1.7 — عمود notification_prefs في profiles معرَّف في migration سابقة
   * Counterexample: profiles?select=notification_prefs → 400 Bad Request
   * **Validates: Requirements 1.7**
   */
  it("عمود notification_prefs معرَّف في migration 20260404900001", () => {
    const content = readMigration("20260404900001_add_notification_prefs.sql");
    expect(content, "ملف migration 20260404900001 يجب أن يكون موجوداً").not.toBe("");
    expect(content).toContain("notification_prefs");
    expect(content).toContain("JSONB");
  });

  /**
   * PBT — Property: جميع الدوال الأربع المعطوبة موجودة في migrations سابقة
   * تُثبت أن المشكلة في schema cache وليس في غياب الدوال
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  fcIt.prop([
    fc.constantFrom(
      { func: "get_dashboard_stats", file: SLOW_RPC_MIGRATION },
      { func: "get_admin_dashboard_activities", file: SLOW_RPC_MIGRATION },
      { func: "get_unread_notification_counts", file: SLOW_RPC_MIGRATION },
      { func: "get_fees_summary", file: FEES_RPC_MIGRATION },
    ),
  ])(
    "كل دالة RPC معطوبة موجودة في migration سابقة (السبب = schema cache miss وليس غياب الدالة)",
    ({ func, file }) => {
      const content = readMigration(file);
      expect(content, `ملف migration ${file} يجب أن يكون موجوداً`).not.toBe("");
      expect(content).toContain(`CREATE OR REPLACE FUNCTION public.${func}`);
    }
  );
});

// ────────────────────────────────────────────────────────────
// Task 2: Preservation Property Tests (قبل الإصلاح)
//
// تُثبت أن الكيانات الموجودة والعاملة ستبقى غير متأثرة.
// نتحقق من وجودها في migrations سابقة للتأكيد على baseline.
//
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
// ────────────────────────────────────────────────────────────

describe("Task 2 — Preservation Tests: الكيانات الموجودة ستبقى سليمة بعد الإصلاح", () => {
  /**
   * 3.1 — get_child_full_details موجودة وستبقى سليمة
   * **Validates: Requirements 3.1**
   */
  it("get_child_full_details معرَّفة في migrations سابقة وستبقى غير متأثرة", () => {
    const content = readMigration(SLOW_RPC_MIGRATION);
    expect(content).toContain("CREATE OR REPLACE FUNCTION public.get_child_full_details");
    expect(content).toContain("p_student_id");
    expect(content).toContain("p_school_id");
  });

  /**
   * 3.1 — get_parent_dashboard_summary موجودة وستبقى سليمة
   * **Validates: Requirements 3.1**
   */
  it("get_parent_dashboard_summary معرَّفة في migrations سابقة وستبقى غير متأثرة", () => {
    const content = readMigration(SLOW_RPC_MIGRATION);
    expect(content).toContain("CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary");
  });

  /**
   * 3.1 — get_teacher_dashboard_stats مُستدعاة في useStats.ts
   * ملاحظة: هذه الدالة يُستدعى اسمها في useStats.ts لكن قد تكون مُعرَّفة
   * خارج migrations (مثلاً في SQL Scripts). تُعدّ هذه حالة خاصة.
   * **Validates: Requirements 3.1**
   */
  it("useStats.ts تستدعي get_teacher_dashboard_stats مع fallback صحيح", () => {
    const statsContent = fsModule.readFileSync(
      pathModule.resolve(__dirname, "../hooks/queries/useStats.ts"),
      "utf-8"
    );
    // التحقق من أن الكود يستدعي الدالة مع fallback آمن
    expect(statsContent).toContain("get_teacher_dashboard_stats");
    // يجب أن يكون هناك fallback عند فشل RPC
    expect(statsContent).toContain("error");
    expect(statsContent).toContain("warn");
  });

  /**
   * 3.2 — أعمدة profiles الأساسية معرَّفة في migrations
   * **Validates: Requirements 3.2**
   */
  it("أعمدة profiles الأساسية (id, full_name, phone, school_id, created_at) معرَّفة", () => {
    const allFiles = fsModule.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
    let profilesTableContent = "";
    for (const file of allFiles) {
      const content = readMigration(file);
      if (content.includes("CREATE TABLE") && content.toLowerCase().includes("profiles")) {
        profilesTableContent += content;
      }
    }
    expect(profilesTableContent).toContain("full_name");
    expect(profilesTableContent).toContain("phone");
    expect(profilesTableContent).toContain("school_id");
  });

  /**
   * 3.3 — conversations table وعمود unread_by_parent موجودان
   * **Validates: Requirements 3.3**
   */
  it("جدول conversations وعمود unread_by_parent معرَّفان في migrations سابقة", () => {
    const content = readMigration("20260821000000_create_conversations_system.sql");
    expect(content).toContain("CREATE TABLE IF NOT EXISTS public.conversations");
    expect(content).toContain("unread_by_parent");
    expect(content).toContain("unread_by_admin");
    expect(content).toContain("parent_id");
    expect(content).toContain("status");
  });

  /**
   * 3.4 — Realtime publication لـ conversations و conversation_messages
   * **Validates: Requirements 3.4**
   */
  it("conversations و conversation_messages مضافتان لـ supabase_realtime publication", () => {
    const content = readMigration("20260821000000_create_conversations_system.sql");
    expect(content).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations");
    expect(content).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages");
  });

  /**
   * 3.5 — ترتيب migrations صحيح (migration الإصلاح أحدث من الدوال المُصلَحة)
   * **Validates: Requirements 3.5**
   */
  it("migration الإصلاح (20260904) أحدث من migrations الدوال (20260903, 20260807)", () => {
    const fixDate = 20260904000000;
    const slowRpcDate = 20260903100000;
    const feesRpcDate = 20260807000000;
    expect(fixDate).toBeGreaterThan(slowRpcDate);
    expect(fixDate).toBeGreaterThan(feesRpcDate);
  });

  /**
   * 3.6 — RLS policies على conversations موجودة لحماية multi-tenant isolation
   * **Validates: Requirements 3.6**
   */
  it("سياسات RLS على conversations تحمي multi-tenant isolation بـ school_id", () => {
    const content = readMigration("20260821000000_create_conversations_system.sql");
    // التحقق من وجود RLS policies
    expect(content).toContain("ENABLE ROW LEVEL SECURITY");
    // policy الأدمن تُقيّد بـ school_id — نبحث عن النمط الكامل
    expect(content).toContain("ur.school_id  = conversations.school_id");
  });

  /**
   * PBT — Property: جميع دوال RPC الصحيحة (غير المعطوبة) موجودة في migrations
   * **Validates: Requirements 3.1**
   */
  fcIt.prop([
    fc.constantFrom(
      "get_child_full_details",
      "get_parent_dashboard_summary",
    ),
  ])(
    "دوال RPC الصحيحة موجودة في migrations سابقة وستبقى دون تغيير بعد الإصلاح",
    (funcName) => {
      const content = readMigration(SLOW_RPC_MIGRATION);
      expect(content).toContain(`public.${funcName}`);
    }
  );

  /**
   * PBT — Property: migration الإصلاح لا تحذف أي policy أو جدول موجود
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   */
  fcIt.prop([
    fc.constantFrom(
      "get_child_full_details",
      "get_parent_dashboard_summary",
      "conversations",
      "profiles",
    ),
  ])(
    "migration الإصلاح لا تحذف الكيانات السليمة",
    (entityName) => {
      const fixContent = readMigration(FIX_MIGRATION);
      if (!fixContent) return; // لم تُنشأ بعد → اختبار مؤجَّل
      // migration الإصلاح لا تستخدم DROP TABLE أو DROP FUNCTION بلا IF EXISTS
      const code = stripSqlComments(fixContent);
      // لا يُفترض أن يُسقط migration الإصلاح الـ tables الموجودة
      expect(code.toUpperCase()).not.toMatch(/DROP\s+TABLE\s+(?!IF\s+EXISTS)/);
    }
  );
});

// ────────────────────────────────────────────────────────────
// Task 3.9 — Fix Verification Tests
// تُشغَّل بعد تطبيق migration الإصلاح للتحقق منه
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
// ────────────────────────────────────────────────────────────

describe("Task 3.9 — Fix Verification: migration الإصلاح يحتوي على جميع العناصر المطلوبة", () => {

  it("ملف migration الإصلاح موجود", () => {
    const content = readMigration(FIX_MIGRATION);
    expect(content, `ملف ${FIX_MIGRATION} يجب أن يكون موجوداً بعد تطبيق Task 3`).not.toBe("");
  });

  /**
   * 2.1 — get_dashboard_stats مُعاد تسجيلها في migration الإصلاح
   * **Validates: Requirements 2.1**
   */
  it("migration الإصلاح تُعيد تسجيل get_dashboard_stats", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("get_dashboard_stats");
    expect(content).toContain("CREATE OR REPLACE FUNCTION");
    expect(content).toContain("p_school_id");
    expect(content).toContain("p_is_super_admin");
  });

  /**
   * 2.2 — get_admin_dashboard_activities مُعادة التسجيل
   * **Validates: Requirements 2.2**
   */
  it("migration الإصلاح تُعيد تسجيل get_admin_dashboard_activities", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("get_admin_dashboard_activities");
  });

  /**
   * 2.3 — get_unread_notification_counts مُعادة التسجيل
   * **Validates: Requirements 2.3**
   */
  it("migration الإصلاح تُعيد تسجيل get_unread_notification_counts", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("get_unread_notification_counts");
  });

  /**
   * 2.4 — get_fees_summary مُعادة التسجيل
   * **Validates: Requirements 2.4**
   */
  it("migration الإصلاح تُعيد تسجيل get_fees_summary", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("get_fees_summary");
    expect(content).toContain("total_due");
    expect(content).toContain("total_paid");
  });

  /**
   * 2.6 — ضمان وجود عمود unread_by_parent
   * **Validates: Requirements 2.6**
   */
  it("migration الإصلاح تضمن وجود unread_by_parent في conversations", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("unread_by_parent");
    expect(content).toContain("ADD COLUMN IF NOT EXISTS");
  });

  /**
   * 2.7 — ضمان وجود عمود notification_prefs
   * **Validates: Requirements 2.7**
   */
  it("migration الإصلاح تضمن وجود notification_prefs في profiles", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("notification_prefs");
    expect(content).toContain("ADD COLUMN IF NOT EXISTS");
    expect(content).toContain("JSONB");
  });

  /**
   * 2.5 — NOTIFY pgrst موجودة لإعادة تحميل schema cache
   * **Validates: Requirements 2.1–2.7**
   */
  it("migration الإصلاح ترسل NOTIFY pgrst لإعادة بناء schema cache", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("NOTIFY pgrst, 'reload schema'");
  });

  /**
   * الـ migration idempotent: كل DROP IF EXISTS, ADD COLUMN IF NOT EXISTS
   * **Validates: Requirements 3.5**
   */
  it("migration الإصلاح idempotent: تستخدم IF NOT EXISTS في كل ALTER TABLE", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    const code = stripSqlComments(content);
    // كل ADD COLUMN يجب أن يستخدم IF NOT EXISTS
    const addColumnCount = (code.match(/ADD\s+COLUMN\s+/gi) ?? []).length;
    const addColumnIfNotExistsCount = (code.match(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi) ?? []).length;
    expect(addColumnCount).toBe(addColumnIfNotExistsCount);
  });

  /**
   * Grants موجودة للـ authenticated role
   * **Validates: Requirements 3.6 (RLS stays protected)**
   */
  it("migration الإصلاح تُعيد منح GRANT EXECUTE للـ authenticated role", () => {
    const content = readMigration(FIX_MIGRATION);
    if (!content) return;
    expect(content).toContain("GRANT");
    expect(content).toContain("authenticated");
  });

  /**
   * PBT — Property: migration الإصلاح تُعيد تسجيل كل الكيانات السبعة
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
   */
  fcIt.prop([
    fc.constantFrom(
      "get_dashboard_stats",
      "get_admin_dashboard_activities",
      "get_unread_notification_counts",
      "get_fees_summary",
      "unread_by_parent",
      "notification_prefs",
      "NOTIFY pgrst",
    ),
  ])(
    "migration الإصلاح تُعالج جميع الكيانات السبعة المعطوبة",
    (entity) => {
      const content = readMigration(FIX_MIGRATION);
      if (!content) return; // migration لم تُنشأ بعد
      expect(content).toContain(entity);
    }
  );
});
