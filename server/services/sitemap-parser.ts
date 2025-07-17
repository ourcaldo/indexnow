import { parseStringPromise } from 'xml2js';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface SitemapIndex {
  loc: string;
  lastmod?: string;
}

export class SitemapParser {
  async parseUrls(sitemapUrl: string): Promise<string[]> {
    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
      }

      const xmlContent = await response.text();
      const parsed = await parseStringPromise(xmlContent);

      // Check if it's a sitemap index
      if (parsed.sitemapindex) {
        return this.parseSitemapIndex(parsed.sitemapindex);
      }

      // Check if it's a regular sitemap
      if (parsed.urlset) {
        return this.parseUrlSet(parsed.urlset);
      }

      throw new Error('Invalid sitemap format');
    } catch (error) {
      console.error(`Error parsing sitemap ${sitemapUrl}:`, error);
      throw error;
    }
  }

  private async parseSitemapIndex(sitemapIndex: any): Promise<string[]> {
    const urls: string[] = [];
    const sitemaps: SitemapIndex[] = sitemapIndex.sitemap || [];

    for (const sitemap of sitemaps) {
      const sitemapUrl = Array.isArray(sitemap.loc) ? sitemap.loc[0] : sitemap.loc;
      try {
        const sitemapUrls = await this.parseUrls(sitemapUrl);
        urls.push(...sitemapUrls);
      } catch (error) {
        console.error(`Failed to parse nested sitemap ${sitemapUrl}:`, error);
        // Continue with other sitemaps even if one fails
      }
    }

    return urls;
  }

  private parseUrlSet(urlset: any): string[] {
    const urls: string[] = [];
    const urlEntries: any[] = urlset.url || [];

    for (const entry of urlEntries) {
      const url = Array.isArray(entry.loc) ? entry.loc[0] : entry.loc;
      if (url && typeof url === 'string') {
        urls.push(url.trim());
      }
    }

    return urls;
  }

  async validateSitemap(sitemapUrl: string): Promise<boolean> {
    try {
      await this.parseUrls(sitemapUrl);
      return true;
    } catch {
      return false;
    }
  }

  async getSitemapStats(sitemapUrl: string): Promise<{ totalUrls: number; sitemaps: number }> {
    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
      }

      const xmlContent = await response.text();
      const parsed = await parseStringPromise(xmlContent);

      if (parsed.sitemapindex) {
        const sitemaps = parsed.sitemapindex.sitemap || [];
        let totalUrls = 0;

        for (const sitemap of sitemaps) {
          const sitemapUrl = Array.isArray(sitemap.loc) ? sitemap.loc[0] : sitemap.loc;
          try {
            const stats = await this.getSitemapStats(sitemapUrl);
            totalUrls += stats.totalUrls;
          } catch {
            // Continue counting even if some sitemaps fail
          }
        }

        return { totalUrls, sitemaps: sitemaps.length };
      }

      if (parsed.urlset) {
        const urls = parsed.urlset.url || [];
        return { totalUrls: urls.length, sitemaps: 1 };
      }

      return { totalUrls: 0, sitemaps: 0 };
    } catch (error) {
      console.error(`Error getting sitemap stats for ${sitemapUrl}:`, error);
      return { totalUrls: 0, sitemaps: 0 };
    }
  }
}

export const sitemapParser = new SitemapParser();
