import { google } from 'googleapis';
import { ServiceAccount } from '@shared/schema';

interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
}

export class GoogleIndexingService {
  private async createAuthClient(serviceAccount: ServiceAccount) {
    // The private key from database should already be properly formatted
    // Just ensure it's clean and properly formatted for JWT signing
    const privateKey = serviceAccount.privateKey.trim();

    const credentials = {
      type: 'service_account',
      project_id: serviceAccount.projectId,
      private_key_id: serviceAccount.privateKeyId,
      private_key: privateKey,
      client_email: serviceAccount.clientEmail,
      client_id: serviceAccount.clientId,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(serviceAccount.clientEmail)}`,
      universe_domain: 'googleapis.com'
    };

    // Debug: Log the first and last few characters to verify format
    console.log('Private key format check:', {
      starts_with: privateKey.substring(0, 27),
      ends_with: privateKey.substring(privateKey.length - 25),
      has_newlines: privateKey.includes('\n'),
      length: privateKey.length
    });

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    return auth.getClient();
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
