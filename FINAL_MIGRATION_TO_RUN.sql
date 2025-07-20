-- Run this COMPLETE script in Supabase SQL Editor
-- It's safe to run even if you already ran parts 1 and 2

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
DROP POLICY IF EXISTS "Users can only access their own indexing jobs" ON indb_indexing_jobs;

CREATE POLICY "Users can only access their own indexing jobs" ON indb_indexing_jobs
FOR ALL USING (user_id = auth.uid());

-- Step 7: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON indb_indexing_jobs TO authenticated;

-- Success message
SELECT 'Quota Management Migration Completed Successfully! 🎉' as status;