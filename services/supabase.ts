import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const supabaseUrl = (rawUrl && isValidUrl(rawUrl.trim())) ? rawUrl.trim() : 'https://kccfrshkkejmqlbebfst.supabase.co';
const supabaseAnonKey = (rawKey && rawKey.trim()) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjY2Zyc2hra2VqbXFsYmViZnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTEzMDUsImV4cCI6MjA4OTU4NzMwNX0.AvVtc5bnE3MMZVtVKg8ZnM_teCYznEIDWehhEN50gRA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
