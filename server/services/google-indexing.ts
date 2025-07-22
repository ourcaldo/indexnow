import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ServiceAccount } from '@shared/schema';
import { EncryptionService } from './encryption';

interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
  isQuotaExceeded?: boolean;
}

interface TokenResponse {
  accessToken: string;
  expiryDate: Date;
  tokenType: string;
  refreshToken?: string;
}

export class GoogleIndexingService {
  private async getAccessToken(serviceAccount: ServiceAccount): Promise<TokenResponse> {
    try {
      // Parse the service account JSON
      const serviceAccountData = JSON.parse(serviceAccount.serviceAccountJson);
      
      // Create JWT client
      const jwtClient = new JWT({
        email: serviceAccountData.client_email,
        key: serviceAccountData.private_key,
        scopes: ['https://www.googleapis.com/auth/indexing'],
      });

      // Debug logging only in development
      if (process.env.NODE_ENV === 'development') {
        console.log('\n=== JWT Details ===');
        console.log('Client Email:', serviceAccountData.client_email);
        console.log('Private Key ID:', serviceAccountData.private_key_id);
        console.log('Scope:', 'https://www.googleapis.com/auth/indexing');
      }
      
      // Exchange JWT for access token
      const tokenResponse = await jwtClient.authorize();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n=== Raw Token Response ===');
        console.log(tokenResponse);
      }

      if (!tokenResponse || !tokenResponse.access_token) {
        throw new Error('Invalid token response - missing access_token');
      }

      return {
        accessToken: tokenResponse.access_token,
        expiryDate: new Date(tokenResponse.expiry_date),
        tokenType: tokenResponse.token_type,
        refreshToken: tokenResponse.refresh_token,
      };
    } catch (error: any) {
      console.error('\n=== Error Details ===');
      console.error('Error:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response Data:', error.response.data);
      }
      throw error;
    }
  }

  private async createAuthClient(serviceAccount: ServiceAccount) {
    // Check if we have a valid cached token (try encrypted first, then plain text)
    let cachedToken = null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=== Service Account Debug ===');
      console.log('Service Account ID:', serviceAccount.id);
      console.log('Has accessTokenEncrypted:', !!serviceAccount.accessTokenEncrypted);
      console.log('Has encryptionIv:', !!serviceAccount.encryptionIv);
      console.log('Has encryptionTag:', !!serviceAccount.encryptionTag);
      console.log('Has plain accessToken:', !!serviceAccount.accessToken);
      console.log('Token expires at:', serviceAccount.tokenExpiresAt);
    }
    
    // Try to get encrypted token first - check for encrypted token and IV (tag can be empty for CBC mode)
    if (serviceAccount.accessTokenEncrypted && serviceAccount.encryptionIv) {
      try {
        cachedToken = EncryptionService.decrypt({
          encrypted: serviceAccount.accessTokenEncrypted,
          iv: serviceAccount.encryptionIv,
          tag: serviceAccount.encryptionTag
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Successfully decrypted cached token');
        }
      } catch (error) {
        console.warn('❌ Failed to decrypt token:', error.message);
        console.warn('❌ This means encryptionTag is missing or corrupted - will generate new token');
        cachedToken = null; // Force new token generation instead of falling back to plain text
      }
    } else if (serviceAccount.accessToken) {
      // Fall back to plain text token for backward compatibility
      cachedToken = serviceAccount.accessToken;
      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Using plain text cached token (will be encrypted on next update)');
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ NO CACHED TOKEN FOUND - will generate new token');
      }
    }
    
    if (cachedToken && serviceAccount.tokenExpiresAt) {
      const expiryTime = new Date(serviceAccount.tokenExpiresAt);
      const now = new Date();
      
      // If token is still valid (with 5-minute buffer), use it
      if (expiryTime.getTime() > now.getTime() + 5 * 60 * 1000) {
        if (process.env.NODE_ENV === 'development') {
        console.log('\n=== Using Cached Token ===');
        console.log('Token expires at:', expiryTime.toISOString());
        console.log('Time remaining:', Math.round((expiryTime.getTime() - now.getTime()) / 1000 / 60), 'minutes');
      }
        
        const auth = new google.auth.OAuth2();
        auth.setCredentials({
          access_token: cachedToken
        });
        return { auth, tokenUpdated: false, newToken: undefined, newExpiry: undefined };
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('\n=== Generating New Token ===');
      console.log('Reason:', !cachedToken ? 'No cached token' : 'Token expired or expiring soon');
    }
    
    // Generate new token
    const tokenInfo = await this.getAccessToken(serviceAccount);
    
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: tokenInfo.accessToken
    });
    
    return { 
      auth, 
      tokenUpdated: true, 
      newToken: tokenInfo.accessToken,
      newExpiry: tokenInfo.expiryDate
    };
  }

  async submitUrlForIndexing(url: string, serviceAccount: ServiceAccount, updateTokenCallback?: (token: string, expiry: Date) => Promise<void>): Promise<IndexingResult> {
    try {
      const authResult = await this.createAuthClient(serviceAccount);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n=== Auth Result Debug ===');
        console.log('tokenUpdated:', authResult.tokenUpdated);
        console.log('hasNewToken:', !!authResult.newToken);
        console.log('hasNewExpiry:', !!authResult.newExpiry);
        console.log('hasCallback:', !!updateTokenCallback);
      }
      
      const indexing = google.indexing({ version: 'v3', auth: authResult.auth });

      // If token was updated and we have a callback to save it
      if (authResult.tokenUpdated && authResult.newToken && authResult.newExpiry && updateTokenCallback) {
        if (process.env.NODE_ENV === 'development') {
          console.log('\n=== Calling Token Update Callback ===');
        }
        await updateTokenCallback(authResult.newToken, authResult.newExpiry);
        if (process.env.NODE_ENV === 'development') {
          console.log('Token update callback completed');
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.log('\n=== Token Update Skipped ===');
        console.log('Conditions not met for token update');
      }

      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED',
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('\n=== Complete API Response ===');
        console.log('Status Code:', response.status);
        console.log('Headers:', JSON.stringify(response.headers, null, 2));
        console.log('Raw Body:', JSON.stringify(response.data, null, 2));
      }

      return {
        url,
        success: true,
      };
    } catch (error: any) {
      // Always log errors, but less verbose in production
      if (process.env.NODE_ENV === 'development') {
        console.error(`\n=== Indexing Failed ===`);
        console.error('URL:', url);
        console.error('Error:', error.message);
        
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
          console.error('Body:', JSON.stringify(error.response.data, null, 2));
        }
      } else {
        console.error(`Indexing failed for URL: ${url} - ${error.message}`);
      }
      
      // Detect quota exceeded responses
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error occurred';
      const isQuotaExceeded = errorMessage.toLowerCase().includes('quota') || 
                             errorMessage.toLowerCase().includes('limit') ||
                             error.response?.status === 429;

      return {
        url,
        success: false,
        error: errorMessage,
        isQuotaExceeded
      };
    }
  }

  async submitMultipleUrls(urls: string[], serviceAccount: ServiceAccount, updateTokenCallback?: (token: string, expiry: Date) => Promise<void>): Promise<IndexingResult[]> {
    const results: IndexingResult[] = [];
    
    // Process URLs with rate limiting
    for (const url of urls) {
      const result = await this.submitUrlForIndexing(url, serviceAccount, updateTokenCallback);
      results.push(result);
      
      // Add delay to respect rate limits (60 requests per minute = 1 per second)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  async getQuotaUsage(serviceAccount: ServiceAccount): Promise<{ remaining: number; limit: number }> {
    try {
      const authClient = await this.createAuthClient(serviceAccount);
      const indexing = google.indexing({ version: 'v3', auth: authClient });

      // Note: Google Indexing API doesn't provide quota information directly
      // We'll track usage in our database instead
      return {
        remaining: serviceAccount.dailyQuotaLimit || 200,
        limit: serviceAccount.dailyQuotaLimit || 200,
      };
    } catch (error) {
      console.error('Failed to get quota usage:', error);
      throw error;
    }
  }

  validateServiceAccount(serviceAccountJson: string): boolean {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      const requiredFields = [
        'type',
        'project_id',
        'private_key_id',
        'private_key',
        'client_email',
        'client_id',
      ];

      return requiredFields.every(field => field in parsed) && parsed.type === 'service_account';
    } catch {
      return false;
    }
  }

  parseServiceAccount(serviceAccountJson: string) {
    const parsed = JSON.parse(serviceAccountJson);
    
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      serviceAccountJson: serviceAccountJson,
    };
  }
}

export const googleIndexingService = new GoogleIndexingService();
