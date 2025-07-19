-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================
-- Run these SQL queries in your Supabase SQL editor
-- to enable user-based data access control

-- Enable RLS on indexing jobs table
ALTER TABLE indb_indexing_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own indexing jobs
CREATE POLICY "Users can view their own indexing jobs" ON indb_indexing_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert indexing jobs for themselves
CREATE POLICY "Users can insert their own indexing jobs" ON indb_indexing_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own indexing jobs
CREATE POLICY "Users can update their own indexing jobs" ON indb_indexing_jobs
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own indexing jobs
CREATE POLICY "Users can delete their own indexing jobs" ON indb_indexing_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- RLS for related tables (optional but recommended)
-- ========================================

-- Enable RLS on URL submissions table
ALTER TABLE indb_url_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view URL submissions for their own jobs
CREATE POLICY "Users can view url submissions for their jobs" ON indb_url_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM indb_indexing_jobs 
            WHERE indb_indexing_jobs.id = indb_url_submissions.job_id 
            AND indb_indexing_jobs.user_id = auth.uid()
        )
    );

-- Policy: Users can only insert URL submissions for their own jobs
CREATE POLICY "Users can insert url submissions for their jobs" ON indb_url_submissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM indb_indexing_jobs 
            WHERE indb_indexing_jobs.id = indb_url_submissions.job_id 
            AND indb_indexing_jobs.user_id = auth.uid()
        )
    );

-- Policy: Users can only update URL submissions for their own jobs
CREATE POLICY "Users can update url submissions for their jobs" ON indb_url_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM indb_indexing_jobs 
            WHERE indb_indexing_jobs.id = indb_url_submissions.job_id 
            AND indb_indexing_jobs.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM indb_indexing_jobs 
            WHERE indb_indexing_jobs.id = indb_url_submissions.job_id 
            AND indb_indexing_jobs.user_id = auth.uid()
        )
    );

-- Policy: Users can only delete URL submissions for their own jobs
CREATE POLICY "Users can delete url submissions for their jobs" ON indb_url_submissions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM indb_indexing_jobs 
            WHERE indb_indexing_jobs.id = indb_url_submissions.job_id 
            AND indb_indexing_jobs.user_id = auth.uid()
        )
    );

-- ========================================
-- Service Accounts RLS (if needed)
-- ========================================

-- Enable RLS on service accounts table
ALTER TABLE indb_service_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own service accounts
CREATE POLICY "Users can view their own service accounts" ON indb_service_accounts
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert service accounts for themselves
CREATE POLICY "Users can insert their own service accounts" ON indb_service_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own service accounts
CREATE POLICY "Users can update their own service accounts" ON indb_service_accounts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own service accounts
CREATE POLICY "Users can delete their own service accounts" ON indb_service_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- Quota Usage RLS (if needed)
-- ========================================

-- Enable RLS on quota usage table
ALTER TABLE indb_quota_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view quota usage for their own service accounts
CREATE POLICY "Users can view quota usage for their service accounts" ON indb_quota_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM indb_service_accounts 
            WHERE indb_service_accounts.id = indb_quota_usage.service_account_id 
            AND indb_service_accounts.user_id = auth.uid()
        )
    );

-- Policy: Users can only insert quota usage for their own service accounts
CREATE POLICY "Users can insert quota usage for their service accounts" ON indb_quota_usage
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM indb_service_accounts 
            WHERE indb_service_accounts.id = indb_quota_usage.service_account_id 
            AND indb_service_accounts.user_id = auth.uid()
        )
    );

-- Policy: Users can only update quota usage for their own service accounts
CREATE POLICY "Users can update quota usage for their service accounts" ON indb_quota_usage
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM indb_service_accounts 
            WHERE indb_service_accounts.id = indb_quota_usage.service_account_id 
            AND indb_service_accounts.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM indb_service_accounts 
            WHERE indb_service_accounts.id = indb_quota_usage.service_account_id 
            AND indb_service_accounts.user_id = auth.uid()
        )
    );

-- ========================================
-- User Profiles RLS
-- ========================================

-- Enable RLS on user profiles table
ALTER TABLE indb_user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own profile
CREATE POLICY "Users can view their own profile" ON indb_user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can only update their own profile
CREATE POLICY "Users can update their own profile" ON indb_user_profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile (during signup)
CREATE POLICY "Users can insert their own profile" ON indb_user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ========================================
-- Verification Queries (Optional - for testing)
-- ========================================

-- Test that RLS is working correctly:
-- SELECT policy_name, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'indb_indexing_jobs';

-- To check if RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename LIKE 'indb_%';