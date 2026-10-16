import { createClient } from "@supabase/supabase-js";

declare const __SUPABASE_URL__: string | undefined;
declare const __SUPABASE_ANON_KEY__: string | undefined;

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || (typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : "") || "";
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || (typeof __SUPABASE_ANON_KEY__ !== "undefined" ? __SUPABASE_ANON_KEY__ : "") || "";

const supabaseUrl = envUrl.trim();
const supabaseAnonKey = envKey.trim();

// Prevent top-level crash if variables are missing or clearly invalid (like placeholder strings)
const isValidUrl = Boolean(supabaseUrl && supabaseUrl.startsWith("http") && supabaseUrl !== "undefined" && supabaseUrl !== "null" && !supabaseUrl.includes("placeholder"));
const isValidKey = Boolean(supabaseAnonKey && supabaseAnonKey.length > 20 && supabaseAnonKey !== "undefined" && supabaseAnonKey !== "null" && !supabaseAnonKey.includes("placeholder"));

const url = isValidUrl ? supabaseUrl : "https://placeholder.supabase.co";
const key = isValidKey ? supabaseAnonKey : "placeholder-key";

export const supabase = createClient(url, key);
export const isSupabaseConfigured = Boolean(isValidUrl && isValidKey);
