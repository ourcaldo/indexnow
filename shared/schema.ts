import { pgTable, text, serial, integer, boolean, uuid, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed', 'paused', 'cancelled']);
export const jobScheduleEnum = pgEnum('job_schedule', ['one-time', 'hourly', 'daily', 'weekly', 'monthly']);
export const urlStatusEnum = pgEnum('url_status', ['pending', 'success', 'error', 'quota_exceeded']);

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const serviceAccounts = pgTable("service_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  serviceAccountJson: text("service_account_json").notNull(),
  clientEmail: text("client_email").notNull(),
  projectId: text("project_id").notNull(),
  isActive: boolean("is_active").default(true),
  dailyQuotaLimit: integer("daily_quota_limit").default(200),
  perMinuteQuotaLimit: integer("per_minute_quota_limit").default(60),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const indexingJobs = pgTable("indexing_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  schedule: jobScheduleEnum("schedule").default('one-time'),
  status: jobStatusEnum("status").default('pending'),
  totalUrls: integer("total_urls").default(0),
  processedUrls: integer("processed_urls").default(0),
  successfulUrls: integer("successful_urls").default(0),
  failedUrls: integer("failed_urls").default(0),
  sitemapUrl: text("sitemap_url"),
  manualUrls: text("manual_urls").array(),
  cronExpression: text("cron_expression"),
  nextRun: timestamp("next_run"),
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const urlSubmissions = pgTable("url_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull(),
  url: text("url").notNull(),
  status: urlStatusEnum("status").default('pending'),
  serviceAccountId: uuid("service_account_id"),
  errorMessage: text("error_message"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quotaUsage = pgTable("quota_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceAccountId: uuid("service_account_id").notNull(),
  date: date("date").defaultNow(),
  requestsCount: integer("requests_count").default(0),
});

// Insert schemas
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceAccountSchema = createInsertSchema(serviceAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  clientEmail: true,
  projectId: true,
}).extend({
  serviceAccountJson: z.string().min(1, "Service account JSON is required"),
  name: z.string().optional(),
});

export const insertIndexingJobSchema = createInsertSchema(indexingJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  processedUrls: true,
  successfulUrls: true,
  failedUrls: true,
});

export const insertUrlSubmissionSchema = createInsertSchema(urlSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuotaUsageSchema = createInsertSchema(quotaUsage).omit({
  id: true,
});

// Types
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type ServiceAccount = typeof serviceAccounts.$inferSelect;
export type InsertServiceAccount = z.infer<typeof insertServiceAccountSchema>;

export type IndexingJob = typeof indexingJobs.$inferSelect;
export type InsertIndexingJob = z.infer<typeof insertIndexingJobSchema>;

export type UrlSubmission = typeof urlSubmissions.$inferSelect;
export type InsertUrlSubmission = z.infer<typeof insertUrlSubmissionSchema>;

export type QuotaUsage = typeof quotaUsage.$inferSelect;
export type InsertQuotaUsage = z.infer<typeof insertQuotaUsageSchema>;

// Additional schemas for API
export const createJobFromSitemapSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  sitemapUrl: z.string().url("Valid sitemap URL is required"),
  schedule: z.enum(['one-time', 'hourly', 'daily', 'weekly', 'monthly']),
  cronExpression: z.string().optional(),
});

export const createJobFromUrlsSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  urls: z.array(z.string().url()).min(1, "At least one URL is required"),
  schedule: z.enum(['one-time', 'hourly', 'daily', 'weekly', 'monthly']),
  cronExpression: z.string().optional(),
});

export type CreateJobFromSitemap = z.infer<typeof createJobFromSitemapSchema>;
export type CreateJobFromUrls = z.infer<typeof createJobFromUrlsSchema>;
