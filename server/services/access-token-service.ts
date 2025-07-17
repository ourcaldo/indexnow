import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';
import { storage } from '../storage';
import { type AccessToken, type InsertAccessToken } from '@shared/schema';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-here-must-be-32-chars';
const ALGORITHM = 'aes-256-cbc';
const ITERATION_COUNT = 10000;

class AccessTokenService {
  private deriveKey(password: string, salt: Buffer): Buffer {
    return pbkdf2Sync(password, salt, ITERATION_COUNT, 32, 'sha256');
  }

  private encrypt(text: string): string {
    const salt = randomBytes(16);
    const key = this.deriveKey(ENCRYPTION_KEY, salt);
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine salt, iv, and encrypted data
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = this.deriveKey(ENCRYPTION_KEY, salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async getCachedToken(serviceAccountId: string): Promise<string | null> {
    try {
      const tokenRecord = await storage.getCachedAccessToken(serviceAccountId);

      if (!tokenRecord) {
        return null;
      }

      return this.decrypt(tokenRecord.encryptedToken);
    } catch (error) {
      console.error('Error retrieving cached token:', error);
      return null;
    }
  }

  async storeToken(serviceAccountId: string, token: string): Promise<void> {
    try {
      const encryptedToken = this.encrypt(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes from now

      await storage.storeAccessToken({
        serviceAccountId,
        encryptedToken,
        expiresAt,
      });
    } catch (error) {
      console.error('Error storing token:', error);
      throw error;
    }
  }

  async invalidateToken(serviceAccountId: string): Promise<void> {
    try {
      await storage.invalidateAccessToken(serviceAccountId);
    } catch (error) {
      console.error('Error invalidating token:', error);
      throw error;
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      await storage.cleanupExpiredTokens();
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  }
}

export const accessTokenService = new AccessTokenService();