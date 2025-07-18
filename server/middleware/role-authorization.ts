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
    // This will be implemented when we add role checking to auth middleware
    // For now, this is a placeholder structure
    
    // Example implementation:
    // const user = await getUserById(userId);
    // req.userRole = user.role;
    
    console.log(`Adding role for user ${userId} to request`);
  } catch (error) {
    console.error('Failed to add user role to request:', error);
  }
}