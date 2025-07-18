export interface AssetConfig {
  logoUrl: string;
  iconUrl: string;
  faviconUrl: string;
  siteUrl: string;
  allowedOrigins: string[];
}

export class AssetConfigService {
  private config: AssetConfig;

  constructor() {
    this.config = this.validateAndLoadConfig();
  }

  private validateAndLoadConfig(): AssetConfig {
    const required = ['LOGO_URL', 'ICON_URL', 'FAVICON_URL'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
      logoUrl: process.env.LOGO_URL!,
      iconUrl: process.env.ICON_URL!,
      faviconUrl: process.env.FAVICON_URL!,
      siteUrl: process.env.SITE_URL || 'http://localhost:5000',
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000']
    };
  }

  getAssetUrl(type: 'logo' | 'icon' | 'favicon'): string {
    switch (type) {
      case 'logo':
        return this.config.logoUrl;
      case 'icon':
        return this.config.iconUrl;
      case 'favicon':
        return this.config.faviconUrl;
      default:
        throw new Error(`Unknown asset type: ${type}`);
    }
  }

  getSiteUrl(): string {
    return this.config.siteUrl;
  }

  getAllowedOrigins(): string[] {
    return this.config.allowedOrigins;
  }

  isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return false;
    return this.config.allowedOrigins.includes(origin);
  }
}

export const assetConfig = new AssetConfigService();