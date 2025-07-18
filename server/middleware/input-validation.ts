import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Input sanitization helpers
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove potential XSS payloads
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/expression\s*\(/gi, '')
    .trim();
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  
  // Only allow http/https URLs
  if (!url.match(/^https?:\/\//)) {
    return '';
  }
  
  // Prevent data URIs and other suspicious schemes
  const suspiciousSchemes = ['data:', 'javascript:', 'vbscript:', 'file:', 'ftp:'];
  for (const scheme of suspiciousSchemes) {
    if (url.toLowerCase().startsWith(scheme)) {
      return '';
    }
  }
  
  return url.trim();
}

// UUID validation middleware
export function validateUuid(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const uuidSchema = z.string().uuid();
    const paramValue = req.params[paramName];
    
    if (!uuidSchema.safeParse(paramValue).success) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
    
    next();
  };
}

// Input sanitization middleware
export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    const sanitized = sanitizeObject(req.body);
    req.body = sanitized;
  }
  
  if (req.query && typeof req.query === 'object') {
    const sanitized = sanitizeObject(req.query);
    req.query = sanitized;
  }
  
  next();
}

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (key.toLowerCase().includes('url')) {
        sanitized[key] = sanitizeUrl(value);
      } else {
        sanitized[key] = sanitizeString(value);
      }
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Service account JSON validation
export function validateServiceAccountJson(serviceAccountJson: string): boolean {
  try {
    const parsed = JSON.parse(serviceAccountJson);
    
    // Required fields for Google service account
    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id',
      'auth_uri',
      'token_uri'
    ];
    
    for (const field of requiredFields) {
      if (!parsed[field]) {
        return false;
      }
    }
    
    // Validate type is service_account
    if (parsed.type !== 'service_account') {
      return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parsed.client_email)) {
      return false;
    }
    
    // Validate private key format
    if (!parsed.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// File upload validation
export function validateFileUpload(maxSize: number = 5 * 1024 * 1024) { // 5MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({ error: 'File too large' });
    }
    
    next();
  };
}

// SQL injection prevention (though Drizzle ORM already protects us)
export function validateSqlInjection(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /UNION(?:\s+ALL)?\s+SELECT/i,
    /INSERT(?:\s+INTO)?\s+/i,
    /UPDATE(?:\s+\w+)?\s+SET/i,
    /DELETE(?:\s+FROM)?\s+/i,
    /DROP(?:\s+TABLE)?\s+/i,
    /ALTER(?:\s+TABLE)?\s+/i,
    /CREATE(?:\s+TABLE)?\s+/i
  ];
  
  const checkForSqlInjection = (str: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  
  const checkObject = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkForSqlInjection(obj);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        return obj.some(item => checkObject(item));
      }
      
      return Object.values(obj).some(value => checkObject(value));
    }
    
    return false;
  };
  
  if (req.body && checkObject(req.body)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  if (req.query && checkObject(req.query)) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }
  
  next();
}