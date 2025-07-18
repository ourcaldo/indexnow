import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { db } from './supabase';
import { userProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { SecurityAnalyticsService } from './security-analytics';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  jti: string; // JWT ID for blacklisting
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface RefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsed: Date;
  isRevoked: boolean;
}

export class JWTAuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-this';
  private static readonly JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
  private static readonly REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
  
  // In-memory storage for blacklisted tokens (in production, use Redis)
  private static blacklistedTokens = new Set<string>();
  private static refreshTokens = new Map<string, RefreshTokenData>();

  /**
   * Generate access token and refresh token pair
   */
  static async generateTokenPair(userId: string, email: string, role: string = 'user'): Promise<TokenPair> {
    const jti = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    
    // Create access token
    const accessTokenPayload: JWTPayload = {
      userId,
      email,
      role,
      iat: now,
      exp: now + this.parseExpiry(this.JWT_EXPIRY),
      jti
    };

    const accessToken = jwt.sign(accessTokenPayload, this.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: this.JWT_EXPIRY
    });

    // Create refresh token
    const refreshTokenPayload = {
      userId,
      type: 'refresh',
      jti: randomBytes(16).toString('hex')
    };

    const refreshToken = jwt.sign(refreshTokenPayload, this.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: this.REFRESH_TOKEN_EXPIRY
    });

    // Store refresh token data
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(now * 1000 + this.parseExpiry(this.REFRESH_TOKEN_EXPIRY) * 1000);
    
    this.refreshTokens.set(refreshTokenHash, {
      userId,
      tokenHash: refreshTokenHash,
      expiresAt,
      createdAt: new Date(),
      lastUsed: new Date(),
      isRevoked: false
    });

    return {
      accessToken,
      refreshToken,
      expiresAt: accessTokenPayload.exp * 1000
    };
  }

  /**
   * Verify and decode access token
   */
  static async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      // Check if token is blacklisted
      const decoded = jwt.decode(token) as JWTPayload;
      if (decoded?.jti && this.blacklistedTokens.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Verify token signature and expiry
      const payload = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      
      // Additional validation
      if (!payload.userId || !payload.email) {
        throw new Error('Invalid token payload');
      }

      // Check if user still exists and is active
      const user = await db.select().from(userProfiles).where(eq(userProfiles.id, payload.userId)).limit(1);
      if (!user.length) {
        throw new Error('User not found');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else {
        throw error;
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.JWT_SECRET) as any;
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      // Check if refresh token exists and is valid
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const storedRefreshToken = this.refreshTokens.get(refreshTokenHash);
      
      if (!storedRefreshToken || storedRefreshToken.isRevoked) {
        throw new Error('Refresh token not found or revoked');
      }

      if (storedRefreshToken.expiresAt < new Date()) {
        this.refreshTokens.delete(refreshTokenHash);
        throw new Error('Refresh token expired');
      }

      // Get user data
      const user = await db.select().from(userProfiles).where(eq(userProfiles.id, payload.userId)).limit(1);
      if (!user.length) {
        throw new Error('User not found');
      }

      // Update last used
      storedRefreshToken.lastUsed = new Date();

      // Generate new token pair
      const newTokenPair = await this.generateTokenPair(
        user[0].id,
        user[0].email,
        user[0].role
      );

      // Revoke old refresh token
      this.refreshTokens.delete(refreshTokenHash);

      return newTokenPair;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else {
        throw error;
      }
    }
  }

  /**
   * Revoke access token by adding to blacklist
   */
  static async revokeAccessToken(token: string): Promise<void> {
    try {
      const payload = jwt.decode(token) as JWTPayload;
      if (payload?.jti) {
        this.blacklistedTokens.add(payload.jti);
      }
    } catch (error) {
      // Token might be invalid, but we still want to log the attempt
      console.warn('Failed to revoke token:', error.message);
    }
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const storedRefreshToken = this.refreshTokens.get(refreshTokenHash);
      
      if (storedRefreshToken) {
        storedRefreshToken.isRevoked = true;
      }
    } catch (error) {
      console.warn('Failed to revoke refresh token:', error.message);
    }
  }

  /**
   * Revoke all tokens for a user
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    // Revoke all refresh tokens for user
    for (const [hash, tokenData] of this.refreshTokens.entries()) {
      if (tokenData.userId === userId) {
        tokenData.isRevoked = true;
      }
    }

    // Log security event
    await SecurityAnalyticsService.logSecurityEvent({
      event_type: 'TOKEN_REVOKE_ALL',
      severity: 'MEDIUM',
      user_id: userId,
      details: { reason: 'All tokens revoked for user' }
    });
  }

  /**
   * Clean up expired tokens
   */
  static cleanupExpiredTokens(): void {
    const now = new Date();
    
    // Clean up expired refresh tokens
    for (const [hash, tokenData] of this.refreshTokens.entries()) {
      if (tokenData.expiresAt < now) {
        this.refreshTokens.delete(hash);
      }
    }

    // Clean up blacklisted tokens older than max JWT expiry
    // This is a simple implementation - in production, use Redis with TTL
    const maxJwtAge = this.parseExpiry(this.JWT_EXPIRY) * 1000;
    const cutoffTime = now.getTime() - maxJwtAge;
    
    for (const jti of this.blacklistedTokens) {
      // This is a simplified cleanup - in production, store timestamp with blacklisted tokens
      // For now, we'll periodically clear all blacklisted tokens
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private static parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 24 * 60 * 60; // Default to 24 hours
    }
  }

  /**
   * Get token statistics
   */
  static getTokenStats(): {
    activeRefreshTokens: number;
    blacklistedTokens: number;
    expiredTokens: number;
  } {
    const now = new Date();
    let expiredTokens = 0;
    
    for (const tokenData of this.refreshTokens.values()) {
      if (tokenData.expiresAt < now) {
        expiredTokens++;
      }
    }

    return {
      activeRefreshTokens: this.refreshTokens.size - expiredTokens,
      blacklistedTokens: this.blacklistedTokens.size,
      expiredTokens
    };
  }
}

// Cleanup expired tokens every hour
setInterval(() => {
  JWTAuthService.cleanupExpiredTokens();
}, 60 * 60 * 1000);