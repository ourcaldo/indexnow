-- Database Optimization Recommendations for IndexNow Application
-- Execute these queries on your Supabase database for better performance

-- 1. Add indexes for commonly queried columns
-- Index on user_id for fast user-related queries
CREATE INDEX IF NOT EXISTS idx_service_accounts_user_id ON indb_service_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_user_id ON indb_indexing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_url_submissions_job_id ON indb_url_submissions(job_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_service_account_id ON indb_quota_usage(service_account_id);

-- Index on status fields for filtering
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indb_indexing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_url_submissions_status ON indb_url_submissions(status);
CREATE INDEX IF NOT EXISTS idx_service_accounts_is_active ON indb_service_accounts(is_active);

-- Compound index for job scheduling queries
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status_next_run ON indb_indexing_jobs(status, next_run);

-- Index on date for quota usage queries
CREATE INDEX IF NOT EXISTS idx_quota_usage_date ON indb_quota_usage(date);

-- 2. Add constraints for data integrity
-- Ensure positive values for quota limits
ALTER TABLE indb_service_accounts 
ADD CONSTRAINT chk_daily_quota_positive CHECK (daily_quota_limit > 0);

ALTER TABLE indb_service_accounts 
ADD CONSTRAINT chk_per_minute_quota_positive CHECK (per_minute_quota_limit > 0);

-- Ensure URL count consistency
ALTER TABLE indb_indexing_jobs 
ADD CONSTRAINT chk_processed_urls_positive CHECK (processed_urls >= 0);

ALTER TABLE indb_indexing_jobs 
ADD CONSTRAINT chk_successful_urls_positive CHECK (successful_urls >= 0);

ALTER TABLE indb_indexing_jobs 
ADD CONSTRAINT chk_failed_urls_positive CHECK (failed_urls >= 0);

-- Ensure request count is non-negative
ALTER TABLE indb_quota_usage 
ADD CONSTRAINT chk_requests_count_positive CHECK (requests_count >= 0);

-- 3. Add foreign key constraints for referential integrity
-- (Note: These might already exist, execute only if needed)
ALTER TABLE indb_service_accounts 
ADD CONSTRAINT fk_service_accounts_user_id 
FOREIGN KEY (user_id) REFERENCES indb_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE indb_indexing_jobs 
ADD CONSTRAINT fk_indexing_jobs_user_id 
FOREIGN KEY (user_id) REFERENCES indb_user_profiles(id) ON DELETE CASCADE;

ALTER TABLE indb_url_submissions 
ADD CONSTRAINT fk_url_submissions_job_id 
FOREIGN KEY (job_id) REFERENCES indb_indexing_jobs(id) ON DELETE CASCADE;

ALTER TABLE indb_url_submissions 
ADD CONSTRAINT fk_url_submissions_service_account_id 
FOREIGN KEY (service_account_id) REFERENCES indb_service_accounts(id) ON DELETE SET NULL;

ALTER TABLE indb_quota_usage 
ADD CONSTRAINT fk_quota_usage_service_account_id 
FOREIGN KEY (service_account_id) REFERENCES indb_service_accounts(id) ON DELETE CASCADE;

-- 4. Add partial indexes for better performance on filtered queries
-- Index only active service accounts
CREATE INDEX IF NOT EXISTS idx_service_accounts_active_only 
ON indb_service_accounts(user_id, client_email) WHERE is_active = true;

-- Index only pending/running jobs
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_pending_running 
ON indb_indexing_jobs(user_id, next_run) WHERE status IN ('pending', 'running');

-- 5. Add unique constraints where appropriate
-- Ensure unique client_email per user
ALTER TABLE indb_service_accounts 
ADD CONSTRAINT uq_service_accounts_user_client_email 
UNIQUE (user_id, client_email);

-- Ensure unique job names per user
ALTER TABLE indb_indexing_jobs 
ADD CONSTRAINT uq_indexing_jobs_user_name 
UNIQUE (user_id, name);

-- 6. Create view for dashboard statistics (optional - for better performance)
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
    up.id as user_id,
    up.email,
    COUNT(DISTINCT sa.id) as total_service_accounts,
    COUNT(DISTINCT CASE WHEN sa.is_active = true THEN sa.id END) as active_service_accounts,
    COUNT(DISTINCT ij.id) as total_jobs,
    COUNT(DISTINCT CASE WHEN ij.status = 'completed' THEN ij.id END) as completed_jobs,
    COUNT(DISTINCT CASE WHEN ij.status = 'failed' THEN ij.id END) as failed_jobs,
    COUNT(DISTINCT CASE WHEN ij.status = 'running' THEN ij.id END) as running_jobs,
    COALESCE(SUM(ij.successful_urls), 0) as total_successful_urls,
    COALESCE(SUM(ij.failed_urls), 0) as total_failed_urls
FROM indb_user_profiles up
LEFT JOIN indb_service_accounts sa ON up.id = sa.user_id
LEFT JOIN indb_indexing_jobs ij ON up.id = ij.user_id
GROUP BY up.id, up.email;

-- 7. Add comments for better documentation
COMMENT ON TABLE indb_user_profiles IS 'User profile information with role-based access control';
COMMENT ON TABLE indb_service_accounts IS 'Google service account configurations for indexing API access';
COMMENT ON TABLE indb_indexing_jobs IS 'Indexing job configurations with scheduling and progress tracking';
COMMENT ON TABLE indb_url_submissions IS 'Individual URL submission records with status tracking';
COMMENT ON TABLE indb_quota_usage IS 'Daily quota usage tracking per service account';

-- 8. Security enhancements (if using RLS)
-- Enable Row Level Security on all tables
ALTER TABLE indb_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_url_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_quota_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic example - adjust based on your auth setup)
-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON indb_user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON indb_user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own service accounts" ON indb_service_accounts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own jobs" ON indb_indexing_jobs
    FOR ALL USING (auth.uid() = user_id);

-- Note: Adjust these policies based on your specific authentication setup
-- and security requirements. The above are basic examples.