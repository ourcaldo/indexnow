-- Create access_tokens table for JWT access token caching
CREATE TABLE IF NOT EXISTS access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_account_id UUID NOT NULL,
  encrypted_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_access_tokens_service_account_id ON access_tokens(service_account_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_expires_at ON access_tokens(expires_at);

-- Add foreign key constraint
ALTER TABLE access_tokens 
ADD CONSTRAINT fk_access_tokens_service_account_id 
FOREIGN KEY (service_account_id) 
REFERENCES service_accounts(id) 
ON DELETE CASCADE;

-- Add RLS policies
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to manage their own access tokens
CREATE POLICY "Users can manage their own access tokens" 
ON access_tokens
FOR ALL
USING (
  service_account_id IN (
    SELECT id FROM service_accounts 
    WHERE user_id = auth.uid()
  )
);