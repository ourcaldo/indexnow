import { db } from './supabase';
import { sql } from 'drizzle-orm';

export interface SecurityEventData {
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ip_address?: string;
  user_agent?: string;
  user_id?: string;
  request_url?: string;
  request_method?: string;
  request_body?: any;
  request_query?: any;
  details?: any;
}

export interface FailedAuthData {
  ip_address: string;
  attempted_email?: string;
  user_agent?: string;
  endpoint: string;
  failure_reason: string;
}

export interface SuspiciousActivityData {
  ip_address: string;
  activity_type: string;
  user_agent?: string;
  request_url?: string;
  request_method?: string;
  detected_patterns?: string[];
  risk_score?: number;
}

export interface BlockedIPData {
  ip_address: string;
  reason: string;
  blocked_until?: Date;
  failed_attempts?: number;
  is_permanent?: boolean;
  created_by?: string;
}

export class SecurityAnalyticsService {
  // Log security events to database
  static async logSecurityEvent(eventData: SecurityEventData): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO indb_security_events (
          event_type, severity, ip_address, user_agent, user_id, 
          request_url, request_method, request_body, request_query, details
        ) VALUES (
          ${eventData.event_type}, 
          ${eventData.severity}, 
          ${eventData.ip_address || null}, 
          ${eventData.user_agent || null}, 
          ${eventData.user_id || null}, 
          ${eventData.request_url || null}, 
          ${eventData.request_method || null}, 
          ${eventData.request_body ? JSON.stringify(eventData.request_body) : null}, 
          ${eventData.request_query ? JSON.stringify(eventData.request_query) : null}, 
          ${eventData.details ? JSON.stringify(eventData.details) : null}
        )
      `);
    } catch (error) {
      console.error('Failed to log security event to database:', error);
      // Fallback to console logging if database fails
      console.warn('🔒 SECURITY EVENT (DB FAILED):', JSON.stringify(eventData, null, 2));
    }
  }

  // Log failed authentication attempts
  static async logFailedAuth(authData: FailedAuthData): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO indb_security_failed_auth_attempts (
          ip_address, attempted_email, user_agent, endpoint, failure_reason
        ) VALUES (
          ${authData.ip_address}, 
          ${authData.attempted_email || null}, 
          ${authData.user_agent || null}, 
          ${authData.endpoint}, 
          ${authData.failure_reason}
        )
      `);
    } catch (error) {
      console.error('Failed to log auth failure to database:', error);
    }
  }

  // Log suspicious activities
  static async logSuspiciousActivity(activityData: SuspiciousActivityData): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO indb_security_suspicious_activities (
          ip_address, activity_type, user_agent, request_url, 
          request_method, detected_patterns, risk_score
        ) VALUES (
          ${activityData.ip_address}, 
          ${activityData.activity_type}, 
          ${activityData.user_agent || null}, 
          ${activityData.request_url || null}, 
          ${activityData.request_method || null}, 
          ${activityData.detected_patterns ? JSON.stringify(activityData.detected_patterns) : null}, 
          ${activityData.risk_score || 1}
        )
      `);
    } catch (error) {
      console.error('Failed to log suspicious activity to database:', error);
    }
  }

  // Block IP address
  static async blockIP(blockData: BlockedIPData): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO indb_security_blocked_ips (
          ip_address, reason, blocked_until, failed_attempts, is_permanent, created_by
        ) VALUES (
          ${blockData.ip_address}, 
          ${blockData.reason}, 
          ${blockData.blocked_until || null}, 
          ${blockData.failed_attempts || 0}, 
          ${blockData.is_permanent || false}, 
          ${blockData.created_by || null}
        )
        ON CONFLICT (ip_address) 
        DO UPDATE SET 
          failed_attempts = indb_security_blocked_ips.failed_attempts + 1,
          blocked_until = EXCLUDED.blocked_until,
          reason = EXCLUDED.reason
      `);
    } catch (error) {
      console.error('Failed to block IP in database:', error);
    }
  }

  // Check if IP is blocked
  static async isIPBlocked(ip_address: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT id FROM indb_security_blocked_ips 
        WHERE ip_address = ${ip_address} 
        AND (blocked_until IS NULL OR blocked_until > NOW())
      `);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Failed to check blocked IP:', error);
      return false;
    }
  }

  // Get security analytics for dashboard
  static async getSecuritySummary(days: number = 7): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          date,
          total_events,
          auth_failures,
          suspicious_requests,
          blocked_ips,
          vulnerability_scans,
          brute_force_attempts,
          unique_ips,
          high_risk_events
        FROM indb_security_analytics 
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Failed to get security summary:', error);
      return [];
    }
  }

  // Get recent security events
  static async getRecentEvents(limit: number = 50): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          event_type,
          severity,
          ip_address,
          user_agent,
          request_url,
          timestamp,
          details
        FROM indb_security_events 
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      console.error('Failed to get recent events:', error);
      return [];
    }
  }

  // Get top attacking IPs
  static async getTopAttackingIPs(days: number = 7, limit: number = 10): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          ip_address,
          COUNT(*) as attack_count,
          array_agg(DISTINCT event_type) as event_types,
          MAX(timestamp) as last_seen
        FROM indb_security_events 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY ip_address
        ORDER BY attack_count DESC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      console.error('Failed to get top attacking IPs:', error);
      return [];
    }
  }

  // Get security events timeline (hourly for last 24 hours)
  static async getSecurityTimeline(): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as events_count,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(*) FILTER (WHERE severity = 'HIGH') as high_severity_count
        FROM indb_security_events 
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Failed to get security timeline:', error);
      return [];
    }
  }
}