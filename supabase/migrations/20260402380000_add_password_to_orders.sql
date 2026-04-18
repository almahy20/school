-- Add admin_password to school_orders
-- Migration: 20260402380000_add_password_to_orders

ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS admin_password TEXT;

NOTIFY pgrst, 'reload schema';
