import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl } from '../services/supabase';
import { createClient } from '@supabase/supabase-js';
import { Building2, Users, Smartphone, Trash2, Plus, ShieldAlert, RefreshCw, Save, X, AlertCircle } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  device_limit: number;
  expires_at: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  tenant_id: string;
  role: string;
  email: string;
  full_name: string;
  created_at: string;
  tenants?: { name: string };
}

interface DeviceSession {
  id: string;
  tenant_id: string;
  user_id: string;
  device_identifier: string;
  device_name: string;
  last_active: string;
  user_profiles?: { email: string };
  tenants?: { name: string };
}

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'devices'>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', tenant_id: '', role: 'user' });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const getAdminClient = () => {
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || (process.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || (process.env as any).SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return supabase;
    
    try {
      new URL(supabaseUrl);
      return createClient(
        supabaseUrl,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } catch (e) {
      console.error("Invalid Supabase URL for admin client:", supabaseUrl);
      return supabase; // Fallback to the default client (which is already a placeholder if URL is invalid)
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const client = getAdminClient();
    try {
      if (activeTab === 'tenants') {
        const { data, error: err } = await client.from('tenants').select('*').order('created_at', { ascending: false });
        if (err) throw err;
        setTenants(data || []);
      } else if (activeTab === 'users') {
        const { data, error: err } = await client.from('user_profiles').select('*, tenants(name)').order('created_at', { ascending: false });
        if (err) throw err;
        setUsers(data || []);
      } else if (activeTab === 'devices') {
        const { data, error: err } = await client.from('device_sessions').select('*, user_profiles(email), tenants(name)').order('last_active', { ascending: false });
        if (err) throw err;
        setDevices(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTenant = async () => {
    if (!editingTenant?.name) return;
    setError('');
    const client = getAdminClient();
    try {
      if (editingTenant.id) {
        // Update
        const { error: err } = await client.from('tenants').update({
          name: editingTenant.name,
          status: editingTenant.status,
          device_limit: editingTenant.device_limit,
          expires_at: editingTenant.expires_at || null
        }).eq('id', editingTenant.id);
        if (err) throw err;
      } else {
        // Insert
        const { error: err } = await client.from('tenants').insert({
          name: editingTenant.name,
          status: editingTenant.status || 'active',
          device_limit: editingTenant.device_limit || 2,
          expires_at: editingTenant.expires_at || null
        });
        if (err) throw err;
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error al guardar empresa');
    }
  };

  const handleRevokeDevice = async (id: string) => {
    setError('');
    const client = getAdminClient();
    try {
      const { error: err } = await client.from('device_sessions').delete().eq('id', id);
      if (err) throw err;
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error al revocar dispositivo');
    }
  };

  const handleCreateUser = async () => {
    setError('');
    if (!newUser.email || !newUser.password || !newUser.tenant_id) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || (process.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || (process.env as any).SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      setError('Falta VITE_SUPABASE_SERVICE_ROLE_KEY en los Secretos de AI Studio.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const adminAuthClient = getAdminClient();

      const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true,
        user_metadata: { full_name: newUser.full_name }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario en Auth');

      const { error: profileError } = await adminAuthClient.from('user_profiles').insert({
        id: authData.user.id,
        tenant_id: newUser.tenant_id,
        role: newUser.role,
        email: newUser.email,
        full_name: newUser.full_name
      });

      if (profileError) {
        await adminAuthClient.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      setIsUserModalOpen(false);
      setNewUser({ email: '', password: '', full_name: '', tenant_id: '', role: 'user' });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ShieldAlert className="w-8 h-8" />
            Panel de Súper Administrador
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona empresas, licencias y dispositivos conectados.</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-300 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'tenants' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <Building2 className="w-4 h-4" /> Empresas (Tenants)
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <Users className="w-4 h-4" /> Usuarios
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'devices' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <Smartphone className="w-4 h-4" /> Dispositivos
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* TENANTS TAB */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button 
              onClick={() => { setEditingTenant({ status: 'active', device_limit: 2 }); setIsModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nueva Empresa
            </button>
          </div>
          <div className="bg-white dark:bg-[#252525] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium">Límite Disp.</th>
                  <th className="p-4 font-medium">Expira</th>
                  <th className="p-4 font-medium">ID (Para invitar)</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{t.name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{t.device_limit}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'Nunca'}</td>
                    <td className="p-4 font-mono text-xs text-slate-400">{t.id}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => { setEditingTenant(t); setIsModalOpen(true); }}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && !loading && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No hay empresas registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {!(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || (process.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || (process.env as any).SUPABASE_SERVICE_ROLE_KEY) && (
            <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Creación de Usuarios</h4>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Para crear usuarios desde aquí, necesitas agregar <code>VITE_SUPABASE_SERVICE_ROLE_KEY</code> en los Secretos de AI Studio.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end">
            <button 
              onClick={() => { 
                // Ensure we have tenants loaded for the dropdown
                if (tenants.length === 0) {
                  supabase.from('tenants').select('*').then(({data}) => setTenants(data || []));
                }
                setIsUserModalOpen(true); 
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Nuevo Usuario
            </button>
          </div>
          <div className="bg-white dark:bg-[#252525] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Empresa</th>
                  <th className="p-4 font-medium">Rol</th>
                  <th className="p-4 font-medium">Fecha Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{u.email}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{u.tenants?.name || 'N/A'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">No hay usuarios registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEVICES TAB */}
      {activeTab === 'devices' && (
        <div className="bg-white dark:bg-[#252525] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="p-4 font-medium">Empresa</th>
                <th className="p-4 font-medium">Usuario (Email)</th>
                <th className="p-4 font-medium">Dispositivo</th>
                <th className="p-4 font-medium">Última Actividad</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {devices.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="p-4 font-medium text-slate-900 dark:text-white">{d.tenants?.name || 'N/A'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{d.user_profiles?.email || 'N/A'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 truncate max-w-[200px]" title={d.device_name}>{d.device_name || d.device_identifier}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{new Date(d.last_active).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setDeleteConfirm(d.id)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Revocar acceso a este dispositivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && !loading && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No hay dispositivos activos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && editingTenant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#252525] rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingTenant.id ? 'Editar Empresa' : 'Nueva Empresa'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nombre de la Empresa</label>
                <input 
                  type="text" 
                  value={editingTenant.name || ''} 
                  onChange={e => setEditingTenant({...editingTenant, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  placeholder="Ej. Aberturas San Juan"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Estado</label>
                  <select 
                    value={editingTenant.status || 'active'} 
                    onChange={e => setEditingTenant({...editingTenant, status: e.target.value as 'active'|'suspended'})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  >
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Límite Dispositivos</label>
                  <input 
                    type="number" 
                    min="1"
                    value={editingTenant.device_limit || 2} 
                    onChange={e => setEditingTenant({...editingTenant, device_limit: parseInt(e.target.value) || 1})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fecha de Expiración (Opcional)</label>
                <input 
                  type="date" 
                  value={editingTenant.expires_at ? editingTenant.expires_at.split('T')[0] : ''} 
                  onChange={e => setEditingTenant({...editingTenant, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/30">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveTenant}
                disabled={!editingTenant.name}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#252525] rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Nuevo Usuario
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Empresa (Tenant)</label>
                <select 
                  value={newUser.tenant_id} 
                  onChange={e => setNewUser({...newUser, tenant_id: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                >
                  <option value="">Selecciona una empresa...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={newUser.full_name} 
                  onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={newUser.email} 
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Contraseña</label>
                <input 
                  type="password" 
                  value={newUser.password} 
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rol</label>
                <select 
                  value={newUser.role} 
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                >
                  <option value="user">Usuario (Cotizador)</option>
                  <option value="admin">Administrador (Puede ver todo de su empresa)</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/30">
              <button 
                onClick={() => setIsUserModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                disabled={isCreatingUser}
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateUser}
                disabled={!newUser.email || !newUser.password || !newUser.tenant_id || isCreatingUser}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreatingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                {isCreatingUser ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#252525] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Revocar dispositivo?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">El usuario tendrá que volver a iniciar sesión si hay cupo disponible.</p>
            <div className="flex justify-center gap-3 pt-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
              <button onClick={() => handleRevokeDevice(deleteConfirm)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Sí, revocar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
