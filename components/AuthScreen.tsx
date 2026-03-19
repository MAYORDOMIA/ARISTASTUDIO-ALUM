import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { checkDeviceLimit } from '../services/deviceManager';
import { AlertCircle, Lock } from 'lucide-react';

export default function AuthScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl === '') {
      setError('Falta configurar las credenciales de Supabase en los Secretos de AI Studio. Por favor, agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    if (supabaseUrl.startsWith('eyJ')) {
      setError('¡Atención! Parece que pegaste una LLAVE (que empieza con eyJ...) en el secreto VITE_SUPABASE_URL. Por favor, revisa tus secretos: VITE_SUPABASE_URL debe ser una dirección web (https://...), no una llave.');
      setLoading(false);
      return;
    }

    const anonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    if (anonKey && anonKey.startsWith('http')) {
      setError('¡Atención! Parece que pegaste una URL (que empieza con http...) en el secreto VITE_SUPABASE_ANON_KEY. Por favor, revisa tus secretos: VITE_SUPABASE_ANON_KEY debe ser una llave (eyJ...), no una dirección web.');
      setLoading(false);
      return;
    }

    try {
      // 1. Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Usuario no encontrado');

      // 2. Fetch User Profile to get Tenant ID
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        // If no profile exists, they might be the superadmin or an unconfigured user
        if (email === 'aristastudiouno@gmail.com') {
           // Superadmin bypass (we'll handle this later)
           onLoginSuccess({ id: authData.user.id, role: 'superadmin', email });
           return;
        }
        throw new Error('Perfil de usuario no configurado. Contacte a soporte.');
      }

      // 3. Check Device Limits & Subscription Status
      const isAllowed = await checkDeviceLimit(profile.tenant_id, profile.id);
      
      if (!isAllowed) {
        // Sign them out immediately if blocked
        await supabase.auth.signOut();
        throw new Error('Límite de dispositivos alcanzado o suscripción inactiva. Contacte a soporte.');
      }

      // 4. Success!
      onLoginSuccess(profile);

    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-800 rounded-2xl shadow-xl p-8 border border-neutral-700">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-indigo-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white text-center mb-2">AristaStudio Pro</h2>
        <p className="text-neutral-400 text-center mb-8">Inicia sesión para acceder a tu espacio de trabajo</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              placeholder="tu@empresa.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Ingresar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
