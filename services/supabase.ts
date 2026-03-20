import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials to bypass environment variable injection issues
export let supabaseUrl = 'https://hwjugiwvqxvgrzwmzwjk.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3anVnaXd2cXh2Z3J6d216d2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0OTc1MDksImV4cCI6MjA1ODA1MzUwOX0.R1_31s145-N7C686K85M1-31s145-N7C686K85M1-31s145-N7C686K85M1';

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
