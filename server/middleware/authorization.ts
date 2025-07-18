import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Resource ownership verification middleware
export function requireOwnership(resourceType: 'service-account' | 'indexing-job' | 'url-submission') {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const resourceId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!resourceId) {
        return res.status(400).json({ error: 'Resource ID required' });
      }
      
      let isOwner = false;
      
      switch (resourceType) {
        case 'service-account':
          const accounts = await storage.getServiceAccounts(userId);
          isOwner = accounts.some(acc => acc.id === resourceId);
          break;
          
        case 'indexing-job':
          const jobs = await storage.getIndexingJobs(userId);
          isOwner = jobs.some(job => job.id === resourceId);
          break;
          
        case 'url-submission':
          // For URL submissions, check if the job belongs to the user
          const submission = await storage.getUrlSubmissions(resourceId);
          if (submission.length > 0) {
            const job = await storage.getIndexingJob(submission[0].jobId);
            isOwner = job?.userId === userId;
          }
          break;
      }
      
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied: Resource not found or not owned by user' });
      }
      
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

// Admin-only access (for future admin features)
export function requireAdmin(req: any, res: Response, next: NextFunction) {
  const userEmail = req.user?.email;
  
  // Define admin emails (in production, this should be in environment variables)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  
  if (!adminEmails.includes(userEmail)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

// Rate limiting per user
const userRateLimits = new Map<string, { count: number; resetTime: number }>();

export function rateLimitPerUser(maxRequests: number = 50, windowMs: number = 15 * 60 * 1000) {
  return (req: any, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const now = Date.now();
    const userData = userRateLimits.get(userId);
    
    if (!userData || now > userData.resetTime) {
      userRateLimits.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (userData.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((userData.resetTime - now) / 1000)
      });
    }
    
    userData.count++;
    next();
  };
}

// Content Security Policy validation
export function validateContentSecurityPolicy(req: Request, res: Response, next: NextFunction) {
  // Check for suspicious file uploads or content types
  const contentType = req.headers['content-type'];
  
  if (contentType) {
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain'
    ];
    
    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      return res.status(415).json({ error: 'Unsupported media type' });
    }
  }
  
  next();
}

// CSRF protection for state-changing operations
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (methods.includes(req.method)) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    
    // In production, implement proper CSRF token validation
    // For now, we'll just check origin header
    if (!origin || !host) {
      return res.status(403).json({ error: 'Invalid request origin' });
    }
  }
  
  next();
}