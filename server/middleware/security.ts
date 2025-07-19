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
  
  // Content Security Policy (basic for SPA) - using environment variable
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).origin : 'https://supabase.co';
  
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    `connect-src 'self' ${supabaseDomain} ${supabaseDomain.replace('https:', 'wss:')}; ` +
    "frame-ancestors 'none';"
  );
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
}

// Rate limiting for API endpoints with cleanup
const apiCallCounts = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of apiCallCounts.entries()) {
    if (now > data.resetTime) {
      apiCallCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'LOGO_URL',
    'ICON_URL',
    'FAVICON_URL'
  ];

  const recommendedEnvVars = [
    'ENCRYPTION_KEY',
    'MAX_DB_CONNECTIONS',
    'DB_CONNECTION_TIMEOUT',
    'ADMIN_EMAILS'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('Please check your .env file and ensure all required variables are set');
    process.exit(1);
  }
  
  // Validate URLs
  const urlVars = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'LOGO_URL', 'ICON_URL', 'FAVICON_URL'];
  for (const varName of urlVars) {
    const value = process.env[varName];
    if (value && !isValidUrl(value)) {
      console.error(`❌ Invalid URL format for ${varName}: ${value}`);
      process.exit(1);
    }
  }
  
  // Validate CORS origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    const origins = allowedOrigins.split(',');
    for (const origin of origins) {
      if (!isValidUrl(origin.trim())) {
        console.error(`❌ Invalid origin URL in ALLOWED_ORIGINS: ${origin}`);
        process.exit(1);
      }
    }
  }
  
  console.log('✅ All required environment variables are present and valid');
  
  // Check for recommended security variables
  const missingRecommended = recommendedEnvVars.filter(varName => !process.env[varName]);
  if (missingRecommended.length > 0) {
    console.warn('⚠️  Missing recommended security environment variables:', missingRecommended);
    console.warn('   These are required for P0 security fixes. Add them to your .env file.');
  } else {
    console.log('✅ All recommended security environment variables are present');
  }
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
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