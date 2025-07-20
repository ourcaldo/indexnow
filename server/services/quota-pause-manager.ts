import { db } from './supabase';
import { indexingJobs, urlSubmissions, serviceAccounts, quotaUsage, dashboardNotifications } from '@shared/schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { quotaMonitoringService } from './quota-monitoring';

interface QuotaCheckResult {
  hasAvailableQuota: boolean;
  availableAccounts: any[];
  exhaustedAccounts: any[];
  shouldPauseJob: boolean;
  pauseReason?: string;
  resumeAfter?: Date;
}

export class QuotaPauseManager {
  
  /**
   * Check if any service accounts have available quota for processing
   */
  async checkQuotaAvailability(userId: string): Promise<QuotaCheckResult> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all active service accounts with their usage
    const accountsWithUsage = await db
      .select({
        account: serviceAccounts,
        usage: sql<number>`COALESCE(${quotaUsage.requestsCount}, 0)`.as('current_usage')
      })
      .from(serviceAccounts)
      .leftJoin(
        quotaUsage,
        and(
          eq(quotaUsage.serviceAccountId, serviceAccounts.id),
          eq(quotaUsage.date, today)
        )
      )
      .where(and(
        eq(serviceAccounts.userId, userId),
        eq(serviceAccounts.isActive, true)
      ))
      .orderBy(sql`current_usage ASC`);

    const availableAccounts = accountsWithUsage.filter(
      row => row.usage < row.account.dailyQuotaLimit
    );
    
    const exhaustedAccounts = accountsWithUsage.filter(
      row => row.usage >= row.account.dailyQuotaLimit
    );

    const hasAvailableQuota = availableAccounts.length > 0;
    const shouldPauseJob = !hasAvailableQuota && exhaustedAccounts.length > 0;

    let pauseReason = '';
    let resumeAfter: Date | undefined;

    if (shouldPauseJob) {
      if (exhaustedAccounts.length === 1) {
        pauseReason = `Daily quota exhausted for service account "${exhaustedAccounts[0].account.name}". Job will resume tomorrow at 00:00 UTC when quota resets.`;
      } else {
        pauseReason = `Daily quota exhausted for all ${exhaustedAccounts.length} service accounts. Job will resume tomorrow at 00:00 UTC when quotas reset.`;
      }
      
      // Set resume time to next day at 00:00 UTC
      resumeAfter = new Date();
      resumeAfter.setUTCDate(resumeAfter.getUTCDate() + 1);
      resumeAfter.setUTCHours(0, 0, 0, 0);
    }

    return {
      hasAvailableQuota,
      availableAccounts: availableAccounts.map(row => row.account),
      exhaustedAccounts: exhaustedAccounts.map(row => row.account),
      shouldPauseJob,
      pauseReason,
      resumeAfter
    };
  }

  /**
   * Pause a job due to quota exhaustion
   */
  async pauseJobDueToQuota(jobId: string, reason: string, resumeAfter?: Date): Promise<void> {
    console.log(`🚫 Pausing job ${jobId} due to quota: ${reason}`);
    
    await db
      .update(indexingJobs)
      .set({
        status: 'paused',
        pausedDueToQuota: true,
        pausedAt: new Date(),
        pauseReason: reason,
        resumeAfter: resumeAfter || null,
        updatedAt: new Date()
      })
      .where(eq(indexingJobs.id, jobId));

    // Create dashboard notification
    const job = await db
      .select()
      .from(indexingJobs)
      .where(eq(indexingJobs.id, jobId))
      .limit(1);

    if (job.length > 0) {
      await db.insert(dashboardNotifications).values({
        userId: job[0].userId,
        title: 'Job Paused - Quota Exhausted',
        message: `Job "${job[0].name}" has been paused due to quota limits. ${reason}`,
        type: 'warning',
        relatedEntityType: 'job',
        relatedEntityId: jobId,
        expiresAt: resumeAfter || new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    }

    // Broadcast pause notification
    this.broadcastJobUpdate(jobId, 'paused', { 
      reason, 
      pausedDueToQuota: true,
      resumeAfter: resumeAfter?.toISOString()
    });
  }

  /**
   * Resume paused jobs that should be resumed (e.g., after quota reset)
   */
  async resumePausedJobs(): Promise<void> {
    const now = new Date();
    
    // Find jobs that should be resumed
    const jobsToResume = await db
      .select()
      .from(indexingJobs)
      .where(and(
        eq(indexingJobs.status, 'paused'),
        eq(indexingJobs.pausedDueToQuota, true),
        lt(indexingJobs.resumeAfter, now)
      ));

    for (const job of jobsToResume) {
      console.log(`🔄 Resuming job ${job.id} after quota reset`);
      
      // Check if quota is now available
      const quotaCheck = await this.checkQuotaAvailability(job.userId);
      
      if (quotaCheck.hasAvailableQuota) {
        await db
          .update(indexingJobs)
          .set({
            status: 'pending',
            pausedDueToQuota: false,
            pausedAt: null,
            pauseReason: null,
            resumeAfter: null,
            updatedAt: new Date()
          })
          .where(eq(indexingJobs.id, job.id));

        // Create resume notification
        await db.insert(dashboardNotifications).values({
          userId: job.userId,
          title: 'Job Resumed',
          message: `Job "${job.name}" has been automatically resumed after quota reset.`,
          type: 'success',
          relatedEntityType: 'job',
          relatedEntityId: job.id,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
        });

        this.broadcastJobUpdate(job.id, 'pending', { 
          resumed: true,
          reason: 'Quota reset - job automatically resumed'
        });
      }
    }
  }

  /**
   * Handle quota exceeded response from Google API
   */
  async handleQuotaExceededResponse(jobId: string, url: string, serviceAccountId: string): Promise<boolean> {
    console.log(`⚠️ Quota exceeded for URL: ${url} on account: ${serviceAccountId}`);
    
    // Mark URL as quota exceeded
    await db.insert(urlSubmissions).values({
      jobId,
      url,
      status: 'quota_exceeded',
      serviceAccountId,
      errorMessage: 'Daily quota limit exceeded',
      submittedAt: new Date()
    });

    // Update job quota exceeded count
    await db
      .update(indexingJobs)
      .set({
        quotaExceededUrls: sql`${indexingJobs.quotaExceededUrls} + 1`,
        updatedAt: new Date()
      })
      .where(eq(indexingJobs.id, jobId));

    // Get job details to check user
    const job = await db
      .select()
      .from(indexingJobs)
      .where(eq(indexingJobs.id, jobId))
      .limit(1);

    if (job.length === 0) return false;

    // Check if we should pause the job
    const quotaCheck = await this.checkQuotaAvailability(job[0].userId);
    
    if (quotaCheck.shouldPauseJob) {
      await this.pauseJobDueToQuota(jobId, quotaCheck.pauseReason!, quotaCheck.resumeAfter);
      return true; // Job was paused
    }

    return false; // Job can continue with other accounts
  }

  /**
   * Broadcast job updates via WebSocket
   */
  private broadcastJobUpdate(jobId: string, status: string, data?: any) {
    try {
      const wss = (global as any).wss;
      if (wss) {
        const message = JSON.stringify({
          type: 'jobUpdate',
          jobId,
          status,
          data,
          timestamp: new Date().toISOString()
        });

        wss.clients.forEach((client: any) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
          }
        });
      }
    } catch (error) {
      console.error('Failed to broadcast job update:', error);
    }
  }

  /**
   * Get real-time job statistics
   */
  async getJobStatistics(jobId: string) {
    const [jobData, urlStats] = await Promise.all([
      db.select().from(indexingJobs).where(eq(indexingJobs.id, jobId)).limit(1),
      db
        .select({
          status: urlSubmissions.status,
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(urlSubmissions)
        .where(eq(urlSubmissions.jobId, jobId))
        .groupBy(urlSubmissions.status)
    ]);

    if (jobData.length === 0) return null;

    const job = jobData[0];
    const stats = {
      total: job.totalUrls,
      processed: 0,
      successful: 0,
      failed: 0,
      quotaExceeded: 0,
      pending: 0
    };

    urlStats.forEach(stat => {
      switch (stat.status) {
        case 'success':
          stats.successful = stat.count;
          stats.processed += stat.count;
          break;
        case 'error':
          stats.failed = stat.count;
          stats.processed += stat.count;
          break;
        case 'quota_exceeded':
          stats.quotaExceeded = stat.count;
          stats.processed += stat.count;
          break;
        case 'pending':
          stats.pending = stat.count;
          break;
      }
    });

    return {
      ...job,
      realTimeStats: stats
    };
  }
}

export const quotaPauseManager = new QuotaPauseManager();