import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertServiceAccountSchema, 
  insertIndexingJobSchema,
  createJobFromSitemapSchema,
  createJobFromUrlsSchema,
  updateUserSettingsSchema
} from "@shared/schema";
import { verifyAuth } from "./services/supabase";
import { googleIndexingService } from "./services/google-indexing";
import { sitemapParser } from "./services/sitemap-parser";
import { jobScheduler } from "./services/job-scheduler";
import { quotaPauseManager } from "./services/quota-pause-manager";
import { requireOwnership, rateLimitPerUser } from "./middleware/authorization";
import { validateUuid, validateServiceAccountJson } from "./middleware/input-validation";
import { SecureLogger } from "./middleware/secure-logging";
import { assetConfig } from "./services/asset-config";
import { emailService } from "./services/email-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication middleware with role population
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        SecureLogger.logSecurityEvent('AUTH_MISSING_HEADER', { ip: req.ip, userAgent: req.get('User-Agent') }, req);
        return res.status(401).json({ error: 'Authorization header required' });
      }

      const token = authHeader.substring(7);
      const user = await verifyAuth(token);
      req.user = user;
      
      // Add user role to request for role-based authorization
      const { addUserRoleToRequest } = await import('./middleware/role-authorization');
      await addUserRoleToRequest(req, user.id);
      
      next();
    } catch (error) {
      SecureLogger.logSecurityEvent('AUTH_INVALID_TOKEN', { ip: req.ip, userAgent: req.get('User-Agent'), error: error.message }, req);
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats(req.user.id);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // User settings routes
  app.get('/api/user/settings', requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getUserSettings(req.user.id);
      if (!settings) {
        return res.status(404).json({ error: 'User settings not found' });
      }
      res.json(settings);
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ error: 'Failed to fetch user settings' });
    }
  });

  app.patch('/api/user/settings', requireAuth, async (req: any, res) => {
    try {
      const validation = updateUserSettingsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const updatedProfile = await storage.updateUserProfile(req.user.id, validation.data);
      
      // Return just the settings part
      const settings = {
        emailJobCompletion: updatedProfile.emailJobCompletion,
        emailJobFailures: updatedProfile.emailJobFailures,
        emailDailyReports: updatedProfile.emailDailyReports,
        requestTimeout: updatedProfile.requestTimeout,
        retryAttempts: updatedProfile.retryAttempts,
      };
      
      res.json(settings);
    } catch (error) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ error: 'Failed to update user settings' });
    }
  });

  // Service accounts routes
  app.get('/api/service-accounts', requireAuth, async (req: any, res) => {
    try {
      const accounts = await storage.getServiceAccounts(req.user.id);
      // Remove sensitive data
      const safeAccounts = accounts.map(acc => ({
        ...acc,
        serviceAccountJson: undefined,
        accessToken: undefined
      }));
      res.json(safeAccounts);
    } catch (error) {
      console.error('Error fetching service accounts:', error);
      res.status(500).json({ error: 'Failed to fetch service accounts' });
    }
  });

  app.post('/api/service-accounts', requireAuth, rateLimitPerUser(10, 60 * 60 * 1000), async (req: any, res) => {
    try {
      const validation = insertServiceAccountSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const { serviceAccountJson, name } = validation.data;

      // Enhanced validation for service account JSON
      if (!validateServiceAccountJson(serviceAccountJson)) {
        SecureLogger.logSecurityEvent('INVALID_SERVICE_ACCOUNT_JSON', { userId: req.user.id }, req);
        return res.status(400).json({ error: 'Invalid service account JSON format' });
      }

      // Additional validation using Google service
      if (!googleIndexingService.validateServiceAccount(serviceAccountJson)) {
        return res.status(400).json({ error: 'Invalid service account credentials' });
      }

      // Parse service account
      const parsed = googleIndexingService.parseServiceAccount(serviceAccountJson);

      const account = await storage.createServiceAccount({
        userId: req.user.id,
        name: name || parsed.clientEmail,
        clientEmail: parsed.clientEmail,
        projectId: parsed.projectId,
        serviceAccountJson: parsed.serviceAccountJson,
        isActive: true,
        dailyQuotaLimit: 200,
        perMinuteQuotaLimit: 60
      });

      // Remove sensitive data
      const safeAccount = {
        ...account,
        serviceAccountJson: undefined,
        accessToken: undefined
      };

      res.status(201).json(safeAccount);
    } catch (error) {
      console.error('Error creating service account:', error);
      res.status(500).json({ error: 'Failed to create service account' });
    }
  });

  app.delete('/api/service-accounts/:id', requireAuth, validateUuid('id'), requireOwnership('service-account'), async (req: any, res) => {
    try {
      await storage.deleteServiceAccount(req.params.id);
      SecureLogger.logSecurityEvent('SERVICE_ACCOUNT_DELETED', { userId: req.user.id, serviceAccountId: req.params.id }, req);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting service account:', error);
      res.status(500).json({ error: 'Failed to delete service account' });
    }
  });

  // Quota usage routes
  app.get('/api/quota-usage', requireAuth, async (req: any, res) => {
    try {
      const usage = await storage.getQuotaUsageByUser(req.user.id);
      res.json(usage);
    } catch (error) {
      console.error('Error fetching quota usage:', error);
      res.status(500).json({ error: 'Failed to fetch quota usage' });
    }
  });

  // Indexing jobs routes
  app.get('/api/indexing-jobs', requireAuth, async (req: any, res) => {
    try {
      const jobs = await storage.getIndexingJobs(req.user.id);
      res.json(jobs);
    } catch (error) {
      console.error('Error fetching indexing jobs:', error);
      res.status(500).json({ error: 'Failed to fetch indexing jobs' });
    }
  });

  app.get('/api/indexing-jobs/:id', requireAuth, validateUuid('id'), requireOwnership('indexing-job'), async (req: any, res) => {
    try {
      const job = await storage.getIndexingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(job);
    } catch (error) {
      console.error('Error fetching indexing job:', error);
      res.status(500).json({ error: 'Failed to fetch indexing job' });
    }
  });

  app.post('/api/indexing-jobs/from-sitemap', requireAuth, async (req: any, res) => {
    try {
      const validation = createJobFromSitemapSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const { name, sitemapUrl, schedule, cronExpression } = validation.data;

      // Parse sitemap to get URLs count
      const urls = await sitemapParser.parseUrls(sitemapUrl);
      
      let cron = cronExpression;
      if (!cron && schedule !== 'one-time') {
        cron = jobScheduler.generateCronExpression(schedule);
      }

      const job = await storage.createIndexingJob({
        userId: req.user.id,
        name,
        schedule,
        sitemapUrl,
        totalUrls: urls.length,
        cronExpression: cron,
        nextRun: schedule === 'one-time' ? new Date() : new Date(Date.now() + 60000), // 1 minute from now
        status: 'pending'
      });

      // Schedule the job if it's recurring, or execute immediately if one-time
      if (schedule === 'one-time') {
        // Execute immediately in the background
        setImmediate(() => {
          jobScheduler.executeJob(job.id);
        });
      } else if (cron) {
        jobScheduler.scheduleJob(job.id, cron);
      }

      res.status(201).json(job);
    } catch (error) {
      console.error('Error creating job from sitemap:', error);
      res.status(500).json({ error: 'Failed to create job from sitemap' });
    }
  });

  app.post('/api/indexing-jobs/from-urls', requireAuth, async (req: any, res) => {
    try {
      const validation = createJobFromUrlsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const { name, urls, schedule, cronExpression } = validation.data;

      let cron = cronExpression;
      if (!cron && schedule !== 'one-time') {
        cron = jobScheduler.generateCronExpression(schedule);
      }

      const job = await storage.createIndexingJob({
        userId: req.user.id,
        name,
        schedule,
        manualUrls: urls,
        totalUrls: urls.length,
        cronExpression: cron,
        nextRun: schedule === 'one-time' ? new Date() : new Date(Date.now() + 60000),
        status: 'pending'
      });

      // Schedule the job if it's recurring, or execute immediately if one-time
      if (schedule === 'one-time') {
        // Execute immediately in the background
        setImmediate(() => {
          jobScheduler.executeJob(job.id);
        });
      } else if (cron) {
        jobScheduler.scheduleJob(job.id, cron);
      }

      res.status(201).json(job);
    } catch (error) {
      console.error('Error creating job from URLs:', error);
      res.status(500).json({ error: 'Failed to create job from URLs' });
    }
  });

  app.patch('/api/indexing-jobs/:id', requireAuth, async (req: any, res) => {
    try {
      const { status, ...updates } = req.body;
      
      const job = await storage.updateIndexingJob(req.params.id, { status, ...updates });
      
      // Handle job scheduling changes
      if (status === 'paused') {
        jobScheduler.unscheduleJob(req.params.id);
      } else if (status === 'pending' && job.cronExpression) {
        jobScheduler.scheduleJob(req.params.id, job.cronExpression);
      }
      
      res.json(job);
    } catch (error) {
      console.error('Error updating indexing job:', error);
      res.status(500).json({ error: 'Failed to update indexing job' });
    }
  });

  app.delete('/api/indexing-jobs/:id', requireAuth, async (req: any, res) => {
    try {
      jobScheduler.unscheduleJob(req.params.id);
      await storage.deleteIndexingJob(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting indexing job:', error);
      res.status(500).json({ error: 'Failed to delete indexing job' });
    }
  });

  // Bulk delete jobs route
  app.delete('/api/indexing-jobs/bulk', requireAuth, async (req: any, res) => {
    try {
      const { jobIds } = req.body;
      
      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        return res.status(400).json({ error: 'jobIds must be a non-empty array' });
      }
      
      // Unschedule all jobs first
      jobIds.forEach(id => jobScheduler.unscheduleJob(id));
      
      // Delete multiple jobs (with user ownership check)
      await storage.deleteMultipleIndexingJobs(jobIds, req.user.id);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error bulk deleting indexing jobs:', error);
      res.status(500).json({ error: 'Failed to bulk delete indexing jobs' });
    }
  });

  app.post('/api/indexing-jobs/:id/rerun', requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getIndexingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // DO NOT delete URL submissions - preserve submission history
      // The job scheduler will handle duplicate URLs appropriately during processing

      // Reset job status and counters for re-run
      const updatedJob = await storage.updateIndexingJob(req.params.id, {
        status: 'pending',
        processedUrls: 0,
        successfulUrls: 0,
        failedUrls: 0,
        lastRun: null,
        nextRun: new Date(),
        pausedDueToQuota: false,  // Reset quota pause status
        pausedAt: null,
        pauseReason: null,
        // CRITICAL: Release any existing locks
        lockedAt: null,
        lockedBy: null
      });

      // IMMEDIATE real-time update via WebSocket
      if (wss) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'job_updated',
              jobId: req.params.id,
              status: 'pending',
              data: updatedJob
            }));
          }
        });
      }

      // Execute the job immediately
      setImmediate(() => {
        jobScheduler.executeJob(req.params.id);
      });

      res.json(updatedJob);
    } catch (error) {
      console.error('Error re-running indexing job:', error);
      res.status(500).json({ error: 'Failed to re-run indexing job' });
    }
  });

  // Resume paused job endpoint
  app.post('/api/indexing-jobs/:id/resume', requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getIndexingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!job.pausedDueToQuota) {
        return res.status(400).json({ error: 'Job is not paused due to quota limits' });
      }

      // Check if quota is now available
      const quotaCheck = await quotaPauseManager.checkQuotaAvailability(job.userId);
      
      if (quotaCheck.hasAvailableQuota) {
        // Resume the job
        const updatedJob = await storage.updateIndexingJob(req.params.id, {
          status: 'pending',
          pausedDueToQuota: false,
          pausedAt: null,
          pauseReason: null,
          resumeAfter: null
        });

        // Execute the job immediately
        setImmediate(() => {
          jobScheduler.executeJob(req.params.id);
        });

        res.json({ 
          success: true, 
          message: 'Job resumed successfully',
          job: updatedJob 
        });
      } else {
        res.json({ 
          success: false, 
          message: quotaCheck.pauseReason || 'Quota still not available',
          availableAccounts: quotaCheck.availableAccounts.length,
          exhaustedAccounts: quotaCheck.exhaustedAccounts.length
        });
      }
    } catch (error) {
      console.error('Error resuming indexing job:', error);
      res.status(500).json({ error: 'Failed to resume indexing job' });
    }
  });

  // URL submissions routes
  app.get('/api/indexing-jobs/:id/submissions', requireAuth, async (req: any, res) => {
    try {
      const submissions = await storage.getUrlSubmissions(req.params.id);
      res.json(submissions);
    } catch (error) {
      console.error('Error fetching URL submissions:', error);
      res.status(500).json({ error: 'Failed to fetch URL submissions' });
    }
  });

  // Sitemap utilities
  app.post('/api/sitemap/validate', requireAuth, async (req: any, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const isValid = await sitemapParser.validateSitemap(url);
      const stats = isValid ? await sitemapParser.getSitemapStats(url) : null;

      res.json({ valid: isValid, stats });
    } catch (error) {
      console.error('Error validating sitemap:', error);
      res.status(500).json({ error: 'Failed to validate sitemap' });
    }
  });

  app.post('/api/sitemap/parse', requireAuth, async (req: any, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const urls = await sitemapParser.parseUrls(url);
      res.json({ urls: urls.slice(0, 100) }); // Return first 100 for preview
    } catch (error) {
      console.error('Error parsing sitemap:', error);
      res.status(500).json({ error: 'Failed to parse sitemap' });
    }
  });

  // Asset proxy routes to hide Supabase storage URLs
  app.get('/api/assets/logo', async (req, res) => {
    try {
      const logoUrl = assetConfig.getAssetUrl('logo');
      const response = await fetch(logoUrl);
      
      if (!response.ok) {
        return res.status(404).json({ error: 'Logo not found' });
      }
      
      const buffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      });
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error serving logo:', error);
      res.status(500).json({ error: 'Failed to load logo' });
    }
  });

  app.get('/api/assets/icon', async (req, res) => {
    try {
      const iconUrl = assetConfig.getAssetUrl('icon');
      const response = await fetch(iconUrl);
      
      if (!response.ok) {
        return res.status(404).json({ error: 'Icon not found' });
      }
      
      const buffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      });
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error serving icon:', error);
      res.status(500).json({ error: 'Failed to load icon' });
    }
  });

  app.get('/api/assets/favicon', async (req, res) => {
    try {
      const faviconUrl = assetConfig.getAssetUrl('favicon');
      const response = await fetch(faviconUrl);
      
      if (!response.ok) {
        return res.status(404).json({ error: 'Favicon not found' });
      }
      
      const buffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      });
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error serving favicon:', error);
      res.status(500).json({ error: 'Failed to load favicon' });
    }
  });

  // Test email connection endpoint
  app.post('/api/test-email', requireAuth, async (req: any, res) => {
    try {
      console.log('Testing email connection...');
      const success = await emailService.testConnection();
      
      if (success) {
        // Try sending a test email
        const testResult = await emailService.sendJobCompletionEmail(
          req.user.email,
          'Test Job',
          5,
          1,
          6
        );
        
        res.json({ 
          connectionTest: success, 
          emailTest: testResult,
          message: 'Email test completed successfully'
        });
      } else {
        res.status(500).json({ 
          connectionTest: success, 
          message: 'Email connection test failed'
        });
      }
    } catch (error) {
      console.error('Email test error:', error);
      res.status(500).json({ error: 'Email test failed', details: error.message });
    }
  });

  // Test daily quota report email endpoint (accessible via GET for browser testing)
  app.get('/test-daily-email', async (req: any, res) => {
    try {
      console.log('🧪 Testing daily quota report email via simple GET...');
      
      const testEmail = req.query.email;
      if (!testEmail) {
        return res.status(400).json({ error: 'Email parameter is required' });
      }
      
      // Use the job scheduler test method
      const result = await jobScheduler.testDailyQuotaReport(testEmail);
      
      res.json({ 
        success: result,
        message: result ? `Daily report sent successfully to ${testEmail}` : 'Failed to send daily report',
        email: testEmail
      });
    } catch (error) {
      console.error('❌ Daily report test error:', error);
      res.status(500).json({ error: 'Daily report test failed', details: error.message });
    }
  });

  // Test daily quota report email endpoint
  app.post('/api/test-daily-report', requireAuth, async (req: any, res) => {
    try {
      console.log('Testing daily quota report email...');
      
      // Get user profile for name
      const userProfile = await storage.getUserProfile(req.user.id);
      const userName = userProfile?.fullName || userProfile?.email?.split('@')[0] || 'User';
      
      // Get actual user stats
      const stats = await storage.getDashboardStats(req.user.id);
      const userJobs = await storage.getIndexingJobs(req.user.id);
      const userAccounts = await storage.getServiceAccounts(req.user.id);
      
      // Calculate additional stats
      const totalProcessed = userJobs.reduce((sum, job) => sum + (job.processedUrls || 0), 0);
      const totalFailedUrls = Math.max(0, totalProcessed - stats.totalUrlsIndexed);
      
      // Calculate completed jobs from today  
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completedJobs = userJobs.filter(job => 
        job.status === 'completed' && 
        job.updatedAt && 
        new Date(job.updatedAt) >= today
      ).length;
      
      const activeServiceAccounts = userAccounts.filter(account => account.isActive).length;
      
      // Use provided email or default to user's email
      const testEmail = req.body.email || req.user.email;
      
      const testResult = await emailService.sendDailyQuotaReport(testEmail, userName, {
        totalSuccessfulUrls: stats.totalUrlsIndexed,
        totalFailedUrls,
        completedJobs,
        activeJobs: stats.activeJobs,
        totalServiceAccounts: userAccounts.length,
        activeServiceAccounts,
        quotaUsed: stats.apiQuotaUsed,
        quotaLimit: stats.apiQuotaLimit,
        quotaPercentage: Math.min(100, (stats.apiQuotaUsed / stats.apiQuotaLimit) * 100)
      });
      
      res.json({ 
        success: testResult,
        message: testResult ? `Daily report sent successfully to ${testEmail}` : 'Failed to send daily report',
        testData: {
          userName,
          totalSuccessfulUrls: stats.totalUrlsIndexed,
          totalFailedUrls,
          completedJobs,
          activeJobs: stats.activeJobs,
          totalServiceAccounts: userAccounts.length,
          activeServiceAccounts,
          quotaUsed: stats.apiQuotaUsed,
          quotaLimit: stats.apiQuotaLimit
        }
      });
    } catch (error) {
      console.error('Daily report test error:', error);
      res.status(500).json({ error: 'Daily report test failed', details: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Store WebSocket server reference for broadcasting updates
  (global as any).wss = wss;
  
  return httpServer;
}
