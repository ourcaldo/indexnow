-- =====================================================
-- CRITICAL: QUOTA MANAGEMENT MIGRATION FOR SUPABASE
-- =====================================================
-- Run this entire script in your Supabase SQL Editor
-- This adds quota pause management functionality

-- Step 1: Add new columns to indb_indexing_jobs table
ALTER TABLE indb_indexing_jobs 
ADD COLUMN IF NOT EXISTS quota_exceeded_urls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS paused_due_to_quota BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pause_reason TEXT,
ADD COLUMN IF NOT EXISTS resume_after TIMESTAMP WITH TIME ZONE;

-- Step 2: Update existing jobs to have the new fields with default values
UPDATE indb_indexing_jobs 
SET quota_exceeded_urls = 0, 
    paused_due_to_quota = FALSE 
WHERE quota_exceeded_urls IS NULL OR paused_due_to_quota IS NULL;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN indb_indexing_jobs.quota_exceeded_urls IS 'Number of URLs that failed due to quota limits';
COMMENT ON COLUMN indb_indexing_jobs.paused_due_to_quota IS 'Indicates if job is paused due to quota exhaustion';
COMMENT ON COLUMN indb_indexing_jobs.paused_at IS 'Timestamp when job was paused';
COMMENT ON COLUMN indb_indexing_jobs.pause_reason IS 'Reason why job was paused';
COMMENT ON COLUMN indb_indexing_jobs.resume_after IS 'Timestamp when job should automatically resume';

-- Step 4: Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_paused_quota 
ON indb_indexing_jobs(paused_due_to_quota) 
WHERE paused_due_to_quota = TRUE;

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_resume_after 
ON indb_indexing_jobs(resume_after) 
WHERE resume_after IS NOT NULL;

-- Step 5: Add quota_exceeded status to url submissions if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'url_status' AND e.enumlabel = 'quota_exceeded'
    ) THEN
        ALTER TYPE url_status ADD VALUE 'quota_exceeded';
    END IF;
END $$;

-- Step 6: Update RLS policies for new columns (if using RLS)
-- Note: This assumes you have existing RLS policies

-- Drop existing policy if it exists and recreate with new columns
DROP POLICY IF EXISTS "Users can only access their own indexing jobs" ON indb_indexing_jobs;

CREATE POLICY "Users can only access their own indexing jobs" ON indb_indexing_jobs
FOR ALL USING (user_id = auth.uid());

-- Step 7: Grant necessary permissions (adjust as needed for your setup)
-- This ensures the application can access the new columns
GRANT SELECT, INSERT, UPDATE, DELETE ON indb_indexing_jobs TO authenticated;

-- Step 8: Create helpful views for quota management (optional but recommended)
CREATE OR REPLACE VIEW quota_paused_jobs AS
SELECT 
    ij.id,
    ij.user_id,
    ij.name,
    ij.status,
    ij.paused_at,
    ij.pause_reason,
    ij.resume_after,
    ij.quota_exceeded_urls,
    ij.total_urls,
    ij.processed_urls,
    ij.successful_urls,
    ij.failed_urls,
    CASE 
        WHEN ij.resume_after IS NOT NULL AND ij.resume_after <= NOW() 
        THEN TRUE 
        ELSE FALSE 
    END AS ready_to_resume
FROM indb_indexing_jobs ij
WHERE ij.paused_due_to_quota = TRUE;

-- Grant access to the view
GRANT SELECT ON quota_paused_jobs TO authenticated;

-- Step 9: Create function to automatically resume jobs (optional)
CREATE OR REPLACE FUNCTION auto_resume_quota_jobs()
RETURNS TABLE(resumed_job_ids UUID[]) AS $$
BEGIN
    -- Update jobs that are ready to be resumed
    UPDATE indb_indexing_jobs 
    SET 
        status = 'pending',
        paused_due_to_quota = FALSE,
        paused_at = NULL,
        pause_reason = NULL,
        resume_after = NULL
    WHERE 
        paused_due_to_quota = TRUE 
        AND resume_after IS NOT NULL 
        AND resume_after <= NOW()
        AND status = 'paused';
    
    -- Return the IDs of resumed jobs
    RETURN QUERY
    SELECT ARRAY_AGG(id) as resumed_job_ids
    FROM indb_indexing_jobs 
    WHERE 
        status = 'pending' 
        AND paused_due_to_quota = FALSE 
        AND updated_at >= NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION auto_resume_quota_jobs() TO authenticated;

-- Step 10: Verification queries to ensure migration was successful
-- You can run these after the migration to verify everything worked

-- Check that new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'indb_indexing_jobs' 
AND column_name IN ('quota_exceeded_urls', 'paused_due_to_quota', 'paused_at', 'pause_reason', 'resume_after')
ORDER BY column_name;

-- Check that the enum was updated
SELECT e.enumlabel
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'url_status'
ORDER BY e.enumlabel;

-- Show current quota paused jobs
SELECT id, name, status, paused_due_to_quota, paused_at, pause_reason
FROM indb_indexing_jobs 
WHERE paused_due_to_quota = TRUE;

-- Success message
SELECT 'Quota Management Migration Completed Successfully! 🎉' as status;