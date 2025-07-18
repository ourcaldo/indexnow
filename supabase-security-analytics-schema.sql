-- Google Indexing Dashboard - Security Analytics Tables
-- Run this SQL in your Supabase SQL Editor to create security logging tables

-- 1. Security Events Table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL DEFAULT 'HIGH',
    ip_address INET,
    user_agent TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_url TEXT,
    request_method VARCHAR(10),
    request_body JSONB,
    request_query JSONB,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. IP Blocking Table
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    failed_attempts INTEGER DEFAULT 0,
    is_permanent BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Failed Authentication Attempts Table
CREATE TABLE IF NOT EXISTS failed_auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    attempted_email VARCHAR(255),
    user_agent TEXT,
    endpoint VARCHAR(100),
    failure_reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Suspicious Activity Log Table
CREATE TABLE IF NOT EXISTS suspicious_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    user_agent TEXT,
    request_url TEXT,
    request_method VARCHAR(10),
    detected_patterns TEXT[],
    risk_score INTEGER DEFAULT 1, -- 1-10 scale
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Security Analytics Summary Table (for dashboard)
CREATE TABLE IF NOT EXISTS security_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_events INTEGER DEFAULT 0,
    auth_failures INTEGER DEFAULT 0,
    suspicious_requests INTEGER DEFAULT 0,
    blocked_ips INTEGER DEFAULT 0,
    vulnerability_scans INTEGER DEFAULT 0,
    brute_force_attempts INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    high_risk_events INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_auth_ip ON failed_auth_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_auth_timestamp ON failed_auth_attempts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_ip ON suspicious_activities(ip_address);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_timestamp ON suspicious_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_analytics_date ON security_analytics(date DESC);

-- Create RLS (Row Level Security) policies
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view security data (admin only)
CREATE POLICY "Security data access" ON security_events
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Blocked IPs access" ON blocked_ips
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Failed auth access" ON failed_auth_attempts
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Suspicious activity access" ON suspicious_activities
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Security analytics access" ON security_analytics
FOR ALL USING (auth.role() = 'authenticated');

-- Function to automatically update security analytics daily
CREATE OR REPLACE FUNCTION update_security_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO security_analytics (
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
    FROM security_events 
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

-- Trigger to update analytics when new security events are inserted
CREATE TRIGGER security_analytics_trigger
    AFTER INSERT ON security_events
    FOR EACH ROW
    EXECUTE FUNCTION update_security_analytics();

-- Sample queries for security analytics (you can use these in your admin panel)

-- Query 1: Recent security events (last 24 hours)
-- SELECT event_type, COUNT(*) as count, severity
-- FROM security_events 
-- WHERE timestamp >= NOW() - INTERVAL '24 hours'
-- GROUP BY event_type, severity
-- ORDER BY count DESC;

-- Query 2: Top attacking IPs
-- SELECT ip_address, COUNT(*) as attack_count, 
--        array_agg(DISTINCT event_type) as event_types
-- FROM security_events 
-- WHERE timestamp >= NOW() - INTERVAL '7 days'
-- GROUP BY ip_address
-- ORDER BY attack_count DESC
-- LIMIT 10;

-- Query 3: Security events timeline (hourly)
-- SELECT DATE_TRUNC('hour', timestamp) as hour,
--        COUNT(*) as events_count,
--        COUNT(DISTINCT ip_address) as unique_ips
-- FROM security_events 
-- WHERE timestamp >= NOW() - INTERVAL '24 hours'
-- GROUP BY hour
-- ORDER BY hour DESC;

-- Query 4: Daily security summary
-- SELECT date, total_events, auth_failures, suspicious_requests, 
--        blocked_ips, vulnerability_scans, brute_force_attempts
-- FROM security_analytics 
-- ORDER BY date DESC 
-- LIMIT 30;

-- Query 5: Current blocked IPs
-- SELECT ip_address, reason, blocked_at, failed_attempts
-- FROM blocked_ips 
-- WHERE (blocked_until IS NULL OR blocked_until > NOW())
-- ORDER BY blocked_at DESC;