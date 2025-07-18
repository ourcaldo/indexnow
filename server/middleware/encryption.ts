import crypto from 'crypto';

// Encryption for sensitive data at rest
export class EncryptionService {
  private static readonly algorithm = 'aes-256-gcm';
  private static readonly keyLength = 32; // 256 bits
  private static readonly ivLength = 16; // 128 bits
  private static readonly tagLength = 16; // 128 bits
  
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Create a 32-byte key from the environment variable
    return crypto.scryptSync(key, 'salt', this.keyLength);
  }
  
  static encrypt(text: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('google-indexing-service'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }
  
  static decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const parts = encryptedData.split(':');
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('google-indexing-service'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }
  
  // Hash passwords or sensitive data
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  // Generate secure random tokens
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  // Verify data integrity
  static createHmac(data: string, secret?: string): string {
    const key = secret || process.env.HMAC_SECRET || 'default-secret';
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }
  
  static verifyHmac(data: string, hmac: string, secret?: string): boolean {
    const expectedHmac = this.createHmac(data, secret);
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  }
}

// Service account JSON encryption helper
export function encryptServiceAccountJson(serviceAccountJson: string): string {
  return EncryptionService.encrypt(serviceAccountJson);
}

export function decryptServiceAccountJson(encryptedData: string): string {
  return EncryptionService.decrypt(encryptedData);
}

// Secure token storage
export function encryptAccessToken(token: string): string {
  return EncryptionService.encrypt(token);
}

export function decryptAccessToken(encryptedToken: string): string {
  return EncryptionService.decrypt(encryptedToken);
}