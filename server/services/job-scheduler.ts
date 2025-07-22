import cron from 'node-cron';
import { db } from './supabase';
import { indexingJobs, urlSubmissions, serviceAccounts, quotaUsage, userProfiles } from '@shared/schema';
import { eq, and, gte, lte, isNull, lt, or, sql } from 'drizzle-orm';
import { googleIndexingService } from './google-indexing';
import { sitemapParser } from './sitemap-parser';
import { emailService } from './email-service';
import { quotaMonitoringService } from './quota-monitoring';
import { quotaPauseManager } from './quota-pause-manager';
import { EncryptionService } from './encryption';

interface ScheduledJob {
  id: string;
  task: cron.ScheduledTask;
}

export class JobScheduler {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private monitorTask: cron.ScheduledTask | null = null;

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

  async initializeScheduler() {
    console.log('6:10:36 AM [express] Job scheduler initialized successfully');
    
    // Start the continuous job monitor that runs every minute
    this.startJobMonitor();
    
    // Schedule daily quota reports at 9 AM every day
    cron.schedule('0 9 * * *', async () => {
      console.log('Sending daily quota reports...');
      await this.sendDailyQuotaReports();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    
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

    // Check for stuck jobs and recover them
    await this.recoverStuckJobs();
  }

  private startJobMonitor() {
    // Create a cron job that runs every minute to check for pending jobs
    this.monitorTask = cron.schedule('* * * * *', async () => {
      await this.checkPendingJobs();
      await this.recoverStuckJobs();
    }, {
      scheduled: true
    });

    // Schedule quota monitoring every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        await quotaMonitoringService.checkAndSendQuotaAlerts();
      } catch (error) {
        console.error('Error in quota monitoring:', error);
      }
    });

    // Schedule cleanup at 2 AM daily
    cron.schedule('0 2 * * *', async () => {
      try {
        await quotaMonitoringService.cleanupOldData();
      } catch (error) {
        console.error('Error in data cleanup:', error);
      }
    });

    // Schedule quota-paused job resume check every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await quotaPauseManager.resumePausedJobs();
      } catch (error) {
        console.error('Error in resuming paused jobs:', error);
      }
    });

    console.log('Job monitor started - checking every minute for pending jobs');
    console.log('Quota monitoring scheduled - checking every 15 minutes');
  }

  private async checkPendingJobs() {
    try {
      const now = new Date();
      
      // Find pending one-time jobs that should run immediately
      const pendingOneTimeJobs = await db
        .select()
        .from(indexingJobs)
        .where(and(
          eq(indexingJobs.status, 'pending'),
          eq(indexingJobs.schedule, 'one-time')
        ));

      for (const job of pendingOneTimeJobs) {
        console.log(`Found pending one-time job: ${job.id} - executing now`);
        setImmediate(() => {
          this.executeJob(job.id);
        });
      }

      // Find scheduled jobs whose time has come
      const scheduledJobs = await db
        .select()
        .from(indexingJobs)
        .where(and(
          eq(indexingJobs.status, 'pending'),
          lte(indexingJobs.nextRun, now)
        ));

      for (const job of scheduledJobs) {
        if (job.schedule !== 'one-time' && job.cronExpression) {
          console.log(`Found scheduled job ready to run: ${job.id} - executing now`);
          setImmediate(() => {
            this.executeJob(job.id);
          });
        }
      }
    } catch (error) {
      console.error('Error checking pending jobs:', error);
    }
  }

  private async recoverStuckJobs() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Find jobs that have been running for more than 5 minutes (likely stuck)
      const stuckJobs = await db
        .select()
        .from(indexingJobs)
        .where(and(
          eq(indexingJobs.status, 'running'),
          lte(indexingJobs.lastRun, fiveMinutesAgo)
        ));

      for (const job of stuckJobs) {
        console.log(`Found stuck job ${job.id} - resetting to pending status`);
        
        await db
          .update(indexingJobs)
          .set({ 
            status: 'pending',
            lastRun: null
          })
          .where(eq(indexingJobs.id, job.id));

        this.broadcastJobUpdate(job.id, 'pending', { recovered: true });
      }
    } catch (error) {
      console.error('Error recovering stuck jobs:', error);
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
      console.log(`🚀 ===== EXECUTING JOB ${jobId} =====`);

      // Get job details FIRST without locking
      const job = await db
        .select()
        .from(indexingJobs)
        .where(eq(indexingJobs.id, jobId))
        .limit(1);

      if (!job.length) {
        console.error(`❌ Job ${jobId} not found`);
        return;
      }

      const jobData = job[0];
      console.log(`📋 Job details: Name="${jobData.name}", Status="${jobData.status}", Total URLs=${jobData.totalUrls}`);

      // Check if job should be processed (only pending jobs)
      if (jobData.status !== 'pending') {
        console.log(`Job ${jobId} is not pending (status: ${jobData.status}) - skipping execution`);
        return;
      }

      // NOW implement job locking ONLY when actually processing
      const lockResult = await db
        .update(indexingJobs)
        .set({ 
          lockedAt: new Date(),
          lockedBy: 'job-scheduler',
          status: 'running' // Set to running immediately when locked
        })
        .where(and(
          eq(indexingJobs.id, jobId),
          eq(indexingJobs.status, 'pending'), // Only lock pending jobs
          or(
            isNull(indexingJobs.lockedAt),
            lt(indexingJobs.lockedAt, new Date(Date.now() - parseInt(process.env.JOB_LOCK_TIMEOUT_MINUTES!) * 60 * 1000)) // Lock expired
          )
        ))
        .returning();

      if (!lockResult.length) {
        console.log(`Job ${jobId} is already locked or being processed`);
        return;
      }

      // DO NOT clear existing URL submissions - preserve submission history
      // Duplicate submissions will be handled by checking existing URLs before processing

      // Update last run time (status already set to 'running' when locked)
      await db
        .update(indexingJobs)
        .set({ 
          lastRun: new Date()
        })
        .where(eq(indexingJobs.id, jobId));

      // Broadcast job started
      this.broadcastJobUpdate(jobId, 'running');

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
          .set({ 
            status: 'failed',
            // CRITICAL: Release lock when job fails
            lockedAt: null,
            lockedBy: null
          })
          .where(eq(indexingJobs.id, jobId));
        
        // Send email notification for job failure
        await this.sendJobFailureEmail(jobData.userId, jobData.name, 'No URLs found');
        
        this.broadcastJobUpdate(jobId, 'failed', { error: 'No URLs found' });
        return;
      }

      // Get user's service accounts
      // Get service accounts sorted by least usage (load balancing)
      const accounts = await quotaMonitoringService.getServiceAccountsByUsage(jobData.userId);

      console.log(`🔄 Load balancing: Using ${accounts.length} service accounts sorted by usage`);

      if (accounts.length === 0) {
        await db
          .update(indexingJobs)
          .set({ 
            status: 'failed',
            // CRITICAL: Release lock when job fails
            lockedAt: null,
            lockedBy: null
          })
          .where(eq(indexingJobs.id, jobId));
        
        // Send email notification for job failure
        await this.sendJobFailureEmail(jobData.userId, jobData.name, 'No active service accounts found');
        
        this.broadcastJobUpdate(jobId, 'failed', { error: 'No active service accounts found' });
        return;
      }

      // Process URLs with quota management
      await this.processUrlsWithQuota(jobId, urls, accounts);

      // Update job completion - check if job was paused
      const submissions = await db
        .select()
        .from(urlSubmissions)
        .where(eq(urlSubmissions.jobId, jobId));

      const successful = submissions.filter(s => s.status === 'success').length;
      const failed = submissions.filter(s => s.status === 'error').length;
      const quotaExceeded = submissions.filter(s => s.status === 'quota_exceeded').length;

      // Check current job status to see if it was paused
      const currentJob = await db
        .select()
        .from(indexingJobs)
        .where(eq(indexingJobs.id, jobId))
        .limit(1);

      if (currentJob.length > 0 && currentJob[0].status !== 'paused') {
        // Only mark as completed if not paused due to quota
        await db
          .update(indexingJobs)
          .set({
            status: 'completed',
            processedUrls: submissions.length,
            successfulUrls: successful,
            failedUrls: failed,
            updatedAt: new Date(),
            // CRITICAL: Release lock when job completes
            lockedAt: null,
            lockedBy: null
          })
          .where(eq(indexingJobs.id, jobId));

        console.log(`Job ${jobId} completed: ${successful} successful, ${failed} failed, ${quotaExceeded} quota exceeded`);
        
        // Send email notification for job completion
        await this.sendJobCompletionEmail(jobData.userId, jobData.name, successful, failed, submissions.length);

        // Broadcast job completion
        this.broadcastJobUpdate(jobId, 'completed', {
          processedUrls: submissions.length,
          successfulUrls: successful,
          failedUrls: failed,
          quotaExceededUrls: quotaExceeded
        });
      } else if (currentJob.length > 0 && currentJob[0].status === 'paused') {
        console.log(`Job ${jobId} paused due to quota limits: ${successful} successful, ${failed} failed, ${quotaExceeded} quota exceeded`);
      }

    } catch (error) {
      console.error(`Error executing job ${jobId}:`, error);
      
      // Check if this is a quota pause error - don't mark as failed
      if (error.message && (error.message.includes('JOB_PAUSED_QUOTA_EXCEEDED') || error.message.includes('JOB_PAUSED_ALL_QUOTA_EXCEEDED'))) {
        console.log(`Job ${jobId} paused due to quota exhaustion - not marking as failed`);
        return; // Exit without marking as failed
      }
      
      await db
        .update(indexingJobs)
        .set({ 
          status: 'failed',
          // CRITICAL: Release lock when job fails
          lockedAt: null,
          lockedBy: null
        })
        .where(eq(indexingJobs.id, jobId));
      
      // Send email notification for job failure
      const job = await db.select().from(indexingJobs).where(eq(indexingJobs.id, jobId)).limit(1);
      if (job.length > 0) {
        await this.sendJobFailureEmail(job[0].userId, job[0].name, error.message);
      }
      
      this.broadcastJobUpdate(jobId, 'failed', { error: error.message });
    }
  }

  private async processUrlsWithQuota(jobId: string, urls: string[], accounts: any[]) {
    const today = new Date().toISOString().split('T')[0];
    let urlIndex = 0;
    
    for (const url of urls) {
      urlIndex++;
      let processed = false;

      // Update real-time progress
      await db
        .update(indexingJobs)
        .set({
          processedUrls: urlIndex - 1,
          updatedAt: new Date()
        })
        .where(eq(indexingJobs.id, jobId));

      // Broadcast real-time progress
      this.broadcastJobUpdate(jobId, 'running', { 
        progress: { 
          current: urlIndex - 1, 
          total: urls.length,
          currentUrl: url
        }
      });

      // Check quota availability before processing each URL
      const job = await db.select().from(indexingJobs).where(eq(indexingJobs.id, jobId)).limit(1);
      if (job.length === 0) break;

      const quotaCheck = await quotaPauseManager.checkQuotaAvailability(job[0].userId);
      
      if (quotaCheck.shouldPauseJob) {
        console.log(`🚫 Pausing job ${jobId} - no available quota`);
        await quotaPauseManager.pauseJobDueToQuota(jobId, quotaCheck.pauseReason!, quotaCheck.resumeAfter);
        return; // Exit processing
      }

      for (const account of quotaCheck.availableAccounts) {
        // Double-check current usage
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

        // Submit URL for indexing with token caching and quota handling
        const result = await googleIndexingService.submitUrlForIndexing(url, account, async (token: string, expiry: Date) => {
          try {
            console.log('\n=== Saving Token to Database ===');
            console.log('Service Account ID:', account.id);
            console.log('Token length:', token.length);
            console.log('Expiry:', expiry.toISOString());
            
            // Encrypt the token before saving
            let encryptedData = null;
            try {
              const encrypted = EncryptionService.encrypt(token);
              encryptedData = {
                accessTokenEncrypted: encrypted.encrypted,
                encryptionIv: encrypted.iv,
                encryptionTag: encrypted.tag,
                // Clear old plain text token
                accessToken: null
              };
              console.log('🔐 Token encrypted successfully');
            } catch (error) {
              console.warn('Failed to encrypt token, saving as plain text:', error.message);
              encryptedData = {
                accessToken: token,
                // Clear encryption fields if encryption fails
                accessTokenEncrypted: null,
                encryptionIv: null,
                encryptionTag: null
              };
            }
            
            // Update the service account with the encrypted token
            const updateResult = await db
              .update(serviceAccounts)
              .set({ 
                ...encryptedData,
                tokenExpiresAt: expiry,
                updatedAt: new Date()
              })
              .where(eq(serviceAccounts.id, account.id))
              .returning();
            
            console.log('Database update result:', updateResult.length > 0 ? 'SUCCESS' : 'FAILED');
            
            // Update the local account object with new token data
            Object.assign(account, encryptedData);
            account.tokenExpiresAt = expiry;
          } catch (error) {
            console.error('Error saving token to database:', error);
          }
        });

        // Handle different response types
        if (result.success) {
          // Success case
          await db.insert(urlSubmissions).values({
            jobId,
            url,
            status: 'success',
            serviceAccountId: account.id,
            submittedAt: new Date()
          });

          // Update quota usage
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

          // Update real-time successful count
          await db
            .update(indexingJobs)
            .set({
              successfulUrls: sql`${indexingJobs.successfulUrls} + 1`,
              updatedAt: new Date()
            })
            .where(eq(indexingJobs.id, jobId));

          // Broadcast real-time success update
          this.broadcastJobUpdate(jobId, 'running', { 
            progress: { 
              current: urlIndex, 
              total: urls.length,
              currentUrl: url,
              success: true,
              message: 'Successfully indexed'
            }
          });

        } else if (result.isQuotaExceeded) {
          // Quota exceeded case - handle with pause manager
          console.log(`🚫 QUOTA EXCEEDED - Pausing job ${jobId} immediately`);
          
          const jobPaused = await quotaPauseManager.handleQuotaExceededResponse(jobId, url, account.id);
          
          if (jobPaused) {
            console.log(`🚫 Job ${jobId} paused due to quota exhaustion - STOPPING ALL PROCESSING`);
            throw new Error('JOB_PAUSED_QUOTA_EXCEEDED'); // Force exit from job processing
          }
          
          // Mark this URL as quota exceeded for tracking
          await db.insert(urlSubmissions).values({
            jobId,
            url,
            status: 'quota_exceeded',
            serviceAccountId: account.id,
            errorMessage: result.error,
            submittedAt: new Date()
          });

          // Broadcast quota exceeded update
          this.broadcastJobUpdate(jobId, 'paused', { 
            progress: { 
              current: urlIndex, 
              total: urls.length,
              currentUrl: url,
              quotaExceeded: true,
              message: 'Quota exceeded - job paused'
            }
          });
          
          // Continue with next account
          continue;
          
        } else {
          // Regular error case
          await db.insert(urlSubmissions).values({
            jobId,
            url,
            status: 'error',
            serviceAccountId: account.id,
            errorMessage: result.error,
            submittedAt: new Date()
          });

          // Update real-time failed count
          await db
            .update(indexingJobs)
            .set({
              failedUrls: sql`${indexingJobs.failedUrls} + 1`,
              updatedAt: new Date()
            })
            .where(eq(indexingJobs.id, jobId));

          // Broadcast real-time error update
          this.broadcastJobUpdate(jobId, 'running', { 
            progress: { 
              current: urlIndex, 
              total: urls.length,
              currentUrl: url,
              error: true,
              message: result.error || 'Indexing failed'
            }
          });
        }

        processed = true;
        break;
      }

      if (!processed) {
        // All accounts exceeded quota - pause the job
        console.log(`🚫 ALL ACCOUNTS EXHAUSTED - Pausing job ${jobId}`);
        const job = await db.select().from(indexingJobs).where(eq(indexingJobs.id, jobId)).limit(1);
        if (job.length > 0) {
          const quotaCheck = await quotaPauseManager.checkQuotaAvailability(job[0].userId);
          if (quotaCheck.shouldPauseJob) {
            await quotaPauseManager.pauseJobDueToQuota(jobId, quotaCheck.pauseReason!, quotaCheck.resumeAfter);
            throw new Error('JOB_PAUSED_ALL_QUOTA_EXCEEDED'); // Force exit from job processing
          }
        }
        
        // If not pausing, record as quota exceeded
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

  private async sendJobCompletionEmail(userId: string, jobName: string, successful: number, failed: number, total: number) {
    try {
      // Get user profile and email preferences
      const user = await db
        .select({
          email: userProfiles.email,
          fullName: userProfiles.fullName,
          emailJobCompletion: userProfiles.emailJobCompletion
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1);

      if (user.length > 0 && user[0].emailJobCompletion) {
        await emailService.sendJobCompletionEmail(
          user[0].email, 
          user[0].fullName || 'User', 
          jobName, 
          successful, 
          failed, 
          total
        );
      }
    } catch (error) {
      console.error('Error sending job completion email:', error);
    }
  }

  private async sendJobFailureEmail(userId: string, jobName: string, errorMessage: string) {
    try {
      // Get user profile and email preferences
      const user = await db
        .select({
          email: userProfiles.email,
          fullName: userProfiles.fullName,
          emailJobFailures: userProfiles.emailJobFailures
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1);

      if (user.length > 0 && user[0].emailJobFailures) {
        await emailService.sendJobFailureEmail(user[0].email, user[0].fullName || 'User', jobName, errorMessage);
      }
    } catch (error) {
      console.error('Error sending job failure email:', error);
    }
  }

  async sendDailyQuotaReports() {
    try {
      console.log('🔄 Starting daily quota reports...');
      
      // Get all users who have daily reports enabled
      const users = await db
        .select({
          id: userProfiles.id,
          email: userProfiles.email,
          emailDailyReports: userProfiles.emailDailyReports
        })
        .from(userProfiles)
        .where(eq(userProfiles.emailDailyReports, true));
      
      console.log(`📧 Found ${users.length} users with daily reports enabled`);

      for (const user of users) {
        // Get dashboard stats for the user
        const storage = await import('../storage');
        const stats = await storage.storage.getDashboardStats(user.id);
        
        // Get user's full name for email
        const userProfile = await storage.storage.getUserProfile(user.id);
        const userName = userProfile?.fullName || userProfile?.email?.split('@')[0] || 'User';
        
        // Get additional stats needed for the report
        const userJobs = await storage.storage.getIndexingJobs(user.id);
        const userAccounts = await storage.storage.getServiceAccounts(user.id);
        
        // Calculate failed URLs (total processed - successful)
        const totalProcessed = userJobs.reduce((sum, job) => sum + (job.processedUrls || 0), 0);
        const totalFailedUrls = totalProcessed - stats.totalUrlsIndexed;
        
        // Calculate completed jobs from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const completedJobs = userJobs.filter(job => 
          job.status === 'completed' && 
          job.updatedAt && 
          new Date(job.updatedAt) >= today
        ).length;
        
        // Calculate active service accounts
        const activeServiceAccounts = userAccounts.filter(account => account.isActive).length;
        
        const reportData = {
          totalSuccessfulUrls: stats.totalUrlsIndexed,
          totalFailedUrls: Math.max(0, totalFailedUrls),
          completedJobs,
          activeJobs: stats.activeJobs,
          totalServiceAccounts: userAccounts.length,
          activeServiceAccounts,
          quotaUsed: stats.apiQuotaUsed,
          quotaLimit: stats.apiQuotaLimit,
          quotaPercentage: Math.min(100, (stats.apiQuotaUsed / stats.apiQuotaLimit) * 100)
        };
        
        console.log(`📊 Sending daily report to ${user.email} with data:`, JSON.stringify(reportData, null, 2));
        
        // Send daily quota report
        const emailResult = await emailService.sendDailyQuotaReport(user.email, userName, reportData);
        
        console.log(`✅ Email sent to ${user.email}:`, emailResult);
      }
      
      console.log('🎯 Daily quota reports completed successfully');
    } catch (error) {
      console.error('Error sending daily quota reports:', error);
    }
  }

  // Test method to send daily quota report to a specific email
  async testDailyQuotaReport(testEmail: string) {
    try {
      console.log(`🧪 Testing daily quota report for ${testEmail}...`);
      
      const userName = 'Test User';
      
      // Mock stats for testing
      const mockStats = {
        totalSuccessfulUrls: 150,
        totalFailedUrls: 5,
        completedJobs: 3,
        activeJobs: 2,
        totalServiceAccounts: 2,
        activeServiceAccounts: 1,
        quotaUsed: 45,
        quotaLimit: 200,
        quotaPercentage: 22.5
      };
      
      console.log('📊 Test data for email:', JSON.stringify(mockStats, null, 2));
      
      const result = await emailService.sendDailyQuotaReport(testEmail, userName, mockStats);
      
      console.log(`✅ Test email result:`, result);
      return result;
    } catch (error) {
      console.error('❌ Error testing daily quota report:', error);
      throw error;
    }
  }
  async testQuotaAlert(testEmail: string, alertType: 'warning' | 'critical' | 'exhausted' = 'warning'): Promise<boolean> {
    console.log(`🧪 Testing quota alert (${alertType}) for ${testEmail}...`);
    
    const testData = {
      warning: { usage: 165, percentage: 82 },
      critical: { usage: 192, percentage: 96 },
      exhausted: { usage: 200, percentage: 100 }
    };
    
    const data = testData[alertType];
    const serviceAccountName = 'Test Service Account';
    const quotaLimit = 200;
    
    const subjects = {
      warning: `⚠️ Quota Warning - ${serviceAccountName} (${data.percentage}% used)`,
      critical: `🚨 Quota Critical - ${serviceAccountName} (${data.percentage}% used)`,
      exhausted: `🛑 Quota Exhausted - ${serviceAccountName} (${data.percentage}% used)`
    };
    
    console.log(`📊 Test quota alert data: ${data.usage}/${quotaLimit} (${data.percentage}%)`);
    
    try {
      const result = await emailService.sendQuotaAlert(
        testEmail,
        'Test User',
        serviceAccountName,
        data.usage,
        quotaLimit,
        data.percentage,
        alertType,
        subjects[alertType]
      );
      console.log(`✅ Test quota alert result: ${result}`);
      return result;
    } catch (error) {
      console.error('❌ Test quota alert failed:', error);
      return false;
    }
  }
}

export const jobScheduler = new JobScheduler();
