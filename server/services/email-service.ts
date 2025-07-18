import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface EmailData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    this.config = this.loadConfig();
    this.transporter = this.createTransporter();
  }

  private loadConfig(): EmailConfig {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_NAME', 'SMTP_FROM_EMAIL'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required SMTP environment variables: ${missing.join(', ')}`);
    }

    return {
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: false, // Always use TLS, not SSL
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
      fromName: process.env.SMTP_FROM_NAME!,
      fromEmail: process.env.SMTP_FROM_EMAIL!,
    };
  }

  private createTransporter(): nodemailer.Transporter {
    return nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: false, // Use STARTTLS instead of SSL
      requireTLS: true, // Require TLS upgrade
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
      tls: {
        rejectUnauthorized: false, // For self-signed certificates
        minVersion: 'TLSv1.2', // Minimum TLS version
      },
      debug: false, // Disable debug logging
      logger: false // Disable logging
    });
  }

  private async loadTemplate(templateName: string): Promise<string> {
    try {
      const templatePath = join(process.cwd(), 'server', 'email-templates', `${templateName}.html`);
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      console.error(`Failed to load email template: ${templateName}`, error);
      throw new Error(`Email template not found: ${templateName}`);
    }
  }

  private replaceTemplateVariables(template: string, data: Record<string, any>): string {
    let result = template;
    
    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // Load and process template
      const template = await this.loadTemplate(emailData.template);
      const htmlContent = this.replaceTemplateVariables(template, emailData.data);

      // Send email
      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: htmlContent,
      });

      console.log(`Email sent successfully to ${emailData.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendJobCompletionEmail(userEmail: string, userName: string, jobName: string, successUrls: number, failedUrls: number, totalUrls: number): Promise<boolean> {
    const data = {
      userName,
      jobName,
      successUrls,
      failedUrls,
      totalUrls,
      completionRate: Math.round((successUrls / totalUrls) * 100),
      logoUrl: process.env.LOGO_URL || '',
      siteUrl: process.env.SITE_URL || 'http://localhost:5000',
      timestamp: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    return this.sendEmail({
      to: userEmail,
      subject: `🎉 Great News! Your IndexNow Job "${jobName}" Has Been Completed Successfully`,
      template: 'job-completion',
      data
    });
  }

  async sendJobFailureEmail(userEmail: string, userName: string, jobName: string, errorMessage: string): Promise<boolean> {
    const data = {
      userName,
      jobName,
      errorMessage,
      logoUrl: process.env.LOGO_URL || '',
      siteUrl: process.env.SITE_URL || 'http://localhost:5000',
      timestamp: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    return this.sendEmail({
      to: userEmail,
      subject: `⚠️ Action Required: IndexNow Job "${jobName}" Encountered an Issue`,
      template: 'job-failure',
      data
    });
  }

  async sendDailyQuotaReport(userEmail: string, userName: string, stats: any): Promise<boolean> {
    const data = {
      userName,
      ...stats,
      logoUrl: process.env.LOGO_URL || '',
      reportDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };

    return this.sendEmail({
      to: userEmail,
      subject: `IndexNow Daily Report - ${data.reportDate}`,
      template: 'daily-quota-report',
      data
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP connection successful');
      return true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();