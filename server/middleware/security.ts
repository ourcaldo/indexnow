import type { Request, Response, NextFunction } from "express";

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy for privacy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic for SPA)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://bwkasvyrzbzhcdtvsbyg.supabase.co wss://bwkasvyrzbzhcdtvsbyg.supabase.co; " +
    "frame-ancestors 'none';"
  );
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
}

// Rate limiting for API endpoints
const apiCallCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = apiCallCounts.get(clientIp);
    
    if (!clientData || now > clientData.resetTime) {
      apiCallCounts.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }
    
    clientData.count++;
    next();
  };
}

// Environment validation
export function validateEnvironment() {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'DATABASE_URL'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

// Sanitize sensitive data from logs
export function sanitizeLogsMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data: any) {
    // Don't log response data that might contain sensitive information
    if (req.path.includes('/api/service-accounts') || req.path.includes('/api/auth')) {
      console.log(`${req.method} ${req.path} - ${res.statusCode} [Response data sanitized]`);
    }
    return originalSend.call(this, data);
  };
  
  res.json = function(data: any) {
    // Don't log response data that might contain sensitive information
    if (req.path.includes('/api/service-accounts') || req.path.includes('/api/auth')) {
      console.log(`${req.method} ${req.path} - ${res.statusCode} [Response data sanitized]`);
    }
    return originalJson.call(this, data);
  };
  
  next();
}