import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '__SUPABASE_URL__';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '__SUPABASE_ANON_KEY__';

if (!supabaseUrl || supabaseUrl === '__SUPABASE_URL__' || !supabaseAnonKey || supabaseAnonKey === '__SUPABASE_ANON_KEY__') {
  console.error('Faltan las variables de entorno de Supabase. Por favor, configúralas en tu plataforma de hosting (GitHub Pages, Vercel, etc).');
}

// Inicializamos con valores por defecto vacíos para que no rompa la app entera si faltan las variables,
// aunque las consultas a la base de datos fallarán hasta que se configuren.
export const supabase = createClient(
  supabaseUrl && supabaseUrl !== '__SUPABASE_URL__' ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseAnonKey && supabaseAnonKey !== '__SUPABASE_ANON_KEY__' ? supabaseAnonKey : 'placeholder-key'
);
