-- =====================================================
-- REMOVE UNWANTED ATTEMPT COLUMNS MIGRATION
-- =====================================================
-- Run this entire script in your Supabase SQL Editor
-- This removes the unwanted attempt_number and previous_attempts columns

-- Step 1: Drop dependencies first (views and functions that use these columns)
DROP VIEW IF EXISTS submission_history CASCADE;
DROP FUNCTION IF EXISTS get_submission_attempt_summary(UUID) CASCADE;

-- Step 2: Remove indexes related to attempt tracking
DROP INDEX IF EXISTS idx_url_submissions_attempt;

-- Step 3: Now drop the unwanted columns from indb_url_submissions table
ALTER TABLE indb_url_submissions 
DROP COLUMN IF EXISTS attempt_number CASCADE,
DROP COLUMN IF EXISTS previous_attempts CASCADE;

-- Step 4: Verification - check that columns are removed
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'indb_url_submissions' 
ORDER BY column_name;

-- Success message
SELECT 'Attempt columns removed successfully! 🎉' as status;