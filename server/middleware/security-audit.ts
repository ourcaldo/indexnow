import type { Request, Response, NextFunction } from "express";
import { SecureLogger } from "./secure-logging";
import { DatabaseSecurityLogger } from "../services/security-logger";

// Security audit and monitoring middleware
export class SecurityAudit {
  private static suspiciousIPs = new Set<string>();
  private static blockedIPs = new Set<string>();
  private static failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
  
  // Monitor for suspicious activity
  static monitorSuspiciousActivity(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      // Common attack patterns
      /\b(union|select|insert|update|delete|drop|create|alter|exec|script|javascript|eval|expression)\b/i,
      // File inclusion attempts
      /\.\.(\/|\\)/,
      // Path traversal
      /\/(etc|proc|sys|boot|dev|root)/,
      // SQL injection patterns
      /['";]|\s+(or|and)\s+/i,
      // XSS patterns
      /<script|javascript:|data:text\/html/i,
      // Command injection
      /[\|;&`$\(\)]/,
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(req.url) || 
      pattern.test(JSON.stringify(req.body || {})) ||
      pattern.test(JSON.stringify(req.query || {}))
    );
    
    if (isSuspicious) {
      SecurityAudit.suspiciousIPs.add(ip);
      DatabaseSecurityLogger.logSecurityEvent('SUSPICIOUS_REQUEST', {
        severity: 'high',
        message: 'Suspicious request pattern detected',
        details: {
          patterns: suspiciousPatterns.map(p => p.source),
          url: req.url,
          method: req.method,
          body: req.body,
          query: req.query
        }
      }, req);
    }
    
    // Check for blocked IPs
    if (SecurityAudit.blockedIPs.has(ip)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  }
  
  // Track failed authentication attempts
  static trackFailedAuth(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';
    const isAuthEndpoint = req.path.includes('/auth') || req.path.includes('/login');
    
    if (isAuthEndpoint && res.statusCode === 401) {
      const attempts = SecurityAudit.failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      attempts.count++;
      attempts.lastAttempt = Date.now();
      
      SecurityAudit.failedAttempts.set(ip, attempts);
      
      // Block IP after 5 failed attempts within 15 minutes
      if (attempts.count >= 5 && Date.now() - attempts.lastAttempt < 15 * 60 * 1000) {
        SecurityAudit.blockedIPs.add(ip);
        DatabaseSecurityLogger.logSecurityEvent('IP_BLOCKED', {
          severity: 'critical',
          message: 'IP blocked due to too many failed authentication attempts',
          details: {
            attempts: attempts.count,
            timeWindow: '15 minutes'
          },
          blocked: true
        }, req);
      }
    }
    
    next();
  }
  
  // Detect potential brute force attacks
  static detectBruteForce(maxAttempts: number = 10, windowMs: number = 5 * 60 * 1000) {
    const attempts = new Map<string, number[]>();
    
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      
      if (!attempts.has(ip)) {
        attempts.set(ip, []);
      }
      
      const ipAttempts = attempts.get(ip)!;
      
      // Remove old attempts outside the window
      const validAttempts = ipAttempts.filter(time => now - time < windowMs);
      
      if (validAttempts.length >= maxAttempts) {
        SecureLogger.logSecurityEvent('BRUTE_FORCE_DETECTED', {
          ip,
          attempts: validAttempts.length,
          windowMs
        }, req);
        
        return res.status(429).json({ 
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      validAttempts.push(now);
      attempts.set(ip, validAttempts);
      
      next();
    };
  }
  
  // Check for common vulnerability scanners
  static detectVulnerabilityScanning(req: Request, res: Response, next: NextFunction) {
    const userAgent = req.get('User-Agent') || '';
    const suspiciousAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /burp/i,
      /zap/i,
      /acunetix/i,
      /nessus/i,
      /openvas/i,
      /masscan/i,
      /dirb/i,
      /gobuster/i,
      /wpscan/i,
      /curl.*python/i,
      /wget/i,
      /scanner/i,
      /vulnerability/i,
      /penetration/i,
      /security.*test/i
    ];
    
    const isSuspiciousAgent = suspiciousAgents.some(pattern => pattern.test(userAgent));
    
    if (isSuspiciousAgent) {
      const ip = req.ip || 'unknown';
      SecurityAudit.suspiciousIPs.add(ip);
      
      DatabaseSecurityLogger.logSecurityEvent('VULNERABILITY_SCANNER_DETECTED', {
        severity: 'critical',
        message: 'Vulnerability scanner detected and blocked',
        details: {
          userAgent,
          url: req.url,
          method: req.method
        },
        blocked: true
      }, req);
      
      // Block known vulnerability scanners
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  }
  
  // Monitor for unusual request patterns
  static monitorRequestPatterns(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || '';
    
    // Check for unusual patterns
    const anomalies = [];
    
    // Check for missing or suspicious user agent
    if (!userAgent || userAgent.length < 10) {
      anomalies.push('suspicious_user_agent');
    }
    
    // Check for unusual request methods
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(req.method)) {
      anomalies.push('unusual_http_method');
    }
    
    // Check for large payloads
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // 100MB
      anomalies.push('large_payload');
    }
    
    // Check for excessive headers
    if (Object.keys(req.headers).length > 50) {
      anomalies.push('excessive_headers');
    }
    
    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
    const hasSuspiciousHeaders = suspiciousHeaders.some(header => 
      req.headers[header] && req.headers[header] !== req.ip
    );
    
    if (hasSuspiciousHeaders) {
      anomalies.push('suspicious_headers');
    }
    
    if (anomalies.length > 0) {
      SecureLogger.logSecurityEvent('REQUEST_ANOMALY', {
        ip,
        userAgent,
        url: req.url,
        method: req.method,
        anomalies
      }, req);
    }
    
    next();
  }
  
  // Generate security report
  static generateSecurityReport() {
    return {
      suspiciousIPs: Array.from(SecurityAudit.suspiciousIPs),
      blockedIPs: Array.from(SecurityAudit.blockedIPs),
      failedAttempts: Object.fromEntries(SecurityAudit.failedAttempts),
      timestamp: new Date().toISOString()
    };
  }
  
  // Clear old data periodically
  static cleanup() {
    const now = Date.now();
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    // Clear failed attempts older than 24 hours
    for (const [ip, attempts] of SecurityAudit.failedAttempts.entries()) {
      if (now - attempts.lastAttempt > cleanupInterval) {
        SecurityAudit.failedAttempts.delete(ip);
      }
    }
    
    // Clear blocked IPs after 24 hours (manual review recommended)
    if (SecurityAudit.blockedIPs.size > 100) {
      SecurityAudit.blockedIPs.clear();
    }
  }
}

// Periodically clean up old security data
setInterval(() => {
  SecurityAudit.cleanup();
}, 60 * 60 * 1000); // Every hour