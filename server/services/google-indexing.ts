import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ServiceAccount } from '@shared/schema';
import { accessTokenService } from './access-token-service';

interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
}

export class GoogleIndexingService {
  private async getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
    // Check if we have a cached token first
    const cachedToken = await accessTokenService.getCachedToken(serviceAccount.id);
    if (cachedToken) {
      console.log('Using cached access token for service account:', serviceAccount.clientEmail);
      return cachedToken;
    }

    console.log('No cached token found, creating new JWT token for:', serviceAccount.clientEmail);
    
    // Create new JWT and get access token
    const serviceAccountCredentials = JSON.parse(serviceAccount.serviceAccountJson);
    
    // Ensure private key has proper newlines (not escaped)
    if (serviceAccountCredentials.private_key?.includes('\\n')) {
      serviceAccountCredentials.private_key = serviceAccountCredentials.private_key.replace(/\\n/g, '\n');
    }
    
    const jwtClient = new JWT({
      email: serviceAccountCredentials.client_email,
      key: serviceAccountCredentials.private_key,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    
    // Exchange JWT for access token
    const tokenResponse = await jwtClient.authorize();
    
    if (!tokenResponse.access_token) {
      throw new Error('Failed to get access token from JWT');
    }

    // Cache the token for future use
    await accessTokenService.storeToken(serviceAccount.id, tokenResponse.access_token);
    
    console.log('New access token created and cached for:', serviceAccount.clientEmail);
    return tokenResponse.access_token;
  }

  private async createAuthClient(serviceAccount: ServiceAccount) {
    try {
      const accessToken = await this.getAccessToken(serviceAccount);
      
      // Create auth client with the access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      console.log('Authentication successful for:', serviceAccount.clientEmail);
      
      return auth;
    } catch (error) {
      console.error('\n=== Error Details ===');
      console.error('Error:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response Data:', error.response.data);
      }
      console.error('Service account keys:', Object.keys(serviceAccount));
      throw error;
    }
  }

  async submitUrlForIndexing(url: string, serviceAccount: ServiceAccount): Promise<IndexingResult> {
    try {
      const authClient = await this.createAuthClient(serviceAccount);
      const indexing = google.indexing({ version: 'v3', auth: authClient });

      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED',
        },
      });

      return {
        url,
        success: true,
      };
    } catch (error: any) {
      console.error(`Failed to index URL ${url}:`, error);
      return {
        url,
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  async submitMultipleUrls(urls: string[], serviceAccount: ServiceAccount): Promise<IndexingResult[]> {
    const results: IndexingResult[] = [];
    
    // Process URLs with rate limiting
    for (const url of urls) {
      const result = await this.submitUrlForIndexing(url, serviceAccount);
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
      serviceAccountJson: serviceAccountJson, // Store the complete JSON
    };
  }
}

export const googleIndexingService = new GoogleIndexingService();
