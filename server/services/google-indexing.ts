import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ServiceAccount } from '@shared/schema';

interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
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

      console.log('\n=== JWT Details ===');
      console.log('Client Email:', serviceAccountData.client_email);
      console.log('Private Key ID:', serviceAccountData.private_key_id);
      console.log('Scope:', 'https://www.googleapis.com/auth/indexing');
      
      // Exchange JWT for access token
      const tokenResponse = await jwtClient.authorize();
      
      console.log('\n=== Raw Token Response ===');
      console.log(tokenResponse);

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
    // Check if we have a valid cached token
    if (serviceAccount.accessToken && serviceAccount.tokenExpiresAt) {
      const expiryTime = new Date(serviceAccount.tokenExpiresAt);
      const now = new Date();
      
      // If token is still valid (with 5-minute buffer), use it
      if (expiryTime.getTime() > now.getTime() + 5 * 60 * 1000) {
        console.log('\n=== Using Cached Token ===');
        console.log('Token expires at:', expiryTime.toISOString());
        console.log('Time remaining:', Math.round((expiryTime.getTime() - now.getTime()) / 1000 / 60), 'minutes');
        
        const auth = new google.auth.OAuth2();
        auth.setCredentials({
          access_token: serviceAccount.accessToken
        });
        return { auth, tokenUpdated: false };
      }
    }

    console.log('\n=== Generating New Token ===');
    console.log('Reason:', !serviceAccount.accessToken ? 'No cached token' : 'Token expired or expiring soon');
    
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
      const indexing = google.indexing({ version: 'v3', auth: authResult.auth });

      // If token was updated and we have a callback to save it
      if (authResult.tokenUpdated && authResult.newToken && authResult.newExpiry && updateTokenCallback) {
        await updateTokenCallback(authResult.newToken, authResult.newExpiry);
        console.log('\n=== Token Cached ===');
        console.log('New token saved to database');
        console.log('Expires at:', authResult.newExpiry.toISOString());
      }

      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED',
        },
      });

      console.log('\n=== Complete API Response ===');
      console.log('Status Code:', response.status);
      console.log('Headers:', JSON.stringify(response.headers, null, 2));
      console.log('Raw Body:', JSON.stringify(response.data, null, 2));

      return {
        url,
        success: true,
      };
    } catch (error: any) {
      console.error(`\n=== Indexing Failed ===`);
      console.error('URL:', url);
      console.error('Error:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('Body:', JSON.stringify(error.response.data, null, 2));
      }
      
      return {
        url,
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Unknown error occurred',
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
