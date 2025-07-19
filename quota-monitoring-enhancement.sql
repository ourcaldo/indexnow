-- Quota Monitoring Enhancement SQL Queries
-- Run these in your Supabase SQL Editor

-- 1. Add quota alert preferences to user profiles
ALTER TABLE indb_user_profiles 
ADD COLUMN email_quota_alerts boolean DEFAULT true,
ADD COLUMN quota_alert_threshold integer DEFAULT 80;

-- 2. Create quota alerts table for tracking sent alerts
CREATE TABLE indb_quota_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    service_account_id uuid NOT NULL,
    alert_type text NOT NULL CHECK (alert_type IN ('warning', 'critical', 'exhausted')),
    threshold_percentage integer NOT NULL,
    current_usage integer NOT NULL,
    quota_limit integer NOT NULL,
    sent_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now()
);

-- 3. Create indexes for better performance
CREATE INDEX idx_quota_alerts_user_id ON indb_quota_alerts(user_id);
CREATE INDEX idx_quota_alerts_service_account_id ON indb_quota_alerts(service_account_id);
CREATE INDEX idx_quota_alerts_sent_at ON indb_quota_alerts(sent_at);

-- 4. Add RLS policies for quota alerts
ALTER TABLE indb_quota_alerts ENABLE row level security;

CREATE POLICY "Users can view their own quota alerts" ON indb_quota_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert quota alerts" ON indb_quota_alerts
    FOR INSERT WITH CHECK (true);

-- 5. Add notification preferences
ALTER TABLE indb_user_profiles 
ADD COLUMN dashboard_notifications boolean DEFAULT true;

-- 6. Create dashboard notifications table
CREATE TABLE indb_dashboard_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read boolean DEFAULT false,
    related_entity_type text, -- 'service_account', 'job', etc.
    related_entity_id uuid,
    created_at timestamp DEFAULT now(),
    expires_at timestamp
);

-- 7. Create indexes for dashboard notifications
CREATE INDEX idx_dashboard_notifications_user_id ON indb_dashboard_notifications(user_id);
CREATE INDEX idx_dashboard_notifications_created_at ON indb_dashboard_notifications(created_at);
CREATE INDEX idx_dashboard_notifications_is_read ON indb_dashboard_notifications(is_read);

-- 8. Add RLS policies for dashboard notifications
ALTER TABLE indb_dashboard_notifications ENABLE row level security;

CREATE POLICY "Users can view their own notifications" ON indb_dashboard_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON indb_dashboard_notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON indb_dashboard_notifications
    FOR INSERT WITH CHECK (true);

-- 9. Clean up old notifications automatically (optional - run if you want automatic cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    -- Delete notifications older than 30 days or expired ones
    DELETE FROM indb_dashboard_notifications 
    WHERE (created_at < now() - interval '30 days') 
       OR (expires_at IS NOT NULL AND expires_at < now());
END;
$$ LANGUAGE plpgsql;

-- 10. Update comments for documentation
COMMENT ON TABLE indb_quota_alerts IS 'Stores quota alert history to prevent duplicate alerts';
COMMENT ON TABLE indb_dashboard_notifications IS 'Stores dashboard notifications for users';
COMMENT ON COLUMN indb_user_profiles.email_quota_alerts IS 'Whether user wants to receive quota alert emails';
COMMENT ON COLUMN indb_user_profiles.quota_alert_threshold IS 'Percentage threshold for quota alerts (default 80%)';
COMMENT ON COLUMN indb_user_profiles.dashboard_notifications IS 'Whether user wants to see dashboard notifications';