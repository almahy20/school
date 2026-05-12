-- Migration: fix_push_subscriptions_permissions
-- Fix permissions and add missing policies for push_subscriptions

-- 1. Ensure the authenticated role has full table access (DML)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- 2. Enable RLS (just in case it wasn't)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can read their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;

-- 4. Create robust policies
CREATE POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own push subscriptions" ON public.push_subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions
FOR DELETE USING (auth.uid() = user_id);

-- 5. Add a unique constraint to avoid duplicate subscriptions for the same endpoint
-- We'll use a functional index on the endpoint property of the JSONB subscription
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'push_subscriptions_endpoint_key' AND n.nspname = 'public'
    ) THEN
        CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions ((subscription->>'endpoint'));
    END IF;
END $$;

-- 6. Refresh schema
NOTIFY pgrst, 'reload schema';
