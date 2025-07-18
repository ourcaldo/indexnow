import type { Request, Response, NextFunction } from "express";
import crypto from 'crypto';

// Secure logging middleware with data sanitization
export class SecureLogger {
  private static readonly sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization', 'cookie',
    'serviceAccountJson', 'accessToken', 'private_key', 'client_secret'
  ];
  
  private static readonly sensitiveHeaders = [
    'authorization', 'cookie', 'x-api-key', 'x-auth-token'
  ];
  
  static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = this.maskSensitiveData(value as string);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  static sanitizeHeaders(headers: any): any {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sensitiveHeaders.includes(lowerKey)) {
        sanitized[key] = this.maskSensitiveData(value as string);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  private static maskSensitiveData(data: string): string {
    if (!data || typeof data !== 'string') {
      return '[REDACTED]';
    }
    
    if (data.length <= 8) {
      return '*'.repeat(data.length);
    }
    
    // Show first 2 and last 2 characters
    return data.substring(0, 2) + '*'.repeat(data.length - 4) + data.substring(data.length - 2);
  }
  
  static logRequest(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Add request ID to request for tracking
    (req as any).requestId = requestId;
    
    const logData = {
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      headers: this.sanitizeHeaders(req.headers),
      body: req.body ? this.sanitizeObject(req.body) : undefined,
      timestamp: new Date().toISOString()
    };
    
    // Log request (only in development or with debug flag)
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LOGGING === 'true') {
      console.log('📥 REQUEST:', JSON.stringify(logData, null, 2));
    }
    
    // Log response
    const originalJson = res.json;
    res.json = function(data: any) {
      const duration = Date.now() - startTime;
      
      const responseLogData = {
        requestId,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        response: res.statusCode >= 400 ? data : SecureLogger.sanitizeObject(data),
        timestamp: new Date().toISOString()
      };
      
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LOGGING === 'true') {
        console.log('📤 RESPONSE:', JSON.stringify(responseLogData, null, 2));
      }
      
      // Log errors to a separate error log
      if (res.statusCode >= 400) {
        console.error('❌ ERROR RESPONSE:', JSON.stringify(responseLogData, null, 2));
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  }
  
  static logError(error: Error, req: Request, res: Response, next: NextFunction) {
    const requestId = (req as any).requestId;
    
    const errorLogData = {
      requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        headers: this.sanitizeHeaders(req.headers),
        body: req.body ? this.sanitizeObject(req.body) : undefined
      },
      timestamp: new Date().toISOString()
    };
    
    console.error('💥 UNHANDLED ERROR:', JSON.stringify(errorLogData, null, 2));
    
    // In production, you might want to send this to an error tracking service
    // like Sentry, LogRocket, or similar
    
    next();
  }
  
  // Security event logging with database integration
  static async logSecurityEvent(event: string, details: any, req?: Request) {
    const securityLogData = {
      event,
      details: this.sanitizeObject(details),
      ip: req?.ip,
      userAgent: req?.get('User-Agent'),
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    };
    
    console.warn('🔒 SECURITY EVENT:', JSON.stringify(securityLogData, null, 2));
    
    // Save to database for analytics
    try {
      const { SecurityAnalyticsService } = await import('../services/security-analytics');
      await SecurityAnalyticsService.logSecurityEvent({
        event_type: event,
        severity: 'HIGH',
        ip_address: req?.ip,
        user_agent: req?.get('User-Agent'),
        request_url: req?.url,
        request_method: req?.method,
        request_body: req?.body,
        request_query: req?.query,
        details: details
      });
    } catch (error) {
      console.error('Failed to save security event to database:', error);
    }
  }
}

// Middleware functions
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  SecureLogger.logRequest(req, res, next);
}

export function errorLoggingMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  SecureLogger.logError(error, req, res, next);
}