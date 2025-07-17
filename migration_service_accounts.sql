-- Migration to update service_accounts table structure
-- This migration adds service_account_json column and removes individual credential columns

-- Step 1: Add new column for complete service account JSON
ALTER TABLE service_accounts ADD COLUMN service_account_json TEXT;

-- Step 2: Update existing records to populate service_account_json
-- Note: This will need to be done manually for existing records since we're reconstructing the JSON
-- For now, we'll set a placeholder that will need to be updated with actual service account JSON
UPDATE service_accounts 
SET service_account_json = json_build_object(
  'type', 'service_account',
  'project_id', project_id,
  'private_key_id', private_key_id,
  'private_key', private_key,
  'client_email', client_email,
  'client_id', client_id,
  'auth_uri', 'https://accounts.google.com/o/oauth2/auth',
  'token_uri', 'https://oauth2.googleapis.com/token',
  'auth_provider_x509_cert_url', 'https://www.googleapis.com/oauth2/v1/certs',
  'client_x509_cert_url', 'https://www.googleapis.com/robot/v1/metadata/x509/' || replace(client_email, '@', '%40'),
  'universe_domain', 'googleapis.com'
)::text;

-- Step 3: Make service_account_json NOT NULL
ALTER TABLE service_accounts ALTER COLUMN service_account_json SET NOT NULL;

-- Step 4: Drop individual credential columns (uncomment after verifying data migration)
-- ALTER TABLE service_accounts DROP COLUMN private_key;
-- ALTER TABLE service_accounts DROP COLUMN private_key_id;
-- ALTER TABLE service_accounts DROP COLUMN client_id;

-- Note: Keep client_email and project_id for quick reference queries