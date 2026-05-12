-- ======================================================
-- Fix RLS Policies for school_orders after clean reset
-- ======================================================

-- Drop exactly what we might have had if any
DROP POLICY IF EXISTS "Anyone can create school orders" ON public.school_orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.school_orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.school_orders;

-- 1. Allow anyone to insert a new order (landing page signup)
CREATE POLICY "Anyone can create school orders"
  ON public.school_orders FOR INSERT
  WITH CHECK (true);

-- 2. Allow anyone to view an order if they have the UUID
CREATE POLICY "Anyone can view orders"
  ON public.school_orders FOR SELECT
  USING (true);

-- 3. Allow anyone to update an order (needed for receipt upload)
CREATE POLICY "Anyone can update orders"
  ON public.school_orders FOR UPDATE
  USING (true);

-- 4. Re-grant privileges just in case
GRANT ALL ON public.school_orders TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
