import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const supabaseUrl = process.env.SUPABASE_URL || 'https://bwkasvyrzbzhcdtvsbyg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a2FzdnlyemJ6aGNkdHZzYnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NTUxNDIsImV4cCI6MjA2ODMzMTE0Mn0._YnFB_X6glA_67HRBcPQIVJ0lzcOQ5PinZzilecvB98';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.bwkasvyrzbzhcdtvsbyg:Jembut123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database connection for server-side operations
const client = postgres(databaseUrl);
export const db = drizzle(client);

export async function verifyAuth(token: string) {
  const { data: user, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  return user.user;
}
