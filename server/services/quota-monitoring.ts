import { db } from './supabase';
import { 
  serviceAccounts, 
  quotaUsage, 
  quotaAlerts,
  dashboardNotifications,
  userProfiles,
  type ServiceAccount,
  type QuotaAlert,
  type DashboardNotification 
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { emailService } from './email-service';

interface QuotaStatus {
  serviceAccount: ServiceAccount;
  currentUsage: number;
  percentage: number;
  alertType: 'warning' | 'critical' | 'exhausted' | null;
}

export class QuotaMonitoringService {
  // Get quota status for all service accounts for a user
  async getQuotaStatusForUser(userId: string): Promise<QuotaStatus[]> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all active service accounts for user
    const accounts = await db
      .select()
      .from(serviceAccounts)
      .where(and(
        eq(serviceAccounts.userId, userId),
        eq(serviceAccounts.isActive, true)
      ));

    const statuses: QuotaStatus[] = [];

    for (const account of accounts) {
      // Get today's usage
      const usage = await db
        .select()
        .from(quotaUsage)
        .where(and(
          eq(quotaUsage.serviceAccountId, account.id),
          eq(quotaUsage.date, today)
        ))
        .limit(1);

      const currentUsage = usage.length ? usage[0].requestsCount : 0;
      const percentage = (currentUsage / account.dailyQuotaLimit) * 100;
      
      let alertType: 'warning' | 'critical' | 'exhausted' | null = null;
      if (percentage >= 100) alertType = 'exhausted';
      else if (percentage >= 95) alertType = 'critical';
      else if (percentage >= 80) alertType = 'warning'; // Will use user's threshold

      statuses.push({
        serviceAccount: account,
        currentUsage,
        percentage,
        alertType
      });
    }

    return statuses;
  }

  // Check and send quota alerts for all users
  async checkAndSendQuotaAlerts(): Promise<void> {
    console.log('🔍 Checking quota alerts for all users...');
    
    // Get all users with quota alerts enabled
    const users = await db
      .select({
        id: userProfiles.id,
        email: userProfiles.email,
        fullName: userProfiles.fullName,
        emailQuotaAlerts: userProfiles.emailQuotaAlerts,
        quotaAlertThreshold: userProfiles.quotaAlertThreshold,
        dashboardNotifications: userProfiles.dashboardNotifications
      })
      .from(userProfiles)
      .where(eq(userProfiles.emailQuotaAlerts, true));

    console.log(`📊 Found ${users.length} users with quota alerts enabled`);

    for (const user of users) {
      try {
        await this.checkUserQuotaAlerts(user);
      } catch (error) {
        console.error(`❌ Error checking quota alerts for user ${user.id}:`, error);
      }
    }
  }

  // Check quota alerts for a specific user
  private async checkUserQuotaAlerts(user: any): Promise<void> {
    const statuses = await this.getQuotaStatusForUser(user.id);
    const threshold = user.quotaAlertThreshold || 80;
    const today = new Date().toISOString().split('T')[0];

    for (const status of statuses) {
      const { serviceAccount, currentUsage, percentage } = status;
      
      // Determine alert type based on user's threshold
      let alertType: 'warning' | 'critical' | 'exhausted' | null = null;
      if (percentage >= 100) alertType = 'exhausted';
      else if (percentage >= 95) alertType = 'critical';
      else if (percentage >= threshold) alertType = 'warning';

      if (!alertType) continue;

      // Check if we've already sent this type of alert today
      const existingAlert = await db
        .select()
        .from(quotaAlerts)
        .where(and(
          eq(quotaAlerts.userId, user.id),
          eq(quotaAlerts.serviceAccountId, serviceAccount.id),
          eq(quotaAlerts.alertType, alertType),
          sql`DATE(${quotaAlerts.sentAt}) = ${today}`
        ))
        .limit(1);

      if (existingAlert.length > 0) {
        continue; // Already sent this alert type today
      }

      // Send email alert
      await this.sendQuotaAlert(user, serviceAccount, alertType, currentUsage, percentage);
      
      // Create dashboard notification if enabled
      if (user.dashboardNotifications) {
        await this.createDashboardNotification(user.id, serviceAccount, alertType, currentUsage, percentage);
      }

      // Record the alert
      await db.insert(quotaAlerts).values({
        userId: user.id,
        serviceAccountId: serviceAccount.id,
        alertType,
        thresholdPercentage: Math.round(percentage),
        currentUsage,
        quotaLimit: serviceAccount.dailyQuotaLimit
      });

      console.log(`📧 Sent ${alertType} quota alert for ${serviceAccount.name} to ${user.email}`);
    }
  }

  // Send quota alert email
  private async sendQuotaAlert(
    user: any, 
    serviceAccount: ServiceAccount, 
    alertType: 'warning' | 'critical' | 'exhausted',
    currentUsage: number,
    percentage: number
  ): Promise<void> {
    const alertTitles = {
      warning: '⚠️ Quota Warning',
      critical: '🚨 Quota Critical',
      exhausted: '🛑 Quota Exhausted'
    };

    const subject = `${alertTitles[alertType]} - ${serviceAccount.name} (${Math.round(percentage)}% used)`;
    
    await emailService.sendQuotaAlert(
      user.email,
      user.fullName || 'User',
      serviceAccount.name,
      currentUsage,
      serviceAccount.dailyQuotaLimit,
      Math.round(percentage),
      alertType,
      subject
    );
  }

  // Create dashboard notification
  private async createDashboardNotification(
    userId: string,
    serviceAccount: ServiceAccount,
    alertType: 'warning' | 'critical' | 'exhausted',
    currentUsage: number,
    percentage: number
  ): Promise<void> {
    const titles = {
      warning: 'Quota Warning',
      critical: 'Quota Critical',
      exhausted: 'Quota Exhausted'
    };

    const messages = {
      warning: `Service account "${serviceAccount.name}" has used ${Math.round(percentage)}% of daily quota (${currentUsage}/${serviceAccount.dailyQuotaLimit})`,
      critical: `Service account "${serviceAccount.name}" is almost at quota limit: ${Math.round(percentage)}% used (${currentUsage}/${serviceAccount.dailyQuotaLimit})`,
      exhausted: `Service account "${serviceAccount.name}" has reached its daily quota limit (${currentUsage}/${serviceAccount.dailyQuotaLimit})`
    };

    const notificationType = alertType === 'warning' ? 'warning' : 'error';
    
    // Set expiration - warning expires in 1 day, critical/exhausted expire at midnight
    const expiresAt = new Date();
    if (alertType === 'warning') {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else {
      expiresAt.setHours(23, 59, 59, 999); // End of today
    }

    await db.insert(dashboardNotifications).values({
      userId,
      title: titles[alertType],
      message: messages[alertType],
      type: notificationType,
      relatedEntityType: 'service_account',
      relatedEntityId: serviceAccount.id,
      expiresAt
    });
  }

  // Get unread dashboard notifications for a user
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

  // Mark notification as read
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(dashboardNotifications)
      .set({ isRead: true })
      .where(and(
        eq(dashboardNotifications.id, notificationId),
        eq(dashboardNotifications.userId, userId)
      ));
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(dashboardNotifications)
      .set({ isRead: true })
      .where(eq(dashboardNotifications.userId, userId));
  }

  // Get service accounts sorted by least usage (for load balancing)
  async getServiceAccountsByUsage(userId: string): Promise<ServiceAccount[]> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get service accounts with their current usage
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
      .orderBy(sql`current_usage ASC`); // Least used first

    return accountsWithUsage.map(row => row.account);
  }

  // Clean up old notifications and alerts
  async cleanupOldData(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Clean up old notifications
    await db
      .delete(dashboardNotifications)
      .where(sql`${dashboardNotifications.createdAt} < ${thirtyDaysAgo} OR 
                 (${dashboardNotifications.expiresAt} IS NOT NULL AND ${dashboardNotifications.expiresAt} < NOW())`);
    
    // Clean up old quota alerts (keep for 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    await db
      .delete(quotaAlerts)
      .where(sql`${quotaAlerts.createdAt} < ${sevenDaysAgo}`);
      
    console.log('🧹 Cleaned up old notifications and quota alerts');
  }
}

export const quotaMonitoringService = new QuotaMonitoringService();