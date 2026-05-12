-- Migration: fix_push_subscriptions_constraint
-- Goal: Add a dedicated endpoint column with a unique constraint to support upsert via PostgREST

-- 1. Add the column if it doesn't exist
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;

-- 2. Populate the column from existing JSONB data
UPDATE public.push_subscriptions SET endpoint = subscription->>'endpoint' WHERE endpoint IS NULL;

-- 3. Make it NOT NULL for future records
ALTER TABLE public.push_subscriptions ALTER COLUMN endpoint SET NOT NULL;

-- 4. Add the UNIQUE constraint (this is what PostgREST needs for ON CONFLICT)
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_unique;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);

-- 5. Refresh schema
NOTIFY pgrst, 'reload schema';
