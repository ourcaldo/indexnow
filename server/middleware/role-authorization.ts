import { Request, Response, NextFunction } from 'express';
import { UserRole, hasPermission } from '../../shared/schema.js';

// Extend Express Request type to include user role
declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole;
    }
  }
}

/**
 * Middleware to check if user has required role permissions
 * Usage: app.get('/admin-route', requireRole('admin'), handler)
 */
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      return res.status(401).json({ 
        error: 'User role not found in request. Please authenticate first.' 
      });
    }
    
    if (!hasPermission(userRole, requiredRole)) {
      return res.status(403).json({ 
        error: `Access denied. Required role: ${requiredRole}, your role: ${userRole}` 
      });
    }
    
    next();
  };
}

/**
 * Middleware to check if user is admin or super_admin
 */
export function requireAdmin() {
  return requireRole('admin');
}

/**
 * Middleware to check if user is super_admin
 */
export function requireSuperAdmin() {
  return requireRole('super_admin');
}

/**
 * Helper function to add user role to request from database lookup
 * This should be called after user authentication
 */
export async function addUserRoleToRequest(req: Request, userId: string) {
  try {
    const { storage } = await import('../storage');
    const user = await storage.getUserProfile(userId);
    
    if (user) {
      (req as any).userRole = user.role;
      // Only log in development mode to reduce noise
      if (process.env.NODE_ENV === 'development') {
        console.log(`Added role '${user.role}' for user ${userId} to request`);
      }
    } else {
      // Default to 'user' role if profile not found
      (req as any).userRole = 'user';
      if (process.env.NODE_ENV === 'development') {
        console.log(`User profile not found for ${userId}, defaulting to 'user' role`);
      }
    }
  } catch (error) {
    console.error('Failed to add user role to request:', error);
    // Default to 'user' role on error to prevent authorization bypass
    (req as any).userRole = 'user';
  }
}