import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertServiceAccountSchema, 
  insertIndexingJobSchema,
  createJobFromSitemapSchema,
  createJobFromUrlsSchema
} from "@shared/schema";
import { verifyAuth } from "./services/supabase";
import { googleIndexingService } from "./services/google-indexing";
import { sitemapParser } from "./services/sitemap-parser";
import { jobScheduler } from "./services/job-scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required' });
      }

      const token = authHeader.substring(7);
      const user = await verifyAuth(token);
      req.user = user;
      next();
    } catch (error) {
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

  app.post('/api/service-accounts', requireAuth, async (req: any, res) => {
    try {
      const validation = insertServiceAccountSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const { serviceAccountJson, name } = validation.data;

      // Validate service account JSON
      if (!googleIndexingService.validateServiceAccount(serviceAccountJson)) {
        return res.status(400).json({ error: 'Invalid service account JSON' });
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

  app.delete('/api/service-accounts/:id', requireAuth, async (req: any, res) => {
    try {
      await storage.deleteServiceAccount(req.params.id);
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

  app.get('/api/indexing-jobs/:id', requireAuth, async (req: any, res) => {
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

  app.post('/api/indexing-jobs/:id/rerun', requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getIndexingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Reset job status and counters for re-run
      const updatedJob = await storage.updateIndexingJob(req.params.id, {
        status: 'pending',
        processedUrls: 0,
        successfulUrls: 0,
        failedUrls: 0,
        lastRun: null,
        nextRun: new Date()
      });

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

  // Initialize job scheduler
  jobScheduler.initializeScheduler();

  const httpServer = createServer(app);
  return httpServer;
}
