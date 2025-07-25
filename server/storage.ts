import { db } from './services/supabase';
import { 
  userProfiles, 
  serviceAccounts, 
  indexingJobs, 
  urlSubmissions, 
  quotaUsage,
  dashboardNotifications,
  type UserProfile,
  type ServiceAccount,
  type IndexingJob,
  type UrlSubmission,
  type QuotaUsage,
  type DashboardNotification,
  type InsertUserProfile,
  type InsertServiceAccount,
  type InsertIndexingJob,
  type InsertUrlSubmission,
  type InsertQuotaUsage,
  type InsertDashboardNotification
} from '@shared/schema';
import { eq, and, desc, count, inArray, sql } from 'drizzle-orm';

export interface IStorage {
  // User profiles
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  getUserProfile(id: string): Promise<UserProfile | undefined>;
  updateUserProfile(id: string, profile: Partial<UserProfile>): Promise<UserProfile>;
  getUserSettings(id: string): Promise<{ emailJobCompletion: boolean; emailJobFailures: boolean; emailDailyReports: boolean; emailQuotaAlerts: boolean; quotaAlertThreshold: number; dashboardNotifications: boolean; requestTimeout: number; retryAttempts: number; } | undefined>;

  // Service accounts
  createServiceAccount(account: Omit<InsertServiceAccount, 'serviceAccountJson'> & { serviceAccountJson: string }): Promise<ServiceAccount>;
  getServiceAccounts(userId: string): Promise<ServiceAccount[]>;
  updateServiceAccount(id: string, account: Partial<ServiceAccount>): Promise<ServiceAccount>;
  deleteServiceAccount(id: string): Promise<void>;

  // Indexing jobs
  createIndexingJob(job: InsertIndexingJob): Promise<IndexingJob>;
  getIndexingJobs(userId: string): Promise<IndexingJob[]>;
  getIndexingJobsWithPagination(userId: string, page: number, limit: number): Promise<{ jobs: IndexingJob[]; total: number; totalPages: number; }>;
  getIndexingJob(id: string): Promise<IndexingJob | undefined>;
  updateIndexingJob(id: string, job: Partial<IndexingJob>): Promise<IndexingJob>;
  deleteIndexingJob(id: string): Promise<void>;
  deleteMultipleIndexingJobs(ids: string[], userId: string): Promise<void>;

  // URL submissions
  getUrlSubmissions(jobId: string): Promise<UrlSubmission[]>;
  createUrlSubmission(submission: InsertUrlSubmission): Promise<UrlSubmission>;
  updateUrlSubmission(id: string, submission: Partial<UrlSubmission>): Promise<UrlSubmission>;
  deleteUrlSubmissionsForJob(jobId: string): Promise<void>;

  // Quota usage
  getQuotaUsage(serviceAccountId: string, date: string): Promise<QuotaUsage | undefined>;
  createOrUpdateQuotaUsage(usage: InsertQuotaUsage): Promise<QuotaUsage>;
  getQuotaUsageByUser(userId: string): Promise<(QuotaUsage & { serviceAccount: ServiceAccount })[]>;

  // Dashboard stats
  getDashboardStats(userId: string): Promise<{
    totalUrlsIndexed: number;
    activeJobs: number;
    successRate: number;
    apiQuotaUsed: number;
    apiQuotaLimit: number;
  }>;

  // Dashboard notifications
  getDashboardNotifications(userId: string): Promise<DashboardNotification[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
}

export class SupabaseStorage implements IStorage {
  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const result = await db.insert(userProfiles).values(profile).returning();
    return result[0];
  }

  async getUserProfile(id: string): Promise<UserProfile | undefined> {
    const result = await db.select().from(userProfiles).where(eq(userProfiles.id, id)).limit(1);
    return result[0];
  }

  async updateUserProfile(id: string, profile: Partial<UserProfile>): Promise<UserProfile> {
    const result = await db
      .update(userProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(userProfiles.id, id))
      .returning();
    return result[0];
  }

  async getUserSettings(id: string): Promise<{ emailJobCompletion: boolean; emailJobFailures: boolean; emailDailyReports: boolean; emailQuotaAlerts: boolean; quotaAlertThreshold: number; dashboardNotifications: boolean; requestTimeout: number; retryAttempts: number; } | undefined> {
    const result = await db
      .select({
        emailJobCompletion: userProfiles.emailJobCompletion,
        emailJobFailures: userProfiles.emailJobFailures,
        emailDailyReports: userProfiles.emailDailyReports,
        emailQuotaAlerts: userProfiles.emailQuotaAlerts,
        quotaAlertThreshold: userProfiles.quotaAlertThreshold,
        dashboardNotifications: userProfiles.dashboardNotifications,
        requestTimeout: userProfiles.requestTimeout,
        retryAttempts: userProfiles.retryAttempts,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, id))
      .limit(1);
    return result[0];
  }

  async createServiceAccount(account: Omit<InsertServiceAccount, 'serviceAccountJson'> & { serviceAccountJson: string }): Promise<ServiceAccount> {
    const result = await db.insert(serviceAccounts).values(account).returning();
    return result[0];
  }

  async getServiceAccounts(userId: string): Promise<ServiceAccount[]> {
    return db.select().from(serviceAccounts).where(eq(serviceAccounts.userId, userId));
  }

  async updateServiceAccount(id: string, account: Partial<ServiceAccount>): Promise<ServiceAccount> {
    const result = await db
      .update(serviceAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(serviceAccounts.id, id))
      .returning();
    return result[0];
  }

  async deleteServiceAccount(id: string): Promise<void> {
    await db.delete(serviceAccounts).where(eq(serviceAccounts.id, id));
  }

  async createIndexingJob(job: InsertIndexingJob): Promise<IndexingJob> {
    const result = await db.insert(indexingJobs).values(job).returning();
    return result[0];
  }

  async getIndexingJobs(userId: string): Promise<IndexingJob[]> {
    return db
      .select()
      .from(indexingJobs)
      .where(eq(indexingJobs.userId, userId))
      .orderBy(desc(indexingJobs.createdAt));
  }

  async getIndexingJobsWithPagination(userId: string, page: number, limit: number): Promise<{ jobs: IndexingJob[]; total: number; totalPages: number; }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(indexingJobs)
      .where(eq(indexingJobs.userId, userId));
    
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    // Get paginated jobs
    const jobs = await db
      .select()
      .from(indexingJobs)
      .where(eq(indexingJobs.userId, userId))
      .orderBy(desc(indexingJobs.createdAt))
      .limit(limit)
      .offset(offset);
    
    return { jobs, total, totalPages };
  }

  async getIndexingJob(id: string): Promise<IndexingJob | undefined> {
    const result = await db.select().from(indexingJobs).where(eq(indexingJobs.id, id)).limit(1);
    return result[0];
  }

  async updateIndexingJob(id: string, job: Partial<IndexingJob>): Promise<IndexingJob> {
    const result = await db
      .update(indexingJobs)
      .set({ ...job, updatedAt: new Date() })
      .where(eq(indexingJobs.id, id))
      .returning();
    return result[0];
  }

  async deleteIndexingJob(id: string): Promise<void> {
    // Delete associated URL submissions first to avoid foreign key constraint violations
    await db.delete(urlSubmissions).where(eq(urlSubmissions.jobId, id));
    
    // Then delete the job
    await db.delete(indexingJobs).where(eq(indexingJobs.id, id));
  }

  async deleteMultipleIndexingJobs(ids: string[], userId: string): Promise<void> {
    // First, delete all associated URL submissions for these jobs
    await db.delete(urlSubmissions).where(inArray(urlSubmissions.jobId, ids));
    
    // Then delete the jobs, ensuring they belong to the user
    await db.delete(indexingJobs).where(
      and(
        inArray(indexingJobs.id, ids),
        eq(indexingJobs.userId, userId)
      )
    );
  }

  async getUrlSubmissions(jobId: string): Promise<UrlSubmission[]> {
    return db.select().from(urlSubmissions)
      .where(eq(urlSubmissions.jobId, jobId))
      .orderBy(desc(urlSubmissions.submittedAt));
  }

  async deleteUrlSubmissionsForJob(jobId: string): Promise<void> {
    await db.delete(urlSubmissions).where(eq(urlSubmissions.jobId, jobId));
  }

  async createUrlSubmission(submission: InsertUrlSubmission): Promise<UrlSubmission> {
    // Validate that the job exists before creating URL submission
    const job = await this.getIndexingJob(submission.jobId);
    if (!job) {
      throw new Error(`Job with ID ${submission.jobId} not found. Cannot create URL submission.`);
    }
    
    const result = await db.insert(urlSubmissions).values(submission).returning();
    return result[0];
  }

  async updateUrlSubmission(id: string, submission: Partial<UrlSubmission>): Promise<UrlSubmission> {
    const result = await db
      .update(urlSubmissions)
      .set({ ...submission, updatedAt: new Date() })
      .where(eq(urlSubmissions.id, id))
      .returning();
    return result[0];
  }

  async getQuotaUsage(serviceAccountId: string, date: string): Promise<QuotaUsage | undefined> {
    const result = await db
      .select()
      .from(quotaUsage)
      .where(and(
        eq(quotaUsage.serviceAccountId, serviceAccountId),
        eq(quotaUsage.date, date)
      ))
      .limit(1);
    return result[0];
  }

  async createOrUpdateQuotaUsage(usage: InsertQuotaUsage): Promise<QuotaUsage> {
    const existing = await this.getQuotaUsage(usage.serviceAccountId, usage.date);
    
    if (existing) {
      const result = await db
        .update(quotaUsage)
        .set({ requestsCount: usage.requestsCount })
        .where(eq(quotaUsage.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(quotaUsage).values(usage).returning();
      return result[0];
    }
  }

  async getQuotaUsageByUser(userId: string): Promise<(QuotaUsage & { serviceAccount: ServiceAccount })[]> {
    const result = await db
      .select({
        quota: quotaUsage,
        serviceAccount: serviceAccounts
      })
      .from(quotaUsage)
      .innerJoin(serviceAccounts, eq(quotaUsage.serviceAccountId, serviceAccounts.id))
      .where(eq(serviceAccounts.userId, userId));

    return result.map(r => ({ ...r.quota, serviceAccount: r.serviceAccount }));
  }

  async getDashboardStats(userId: string): Promise<{
    totalUrlsIndexed: number;
    activeJobs: number;
    successRate: number;
    apiQuotaUsed: number;
    apiQuotaLimit: number;
  }> {
    // Get user's jobs
    const userJobs = await this.getIndexingJobs(userId);
    
    // Calculate total URLs indexed
    const totalUrlsIndexed = userJobs.reduce((sum, job) => sum + (job.successfulUrls || 0), 0);
    
    // Count active jobs
    const activeJobs = userJobs.filter(job => 
      job.status === 'running' || job.status === 'pending'
    ).length;
    
    // Calculate success rate
    const totalProcessed = userJobs.reduce((sum, job) => sum + (job.processedUrls || 0), 0);
    const totalSuccessful = userJobs.reduce((sum, job) => sum + (job.successfulUrls || 0), 0);
    const successRate = totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 0;
    
    // Get quota usage
    const userAccounts = await this.getServiceAccounts(userId);
    const quotaUsages = await this.getQuotaUsageByUser(userId);
    
    const today = new Date().toISOString().split('T')[0];
    const todayUsages = quotaUsages.filter(q => q.date === today);
    
    const apiQuotaUsed = todayUsages.reduce((sum, usage) => sum + usage.requestsCount, 0);
    const apiQuotaLimit = userAccounts.reduce((sum, account) => sum + (account.dailyQuotaLimit || 200), 0);
    
    return {
      totalUrlsIndexed,
      activeJobs,
      successRate: Math.round(successRate * 100) / 100,
      apiQuotaUsed,
      apiQuotaLimit
    };
  }

  async getDashboardNotifications(userId: string): Promise<DashboardNotification[]> {
    const now = new Date();
    return db
      .select()
      .from(dashboardNotifications)
      .where(and(
        eq(dashboardNotifications.userId, userId),
        eq(dashboardNotifications.isRead, false),
        sql`(${dashboardNotifications.expiresAt} IS NULL OR ${dashboardNotifications.expiresAt} > ${now})`
      ))
      .orderBy(desc(dashboardNotifications.createdAt));
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(dashboardNotifications)
      .set({ isRead: true })
      .where(and(
        eq(dashboardNotifications.id, notificationId),
        eq(dashboardNotifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(dashboardNotifications)
      .set({ isRead: true })
      .where(eq(dashboardNotifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const now = new Date();
    const result = await db
      .select({ count: count() })
      .from(dashboardNotifications)
      .where(and(
        eq(dashboardNotifications.userId, userId),
        eq(dashboardNotifications.isRead, false),
        sql`(${dashboardNotifications.expiresAt} IS NULL OR ${dashboardNotifications.expiresAt} > ${now})`
      ));
    
    return result[0]?.count || 0;
  }
}

export const storage = new SupabaseStorage();
