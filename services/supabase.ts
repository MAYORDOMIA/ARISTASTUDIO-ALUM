import { createClient } from '@supabase/supabase-js';

console.log("DEBUG: Supabase initialization check:", {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY ? '***' : 'MISSING',
  rawUrl: import.meta.env.VITE_SUPABASE_URL
});

export let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

// Ensure URL has https:// prefix if it's just a project ID
if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  if (supabaseUrl.includes('.')) {
    supabaseUrl = `https://${supabaseUrl}`;
  } else {
    supabaseUrl = `https://${supabaseUrl}.supabase.co`;
  }
}

let client;
try {
  // Validate URL format before creating client
  new URL(supabaseUrl);
  client = createClient(supabaseUrl, supabaseAnonKey);
} catch (e) {
  console.error("Invalid Supabase URL provided:", supabaseUrl);
  // Fallback to a valid placeholder so the app doesn't crash completely,
  // allowing the AuthScreen to show the configuration error.
  client = createClient('https://placeholder.supabase.co', 'placeholder');
}

export const supabase = client;
