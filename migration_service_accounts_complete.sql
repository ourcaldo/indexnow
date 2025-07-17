-- Complete migration to clean up service_accounts table
-- Run this AFTER confirming the service_account_json column is properly populated

-- Drop the old individual credential columns
ALTER TABLE service_accounts DROP COLUMN IF EXISTS private_key;
ALTER TABLE service_accounts DROP COLUMN IF EXISTS private_key_id;
ALTER TABLE service_accounts DROP COLUMN IF EXISTS client_id;

-- Add any missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_service_accounts_user_id ON service_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_service_accounts_is_active ON service_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_service_accounts_client_email ON service_accounts(client_email);