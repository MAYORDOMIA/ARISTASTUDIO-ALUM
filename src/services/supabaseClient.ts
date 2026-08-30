import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

// Prevent top-level crash if variables are missing or clearly invalid (like placeholder strings)
const isValidUrl = supabaseUrl && supabaseUrl.startsWith("http") && supabaseUrl !== "undefined" && supabaseUrl !== "null";
const isValidKey = supabaseAnonKey && supabaseAnonKey.length > 20 && supabaseAnonKey !== "undefined" && supabaseAnonKey !== "null";

const url = isValidUrl ? supabaseUrl : "https://placeholder.supabase.co";
const key = isValidKey ? supabaseAnonKey : "placeholder-key";

export const supabase = createClient(url, key);
export const isSupabaseConfigured = Boolean(isValidUrl && isValidKey);
