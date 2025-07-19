-- ========================================
-- P0 CRITICAL SECURITY FIXES - RUN IN SUPABASE SQL EDITOR
-- ========================================

-- 1. ADD JOB LOCKING COLUMNS (Prevents race conditions)
-- This prevents multiple job executions simultaneously
ALTER TABLE indb_indexing_jobs 
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- 2. ADD ACCESS TOKEN ENCRYPTION COLUMNS
-- This will allow us to encrypt access tokens instead of storing them in plain text
ALTER TABLE indb_service_accounts 
ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
ADD COLUMN IF NOT EXISTS encryption_tag TEXT;

-- 3. ADD PERFORMANCE INDEXES (Critical for query performance)
-- User profiles role lookup (for role-based authorization)
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON indb_user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON indb_user_profiles(email);

-- Service accounts user lookup
CREATE INDEX IF NOT EXISTS idx_service_accounts_user_id ON indb_service_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_service_accounts_active ON indb_service_accounts(user_id, is_active);

-- Indexing jobs user lookup and status
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_user_id ON indb_indexing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indb_indexing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_next_run ON indb_indexing_jobs(next_run) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_locked ON indb_indexing_jobs(locked_at) WHERE locked_at IS NOT NULL;

-- URL submissions job lookup
CREATE INDEX IF NOT EXISTS idx_url_submissions_job_id ON indb_url_submissions(job_id);
CREATE INDEX IF NOT EXISTS idx_url_submissions_status ON indb_url_submissions(status);
CREATE INDEX IF NOT EXISTS idx_url_submissions_service_account ON indb_url_submissions(service_account_id);

-- Quota usage date and service account lookup
CREATE INDEX IF NOT EXISTS idx_quota_usage_service_account_date ON indb_quota_usage(service_account_id, date);

-- Security events for monitoring
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON indb_security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON indb_security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON indb_security_events(user_id);

-- 4. CLEAN UP ORPHANED RECORDS BEFORE ADDING CONSTRAINTS
-- Remove any orphaned records that would violate foreign key constraints

-- Clean up URL submissions with invalid service account references
DELETE FROM indb_url_submissions 
WHERE service_account_id IS NOT NULL 
AND service_account_id NOT IN (SELECT id FROM indb_service_accounts);

-- Clean up URL submissions with invalid job references
DELETE FROM indb_url_submissions 
WHERE job_id NOT IN (SELECT id FROM indb_indexing_jobs);

-- Clean up quota usage with invalid service account references
DELETE FROM indb_quota_usage 
WHERE service_account_id NOT IN (SELECT id FROM indb_service_accounts);

-- Clean up indexing jobs with invalid user references
DELETE FROM indb_indexing_jobs 
WHERE user_id NOT IN (SELECT id FROM indb_user_profiles);

-- Clean up service accounts with invalid user references
DELETE FROM indb_service_accounts 
WHERE user_id NOT IN (SELECT id FROM indb_user_profiles);

-- 5. ADD FOREIGN KEY CONSTRAINTS (Data integrity)
-- These ensure referential integrity and prevent orphaned records
-- Using DO blocks to handle existing constraints gracefully

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_service_accounts_user' 
                   AND table_name = 'indb_service_accounts') THEN
        ALTER TABLE indb_service_accounts 
        ADD CONSTRAINT fk_service_accounts_user 
        FOREIGN KEY (user_id) REFERENCES indb_user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_indexing_jobs_user' 
                   AND table_name = 'indb_indexing_jobs') THEN
        ALTER TABLE indb_indexing_jobs 
        ADD CONSTRAINT fk_indexing_jobs_user 
        FOREIGN KEY (user_id) REFERENCES indb_user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_url_submissions_job' 
                   AND table_name = 'indb_url_submissions') THEN
        ALTER TABLE indb_url_submissions 
        ADD CONSTRAINT fk_url_submissions_job 
        FOREIGN KEY (job_id) REFERENCES indb_indexing_jobs(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_url_submissions_service_account' 
                   AND table_name = 'indb_url_submissions') THEN
        ALTER TABLE indb_url_submissions 
        ADD CONSTRAINT fk_url_submissions_service_account 
        FOREIGN KEY (service_account_id) REFERENCES indb_service_accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_quota_usage_service_account' 
                   AND table_name = 'indb_quota_usage') THEN
        ALTER TABLE indb_quota_usage 
        ADD CONSTRAINT fk_quota_usage_service_account 
        FOREIGN KEY (service_account_id) REFERENCES indb_service_accounts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. ADD CONNECTION POOL LIMITS (Prevent connection exhaustion)
-- Note: This is for information - actual connection pool limits are set in application config
-- Max connections recommended: 10-20 for development, 50-100 for production

-- 7. ADD DATA VALIDATION CONSTRAINTS
-- Ensure data quality and prevent invalid data
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_daily_quota_positive' 
                   AND table_name = 'indb_service_accounts') THEN
        ALTER TABLE indb_service_accounts 
        ADD CONSTRAINT chk_daily_quota_positive 
        CHECK (daily_quota_limit > 0 AND daily_quota_limit <= 1000);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_minute_quota_positive' 
                   AND table_name = 'indb_service_accounts') THEN
        ALTER TABLE indb_service_accounts 
        ADD CONSTRAINT chk_minute_quota_positive 
        CHECK (per_minute_quota_limit > 0 AND per_minute_quota_limit <= 600);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_requests_count_positive' 
                   AND table_name = 'indb_quota_usage') THEN
        ALTER TABLE indb_quota_usage 
        ADD CONSTRAINT chk_requests_count_positive 
        CHECK (requests_count >= 0);
    END IF;
END $$;

-- 8. SECURITY EVENT CLEANUP (Prevent table bloat)
-- Create a function to clean up old security events (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_events()
RETURNS void AS $$
BEGIN
    DELETE FROM indb_security_events 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    DELETE FROM indb_security_failed_auth_attempts 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    DELETE FROM indb_security_suspicious_activities 
    WHERE timestamp < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily at 2 AM (you can set this up in Supabase cron extension)
-- SELECT cron.schedule('cleanup-security-events', '0 2 * * *', 'SELECT cleanup_old_security_events();');

-- 9. ADD UNIQUE CONSTRAINTS (Prevent duplicates)
-- Prevent duplicate quota usage entries per service account per day
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_quota_usage_service_account_date' 
                   AND table_name = 'indb_quota_usage') THEN
        ALTER TABLE indb_quota_usage 
        ADD CONSTRAINT uk_quota_usage_service_account_date 
        UNIQUE (service_account_id, date);
    END IF;
END $$;

-- Prevent duplicate service account emails per user
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_service_accounts_user_email' 
                   AND table_name = 'indb_service_accounts') THEN
        ALTER TABLE indb_service_accounts 
        ADD CONSTRAINT uk_service_accounts_user_email 
        UNIQUE (user_id, client_email);
    END IF;
END $$;

-- 10. ADD AUDIT TRIGGERS (Optional - for advanced monitoring)
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables that need automatic updated_at updates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                   WHERE trigger_name = 'trigger_update_service_accounts_updated_at') THEN
        CREATE TRIGGER trigger_update_service_accounts_updated_at
            BEFORE UPDATE ON indb_service_accounts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                   WHERE trigger_name = 'trigger_update_indexing_jobs_updated_at') THEN
        CREATE TRIGGER trigger_update_indexing_jobs_updated_at
            BEFORE UPDATE ON indb_indexing_jobs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                   WHERE trigger_name = 'trigger_update_user_profiles_updated_at') THEN
        CREATE TRIGGER trigger_update_user_profiles_updated_at
            BEFORE UPDATE ON indb_user_profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 11. GRANT PROPER PERMISSIONS (Security)
-- Ensure authenticated users can only access their own data
-- Note: Supabase RLS (Row Level Security) should be enabled for these tables

-- Enable RLS on all tables if not already enabled
ALTER TABLE indb_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_url_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE indb_quota_usage ENABLE ROW LEVEL SECURITY;

-- ========================================
-- VERIFICATION QUERIES
-- Run these to verify the changes were applied correctly
-- ========================================

-- Check if all indexes were created
SELECT 
    schemaname, 
    indexname, 
    tablename 
FROM pg_indexes 
WHERE tablename LIKE 'indb_%' 
ORDER BY tablename, indexname;

-- Check if all constraints were added
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type 
FROM information_schema.table_constraints tc
WHERE tc.table_name LIKE 'indb_%'
ORDER BY tc.table_name, tc.constraint_type;

-- Check if new columns were added
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name LIKE 'indb_%' 
    AND column_name IN ('locked_at', 'locked_by', 'access_token_encrypted', 'encryption_iv', 'encryption_tag')
ORDER BY table_name, column_name;

-- ========================================
-- MIGRATION NOTES:
-- ========================================
-- 1. After running this SQL, update your .env file to include:
--    ENCRYPTION_KEY=<generate-32-byte-base64-key>
--    MAX_DB_CONNECTIONS=10
--    DB_CONNECTION_TIMEOUT=30000
--
-- 2. The encryption migration will happen gradually:
--    - New tokens will be encrypted
--    - Existing plain text tokens will be re-encrypted when refreshed
--
-- 3. Test the application thoroughly after applying these changes
--
-- 4. Monitor the logs for any constraint violations or performance issues
-- ========================================