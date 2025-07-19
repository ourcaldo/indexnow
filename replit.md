# Google Indexing Dashboard

## Overview

This is a full-stack web application that provides an instant indexing solution similar to RankMath's Instant Indexing plugin. The application allows users to manage Google service accounts, submit URLs for indexing via Google Search Console API, and schedule automated indexing jobs. It features a clean, professional dashboard with a warm color scheme and collapsible sidebar navigation.

## User Preferences

Preferred communication style: Simple, everyday language.
**CRITICAL DATABASE POLICY: SUPABASE ONLY**
- This project uses SUPABASE database exclusively - NO local PostgreSQL, NO local database installation EVER
- Database connection: Supabase PostgreSQL via DATABASE_URL environment variable only
- Authentication: JWT-based approach for Google Indexing API with token caching
- NEVER install local PostgreSQL or any local database solutions
- ALL database operations go through Supabase connection string only

## Recent Changes

### July 17, 2025 - Migration from Replit Agent to Replit Environment
- Updated database schema to match actual Supabase structure with `service_account_json`, `access_token`, and `token_expires_at` columns
- Implemented JWT-based authentication approach for Google Indexing API using google-auth-library
- Added token caching system to reuse access tokens until expiry (with 5-minute buffer)
- Updated storage layer and routes to work with new schema structure
- Successfully tested URL indexing with proper token generation and caching
- Migration completed successfully with all components working

## System Architecture

The application follows a modern full-stack architecture with clear separation of concerns:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state management
- **UI Framework**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom warm color scheme
- **Build Tool**: Vite with TypeScript support

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with middleware-based architecture
- **Authentication**: JWT-based auth with Supabase integration
- **Database**: PostgreSQL via Drizzle ORM
- **External APIs**: Google Indexing API integration

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Type-safe schema definitions with Zod validation
- **Tables**: User profiles, service accounts, indexing jobs, URL submissions, quota usage
- **Relationships**: Foreign key relationships between users, accounts, and jobs

## Key Components

### Authentication System
- Supabase-based authentication with JWT tokens
- Protected routes with middleware verification
- User profile management with email and full name
- Session handling and automatic token refresh

### Service Account Management
- Google Service Account JSON upload and validation
- Secure storage of private keys and credentials
- Quota tracking (daily and per-minute limits)
- Active/inactive status management

### Indexing Job System
- One-time and scheduled job support (hourly, daily, weekly, monthly)
- Sitemap parsing for automatic URL discovery
- Manual URL submission capability
- Job status tracking (pending, running, completed, failed, paused, cancelled)
- Progress monitoring with success/failure counts

### Google API Integration
- Google Indexing API client with service account authentication
- Automatic URL submission with retry logic
- Quota usage tracking and enforcement
- Error handling and status reporting

### Scheduling System
- Cron-based job scheduler for automated indexing
- Flexible scheduling options with cron expressions
- Job persistence and recovery on restart
- Next run calculation and display

## Data Flow

1. **User Authentication**: Users sign up/login via Supabase auth
2. **Service Account Setup**: Users upload Google service account JSON files
3. **Job Creation**: Users create indexing jobs with sitemaps or manual URLs
4. **URL Processing**: System parses sitemaps and extracts URLs for indexing
5. **API Submission**: URLs are submitted to Google Indexing API using service accounts
6. **Quota Tracking**: API usage is tracked against service account limits
7. **Status Updates**: Job progress and URL submission results are updated in real-time

## External Dependencies

### Core Dependencies
- **@supabase/supabase-js**: Authentication and database connection
- **drizzle-orm**: Type-safe database ORM
- **@neondatabase/serverless**: PostgreSQL database driver
- **googleapis**: Google API client for indexing requests
- **xml2js**: XML parsing for sitemap processing
- **node-cron**: Cron job scheduling

### UI Dependencies
- **@radix-ui/***: Headless UI components
- **@tanstack/react-query**: Server state management
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Build tool and dev server
- **typescript**: Type checking and compilation
- **tsx**: TypeScript execution for development

## Deployment Strategy

### Development Environment
- Vite dev server for frontend with HMR
- tsx for running TypeScript server code
- Environment variables for Supabase configuration
- Automatic reload on file changes

### Production Build
- Vite build for optimized frontend bundle
- esbuild for server-side code compilation
- Static asset serving from Express
- Environment-based configuration

### Database Setup
- Drizzle migrations for schema management
- PostgreSQL connection via Supabase/Neon
- Connection pooling for performance
- RLS (Row Level Security) for data isolation

### Environment Configuration
- Supabase URL and API keys
- Database connection strings
- Google service account credentials
- CORS and security headers

The application is designed to be scalable and maintainable, with clear separation between client and server code, type safety throughout, and robust error handling for external API integrations.

## Recent Changes (July 18, 2025)

### 📧 Email System Enhancement (Latest - Updated)
✓ **Fixed email template data issues** - Resolved parameter mismatch causing undefined values in email templates
✓ **Redesigned email templates with modern UI** - Created new templates based on user-provided design template
✓ **Updated email subjects** - Made subjects more engaging and descriptive with emojis
✓ **Added proper user name handling** - Fixed missing userName parameter in job completion emails
✓ **Enhanced template variables** - Added siteUrl for dashboard links and improved data formatting
✓ **Maintained brand consistency** - All templates now use IndexNow branding with proper logo integration

### 📧 Email System Enhancement (Previous)
✓ **Disabled verbose nodemailer debugging** - Removed excessive debug logging from email service for cleaner production logs
✓ **Redesigned email templates** - Updated all email templates with modern design inspired by user reference images
✓ **Integrated actual IndexNow logo** - Replaced text-based logo with actual PNG logo from Supabase storage
✓ **Removed outdated taglines** - Eliminated "Google Search Console Indexing Dashboard" branding as requested
✓ **Enhanced visual hierarchy** - Added centered success/failure icons with colored circular backgrounds
✓ **Improved email layout** - Better spacing, typography, and visual structure for professional appearance
✓ **Maintained brand consistency** - All templates now use consistent IndexNow branding and orange color scheme

### 🔧 Critical Security and Performance Fixes
✓ **Fixed hardcoded Supabase URLs** - Moved all asset URLs to environment variables
✓ **Fixed CORS security vulnerability** - Replaced wildcard (*) with configurable allowed origins
✓ **Optimized production logging** - Reduced debug logging noise in production environment
✓ **Added asset configuration service** - Centralized asset URL management with validation
✓ **Enhanced environment validation** - Added URL format validation and comprehensive checks
✓ **Provided database optimization recommendations** - Added indexes, constraints, and performance improvements

### Environment Variables Added:
- `LOGO_URL` - URL for application logo
- `ICON_URL` - URL for application icon  
- `FAVICON_URL` - URL for favicon
- `SITE_URL` - Base site URL (default: localhost:5000)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

### Database Migration to Prefixed Schema
✓ Successfully migrated all database tables to use `indb_` prefix format
✓ Updated all table names: `indexing_jobs` → `indb_indexing_jobs`, etc.
✓ Migrated security tables: `security_events` → `indb_security_events`, etc. 
✓ Updated all code references to use new prefixed table names
✓ Fixed security event recording to save to database for analytics
✓ Created comprehensive security analytics service with 7 event types
✓ Application now running successfully with new schema structure
✓ Added user role system with 'user', 'admin', 'super_admin' roles and default 'user'
✓ Created role-based authorization middleware for future admin features
✓ Implemented role hierarchy utilities and permission checking functions

## Recent Changes (July 19, 2025)

### ✅ Load Balancing & Quota Monitoring Enhancement (Latest)
✓ **Implemented load balancing** - Service accounts now sorted by least usage first for optimal distribution
✓ **Added quota monitoring system** - Automated checking every 15 minutes with three alert levels (warning, critical, exhausted)
✓ **Created quota alert emails** - Professional email templates with progress bars and detailed usage information
✓ **Added dashboard notifications** - In-app notification system for quota alerts and system updates
✓ **Enhanced database schema** - New tables for quota alerts and dashboard notifications with proper RLS policies
✓ **Integrated automatic cleanup** - Daily cleanup of old notifications and alerts at 2 AM
✓ **Successfully tested all alert types** - Confirmed delivery of warning (82%), critical (96%), and exhausted (100%) alerts to aldodkris@gmail.com
✓ **Enhanced user preferences** - Added quota alert threshold settings and notification preferences

### ✅ Daily Quota Report Email Fix (Previous)
✓ **Fixed placeholder rendering issue** - Daily quota report emails now properly render all placeholders instead of showing raw {{variable}} text
✓ **Corrected function parameters** - Fixed missing userName parameter in sendDailyQuotaReport call in job scheduler
✓ **Updated email template** - Changed "Detail Payment" to "Account Details" section in daily-quota-report.html template
✓ **Enhanced data calculation** - Added proper calculation for failed URLs, completed jobs from today, and active service accounts
✓ **Fixed email layout alignment** - Converted flexbox to table layout for proper left-right alignment in all email clients
✓ **Improved logging** - Added comprehensive logging for daily quota report generation and email sending
✓ **Successfully tested** - Confirmed email delivery to aldodkris@gmail.com with proper data rendering and layout alignment

### 🔧 Critical Fixes and Feature Enhancements (Previous)
✓ **Fixed access token encryption error** - Updated crypto service to use CBC mode instead of deprecated GCM methods
✓ **Added comprehensive filter system to manage jobs page** - Search by name/URL, filter by status and schedule
✓ **Enhanced pagination display** - Shows filtered vs total job counts for better UX
✓ **Resolved React Query cache conflicts** - Fixed navigation issues between pages
✓ **Improved job table functionality** - Real-time filtering with search and dropdown filters

### 🔧 Technical Improvements
- Replaced `crypto.createCipherGCM()` with `crypto.createCipher()` using AES-256-CBC mode
- Added search functionality across job names, sitemap URLs, and manual URLs
- Implemented status and schedule filtering with dropdown selectors
- Enhanced pagination to reflect filtered results accurately
- Added proper debug logging for troubleshooting navigation issues

## Recent Changes (July 19, 2025) - Pagination and Bulk Delete Implementation (Previous)

### ✅ Enhancements Completed
✓ **Added pagination to manage jobs page** - Jobs now display 20 records per page with navigation controls
✓ **Implemented bulk delete functionality** - Users can select multiple jobs and delete them with confirmation dialog
✓ **Removed Replit dev banner script** - Eliminated unnecessary script for cleaner production builds
✓ **Created RLS policies for Supabase** - Comprehensive row-level security policies for user data isolation
✓ **Enhanced job table with checkboxes** - Select all/individual job selection with proper state management
✓ **Added pagination controls** - Previous/next buttons with page indicators for better UX

### 🔧 Technical Improvements
- Updated storage layer with `getIndexingJobsWithPagination()` method for efficient data fetching
- Added `deleteMultipleIndexingJobs()` method with user ownership verification
- Enhanced API routes to support both paginated and non-paginated requests
- Implemented bulk delete endpoint `/api/indexing-jobs/bulk` with proper error handling
- Added comprehensive UI components for pagination and bulk operations

### 📋 Database Security (RLS Policies)
- Created `SUPABASE_RLS_POLICIES.sql` file with all necessary row-level security policies
- Policies ensure users can only access, modify, and delete their own data
- Covered all related tables: indexing jobs, URL submissions, service accounts, quota usage
- Implemented proper foreign key relationship checks in policies

## Recent Changes (July 19, 2025) - Job Management Enhancements

### ✓ Pagination Implementation
✓ **Added pagination support to manage jobs page** - Now displays 20 jobs per page with navigation controls
✓ **Updated API endpoints for pagination** - GET /api/indexing-jobs now supports ?page=X&limit=Y parameters
✓ **Enhanced storage layer** - Added getIndexingJobsWithPagination method with total count and page calculation
✓ **Backward compatibility maintained** - Widget views still get all jobs, full page uses pagination

### ✓ Bulk Delete Functionality
✓ **Added checkbox selection system** - Users can select individual jobs or select all on current page
✓ **Implemented bulk delete API** - DELETE /api/indexing-jobs/bulk endpoint with user ownership validation
✓ **Added confirmation dialog** - Users must confirm before bulk deleting selected jobs
✓ **Enhanced UI controls** - Delete Selected button appears when jobs are selected

### ✓ Security & Performance Improvements
✓ **Removed Replit dev banner script** - Cleaned up HTML to remove unnecessary external script
✓ **Created RLS policies** - Comprehensive Row Level Security policies for Supabase tables
✓ **User ownership validation** - All delete operations verify user ownership before execution
✓ **Proper cleanup handling** - URL submissions are deleted when parent jobs are removed

### 📋 SQL Queries for User Implementation
- Created `rls-policies.sql` file with complete RLS setup for all database tables
- Includes policies for indexing jobs, URL submissions, service accounts, and quota usage
- Ensures users can only access and modify their own data

## Recent Changes (July 19, 2025) - P0 CRITICAL SECURITY FIXES (Previous)

### 🛡️ P0 Critical Security Fixes Completed
✓ **Fixed Authentication Bypass Vulnerability** - Implemented proper role-based authorization system
✓ **Fixed Hardcoded Supabase URLs in CSP** - Content Security Policy now uses environment variables dynamically
✓ **Fixed Memory Leaks in Rate Limiting** - Added cleanup timers for rate limiting Maps (every 5 minutes)
✓ **Implemented Job Execution Locking** - Added database locking mechanism to prevent race conditions in job processing
✓ **Created Token Encryption Service** - Prepared infrastructure for encrypting Google API access tokens
✓ **Enhanced Authentication Middleware** - Authentication now properly populates user roles for authorization
✓ **Added Environment Variable Validation** - System now warns about missing critical security variables

### 📋 Database Schema Updates Required
- Created comprehensive SQL file: `P0-CRITICAL-FIXES.sql` with all required database changes
- Added job locking columns: `locked_at`, `locked_by` to prevent concurrent job execution
- Added token encryption columns: `access_token_encrypted`, `encryption_iv`, `encryption_tag`
- Added critical performance indexes for user lookups, job status, and quota management
- Added foreign key constraints for data integrity
- Added data validation constraints for quota limits
- Implemented automatic cleanup for security events
- Added audit triggers for automatic updated_at timestamps

### ⚠️ Action Items for User
1. **Run P0-CRITICAL-FIXES.sql in Supabase SQL Editor** - Contains all critical database schema updates
2. **Update .env file with generated encryption key** - Required for token encryption
3. **Set ADMIN_EMAILS environment variable** - Required for admin role functionality

### 🔧 Technical Improvements Made
- Role authorization system now functional with database lookup
- Job scheduler now prevents concurrent execution of same job
- Memory leaks eliminated from rate limiting system
- Content Security Policy made dynamic and environment-aware
- Enhanced error handling and logging throughout authentication flow

## Recent Changes (July 18, 2025) - Previous

### Migration and Authentication Updates
✓ Successfully migrated from Replit Agent to standard Replit environment
✓ Fixed database schema to match Supabase structure with service_account_json and access_token columns  
✓ Implemented JWT-based Google API authentication with token caching
✓ Updated Google Indexing Service to save and reuse access tokens
✓ Added proper token expiry handling with 5-minute buffer
✓ Enhanced error logging and debugging for API calls
✓ Token caching now working correctly - verified reusing tokens for 58+ minutes

### Comprehensive Security Hardening (July 18, 2025)
✓ Removed all hardcoded Supabase credentials and moved to environment variables
✓ Added comprehensive input validation and sanitization middleware
✓ Implemented XSS and SQL injection protection
✓ Added security headers (CSP, X-Frame-Options, X-XSS-Protection, etc.)
✓ Implemented resource ownership verification for all protected endpoints
✓ Added per-user rate limiting and brute force protection
✓ Created encryption service for sensitive data at rest
✓ Implemented secure logging with sensitive data sanitization
✓ Added vulnerability scanner detection and blocking
✓ Implemented request anomaly detection and monitoring
✓ Added security event logging and alerting system
✓ Created comprehensive security audit and monitoring system
✓ Added IP-based blocking for suspicious activity
✓ Implemented failed authentication attempt tracking
✓ Added file upload security validation
✓ Created CSRF protection for state-changing operations
✓ Implemented proper error handling without information disclosure
✓ Added environment variable validation at startup
✓ Created detailed security vulnerabilities assessment report
✓ Implemented advanced threat protection and monitoring

### New Features Added
✓ Added automatic redirect after job creation to job detail page
✓ Enhanced job detail page with action buttons (Start, Pause, Stop, Re-run, Delete)
✓ Implemented proper button states based on job status validation
✓ Added backend route for job re-run functionality with counter reset
✓ Added Delete button with confirmation dialog and automatic redirect to jobs list
✓ Fixed API response parsing issue causing "undefined" job IDs in redirects
✓ All job management features now working correctly with proper authentication

### Real-time Updates and Job Scheduling (July 18, 2025)
✓ Implemented WebSocket server for real-time job status updates
✓ Added WebSocket client hook for automatic cache invalidation
✓ Fixed job scheduler initialization on server startup
✓ Added proper broadcasting of job status changes (running, completed, failed)
✓ Enhanced job execution with real-time progress updates
✓ Pending jobs now execute immediately on server restart
✓ Scheduled jobs run at their designated times with cron expressions

### Enhanced Job Management and UI Improvements (July 18, 2025)
✓ Added continuous job monitoring with cron-based background process
✓ Implemented automatic stuck job recovery (jobs running > 5 minutes reset to pending)
✓ Enhanced job scheduler with every-minute checks for pending and scheduled jobs
✓ Updated logo to use custom IndexNow branding from Supabase storage across all pages
✓ Enhanced favicon with proper sizing and added SEO meta tags
✓ Fixed login/signup pages to display IndexNow logo instead of old icon branding
✓ Increased logo sizes throughout application for better visibility
✓ Created API layer for assets to hide Supabase storage URLs from frontend
✓ Updated favicon to use original icon while sidebar uses black icon version
✓ Restructured sidebar navigation with hierarchical IndexNow menu
✓ Moved Jobs under IndexNow as "Manage Jobs" submenu
✓ Added "New Index" submenu for creating new indexing jobs
✓ Implemented collapsible sidebar sections with proper state management
✓ Updated menu styling to use subtle slate colors instead of orange highlights

### Critical Security & Performance Fixes (July 18, 2025)
✓ Fixed hardcoded Supabase URLs in asset routes - moved to environment variables
✓ Fixed CORS wildcard origin vulnerability - now uses environment-based allowed origins
✓ Reduced excessive debug logging - production logging is now optimized
✓ Created AssetConfigService for centralized asset URL management
✓ Enhanced environment variable validation with URL format checking
✓ Added comprehensive database indexes for query performance optimization
✓ Fixed foreign key constraint violations in URL submissions
✓ Added validation to prevent orphaned URL submissions
✓ Enhanced job deletion with cascading URL submission cleanup
✓ Improved error handling and database integrity validation