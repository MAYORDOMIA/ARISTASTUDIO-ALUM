import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, UserX, UserCheck, Smartphone } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  is_active: boolean;
}

const SuperAdminDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) console.error('Error fetching profiles:', error);
    else setProfiles(data || []);
    setLoading(false);
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    
    if (error) alert('Error al cambiar estado');
    else fetchProfiles();
  };

  if (loading) return <div>Cargando panel de control...</div>;

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <ShieldCheck className="text-sky-500" /> Panel de Super Admin
      </h2>
      <div className="space-y-4">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="font-bold text-slate-700">{profile.email}</p>
              <p className="text-xs text-slate-400">ID: {profile.id}</p>
            </div>
            <button 
              onClick={() => toggleUserStatus(profile.id, profile.is_active)}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 ${profile.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {profile.is_active ? <UserCheck size={16} /> : <UserX size={16} />}
              {profile.is_active ? 'Activo' : 'Bloqueado'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
