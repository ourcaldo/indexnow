import cron from 'node-cron';
import { db } from './supabase';
import { indexingJobs, urlSubmissions, serviceAccounts, quotaUsage } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { googleIndexingService } from './google-indexing';
import { sitemapParser } from './sitemap-parser';

interface ScheduledJob {
  id: string;
  task: cron.ScheduledTask;
}

export class JobScheduler {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();

  async initializeScheduler() {
    // Load all active scheduled jobs from database
    const jobs = await db
      .select()
      .from(indexingJobs)
      .where(eq(indexingJobs.status, 'pending'));

    for (const job of jobs) {
      if (job.schedule === 'one-time') {
        // Execute one-time jobs immediately
        console.log(`Executing pending one-time job: ${job.id}`);
        setImmediate(() => {
          this.executeJob(job.id);
        });
      } else if (job.cronExpression) {
        // Schedule recurring jobs
        this.scheduleJob(job.id, job.cronExpression);
      }
    }
  }

  scheduleJob(jobId: string, cronExpression: string) {
    // Remove existing schedule if any
    this.unscheduleJob(jobId);

    try {
      const task = cron.schedule(cronExpression, async () => {
        await this.executeJob(jobId);
      }, {
        scheduled: false
      });

      this.scheduledJobs.set(jobId, { id: jobId, task });
      task.start();
      
      console.log(`Scheduled job ${jobId} with cron: ${cronExpression}`);
    } catch (error) {
      console.error(`Failed to schedule job ${jobId}:`, error);
    }
  }

  unscheduleJob(jobId: string) {
    const scheduledJob = this.scheduledJobs.get(jobId);
    if (scheduledJob) {
      scheduledJob.task.stop();
      this.scheduledJobs.delete(jobId);
      console.log(`Unscheduled job ${jobId}`);
    }
  }

  async executeJob(jobId: string) {
    try {
      console.log(`Executing job ${jobId}`);

      // Get job details
      const job = await db
        .select()
        .from(indexingJobs)
        .where(eq(indexingJobs.id, jobId))
        .limit(1);

      if (!job.length) {
        console.error(`Job ${jobId} not found`);
        return;
      }

      const jobData = job[0];

      // Update job status to running
      await db
        .update(indexingJobs)
        .set({ 
          status: 'running',
          lastRun: new Date()
        })
        .where(eq(indexingJobs.id, jobId));

      let urls: string[] = [];

      // Get URLs from sitemap or manual input
      if (jobData.sitemapUrl) {
        urls = await sitemapParser.parseUrls(jobData.sitemapUrl);
      } else if (jobData.manualUrls) {
        urls = jobData.manualUrls;
      }

      if (urls.length === 0) {
        await db
          .update(indexingJobs)
          .set({ status: 'failed' })
          .where(eq(indexingJobs.id, jobId));
        return;
      }

      // Get user's service accounts
      const accounts = await db
        .select()
        .from(serviceAccounts)
        .where(and(
          eq(serviceAccounts.userId, jobData.userId),
          eq(serviceAccounts.isActive, true)
        ));

      if (accounts.length === 0) {
        await db
          .update(indexingJobs)
          .set({ status: 'failed' })
          .where(eq(indexingJobs.id, jobId));
        return;
      }

      // Process URLs with quota management
      await this.processUrlsWithQuota(jobId, urls, accounts);

      // Update job completion
      const submissions = await db
        .select()
        .from(urlSubmissions)
        .where(eq(urlSubmissions.jobId, jobId));

      const successful = submissions.filter(s => s.status === 'success').length;
      const failed = submissions.filter(s => s.status === 'error').length;

      await db
        .update(indexingJobs)
        .set({
          status: 'completed',
          processedUrls: submissions.length,
          successfulUrls: successful,
          failedUrls: failed
        })
        .where(eq(indexingJobs.id, jobId));

      console.log(`Job ${jobId} completed: ${successful} successful, ${failed} failed`);

    } catch (error) {
      console.error(`Error executing job ${jobId}:`, error);
      
      await db
        .update(indexingJobs)
        .set({ status: 'failed' })
        .where(eq(indexingJobs.id, jobId));
    }
  }

  private async processUrlsWithQuota(jobId: string, urls: string[], accounts: any[]) {
    const today = new Date().toISOString().split('T')[0];
    
    for (const url of urls) {
      let processed = false;

      for (const account of accounts) {
        // Check quota usage for today
        const usage = await db
          .select()
          .from(quotaUsage)
          .where(and(
            eq(quotaUsage.serviceAccountId, account.id),
            eq(quotaUsage.date, today)
          ))
          .limit(1);

        const currentUsage = usage.length ? usage[0].requestsCount : 0;
        
        if (currentUsage >= account.dailyQuotaLimit) {
          continue; // Try next account
        }

        // Submit URL for indexing with token caching
        const result = await googleIndexingService.submitUrlForIndexing(url, account, async (token: string, expiry: Date) => {
          // Update the service account with the new token
          await db
            .update(serviceAccounts)
            .set({ 
              accessToken: token,
              tokenExpiresAt: expiry,
              updatedAt: new Date()
            })
            .where(eq(serviceAccounts.id, account.id));
        });

        // Create URL submission record
        await db.insert(urlSubmissions).values({
          jobId,
          url,
          status: result.success ? 'success' : 'error',
          serviceAccountId: account.id,
          errorMessage: result.error,
          submittedAt: new Date()
        });

        // Update quota usage only if the request was successful
        if (result.success) {
          if (usage.length) {
            await db
              .update(quotaUsage)
              .set({ requestsCount: currentUsage + 1 })
              .where(eq(quotaUsage.id, usage[0].id));
          } else {
            await db.insert(quotaUsage).values({
              serviceAccountId: account.id,
              date: today,
              requestsCount: 1
            });
          }
        }

        processed = true;
        break;
      }

      if (!processed) {
        // All accounts exceeded quota
        await db.insert(urlSubmissions).values({
          jobId,
          url,
          status: 'quota_exceeded',
          errorMessage: 'All service accounts exceeded daily quota'
        });
      }
    }
  }

  generateCronExpression(schedule: string): string {
    switch (schedule) {
      case 'hourly':
        return '0 * * * *';
      case 'daily':
        return '0 9 * * *'; // 9 AM daily
      case 'weekly':
        return '0 9 * * 1'; // 9 AM every Monday
      case 'monthly':
        return '0 9 1 * *'; // 9 AM on 1st of every month
      default:
        throw new Error('Invalid schedule type');
    }
  }
}

export const jobScheduler = new JobScheduler();
