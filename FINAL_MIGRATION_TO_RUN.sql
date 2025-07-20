-- COMPLETE QUOTA MANAGEMENT MIGRATION - Run this COMPLETE script in Supabase SQL Editor
-- This includes all necessary columns and fixes for quota management system

-- Step 1: Add quota management columns to indexing jobs table
DO $$ 
BEGIN 
    -- Add paused_due_to_quota column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indb_indexing_jobs' AND column_name = 'paused_due_to_quota') THEN
        ALTER TABLE indb_indexing_jobs ADD COLUMN paused_due_to_quota BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add paused_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indb_indexing_jobs' AND column_name = 'paused_at') THEN
        ALTER TABLE indb_indexing_jobs ADD COLUMN paused_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add pause_reason column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indb_indexing_jobs' AND column_name = 'pause_reason') THEN
        ALTER TABLE indb_indexing_jobs ADD COLUMN pause_reason TEXT;
    END IF;
    
    -- Add resume_after column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indb_indexing_jobs' AND column_name = 'resume_after') THEN
        ALTER TABLE indb_indexing_jobs ADD COLUMN resume_after TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add quota_exceeded_urls column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indb_indexing_jobs' AND column_name = 'quota_exceeded_urls') THEN
        ALTER TABLE indb_indexing_jobs ADD COLUMN quota_exceeded_urls INTEGER DEFAULT 0;
    END IF;
END $$;

-- Step 2: Create dashboard_notifications table if not exists
CREATE TABLE IF NOT EXISTS indb_dashboard_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    related_entity_type TEXT,
    related_entity_id TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create quota_alerts table if not exists
CREATE TABLE IF NOT EXISTS indb_quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    service_account_id UUID NOT NULL,
    alert_level TEXT NOT NULL CHECK (alert_level IN ('warning', 'critical', 'exhausted')),
    quota_used INTEGER NOT NULL,
    quota_limit INTEGER NOT NULL,
    percentage_used DECIMAL(5,2) NOT NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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