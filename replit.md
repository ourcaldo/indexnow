# Google Indexing Dashboard

## Overview

This is a full-stack web application that provides an instant indexing solution similar to RankMath's Instant Indexing plugin. The application allows users to manage Google service accounts, submit URLs for indexing via Google Search Console API, and schedule automated indexing jobs. It features a clean, professional dashboard with a warm color scheme and collapsible sidebar navigation.

## User Preferences

Preferred communication style: Simple, everyday language.
Database: Uses Supabase (not local PostgreSQL) with service_account_json and access_token columns.
Authentication: JWT-based approach for Google Indexing API with token caching.
Database: Use Supabase for database operations, never use local PostgreSQL.
Authentication: Use JWT-based authentication approach for Google API integration.

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