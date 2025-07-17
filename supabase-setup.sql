-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'paused', 'cancelled');
CREATE TYPE job_schedule AS ENUM ('one-time', 'hourly', 'daily', 'weekly', 'monthly');
CREATE TYPE url_status AS ENUM ('pending', 'success', 'error', 'quota_exceeded');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service accounts table
CREATE TABLE public.service_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    project_id TEXT NOT NULL,
    private_key TEXT NOT NULL,
    private_key_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    daily_quota_limit INTEGER DEFAULT 200,
    per_minute_quota_limit INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing jobs table
CREATE TABLE public.indexing_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    schedule job_schedule NOT NULL DEFAULT 'one-time',
    status job_status NOT NULL DEFAULT 'pending',
    total_urls INTEGER NOT NULL DEFAULT 0,
    processed_urls INTEGER NOT NULL DEFAULT 0,
    successful_urls INTEGER NOT NULL DEFAULT 0,
    failed_urls INTEGER NOT NULL DEFAULT 0,
    sitemap_url TEXT,
    manual_urls TEXT[],
    cron_expression TEXT,
    next_run TIMESTAMPTZ,
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- URL processing table
CREATE TABLE public.url_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_id UUID REFERENCES public.indexing_jobs(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    status url_status NOT NULL DEFAULT 'pending',
    service_account_id UUID REFERENCES public.service_accounts(id),
    error_message TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API quota tracking
CREATE TABLE public.quota_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_account_id UUID REFERENCES public.service_accounts(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    requests_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(service_account_id, date)
);

-- RLS Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.url_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_usage ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Service accounts policies
CREATE POLICY "Users can manage own service accounts" ON public.service_accounts
    FOR ALL USING (auth.uid() = user_id);

-- Indexing jobs policies
CREATE POLICY "Users can manage own indexing jobs" ON public.indexing_jobs
    FOR ALL USING (auth.uid() = user_id);

-- URL submissions policies
CREATE POLICY "Users can view own URL submissions" ON public.url_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.indexing_jobs 
            WHERE id = url_submissions.job_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own URL submissions" ON public.url_submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.indexing_jobs 
            WHERE id = url_submissions.job_id AND user_id = auth.uid()
        )
    );

-- Quota usage policies
CREATE POLICY "Users can view own quota usage" ON public.quota_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.service_accounts 
            WHERE id = quota_usage.service_account_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own quota usage" ON public.quota_usage
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.service_accounts 
            WHERE id = quota_usage.service_account_id AND user_id = auth.uid()
        )
    );

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_service_accounts_updated_at BEFORE UPDATE ON public.service_accounts
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_indexing_jobs_updated_at BEFORE UPDATE ON public.indexing_jobs
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_url_submissions_updated_at BEFORE UPDATE ON public.url_submissions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
