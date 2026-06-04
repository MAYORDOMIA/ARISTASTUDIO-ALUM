import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Upload,
} from "lucide-react";
interface Profile {
  id: string;
  email: string;
  is_active: boolean;
  role: string;
  limite_dispositivos: number;
  created_at?: string;
  registered_count?: number; // Calculado tras fetch
}
const SuperAdminDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);
  const fetchProfiles = async () => {
    setLoading(true);
    /* Traemos perfiles y luego contamos dispositivos */ const {
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
      const counts: any = {};
      (devices || []).forEach((d) => {
        counts[d.user_id] = (counts[d.user_id] || 0) + 1;
      });
      setProfiles(
        profs.map((p) => ({ ...p, registered_count: counts[p.id] || 0 })),
      );
    }
    setLoading(false);
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

        // Mapeo esperado según schema: clave en json -> tabla
        const tables = {
            // Mapeo desde las claves encontradas en el JSON
            aluminum: 'materiales_perfiles_usuario',
            glasses: 'materiales_vidrios_usuario',
            accessories: 'materiales_accesorios_usuario',
            blindPanels: 'paneles_usuario',
            dvhInputs: 'dvh_usuario',
            // Mapeo por compatibilidad con posibles versiones anteriores
            perfiles: 'materiales_perfiles_usuario',
            vidrios: 'materiales_vidrios_usuario',
            accesorios: 'materiales_accesorios_usuario',
            recetas: 'recetas_usuario',
            tratamientos: 'tratamientos_usuario',
            paneles: 'paneles_usuario',
            dvh: 'dvh_usuario'
        };

        for (const [key, tableName] of Object.entries(tables)) {
            if (jsonData[key] && Array.isArray(jsonData[key])) {
                const dataToUpsert = jsonData[key].map((item: any) => ({
                    ...item,
                    user_id: targetUserId 
                }));
                console.log(`Intentando upsert en ${tableName} para ${targetUserId}:`, dataToUpsert);
                // Usamos upsert para evitar errores de duplicados (unique constraint master_ref, user_id)
                const { data, error } = await supabase.from(tableName).upsert(dataToUpsert, { onConflict: 'user_id, master_ref' });
                if (error) {
                  console.error(`Error en tabla ${tableName}:`, error);
                  throw new Error(`Error en tabla ${tableName}: ${error.message}`);
                }
                console.log(`Upsert exitoso en ${tableName}:`, data);
            } else {
                console.log(`Saltando clave ${key} (tabla ${tableName}) - no existe o no es array`);
            }
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
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">
              Super Administrador
            </h2>
            <p className="text-xs text-slate-500 ">
              Gestión de acceso de usuarios
            </p>
          </div>
        </div>
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
      </div>
    </div>
  );
};
export default SuperAdminDashboard;
