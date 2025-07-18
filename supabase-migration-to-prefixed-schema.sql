-- Migration Script: Rename tables to use indb_ prefix
-- Run this in your Supabase SQL Editor

-- Step 1: Rename existing tables to new prefixed format
ALTER TABLE security_events RENAME TO indb_security_events;
ALTER TABLE blocked_ips RENAME TO indb_security_blocked_ips;
ALTER TABLE failed_auth_attempts RENAME TO indb_security_failed_auth_attempts;
ALTER TABLE suspicious_activities RENAME TO indb_security_suspicious_activities;
ALTER TABLE security_analytics RENAME TO indb_security_analytics;

-- Core application tables (keeping existing structure but adding prefix)
ALTER TABLE indexing_jobs RENAME TO indb_indexing_jobs;
ALTER TABLE service_accounts RENAME TO indb_service_accounts;
ALTER TABLE url_submissions RENAME TO indb_url_submissions;
ALTER TABLE quota_usage RENAME TO indb_quota_usage;
ALTER TABLE user_profiles RENAME TO indb_user_profiles;

-- Step 2: Update indexes to match new table names
DROP INDEX IF EXISTS idx_security_events_timestamp;
DROP INDEX IF EXISTS idx_security_events_ip;
DROP INDEX IF EXISTS idx_security_events_type;
DROP INDEX IF EXISTS idx_security_events_severity;
DROP INDEX IF EXISTS idx_blocked_ips_ip;
DROP INDEX IF EXISTS idx_failed_auth_ip;
DROP INDEX IF EXISTS idx_failed_auth_timestamp;
DROP INDEX IF EXISTS idx_suspicious_activities_ip;
DROP INDEX IF EXISTS idx_suspicious_activities_timestamp;
DROP INDEX IF EXISTS idx_security_analytics_date;

-- Recreate indexes with new table names
CREATE INDEX IF NOT EXISTS idx_indb_security_events_timestamp ON indb_security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_indb_security_events_ip ON indb_security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_indb_security_events_type ON indb_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_indb_security_events_severity ON indb_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_indb_security_blocked_ips_ip ON indb_security_blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_indb_security_failed_auth_ip ON indb_security_failed_auth_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_indb_security_failed_auth_timestamp ON indb_security_failed_auth_attempts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_indb_security_suspicious_activities_ip ON indb_security_suspicious_activities(ip_address);
CREATE INDEX IF NOT EXISTS idx_indb_security_suspicious_activities_timestamp ON indb_security_suspicious_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_indb_security_analytics_date ON indb_security_analytics(date DESC);

-- Step 3: Update RLS policies
DROP POLICY IF EXISTS "Security data access" ON indb_security_events;
DROP POLICY IF EXISTS "Blocked IPs access" ON indb_security_blocked_ips;
DROP POLICY IF EXISTS "Failed auth access" ON indb_security_failed_auth_attempts;
DROP POLICY IF EXISTS "Suspicious activity access" ON indb_security_suspicious_activities;
DROP POLICY IF EXISTS "Security analytics access" ON indb_security_analytics;

-- Recreate RLS policies
CREATE POLICY "Security events access" ON indb_security_events
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Blocked IPs access" ON indb_security_blocked_ips
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Failed auth access" ON indb_security_failed_auth_attempts
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Suspicious activity access" ON indb_security_suspicious_activities
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Security analytics access" ON indb_security_analytics
FOR ALL USING (auth.role() = 'authenticated');

-- Step 4: Update triggers and functions
DROP TRIGGER IF EXISTS security_analytics_trigger ON indb_security_events;
DROP FUNCTION IF EXISTS update_security_analytics();

-- Recreate function with new table names
CREATE OR REPLACE FUNCTION update_security_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO indb_security_analytics (
        date,
        total_events,
        auth_failures,
        suspicious_requests,
        blocked_ips,
        vulnerability_scans,
        brute_force_attempts,
        unique_ips,
        high_risk_events,
        updated_at
    )
    SELECT 
        CURRENT_DATE,
        COUNT(*),
        COUNT(*) FILTER (WHERE event_type LIKE 'AUTH_%'),
        COUNT(*) FILTER (WHERE event_type = 'SUSPICIOUS_REQUEST'),
        COUNT(*) FILTER (WHERE event_type = 'IP_BLOCKED'),
        COUNT(*) FILTER (WHERE event_type = 'VULNERABILITY_SCANNER_DETECTED'),
        COUNT(*) FILTER (WHERE event_type = 'BRUTE_FORCE_DETECTED'),
        COUNT(DISTINCT ip_address),
        COUNT(*) FILTER (WHERE severity = 'HIGH'),
        NOW()
    FROM indb_security_events 
    WHERE DATE(timestamp) = CURRENT_DATE
    ON CONFLICT (date) 
    DO UPDATE SET
        total_events = EXCLUDED.total_events,
        auth_failures = EXCLUDED.auth_failures,
        suspicious_requests = EXCLUDED.suspicious_requests,
        blocked_ips = EXCLUDED.blocked_ips,
        vulnerability_scans = EXCLUDED.vulnerability_scans,
        brute_force_attempts = EXCLUDED.brute_force_attempts,
        unique_ips = EXCLUDED.unique_ips,
        high_risk_events = EXCLUDED.high_risk_events,
        updated_at = EXCLUDED.updated_at;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER security_analytics_trigger
    AFTER INSERT ON indb_security_events
    FOR EACH ROW
    EXECUTE FUNCTION update_security_analytics();

-- Step 5: Verify migration completed successfully
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'indb_%'
ORDER BY table_name;