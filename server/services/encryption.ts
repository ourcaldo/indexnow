import crypto from 'crypto';

export class EncryptionService {
  private static algorithm = 'aes-256-cbc';
  private static keyLength = 32; // 256 bits
  
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // The key from env is base64 encoded (h2mMbDrURT6kd/kG2G0kCJijh0EdApsQp1zjBvciiSA=)
    // Decode it directly from base64
    return Buffer.from(key, 'base64');
  }

  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(16); // 128 bits IV
      
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: 'cbc-mode' // CBC mode doesn't use auth tags, but we need a non-empty value for database
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
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
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