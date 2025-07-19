import { pgTable, text, serial, integer, boolean, uuid, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed', 'paused', 'cancelled']);
export const jobScheduleEnum = pgEnum('job_schedule', ['one-time', 'hourly', 'daily', 'weekly', 'monthly']);
export const urlStatusEnum = pgEnum('url_status', ['pending', 'success', 'error', 'quota_exceeded']);

export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'super_admin']);

export const userProfiles = pgTable("indb_user_profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  role: userRoleEnum("role").default('user').notNull(),
  emailJobCompletion: boolean("email_job_completion").default(true),
  emailJobFailures: boolean("email_job_failures").default(false),
  emailDailyReports: boolean("email_daily_reports").default(true),
  emailQuotaAlerts: boolean("email_quota_alerts").default(true),
  quotaAlertThreshold: integer("quota_alert_threshold").default(80),
  dashboardNotifications: boolean("dashboard_notifications").default(true),
  requestTimeout: integer("request_timeout").default(30),
  retryAttempts: integer("retry_attempts").default(3),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const serviceAccounts = pgTable("indb_service_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  clientEmail: text("client_email").notNull(),
  projectId: text("project_id").notNull(),
  isActive: boolean("is_active").default(true),
  dailyQuotaLimit: integer("daily_quota_limit").default(200),
  perMinuteQuotaLimit: integer("per_minute_quota_limit").default(60),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  serviceAccountJson: text("service_account_json").notNull(),
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  accessTokenEncrypted: text("access_token_encrypted"),
  encryptionIv: text("encryption_iv"),
  encryptionTag: text("encryption_tag"),
});

export const indexingJobs = pgTable("indb_indexing_jobs", {
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
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const urlSubmissions = pgTable("indb_url_submissions", {
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

export const quotaUsage = pgTable("indb_quota_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceAccountId: uuid("service_account_id").notNull(),
  date: date("date").defaultNow(),
  requestsCount: integer("requests_count").default(0),
});

export const quotaAlertTypeEnum = pgEnum('quota_alert_type', ['warning', 'critical', 'exhausted']);
export const notificationTypeEnum = pgEnum('notification_type', ['info', 'warning', 'error', 'success']);

export const quotaAlerts = pgTable("indb_quota_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  serviceAccountId: uuid("service_account_id").notNull(),
  alertType: quotaAlertTypeEnum("alert_type").notNull(),
  thresholdPercentage: integer("threshold_percentage").notNull(),
  currentUsage: integer("current_usage").notNull(),
  quotaLimit: integer("quota_limit").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dashboardNotifications = pgTable("indb_dashboard_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull(),
  isRead: boolean("is_read").default(false),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Insert schemas
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  role: z.enum(['user', 'admin', 'super_admin']).default('user'),
});

export const updateUserSettingsSchema = z.object({
  emailJobCompletion: z.boolean().optional(),
  emailJobFailures: z.boolean().optional(),
  emailDailyReports: z.boolean().optional(),
  emailQuotaAlerts: z.boolean().optional(),
  quotaAlertThreshold: z.number().min(50).max(95).optional(),
  dashboardNotifications: z.boolean().optional(),
  requestTimeout: z.number().min(5).max(300).optional(),
  retryAttempts: z.number().min(0).max(10).optional(),
});

export const insertServiceAccountSchema = createInsertSchema(serviceAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  clientEmail: true,
  projectId: true,
  accessToken: true,
  tokenExpiresAt: true,
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

export const createJobFromSitemapSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  sitemapUrl: z.string().url("Valid sitemap URL is required"),
  schedule: z.enum(['one-time', 'hourly', 'daily', 'weekly', 'monthly']).default('one-time'),
  cronExpression: z.string().optional(),
});

export const createJobFromUrlsSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  urls: z.array(z.string().url("Valid URL is required")).min(1, "At least one URL is required"),
  schedule: z.enum(['one-time', 'hourly', 'daily', 'weekly', 'monthly']).default('one-time'),
  cronExpression: z.string().optional(),
});

export const insertUrlSubmissionSchema = createInsertSchema(urlSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuotaUsageSchema = createInsertSchema(quotaUsage).omit({
  id: true,
});

export const insertQuotaAlertSchema = createInsertSchema(quotaAlerts).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export const insertDashboardNotificationSchema = createInsertSchema(dashboardNotifications).omit({
  id: true,
  createdAt: true,
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

export type QuotaAlert = typeof quotaAlerts.$inferSelect;
export type InsertQuotaAlert = z.infer<typeof insertQuotaAlertSchema>;

export type DashboardNotification = typeof dashboardNotifications.$inferSelect;
export type InsertDashboardNotification = z.infer<typeof insertDashboardNotificationSchema>;

export type CreateJobFromSitemap = z.infer<typeof createJobFromSitemapSchema>;
export type CreateJobFromUrls = z.infer<typeof createJobFromUrlsSchema>;

// User role types and utilities
export type UserRole = 'user' | 'admin' | 'super_admin';

export const USER_ROLES = {
  USER: 'user' as const,
  ADMIN: 'admin' as const,
  SUPER_ADMIN: 'super_admin' as const,
} as const;

// Role hierarchy utilities for authorization
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    'user': 1,
    'admin': 2,
    'super_admin': 3,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function isAdmin(userRole: UserRole): boolean {
  return userRole === 'admin' || userRole === 'super_admin';
}

export function isSuperAdmin(userRole: UserRole): boolean {
  return userRole === 'super_admin';
}
