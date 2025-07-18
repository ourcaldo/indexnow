-- SQL queries to create security events table in Supabase
-- Run these queries in your Supabase SQL editor

-- 1. Create the security event type enum
CREATE TYPE security_event_type AS ENUM (
  'LOGIN_ATTEMPT',
  'LOGIN_SUCCESS', 
  'LOGIN_FAILURE',
  'UNAUTHORIZED_ACCESS',
  'SUSPICIOUS_REQUEST',
  'VULNERABILITY_SCANNER_DETECTED',
  'BRUTE_FORCE_ATTEMPT',
  'IP_BLOCKED',
  'RATE_LIMIT_EXCEEDED',
  'INVALID_TOKEN',
  'CSRF_ATTEMPT',
  'XSS_ATTEMPT',
  'SQL_INJECTION_ATTEMPT',
  'FILE_UPLOAD_BLOCKED',
  'ANOMALY_DETECTED'
);

-- 2. Create the security_events table
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id), -- Optional - not all events have a user
  event_type security_event_type NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  request_method TEXT,
  request_url TEXT,
  message TEXT,
  details TEXT, -- JSON string for additional event data
  blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX idx_security_events_blocked ON security_events(blocked);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- Policy for admin users to view all security events
CREATE POLICY "Admin users can view all security events" ON security_events
  FOR SELECT
  TO authenticated
  USING (
    -- Replace with your admin email addresses
    auth.jwt() ->> 'email' = ANY(ARRAY['admin@example.com', 'security@example.com'])
  );

-- Policy for admin users to insert security events
CREATE POLICY "Admin users can insert security events" ON security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Replace with your admin email addresses
    auth.jwt() ->> 'email' = ANY(ARRAY['admin@example.com', 'security@example.com'])
  );

-- Policy for users to view their own security events
CREATE POLICY "Users can view their own security events" ON security_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy for service role (backend) to insert security events
CREATE POLICY "Service role can insert security events" ON security_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy for service role (backend) to view security events
CREATE POLICY "Service role can view security events" ON security_events
  FOR SELECT
  TO service_role
  USING (true);

-- 6. Grant permissions
GRANT SELECT, INSERT ON security_events TO authenticated;
GRANT ALL ON security_events TO service_role;

-- 7. Create a function to log security events (optional - for stored procedure approach)
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_event_type security_event_type,
  p_severity TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_request_method TEXT DEFAULT NULL,
  p_request_url TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_details TEXT DEFAULT NULL,
  p_blocked BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO security_events (
    user_id, event_type, severity, ip_address, user_agent,
    request_method, request_url, message, details, blocked
  ) VALUES (
    p_user_id, p_event_type, p_severity, p_ip_address, p_user_agent,
    p_request_method, p_request_url, p_message, p_details, p_blocked
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated, service_role;

-- 8. Create a view for security statistics (optional)
CREATE VIEW security_event_stats AS
SELECT 
  event_type,
  severity,
  COUNT(*) as event_count,
  COUNT(CASE WHEN blocked = true THEN 1 END) as blocked_count,
  DATE_TRUNC('hour', created_at) as hour_bucket
FROM security_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type, severity, DATE_TRUNC('hour', created_at)
ORDER BY hour_bucket DESC;

-- Grant access to the view
GRANT SELECT ON security_event_stats TO authenticated, service_role;