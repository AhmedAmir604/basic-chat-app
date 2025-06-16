import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export type Profile = {
  id: string;
  updated_at?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  website?: string;
};