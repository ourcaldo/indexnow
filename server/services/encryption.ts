import crypto from 'crypto';

export class EncryptionService {
  private static algorithm = 'aes-256-gcm';
  private static keyLength = 32; // 256 bits
  
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // If key is base64 encoded, decode it
    if (key.length === 44 && key.endsWith('=')) {
      return Buffer.from(key, 'base64');
    }
    
    // If key is hex encoded, convert to buffer
    if (key.length === 64) {
      return Buffer.from(key, 'hex');
    }
    
    // Otherwise, create a hash of the key to ensure proper length
    return crypto.createHash('sha256').update(key).digest();
  }

  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(16); // 128 bits IV
      
      const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from('access_token', 'utf8')); // Additional authenticated data
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    try {
      const key = this.getEncryptionKey();
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = crypto.createDecipherGCM(this.algorithm, key, iv);
      decipher.setAAD(Buffer.from('access_token', 'utf8'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt token');
    }
  }

  static generateKey(): string {
    // Generate a secure 256-bit key
    const key = crypto.randomBytes(this.keyLength);
    return key.toString('base64');
  }

  // Helper method to safely encrypt access token for database storage
  static encryptAccessToken(token: string): string {
    const encrypted = this.encrypt(token);
    return JSON.stringify(encrypted);
  }

  // Helper method to safely decrypt access token from database
  static decryptAccessToken(encryptedToken: string): string {
    const encrypted = JSON.parse(encryptedToken);
    return this.decrypt(encrypted);
  }
}