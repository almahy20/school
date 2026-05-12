-- ======================================================
-- School Orders Table: طلبات المدارس الجديدة قبل التفعيل
-- ======================================================
CREATE TABLE IF NOT EXISTS public.school_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name     TEXT NOT NULL,
  school_slug     TEXT NOT NULL UNIQUE,
  admin_name      TEXT NOT NULL,
  admin_phone     TEXT NOT NULL,
  admin_whatsapp  TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'monthly', -- monthly | half_yearly | yearly
  logo_url        TEXT,
  receipt_url     TEXT,
  receipt_note    TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add logo_url to existing schools table if not exists
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Enable RLS on school_orders (public can insert, only super admin can read/update)
ALTER TABLE public.school_orders ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert a new order (landing page signup)
CREATE POLICY "Anyone can create school orders"
  ON public.school_orders FOR INSERT
  WITH CHECK (true);

-- Only super admin can view all orders
CREATE POLICY "Super admin can view orders"
  ON public.school_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Only super admin can update orders
CREATE POLICY "Super admin can update orders"
  ON public.school_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Storage bucket for school assets (logos, receipts)
-- NOTE: Create manually in Supabase dashboard → Storage → New Bucket → "school-assets" (public)
-- Then paste this policy in SQL editor:

-- Allow anyone to upload to school-assets bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload school assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'school-assets');

CREATE POLICY "Anyone can view school assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-assets');
