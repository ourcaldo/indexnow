-- RLS (Row Level Security) Policies for IndexNow Dashboard
-- Run these SQL queries in your Supabase SQL Editor

-- Enable RLS on indexing jobs table
ALTER TABLE indb_indexing_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/manage their own indexing jobs
CREATE POLICY "Users can manage their own indexing jobs" ON indb_indexing_jobs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable RLS on URL submissions table  
ALTER TABLE indb_url_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see URL submissions for their own jobs
CREATE POLICY "Users can manage URL submissions for their jobs" ON indb_url_submissions
  FOR ALL
  USING (
    job_id IN (
      SELECT id FROM indb_indexing_jobs WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM indb_indexing_jobs WHERE user_id = auth.uid()
    )
  );

-- Enable RLS on service accounts table
ALTER TABLE indb_service_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own service accounts
CREATE POLICY "Users can manage their own service accounts" ON indb_service_accounts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable RLS on quota usage table
ALTER TABLE indb_quota_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see quota usage for their own service accounts
CREATE POLICY "Users can view quota usage for their service accounts" ON indb_quota_usage
  FOR SELECT
  USING (
    service_account_id IN (
      SELECT id FROM indb_service_accounts WHERE user_id = auth.uid()
    )
  );

-- Policy: System can create/update quota usage records (for API usage tracking)
CREATE POLICY "System can manage quota usage" ON indb_quota_usage
  FOR INSERT, UPDATE
  WITH CHECK (true);

-- Enable RLS on user profiles table
ALTER TABLE indb_user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own profile
CREATE POLICY "Users can manage their own profile" ON indb_user_profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Note: Security-related tables (indb_security_*) should remain accessible only to the application
-- These tables don't need user-level RLS as they are for system monitoring