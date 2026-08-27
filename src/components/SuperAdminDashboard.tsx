import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import { saveBulkData } from "../services/migrationService";
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Upload,
  Key,
  Activity,
  AlertTriangle,
  Terminal,
  Megaphone,
  Plus,
  Trash2,
  Check,
  X
} from "lucide-react";
interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  is_active: boolean;
  created_at: string;
}

interface ActivityLog {
  id: string;
  user_email: string;
  event_type: string;
  description: string;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  is_active: boolean;
  role: string;
  limite_dispositivos: number;
  created_at?: string;
  registered_count?: number; // Calculado tras fetch
  quotes_count?: number; // Presupuestos / obras guardadas
  recipes_count?: number; // Tipologías / recetas guardadas
}
const SuperAdminDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "announcements">("users");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState("");
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success'>('info');
  const [isPublishing, setIsPublishing] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);
  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    setAnnouncementsError(null);
    const { data, error } = await supabase
      .from("anuncios_globales")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        setAnnouncementsError("table_missing");
      } else {
        console.error("Error fetching announcements", error);
      }
    } else if (data) {
      setAnnouncements(data);
    }
    setLoadingAnnouncements(false);
  };

  const publishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementMsg.trim()) return;
    setIsPublishing(true);
    const { error } = await supabase
      .from("anuncios_globales")
      .insert([{ message: newAnnouncementMsg, type: newAnnouncementType, is_active: true }]);
    
    setIsPublishing(false);
    if (error) {
      alert("Error al publicar anuncio: " + error.message);
    } else {
      setNewAnnouncementMsg("");
      fetchAnnouncements();
    }
  };

  const toggleAnnouncement = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("anuncios_globales")
      .update({ is_active: !currentStatus })
      .eq("id", id);
    if (!error) fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar este anuncio?")) return;
    const { error } = await supabase
      .from("anuncios_globales")
      .delete()
      .eq("id", id);
    if (!error) fetchAnnouncements();
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsError(null);
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
      
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        setLogsError("table_missing");
      } else {
        console.error("Error fetching logs", JSON.stringify(error));
      }
    } else if (data) {
      setLogs(data);
    }
    setLoadingLogs(false);
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    } else if (activeTab === "announcements") {
      fetchAnnouncements();
    }
  }, [activeTab]);

  const fetchProfiles = async () => {
    setLoading(true);
    /* Traemos perfiles y luego contamos dispositivos y analiticas */
    const {
      data: profs,
      error,
    } = await supabase
      .from("perfiles_usuarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (profs) {
      const { data: devices } = await supabase
        .from("gestion_dispositivos")
        .select("user_id");
        
      const { data: quotes } = await supabase
        .from("presupuestos")
        .select("user_id");
        
      const { data: recipes } = await supabase
        .from("recetas_usuario")
        .select("user_id");

      const counts: any = {};
      (devices || []).forEach((d) => {
        counts[d.user_id] = (counts[d.user_id] || 0) + 1;
      });
      
      const quoteCounts: any = {};
      (quotes || []).forEach((q) => {
        quoteCounts[q.user_id] = (quoteCounts[q.user_id] || 0) + 1;
      });
      
      const recipeCounts: any = {};
      (recipes || []).forEach((r) => {
        recipeCounts[r.user_id] = (recipeCounts[r.user_id] || 0) + 1;
      });

      setProfiles(
        profs.map((p) => ({ 
          ...p, 
          registered_count: counts[p.id] || 0,
          quotes_count: quoteCounts[p.id] || 0,
          recipes_count: recipeCounts[p.id] || 0
        })),
      );
    }
    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUserId || !newPassword || newPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setIsResetting(true);
    try {
      const { error } = await supabase.rpc("update_user_password_by_admin", {
        target_user_id: passwordResetUserId,
        new_password: newPassword
      });
      if (error) throw error;
      alert("Contraseña actualizada exitosamente.");
      setPasswordResetUserId(null);
      setNewPassword("");
    } catch (err: any) {
      console.error(err);
      alert("Error al actualizar contraseña: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    setToggling(id);
    const { error } = await supabase
      .from("perfiles_usuarios")
      .update({ is_active: !currentStatus })
      .eq("id", id);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, is_active: !currentStatus } : p,
        ),
      );
    }
    setToggling(null);
  };
  const updateMaxDevices = async (id: string, max: number) => {
    if (max < 1) return;
    const { error } = await supabase
      .from("perfiles_usuarios")
      .update({ limite_dispositivos: max })
      .eq("id", id);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, limite_dispositivos: max } : p)),
      );
    }
  };
  const resetDevices = async (id: string) => {
    if (!confirm("¿Estás seguro de resetear los dispositivos de este usuario?"))
      return;
    setToggling(id);
    const { error } = await supabase
      .from("gestion_dispositivos")
      .delete()
      .eq("user_id", id);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, registered_count: 0 } : p)),
      );
      alert("Dispositivos reseteados correctamente.");
    } else {
      console.error("Error resetting devices:", error);
      alert("Error al resetear dispositivos: " + error.message);
    }
    setToggling(null);
  };
  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`PELIGRO: ¿Borrar permanentemente el perfil de ${email}?\n\nRequiere que hayas ejecutado el script SQL RPC "delete_user_by_admin".`))
      return;
    setToggling(id);
    
    // Call the custom RPC function to delete from auth.users (cascades automatically)
    const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: id });
    
    if (!error) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      alert("Usuario eliminado correctamente del sistema.");
    } else {
      console.error("Error deleting user via RPC:", error);
      alert(
        "No se pudo eliminar el usuario completamente.\n\n" +
        "SISTEMA ROBUSTO: Para poder borrar usuarios, debes ir a Supabase -> SQL Editor y ejecutar el código que está en el archivo delete_user_rpc.sql de este proyecto.\n\nDetalle: " + error.message
      );
    }
    setToggling(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !targetUserId) return;
    
    setToggling(targetUserId);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        console.log("Cargando JSON para usuario", targetUserId, jsonData);

        // Normalize keys for saveBulkData in case older JSON backups used Spanish top-level keys
        if (jsonData.perfiles && !jsonData.aluminum) jsonData.aluminum = jsonData.perfiles;
        if (jsonData.vidrios && !jsonData.glasses) jsonData.glasses = jsonData.vidrios;
        if (jsonData.accesorios && !jsonData.accessories) jsonData.accessories = jsonData.accesorios;
        if (jsonData.paneles && !jsonData.blindPanels) jsonData.blindPanels = jsonData.paneles;
        if (jsonData.dvh && !jsonData.dvhInputs) jsonData.dvhInputs = jsonData.dvh;

        const result = await saveBulkData(targetUserId, jsonData);
        
        if (!result.success) {
           throw new Error(result.errors.join(", "));
        }
        
        alert("¡Datos cargados exitosamente!");
      } catch (err: any) {
        console.error("Error cargando JSON:", err);
        alert("Error al procesar el archivo: " + err.message);
      } finally {
        setToggling(null);
        setTargetUserId(null);
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">
                Super Administrador
              </h2>
              <p className="text-xs text-slate-500 ">
                Gestión avanzada de la plataforma
              </p>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${activeTab === "users" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Usuarios
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${activeTab === "logs" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Eventos
            </button>
            <button
              onClick={() => setActiveTab("announcements")}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${activeTab === "announcements" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Anuncios
            </button>
          </div>
        </div>

        {activeTab === "users" ? (
        <div className="space-y-3">
          {profiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No hay usuarios registrados aún.
            </div>
          ) : (
            profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-4"
              >
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-800 ">
                    {profile.email}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="flex items-center gap-2">
                      <span>Estado:</span>
                      <span
                        className={
                          profile.is_active
                            ? "text-emerald-500 font-bold"
                            : "text-amber-500 font-bold"
                        }
                      >
                        {profile.is_active ? "Activo" : "En revisión"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Rol:</span>
                      <span className="text-sky-500 font-bold uppercase">
                        {profile.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      <span className="font-bold text-slate-600">{profile.quotes_count || 0}</span> obras
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      <span className="font-bold text-slate-600">{profile.recipes_count || 0}</span> tipologías
                    </div>
                  </div>
                  {profile.role !== "super_admin" && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 ">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <MonitorSmartphone size={14} />
                        <span>Límite disp:</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={profile.limite_dispositivos || 2}
                        onChange={(e) =>
                          updateMaxDevices(
                            profile.id,
                            parseInt(e.target.value) || 2,
                          )
                        }
                        className="w-16 p-1 text-xs font-bold text-center border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        ({profile.registered_count || 0} en uso)
                      </span>
                      <button
                        onClick={() => resetDevices(profile.id)}
                        disabled={toggling === profile.id}
                        className="ml-auto text-[10px] flex items-center gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors font-bold uppercase tracking-widest"
                      >
                        <RefreshCw size={10} /> Resetear
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => toggleStatus(profile.id, profile.is_active)}
                    disabled={
                      toggling === profile.id || profile.role === "super_admin"
                    }
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${profile.role === "super_admin" ? "bg-slate-200 text-slate-400 cursor-not-allowed " : profile.is_active ? "bg-amber-50 text-amber-600 hover:bg-amber-100 " : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 "}`}
                  >
                    {toggling === profile.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : profile.is_active ? (
                      <>
                        <UserX size={14} /> Desactivar
                      </>
                    ) : (
                      <>
                        <UserCheck size={14} /> Activar
                      </>
                    )}
                  </button>
                  {profile.role !== "super_admin" && (
                    <div className="flex gap-2">
                        <button
                          onClick={() => setPasswordResetUserId(profile.id)}
                          disabled={toggling === profile.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200 "
                        >
                          <Key size={14} /> Contraseña
                        </button>
                        <button
                          onClick={() => {
                              setTargetUserId(profile.id);
                              fileInputRef.current?.click();
                          }}
                          disabled={toggling === profile.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors bg-sky-100 text-sky-700 hover:bg-sky-200 "
                        >
                          <Upload size={14} /> Cargar JSON
                        </button>
                        <button
                          onClick={() => deleteUser(profile.id, profile.email)}
                          disabled={toggling === profile.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors bg-red-100 text-red-700 hover:bg-red-200 "
                        >
                          <UserX size={14} /> Destruir Cuenta Base
                        </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        ) : activeTab === "logs" ? (
          <div className="space-y-4">
            {logsError === "table_missing" ? (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-700 font-bold mb-3">
                  <AlertTriangle size={20} />
                  Falta la tabla de logs en Supabase
                </div>
                <p className="text-sm text-amber-700 mb-4">
                  Para poder registrar los eventos, necesitas crear la tabla <strong>activity_logs</strong> en tu base de datos. Copia y ejecuta este código en el SQL Editor de Supabase:
                </p>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono">
{`CREATE TABLE activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  event_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own logs" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all logs" ON activity_logs
  FOR SELECT USING (
    (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin'
  );`}
                </pre>
                <button onClick={fetchLogs} className="mt-4 bg-amber-200 text-amber-800 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-amber-300 transition-colors">
                  Ya ejecuté el código, reintentar
                </button>
              </div>
            ) : loadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-slate-400" size={24} />
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Fecha</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Usuario</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Evento</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.length === 0 ? (
                       <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No hay eventos registrados.</td></tr>
                    ) : logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {log.user_email}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                            log.event_type === 'error' ? 'bg-red-100 text-red-700' :
                            log.event_type === 'login' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {log.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {log.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {announcementsError === "table_missing" ? (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-700 font-bold mb-3">
                  <AlertTriangle size={20} />
                  Falta la tabla de anuncios en Supabase
                </div>
                <p className="text-sm text-amber-700 mb-4">
                  Para poder enviar mensajes globales, necesitas crear la tabla <strong>anuncios_globales</strong>. Copia y ejecuta este código en el SQL Editor de Supabase:
                </p>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono">
{`CREATE TABLE anuncios_globales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE anuncios_globales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements" ON anuncios_globales
  FOR SELECT USING (is_active = true OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can manage announcements" ON anuncios_globales
  FOR ALL USING (
    (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin'
  );`}
                </pre>
                <button onClick={fetchAnnouncements} className="mt-4 bg-amber-200 text-amber-800 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-amber-300 transition-colors">
                  Ya ejecuté el código, reintentar
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <form onSubmit={publishAnnouncement} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nuevo Anuncio Global</label>
                    <textarea
                      value={newAnnouncementMsg}
                      onChange={(e) => setNewAnnouncementMsg(e.target.value)}
                      placeholder="Escribe aquí el mensaje que verán todos los usuarios al entrar..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[80px]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex gap-2 w-full sm:w-auto">
                      <select 
                        value={newAnnouncementType}
                        onChange={(e) => setNewAnnouncementType(e.target.value as any)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="info">Información (Azul)</option>
                        <option value="success">Novedad (Verde)</option>
                        <option value="warning">Alerta (Amarillo)</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isPublishing || !newAnnouncementMsg.trim()}
                      className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black uppercase text-[10px] tracking-widest px-6 py-2.5 rounded-xl transition-colors flex justify-center items-center gap-2"
                    >
                      {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <><Megaphone size={14} /> Publicar</>}
                    </button>
                  </div>
                </form>

                {loadingAnnouncements ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm">No hay anuncios creados.</div>
                    ) : (
                      announcements.map((ann) => (
                        <div key={ann.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 justify-between ${!ann.is_active ? 'bg-slate-50 border-slate-200 opacity-60' : ann.type === 'warning' ? 'bg-amber-50 border-amber-200' : ann.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-sky-50 border-sky-200'}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${!ann.is_active ? 'bg-slate-200 text-slate-500' : ann.type === 'warning' ? 'bg-amber-200 text-amber-800' : ann.type === 'success' ? 'bg-emerald-200 text-emerald-800' : 'bg-sky-200 text-sky-800'}`}>
                                {ann.type}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(ann.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{ann.message}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleAnnouncement(ann.id, ann.is_active)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest ${ann.is_active ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                            >
                              {ann.is_active ? 'Ocultar' : 'Mostrar'}
                            </button>
                            <button
                              onClick={() => deleteAnnouncement(ann.id)}
                              className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {passwordResetUserId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100">
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-tighter mb-4 flex items-center gap-2">
              <Key size={16} className="text-purple-500" />
              Cambiar Contraseña
            </h3>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                  Nueva Contraseña
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordResetUserId(null);
                    setNewPassword("");
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-widest py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isResetting || newPassword.length < 6}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-bold uppercase text-[10px] tracking-widest py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
                >
                  {isResetting ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default SuperAdminDashboard;
