-- Migration: 20260424000002_add_expected_results_to_exam_templates.sql
-- Goal: Add expected_results column to exam_templates to support predefined grading options for text-based tests

-- 1. Add expected_results column to exam_templates
-- We use TEXT[] (array of text) to store multiple predefined results
ALTER TABLE public.exam_templates 
ADD COLUMN IF NOT EXISTS expected_results TEXT[] DEFAULT '{}';

-- 2. Refresh schema cache
NOTIFY pgrst, 'reload schema';
