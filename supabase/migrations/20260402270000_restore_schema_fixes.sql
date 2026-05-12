-- 20260402270000_restore_schema_fixes.sql

-- 1. Restore missing columns to school_orders
ALTER TABLE public.school_orders 
ADD COLUMN IF NOT EXISTS school_slug TEXT,
ADD COLUMN IF NOT EXISTS admin_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_note TEXT,
ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- 2. Update complaints status constraint
-- First drop the old one if it exists (it might have a generic name)
-- We'll just force a new one or use a more flexible one.
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check CHECK (status IN ('pending', 'processing', 'resolved', 'in_progress'));

-- 3. Fix notifications RLS and ensure ownership check is robust
DROP POLICY IF EXISTS "notifications_isolation" ON public.notifications;
CREATE POLICY "notifications_isolation" ON public.notifications 
FOR ALL TO authenticated 
USING (
    public.is_super_admin() 
    OR user_id = auth.uid()
)
WITH CHECK (
    public.is_super_admin() 
    OR user_id = auth.uid()
);

-- Allow anon or authenticated to check for notifications? 
-- Actually, the 403 on HEAD select might be because RLS is biting on the count.
-- We ensure SELECT is always allowed for the owner.
CREATE POLICY "notifications_select_owner" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. Enable Realtime explicitly for notifications if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Already added or other issue, move on
END $$;

NOTIFY pgrst, 'reload schema';
