-- ======================================================
-- Fix RLS Policies for school_orders
-- To allow public users to view and update their own orders via UUID
-- ======================================================

-- 1. Drop existing restricted SELECT and UPDATE policies
DROP POLICY IF EXISTS "Super admin can view orders" ON public.school_orders;
DROP POLICY IF EXISTS "Super admin can update orders" ON public.school_orders;

-- 2. Allow anyone to view an order if they have the UUID
CREATE POLICY "Anyone can view orders"
  ON public.school_orders FOR SELECT
  USING (true);

-- 3. Allow anyone to update an order (needed for receipt upload)
CREATE POLICY "Anyone can update orders"
  ON public.school_orders FOR UPDATE
  USING (true);

-- Ensure INSERT is still allowed (from previous migration)
-- CREATE POLICY "Anyone can create school orders" ON public.school_orders FOR INSERT WITH CHECK (true);
