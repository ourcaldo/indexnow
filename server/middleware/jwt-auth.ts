import type { Request, Response, NextFunction } from "express";
import { JWTAuthService } from "../services/jwt-auth";
import { SecureLogger } from "./secure-logging";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  jwtPayload?: {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
    jti: string;
  };
}

/**
 * Middleware to require authentication using JWT tokens
 */
export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      SecureLogger.logSecurityEvent('AUTH_MISSING_HEADER', { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      }, req);
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.substring(7);
    
    // Validate token using JWT service
    const jwtPayload = await JWTAuthService.verifyAccessToken(token);
    
    // Set user information on request
    req.user = {
      id: jwtPayload.userId,
      email: jwtPayload.email,
      role: jwtPayload.role
    };
    req.jwtPayload = jwtPayload;
    
    next();
  } catch (error) {
    SecureLogger.logSecurityEvent('AUTH_INVALID_TOKEN', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'), 
      error: error.message,
      tokenPresent: !!req.headers.authorization,
      path: req.path,
      method: req.method
    }, req);
    
    // Return specific error messages for different failure types
    if (error.message === 'Token expired') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    } else if (error.message === 'Token has been revoked') {
      return res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
    } else if (error.message === 'User not found') {
      return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    } else {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
  }
};

/**
 * Middleware to require specific roles
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      SecureLogger.logSecurityEvent('AUTH_INSUFFICIENT_ROLE', { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'),
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      }, req);
      
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * Middleware to require super admin role
 */
export const requireSuperAdmin = requireRole(['super_admin']);

/**
 * Optional auth middleware - allows both authenticated and anonymous access
 */
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No auth header, continue without user
    }

    const token = authHeader.substring(7);
    const jwtPayload = await JWTAuthService.verifyAccessToken(token);
    
    req.user = {
      id: jwtPayload.userId,
      email: jwtPayload.email,
      role: jwtPayload.role
    };
    req.jwtPayload = jwtPayload;
    
    next();
  } catch (error) {
    // If token is invalid, continue without user (don't block the request)
    next();
  }
};