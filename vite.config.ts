import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
    const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl) {
      console.warn("WARNING: VITE_SUPABASE_URL is missing in build environment!");
    }
    
    if (!supabaseAnonKey) {
      console.warn("WARNING: VITE_SUPABASE_ANON_KEY is missing in build environment!");
    }
    
    return {
      base: '/', // Mejor para Vercel
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        '__SUPABASE_URL__': JSON.stringify(supabaseUrl),
        '__SUPABASE_ANON_KEY__': JSON.stringify(supabaseAnonKey),
        '__SUPABASE_SERVICE_ROLE_KEY__': JSON.stringify(supabaseServiceRoleKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
