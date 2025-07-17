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
    try {
      let serviceAccountCredentials;
      
      // Handle both old and new database formats
      console.log('=== Service Account Debug ===');
      console.log('Service Account Object Keys:', Object.keys(serviceAccount));
      console.log('Has serviceAccountJson:', !!serviceAccount.serviceAccountJson);
      console.log('Has privateKey:', !!(serviceAccount as any).privateKey);
      console.log('Has privateKeyId:', !!(serviceAccount as any).privateKeyId);
      console.log('Has clientId:', !!(serviceAccount as any).clientId);
      
      if (serviceAccount.serviceAccountJson) {
        // New format: complete JSON stored in serviceAccountJson field
        serviceAccountCredentials = JSON.parse(serviceAccount.serviceAccountJson);
        console.log('Using new format - complete service account JSON');
      } else {
        // Old format: individual fields in database - reconstruct the service account object
        console.log('Using old format - reconstructing service account from individual fields');
        serviceAccountCredentials = {
          type: 'service_account',
          project_id: serviceAccount.projectId,
          private_key_id: (serviceAccount as any).privateKeyId,
          private_key: (serviceAccount as any).privateKey,
          client_email: serviceAccount.clientEmail,
          client_id: (serviceAccount as any).clientId,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(serviceAccount.clientEmail)}`,
          universe_domain: 'googleapis.com'
        };
      }
      
      console.log('\n=== JWT Details ===');
      console.log('Client Email:', serviceAccountCredentials.client_email);
      console.log('Private Key ID:', serviceAccountCredentials.private_key_id);
      console.log('Project ID:', serviceAccountCredentials.project_id);
      console.log('Private key starts with:', serviceAccountCredentials.private_key?.substring(0, 50) + '...');
      console.log('Private key ends with:', serviceAccountCredentials.private_key?.substring(serviceAccountCredentials.private_key.length - 50) + '...');
      console.log('Has proper line breaks:', serviceAccountCredentials.private_key?.includes('\n'));
      console.log('Service account structure:', JSON.stringify(serviceAccountCredentials, null, 2).substring(0, 200) + '...');
      
      // Ensure private key has proper newlines (not escaped)
      if (serviceAccountCredentials.private_key?.includes('\\n')) {
        serviceAccountCredentials.private_key = serviceAccountCredentials.private_key.replace(/\\n/g, '\n');
        console.log('Fixed escaped newlines in private key');
      }
      
      // Use the exact same approach as your working local example
      const jwtClient = new JWT({
        email: serviceAccountCredentials.client_email,
        key: serviceAccountCredentials.private_key,
        scopes: ['https://www.googleapis.com/auth/indexing'],
      });
      
      // Exchange JWT for access token (same as your working example)
      const tokenResponse = await jwtClient.authorize();
      
      console.log('\n=== Raw Token Response ===');
      console.log('Access token starts with:', tokenResponse.access_token?.substring(0, 50) + '...');
      console.log('Token type:', tokenResponse.token_type);
      console.log('Expiry date:', new Date(tokenResponse.expiry_date));
      
      if (!tokenResponse || !tokenResponse.access_token) {
        throw new Error('Invalid token response - missing access_token');
      }
      
      console.log('JWT authentication successful for:', serviceAccountCredentials.client_email);
      
      return jwtClient;
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
