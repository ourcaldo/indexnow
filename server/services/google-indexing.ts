import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ServiceAccount } from '@shared/schema';

interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
}

export class GoogleIndexingService {
  private async createAuthClient(serviceAccount: ServiceAccount) {
    // Use JWT library directly for better control over the authentication process
    const client = new JWT({
      email: serviceAccount.clientEmail,
      key: serviceAccount.privateKey,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    // Authorize to get the access token
    await client.authorize();
    
    console.log('JWT authentication successful for:', serviceAccount.clientEmail);
    
    return client;
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
    
    // Ensure the private key is properly formatted
    let privateKey = parsed.private_key;
    
    // Clean up the private key if it has escape sequences
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    return {
      projectId: parsed.project_id,
      privateKeyId: parsed.private_key_id,
      privateKey: privateKey,
      clientEmail: parsed.client_email,
      clientId: parsed.client_id,
    };
  }
}

export const googleIndexingService = new GoogleIndexingService();
