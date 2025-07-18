import { supabase } from '../db';
import { Request } from 'express';

export class DatabaseSecurityLogger {
  static async logSecurityEvent(
    eventType: string,
    data: {
      userId?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      message?: string;
      details?: any;
      blocked?: boolean;
    },
    req: Request
  ) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      const securityEvent = {
        user_id: data.userId || null,
        event_type: eventType,
        severity: data.severity || 'medium',
        ip_address: ipAddress,
        user_agent: userAgent,
        request_method: req.method,
        request_url: req.url,
        message: data.message || `Security event: ${eventType}`,
        details: data.details ? JSON.stringify(data.details) : null,
        blocked: data.blocked || false,
      };

      const { error } = await supabase
        .from('security_events')
        .insert([securityEvent]);

      if (error) {
        console.error('Failed to log security event to Supabase:', error);
        // Fallback to console logging
        console.log(`[SECURITY] ${eventType}: ${data.message || eventType} - IP: ${ipAddress}`);
      } else {
        // Also log to console for immediate visibility
        console.log(`[SECURITY] ${eventType}: ${data.message || eventType} - IP: ${ipAddress}`);
      }
    } catch (error) {
      console.error('Failed to log security event to database:', error);
      // Fallback to console logging
      console.log(`[SECURITY] ${eventType}: ${data.message || eventType} - IP: ${req.ip}`);
    }
  }

  static async getSecurityEvents(options: {
    limit?: number;
    offset?: number;
    userId?: string;
    eventType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    try {
      const query = db.select().from(securityEvents);
      
      // Add filters here if needed
      const events = await query
        .orderBy(securityEvents.createdAt)
        .limit(options.limit || 100)
        .offset(options.offset || 0);
      
      return events;
    } catch (error) {
      console.error('Failed to fetch security events:', error);
      return [];
    }
  }

  static async getSecurityStats() {
    try {
      // Get recent security events count by type
      const events = await db.select().from(securityEvents)
        .orderBy(securityEvents.createdAt)
        .limit(1000); // Last 1000 events
      
      const stats = {
        totalEvents: events.length,
        eventsByType: {} as Record<string, number>,
        eventsBySeverity: {} as Record<string, number>,
        recentBlocked: events.filter(e => e.blocked).length,
      };

      events.forEach(event => {
        stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
        stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to fetch security stats:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        recentBlocked: 0,
      };
    }
  }
}