-- Migration: Add role column to indb_user_profiles table
-- Run this in your Supabase SQL Editor

-- Step 1: Create the user role enum type
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');

-- Step 2: Add the role column with default value
ALTER TABLE indb_user_profiles 
ADD COLUMN role user_role DEFAULT 'user' NOT NULL;

-- Step 3: Update existing records to have 'user' role (they already have default, but just to be explicit)
UPDATE indb_user_profiles 
SET role = 'user' 
WHERE role IS NULL;

-- Step 4: Create index for role-based queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_indb_user_profiles_role ON indb_user_profiles(role);

-- Step 5: Verify the migration
SELECT 
  id, 
  email, 
  full_name, 
  role, 
  created_at 
FROM indb_user_profiles 
LIMIT 5;