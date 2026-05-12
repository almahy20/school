-- Migration: 20260415000000_add_score_type_to_exam_templates.sql
-- Goal: Add score_type column to exam_templates to support numeric and text-based grading

-- 1. Add score_type column to exam_templates
ALTER TABLE public.exam_templates 
ADD COLUMN IF NOT EXISTS score_type TEXT NOT NULL DEFAULT 'numeric' 
CHECK (score_type IN ('numeric', 'text'));

-- 2. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_exam_templates_score_type 
ON public.exam_templates(score_type);

-- 3. Update existing records to have 'numeric' as default (already handled by DEFAULT)

-- 4. Refresh schema cache
NOTIFY pgrst, 'reload schema';
