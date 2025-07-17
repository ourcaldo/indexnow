# Google Indexing Dashboard

## Overview

This is a full-stack web application that provides an instant indexing solution similar to RankMath's Instant Indexing plugin. The application allows users to manage Google service accounts, submit URLs for indexing via Google Search Console API, and schedule automated indexing jobs. It features a clean, professional dashboard with a warm color scheme and collapsible sidebar navigation.

## User Preferences

Preferred communication style: Simple, everyday language.
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