# 🚀 Quick Start: Smart Data Retention System

## Setup in 3 Steps

### Step 1: Apply Migration

**Option A: Using Supabase CLI** (Recommended)
```bash
supabase db push
```

**Option B: Using Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Open file: `supabase/migrations/20260410000000_smart_data_retention_system.sql`
3. Copy all content
4. Paste in SQL Editor
5. Click "Run"
6. ✅ Done!

### Step 2: Verify Installation

Run this in SQL Editor:
```sql
SELECT * FROM public.data_retention_policies;
SELECT * FROM public.database_size_info;
```

You should see your retention policies and database sizes.

### Step 3: Run First Cleanup

```sql
-- This will delete old data and show you a report
SELECT public.trigger_data_cleanup();
```

**Expected output:**
```json
{
  "success": true,
  "tables_cleaned": 3,
  "total_deleted": 45000,
  "details": [...],
  "executed_at": "2026-04-10T10:00:00Z"
}
```

---

## Access the UI

1. Start your app: `npm run dev`
2. Login as **Admin**
3. Go to: **سياسات الاحتفاظ** (Data Retention) from sidebar
4. You'll see:
   - 📊 Database size breakdown
   - ⚙️ Retention policies (toggle on/off)
   - 🧹 Manual cleanup button
   - 📈 Cleanup estimates

---

## Optional: Auto-Cleanup (pg_cron)

**Requires Supabase Pro plan or higher**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run cleanup every Sunday at 2 AM
SELECT cron.schedule(
  'weekly-data-cleanup',
  '0 2 * * 0',
  $$SELECT public.trigger_data_cleanup();$$
);
```

**That's it!** Your database will now auto-clean weekly.

---

## What Happens Next?

### Automatic Cleanup:
- ✅ Notifications older than 90 days → Deleted
- ✅ Messages older than 1 year → Deleted
- ✅ Attendance older than 2 years → Deleted
- ✅ Grades → **Kept forever** (academic record)
- ✅ Payments → **Kept forever** (financial record)

### Historical Summaries:
Even after deletion, you can still see:
- 📊 Yearly attendance percentages
- 📊 Grade averages by subject
- 📊 School-wide statistics
- All computed **on-demand** (zero storage cost!)

---

## Monitor Your Database

```sql
-- Check current size
SELECT * FROM public.database_size_info;

-- See what will be deleted
SELECT 
  'notifications' as table_name,
  COUNT(*) as rows_to_delete
FROM notifications 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Check retention policies
SELECT * FROM data_retention_policies;
```

---

## Expected Results

### Before:
```
Year 1:  500 MB
Year 2:  1 GB
Year 5:  2.5 GB 🔴
```

### After:
```
Any time: ~500MB - 1.3 GB ✅ (constant!)
```

**Space saved: 50-80%** 🎉

---

## Troubleshooting

### Error: "function does not exist"
→ Run the migration first!

### Error: "permission denied"
→ Make sure you're logged in as Admin

### Cleanup deleted 0 rows
→ No old data to delete yet (normal for new databases)

### Need help?
→ Read full guide: `DATA_RETENTION_GUIDE.md`

---

## Files Created

```
✅ supabase/migrations/20260410000000_smart_data_retention_system.sql
✅ supabase/migrations/RUN_ME_FIRST_data_retention_setup.sql
✅ src/hooks/queries/useDataRetention.ts
✅ src/pages/DataRetentionSettingsPage.tsx
✅ DATA_RETENTION_GUIDE.md
✅ QUICK_START_DATA_RETENTION.md (this file)
```

---

## Next Steps

1. ✅ Apply migration
2. ✅ Run cleanup
3. ✅ Test UI at `/data-retention`
4. ✅ (Optional) Enable pg_cron
5. ✅ Monitor monthly

**Your database is now optimized!** 🚀
