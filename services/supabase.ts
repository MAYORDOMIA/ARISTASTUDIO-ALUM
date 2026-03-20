import { createClient } from '@supabase/supabase-js';

// Professional setup: Reading credentials from environment variables
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Ensure URL has https:// prefix if it's just a project ID
let url = supabaseUrl;
if (url && !url.startsWith('http')) {
  if (url.includes('.')) {
    url = `https://${url}`;
  } else {
    url = `https://${url}.supabase.co`;
  }
}

let client;
try {
  // Validate URL format before creating client
  new URL(url);
  client = createClient(url, supabaseAnonKey);
} catch (e) {
  console.error("Invalid Supabase URL provided:", url);
  // Fallback to a valid placeholder so the app doesn't crash completely,
  // allowing the AuthScreen to show the configuration error.
  client = createClient('https://placeholder.supabase.co', 'placeholder');
}

export const supabase = client;
