import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import { saveBulkData, applyBulkPriceIncrease, BulkPriceIncreaseResult } from "../services/migrationService";
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Upload,
  UploadCloud,
  Database,
  Key,
  Activity,
  AlertTriangle,
  Terminal,
  Megaphone,
  Plus,
  Trash2,
  Check,
  X,
  User,
  Globe,
  Copy,
  TrendingUp,
  Percent,
  Layers,
  Box,
  Package,
  Search,
  CheckCircle2,
} from "lucide-react";
interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  is_active: boolean;
  target_user_id?: string | null;
  target_user_email?: string | null;
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
  glasses_count?: number; // Vidrios en base de datos
  accessories_count?: number; // Accesorios en base de datos
  aluminum_price_per_kg?: number; // Precio aluminio crudo ($/kg)
  web_quoter_enabled?: boolean; // Habilitación del servicio de cotizador web para clientes
}

interface SuperAdminDashboardProps {
  currentUserId?: string;
  onCurrentUserDataUpdated?: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  currentUserId,
  onCurrentUserDataUpdated,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New states for Distribution tab
  const masterFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkData, setBulkData] = useState<any | null>(null);
  const [selectedCategories, setSelectedCategories] = useState({
    recetas: true,
    perfiles: true,
    accesorios: true,
    vidrios: true,
  });
  const [availableLines, setAvailableLines] = useState<string[]>([]);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showLinesModal, setShowLinesModal] = useState(false);

  // Estados para Aumentos Masivos por Porcentaje (%)
  const [applyGlassIncrease, setApplyGlassIncrease] = useState(true);
  const [applyAluminumIncrease, setApplyAluminumIncrease] = useState(true);
  const [applyAccessoryIncrease, setApplyAccessoryIncrease] = useState(true);
  const [glassIncreasePct, setGlassIncreasePct] = useState<string>("0");
  const [aluminumIncreasePct, setAluminumIncreasePct] = useState<string>("0");
  const [accessoryIncreasePct, setAccessoryIncreasePct] = useState<string>("0");
  const [unifiedIncreasePct, setUnifiedIncreasePct] = useState<string>("");
  const [isApplyingPriceIncrease, setIsApplyingPriceIncrease] = useState(false);
  const [priceIncreaseSummary, setPriceIncreaseSummary] = useState<BulkPriceIncreaseResult | null>(null);
  const [distributionUserSearch, setDistributionUserSearch] = useState("");
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "announcements" | "distribution">("users");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState("");
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success' | 'urgent'>('info');
  const [targetUserOption, setTargetUserOption] = useState<string>("all");
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
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
      } else if (error.code === '42501') {
        setAnnouncementsError("permission_denied");
      } else {
        console.warn("Aviso al consultar anuncios en Supabase:", error.message);
        setAnnouncementsError("general_error");
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
    
    const targetProfile = targetUserOption !== "all" ? profiles.find(p => p.id === targetUserOption) : null;
    const payload: any = { 
      message: newAnnouncementMsg, 
      type: newAnnouncementType, 
      is_active: true 
    };

    if (targetProfile) {
      payload.target_user_id = targetProfile.id;
      payload.target_user_email = targetProfile.email;
    }

    const { error } = await supabase
      .from("anuncios_globales")
      .insert([payload]);
    
    setIsPublishing(false);
    if (error) {
      if (error.code === '42703') {
        alert(
          "ATENCIÓN: Para enviar mensajes individuales, tu tabla en Supabase necesita 2 columnas nuevas.\n\n" +
          "Copia y ejecuta esto en Supabase -> SQL Editor:\n\n" +
          "ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;\n" +
          "ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_email text;\n\n" +
          "Detalle del servidor: " + error.message
        );
      } else {
        alert("Error al publicar anuncio: " + error.message);
      }
    } else {
      setNewAnnouncementMsg("");
      setTargetUserOption("all");
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

      const { data: glassesRows } = await supabase
        .from("materiales_vidrios_usuario")
        .select("user_id");

      const { data: accessoriesRows } = await supabase
        .from("materiales_accesorios_usuario")
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

      const glassCounts: any = {};
      (glassesRows || []).forEach((g) => {
        glassCounts[g.user_id] = (glassCounts[g.user_id] || 0) + 1;
      });

      const accessoryCounts: any = {};
      (accessoriesRows || []).forEach((a) => {
        accessoryCounts[a.user_id] = (accessoryCounts[a.user_id] || 0) + 1;
      });

      // Mapear configuración de cotizador web y precio aluminio crudo
      const { data: configs } = await supabase
        .from("configuracion_usuario")
        .select("user_id, config_data");
      const configMap: any = {};
      (configs || []).forEach((c) => {
        configMap[c.user_id] = c.config_data;
      });

      setProfiles(
        profs.map((p) => ({ 
          ...p, 
          registered_count: counts[p.id] || 0,
          quotes_count: quoteCounts[p.id] || 0,
          recipes_count: recipeCounts[p.id] || 0,
          glasses_count: glassCounts[p.id] || 0,
          accessories_count: accessoryCounts[p.id] || 0,
          aluminum_price_per_kg:
            configMap[p.id]?.aluminumPricePerKg !== undefined
              ? Number(configMap[p.id].aluminumPricePerKg)
              : undefined,
          web_quoter_enabled: p.web_quoter_enabled || Boolean(configMap[p.id]?.webQuoterPlanActive),
        })),
      );
    }
    setLoading(false);
  };

  const toggleWebQuoter = async (id: string, currentVal: boolean) => {
    setToggling(id);
    const nextVal = !currentVal;
    try {
      await supabase
        .from("perfiles_usuarios")
        .update({ web_quoter_enabled: nextVal })
        .eq("id", id);
    } catch (e) {
      console.warn("Columna web_quoter_enabled en perfiles_usuarios:", e);
    }

    try {
      const { data: existingConf } = await supabase
        .from("configuracion_usuario")
        .select("config_data")
        .eq("user_id", id)
        .maybeSingle();

      const currentData = existingConf?.config_data || {};
      const updatedData = { ...currentData, webQuoterPlanActive: nextVal };

      await supabase
        .from("configuracion_usuario")
        .upsert([{ user_id: id, config_data: updatedData }], {
          onConflict: "user_id",
        });
    } catch (e) {
      console.warn("Fallo al actualizar webQuoterPlanActive en configuracion_usuario:", e);
    }

    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, web_quoter_enabled: nextVal } : p
      )
    );
    setToggling(null);
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

  
  const handleMasterFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if (jsonData.perfiles && !jsonData.aluminum) jsonData.aluminum = jsonData.perfiles;
        if (jsonData.vidrios && !jsonData.glasses) jsonData.glasses = jsonData.vidrios;
        if (jsonData.accesorios && !jsonData.accessories) jsonData.accessories = jsonData.accesorios;
        if (jsonData.paneles && !jsonData.blindPanels) jsonData.blindPanels = jsonData.paneles;
        if (jsonData.dvh && !jsonData.dvhInputs) jsonData.dvhInputs = jsonData.dvh;
        if (jsonData.recetas && !jsonData.recipes) jsonData.recipes = jsonData.recetas;
        if (jsonData.recipes && !jsonData.recetas) jsonData.recetas = jsonData.recipes;

        setBulkData(jsonData);
        
        if (jsonData.recetas) {
          const lines = new Set<string>();
          jsonData.recetas.forEach((r: any) => {
            if (r.line) lines.add(r.line);
          });
          const uniqueLines = Array.from(lines);
          setAvailableLines(uniqueLines);
          setSelectedLines(uniqueLines);
        }
      } catch (err) {
         console.error("Error cargando JSON Maestro:", err);
         alert("Error al procesar el archivo maestro.");
      }
    };
    reader.readAsText(file);
  };

  const handleBulkInjection = async () => {
    if (!bulkData || selectedUsers.length === 0) return;
    if (!confirm(`¿Estás seguro de que deseas inyectar estos datos a ${selectedUsers.length} usuarios? Esto sobreescribirá las categorías seleccionadas.`)) return;

    setIsDeploying(true);
    const dataToInject: any = {};
    if (selectedCategories.perfiles) dataToInject.aluminum = bulkData.aluminum || [];
    if (selectedCategories.accesorios) dataToInject.accessories = bulkData.accessories || [];
    if (selectedCategories.vidrios) {
        dataToInject.glasses = bulkData.glasses || [];
        dataToInject.blindPanels = bulkData.blindPanels || [];
        dataToInject.dvhInputs = bulkData.dvhInputs || [];
    }
    if (selectedCategories.recetas) {
        dataToInject.recipes = (bulkData.recetas || []).filter((r: any) => selectedLines.includes(r.line));
    }

    try {
        let successCount = 0;
        for (const userId of selectedUsers) {
          const result = await saveBulkData(userId, dataToInject);
          if (result.success) successCount++;
        }
        alert(`¡Inyección completada! Se actualizaron ${successCount} usuarios.`);
        fetchProfiles();
        if (currentUserId && selectedUsers.includes(currentUserId) && onCurrentUserDataUpdated) {
          onCurrentUserDataUpdated();
        }
    } catch (error: any) {
        alert("Error durante la inyección: " + error.message);
    } finally {
        setIsDeploying(false);
    }
  };

  const handleApplyUnifiedPct = () => {
    const val = unifiedIncreasePct.trim();
    if (!val) return;
    setGlassIncreasePct(val);
    setAluminumIncreasePct(val);
    setAccessoryIncreasePct(val);
  };

  const handleBulkPriceIncrease = async () => {
    if (selectedUsers.length === 0) {
      alert("Selecciona al menos un usuario destinatario en la lista.");
      return;
    }

    const glassPct = applyGlassIncrease ? parseFloat(glassIncreasePct) || 0 : 0;
    const aluPct = applyAluminumIncrease ? parseFloat(aluminumIncreasePct) || 0 : 0;
    const accPct = applyAccessoryIncrease ? parseFloat(accessoryIncreasePct) || 0 : 0;

    if (glassPct === 0 && aluPct === 0 && accPct === 0) {
      alert("Ingresa al menos un porcentaje distinto de 0% en alguna de las bases activadas.");
      return;
    }

    const resumenLineas: string[] = [];
    if (glassPct !== 0) resumenLineas.push(`• Vidrios ($/m²): ${glassPct > 0 ? "+" : ""}${glassPct}%`);
    if (aluPct !== 0) resumenLineas.push(`• Aluminio Crudo ($/KG): ${aluPct > 0 ? "+" : ""}${aluPct}%`);
    if (accPct !== 0) resumenLineas.push(`• Accesorios ($/unidad): ${accPct > 0 ? "+" : ""}${accPct}%`);

    const confirmed = confirm(
      `¿Confirmas aplicar el aumento masivo sobre los precios actuales de ${selectedUsers.length} usuario(s)?\n\n` +
      resumenLineas.join("\n") +
      `\n\nSe actualizarán directamente las bases de datos de los usuarios seleccionados sin borrar ni sobrescribir sus ítems.`
    );
    if (!confirmed) return;

    setIsApplyingPriceIncrease(true);
    setPriceIncreaseSummary(null);
    try {
      const result = await applyBulkPriceIncrease(selectedUsers, {
        glassPercentage: glassPct,
        aluminumCrudoPercentage: aluPct,
        accessoryPercentage: accPct,
      });
      setPriceIncreaseSummary(result);
      await fetchProfiles();
      if (currentUserId && selectedUsers.includes(currentUserId) && onCurrentUserDataUpdated) {
        onCurrentUserDataUpdated();
      }
      if (!result.success) {
        alert(
          `Aumento aplicado parcialmente con advertencias:\n` +
          `• Usuarios actualizados: ${result.updatedUsers}\n` +
          `• Vidrios actualizados: ${result.glassesUpdated}\n` +
          `• Configs Aluminio Crudo: ${result.aluminumConfigsUpdated}\n` +
          `• Accesorios actualizados: ${result.accessoriesUpdated}\n\n` +
          `Errores:\n${result.errors.join("\n")}`
        );
      }
    } catch (err: any) {
      alert("Error al aplicar el aumento masivo: " + (err?.message || err));
    } finally {
      setIsApplyingPriceIncrease(false);
    }
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
              onClick={() => setActiveTab("distribution")}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${activeTab === "distribution" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Distribución
            </button>
            <button
              onClick={() => setActiveTab("announcements")}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${activeTab === "announcements" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Anuncios
            </button>
          </div>
        </div>

        {activeTab === "distribution" ? (
          <div className="space-y-6">
            {/* 1. SELECCIÓN DE USUARIOS DESTINATARIOS (COMPARTIDA PARA AUMENTOS E INYECCIÓN) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2.5 text-sm font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === profiles.length && profiles.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUsers(profiles.map((p) => p.id));
                        else setSelectedUsers([]);
                      }}
                      className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                    />
                    Seleccionar Todos ({profiles.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUsers(profiles.filter((p) => p.is_active).map((p) => p.id))
                    }
                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                  >
                    Solo Activos
                  </button>
                  {selectedUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUsers([])}
                      className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={distributionUserSearch}
                      onChange={(e) => setDistributionUserSearch(e.target.value)}
                      placeholder="Buscar email..."
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 w-44 sm:w-52"
                    />
                  </div>
                  <span className="text-xs font-black text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg uppercase tracking-widest whitespace-nowrap">
                    {selectedUsers.length} Selec.
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {profiles
                  .filter((p) =>
                    !distributionUserSearch.trim()
                      ? true
                      : p.email.toLowerCase().includes(distributionUserSearch.trim().toLowerCase())
                  )
                  .map((profile) => (
                    <label
                      key={profile.id}
                      className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        selectedUsers.includes(profile.id) ? "bg-sky-50/40" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(profile.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers((p) => [...p, profile.id]);
                          else setSelectedUsers((p) => p.filter((id) => id !== profile.id));
                        }}
                        className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-2">
                          <span className="truncate">{profile.email}</span>
                          {profile.role === "super_admin" && (
                            <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                              Admin
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest ${
                              profile.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {profile.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="text-sky-700">
                            Alu Crudo:{" "}
                            {profile.aluminum_price_per_kg !== undefined
                              ? `$${profile.aluminum_price_per_kg.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}/kg`
                              : "Sin config ($15 base)"}
                          </span>
                          <span>• {profile.glasses_count || 0} vidrios</span>
                          <span>• {profile.accessories_count || 0} accesorios</span>
                          <span>• {profile.recipes_count || 0} recetas</span>
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
            </div>

            {/* 2. AUMENTOS MASIVOS DE PRECIOS EN PORCENTAJE (%) */}
            <div className="bg-gradient-to-br from-amber-50/70 via-white to-sky-50/60 border border-amber-200 rounded-2xl p-5 space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                      Aumentos Masivos de Precios (%)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Sube un porcentaje sobre el precio actual que ya tiene cada usuario seleccionado, sin borrar ni reemplazar su catálogo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs shrink-0">
                  <input
                    type="number"
                    step="0.1"
                    value={unifiedIncreasePct}
                    onChange={(e) => setUnifiedIncreasePct(e.target.value)}
                    placeholder="% general"
                    className="w-24 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUnifiedPct}
                    disabled={!unifiedIncreasePct.trim()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Aplicar a los 3
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Vidrios */}
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    applyGlassIncrease
                      ? "bg-white border-sky-300 shadow-sm"
                      : "bg-slate-50/70 border-slate-200 opacity-65"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyGlassIncrease}
                        onChange={(e) => setApplyGlassIncrease(e.target.checked)}
                        className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                      />
                      <Layers size={15} className="text-sky-600" />
                      Vidrios Completa
                    </label>
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                      $/m²
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      disabled={!applyGlassIncrease}
                      value={glassIncreasePct}
                      onChange={(e) => setGlassIncreasePct(e.target.value)}
                      className="w-full pr-8 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed"
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">
                    Ej. $1.000 →{" "}
                    <strong className="text-slate-700">
                      $
                      {(
                        1000 *
                        (1 + ((applyGlassIncrease ? parseFloat(glassIncreasePct) || 0 : 0) / 100))
                      ).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </p>
                </div>

                {/* Aluminio Crudo */}
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    applyAluminumIncrease
                      ? "bg-white border-amber-300 shadow-sm"
                      : "bg-slate-50/70 border-slate-200 opacity-65"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyAluminumIncrease}
                        onChange={(e) => setApplyAluminumIncrease(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                      />
                      <Box size={15} className="text-amber-600" />
                      Aluminio Crudo
                    </label>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      $/KG
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      disabled={!applyAluminumIncrease}
                      value={aluminumIncreasePct}
                      onChange={(e) => setAluminumIncreasePct(e.target.value)}
                      className="w-full pr-8 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed"
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">
                    Ej. $1.000 →{" "}
                    <strong className="text-slate-700">
                      $
                      {(
                        1000 *
                        (1 + ((applyAluminumIncrease ? parseFloat(aluminumIncreasePct) || 0 : 0) / 100))
                      ).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </p>
                </div>

                {/* Accesorios */}
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    applyAccessoryIncrease
                      ? "bg-white border-emerald-300 shadow-sm"
                      : "bg-slate-50/70 border-slate-200 opacity-65"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyAccessoryIncrease}
                        onChange={(e) => setApplyAccessoryIncrease(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                      />
                      <Package size={15} className="text-emerald-600" />
                      Accesorios Completa
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      $/Unidad
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      disabled={!applyAccessoryIncrease}
                      value={accessoryIncreasePct}
                      onChange={(e) => setAccessoryIncreasePct(e.target.value)}
                      className="w-full pr-8 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed"
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">
                    Ej. $1.000 →{" "}
                    <strong className="text-slate-700">
                      $
                      {(
                        1000 *
                        (1 + ((applyAccessoryIncrease ? parseFloat(accessoryIncreasePct) || 0 : 0) / 100))
                      ).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </p>
                </div>
              </div>

              {priceIncreaseSummary && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                    priceIncreaseSummary.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-widest">
                      {priceIncreaseSummary.success
                        ? "Aumento masivo aplicado con éxito"
                        : "Aumento aplicado con advertencias"}
                    </p>
                    <p className="font-medium">
                      Usuarios actualizados: <strong>{priceIncreaseSummary.updatedUsers}</strong> • Vidrios actualizados:{" "}
                      <strong>{priceIncreaseSummary.glassesUpdated}</strong> • Alu Crudo actualizado:{" "}
                      <strong>{priceIncreaseSummary.aluminumConfigsUpdated}</strong> • Accesorios actualizados:{" "}
                      <strong>{priceIncreaseSummary.accessoriesUpdated}</strong>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleBulkPriceIncrease}
                  disabled={isApplyingPriceIncrease || selectedUsers.length === 0}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-black uppercase text-xs tracking-widest px-6 py-3.5 rounded-xl transition-colors flex items-center gap-2.5 shadow-md hover:shadow-lg"
                >
                  {isApplyingPriceIncrease ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <TrendingUp size={18} />
                  )}
                  Aplicar Aumento Masivo a {selectedUsers.length} Usuario(s)
                </button>
              </div>
            </div>

            {/* 3. INYECCIÓN DE ARCHIVO MAESTRO JSON */}
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    Inyección de Archivo Maestro JSON (Sobrescribe categorías seleccionadas)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Usa la misma selección de usuarios de arriba para inyectar recetas, perfiles, accesorios o vidrios desde un respaldo JSON.
                  </p>
                </div>
              </div>

              {!bulkData ? (
                <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                  <UploadCloud size={44} className="text-slate-400 mb-3" />
                  <p className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4">
                    Cargar Archivo Maestro JSON
                  </p>
                  <button
                    onClick={() => masterFileInputRef.current?.click()}
                    className="bg-sky-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-sky-700"
                  >
                    Subir Archivo
                  </button>
                  <input
                    type="file"
                    ref={masterFileInputRef}
                    onChange={handleMasterFileUpload}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-emerald-800 uppercase tracking-widest">
                        Archivo Maestro en Memoria
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">
                        Contiene {bulkData.recetas?.length || 0} recetas, {bulkData.aluminum?.length || 0} perfiles,{" "}
                        {bulkData.accessories?.length || 0} accesorios.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setBulkData(null);
                      }}
                      className="text-xs font-bold uppercase text-emerald-700 hover:text-emerald-900 px-3 py-1.5 bg-emerald-100 rounded-lg"
                    >
                      Cambiar Archivo
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">
                      Filtros de Inyección
                    </h4>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCategories.recetas}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedCategories((p) => ({ ...p, recetas: isChecked }));
                              if (isChecked && availableLines.length > 0) setShowLinesModal(true);
                            }}
                            className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                          />
                          Recetas
                        </label>
                        {selectedCategories.recetas && availableLines.length > 0 && (
                          <button
                            onClick={() => setShowLinesModal(true)}
                            className="text-[10px] text-sky-600 font-bold uppercase hover:underline"
                          >
                            (Seleccionadas: {selectedLines.length}/{availableLines.length}) Editar
                          </button>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.perfiles}
                          onChange={(e) =>
                            setSelectedCategories((p) => ({ ...p, perfiles: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                        />
                        Perfiles
                      </label>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.accesorios}
                          onChange={(e) =>
                            setSelectedCategories((p) => ({ ...p, accesorios: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                        />
                        Accesorios
                      </label>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.vidrios}
                          onChange={(e) =>
                            setSelectedCategories((p) => ({ ...p, vidrios: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                        />
                        Vidrios / Paneles
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleBulkInjection}
                      disabled={isDeploying || selectedUsers.length === 0}
                      className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black uppercase text-xs tracking-widest px-8 py-4 rounded-xl transition-colors flex items-center gap-3 shadow-lg hover:shadow-xl"
                    >
                      {isDeploying ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Database size={18} />
                      )}
                      Inyectar Datos a {selectedUsers.length} Usuarios
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "users" ? (
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
                  <button
                    onClick={() => toggleWebQuoter(profile.id, Boolean(profile.web_quoter_enabled))}
                    disabled={toggling === profile.id}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      profile.web_quoter_enabled
                        ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    <Globe size={13} />
                    Cotizador Web: {profile.web_quoter_enabled ? "Activo" : "Inactivo"}
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
            {announcementsError === "table_missing" || announcementsError === "permission_denied" ? (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-700 font-bold mb-3">
                  <AlertTriangle size={20} />
                  {announcementsError === "permission_denied"
                    ? "Permisos RLS de Anuncios en Supabase (Error 42501)"
                    : "Configurar tabla de anuncios en Supabase"}
                </div>
                <p className="text-sm text-amber-700 mb-4">
                  {announcementsError === "permission_denied"
                    ? "La política anterior en Supabase intentó consultar la tabla interna auth.users, lo cual Postgres restringe por seguridad. Ejecuta este script corregido en Supabase -> SQL Editor para solucionar los permisos de inmediato:"
                    : "Para poder enviar mensajes globales e individuales, ejecuta este script en el SQL Editor de Supabase:"}
                </p>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono">
{`CREATE TABLE IF NOT EXISTS public.anuncios_globales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean DEFAULT true,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_email text;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS type text DEFAULT 'info';

ALTER TABLE public.anuncios_globales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Super admins can manage announcements" ON public.anuncios_globales;

CREATE POLICY "Users can read their announcements" ON public.anuncios_globales
  FOR SELECT USING (
    is_active = true 
    AND (
      (target_user_id IS NULL AND target_user_email IS NULL)
      OR (auth.uid() IS NOT NULL AND target_user_id = auth.uid())
      OR (auth.jwt() ->> 'email' IS NOT NULL AND target_user_email = (auth.jwt() ->> 'email'))
      OR (auth.uid() IS NOT NULL AND target_user_email = (SELECT email FROM public.perfiles_usuarios WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Super admins can manage announcements" ON public.anuncios_globales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles_usuarios 
      WHERE perfiles_usuarios.id = auth.uid() 
      AND perfiles_usuarios.role = 'super_admin'
    )
  );`}
                </pre>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      const sqlText = `CREATE TABLE IF NOT EXISTS public.anuncios_globales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean DEFAULT true,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_email text;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS type text DEFAULT 'info';
ALTER TABLE public.anuncios_globales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Super admins can manage announcements" ON public.anuncios_globales;
CREATE POLICY "Users can read their announcements" ON public.anuncios_globales
  FOR SELECT USING (
    is_active = true 
    AND (
      (target_user_id IS NULL AND target_user_email IS NULL)
      OR (auth.uid() IS NOT NULL AND target_user_id = auth.uid())
      OR (auth.jwt() ->> 'email' IS NOT NULL AND target_user_email = (auth.jwt() ->> 'email'))
      OR (auth.uid() IS NOT NULL AND target_user_email = (SELECT email FROM public.perfiles_usuarios WHERE id = auth.uid()))
    )
  );
CREATE POLICY "Super admins can manage announcements" ON public.anuncios_globales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles_usuarios 
      WHERE perfiles_usuarios.id = auth.uid() 
      AND perfiles_usuarios.role = 'super_admin'
    )
  );`;
                      navigator.clipboard.writeText(sqlText);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
                  >
                    {copiedSql ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar SQL</>}
                  </button>
                  <button onClick={fetchAnnouncements} className="bg-amber-200 text-amber-800 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-amber-300 transition-colors">
                    Ya ejecuté el código, reintentar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <form onSubmit={publishAnnouncement} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <User size={14} className="text-sky-600" /> Destinatario
                      </label>
                      <select
                        value={targetUserOption}
                        onChange={(e) => setTargetUserOption(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                      >
                        <option value="all">🌐 TODOS LOS USUARIOS (Anuncio Global)</option>
                        <optgroup label="👤 Mensaje Individual para Usuario Específico:">
                          {profiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.email} {p.role === "super_admin" ? "(Admin)" : ""} {p.is_active ? "• Activo" : "• Inactivo"}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="sm:w-56">
                      <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                        Tipo de Notificación
                      </label>
                      <select 
                        value={newAnnouncementType}
                        onChange={(e) => setNewAnnouncementType(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                      >
                        <option value="info">🔵 Información (Azul)</option>
                        <option value="success">🟢 Novedad / Felicitación (Verde)</option>
                        <option value="warning">🟡 Alerta / Recordatorio (Amarillo)</option>
                        <option value="urgent">🔴 Urgente / Bloqueo (Rojo)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                      Mensaje del Anuncio
                    </label>
                    <textarea
                      value={newAnnouncementMsg}
                      onChange={(e) => setNewAnnouncementMsg(e.target.value)}
                      placeholder={
                        targetUserOption === "all"
                          ? "Escribe aquí el mensaje que verán TODOS los usuarios al entrar a la app..."
                          : `Escribe el mensaje personal que verá exclusivamente este usuario cada vez que entre a la app...`
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[90px] shadow-sm"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1.5">
                      <p className="text-[11px] text-slate-500 font-medium">
                        🔔 <strong>Activación continua:</strong> Cada vez que el usuario entre o recargue la app, se activará este mensaje en pantalla. Puede cerrarlo para trabajar, pero volverá a activarse cada vez que vuelva a ingresar hasta que presiones <em>Desactivar</em>.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowSqlGuide(!showSqlGuide)}
                        className="text-[11px] text-sky-600 hover:text-sky-800 font-bold underline shrink-0"
                      >
                        {showSqlGuide ? "Ocultar SQL de Supabase" : "Ver / Copiar SQL de Supabase"}
                      </button>
                    </div>
                  </div>

                  {showSqlGuide && (
                    <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs space-y-2 border border-slate-800 font-mono">
                      <div className="flex items-center justify-between text-emerald-400 font-bold">
                        <span>Script SQL para Supabase (anuncios_globales)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const sqlText = `CREATE TABLE IF NOT EXISTS public.anuncios_globales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean DEFAULT true,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_email text;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS type text DEFAULT 'info';
ALTER TABLE public.anuncios_globales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Super admins can manage announcements" ON public.anuncios_globales;
CREATE POLICY "Users can read their announcements" ON public.anuncios_globales
  FOR SELECT USING (
    is_active = true 
    AND (
      (target_user_id IS NULL AND target_user_email IS NULL)
      OR (auth.uid() IS NOT NULL AND target_user_id = auth.uid())
      OR (auth.jwt() ->> 'email' IS NOT NULL AND target_user_email = (auth.jwt() ->> 'email'))
      OR (auth.uid() IS NOT NULL AND target_user_email = (SELECT email FROM public.perfiles_usuarios WHERE id = auth.uid()))
    )
  );
CREATE POLICY "Super admins can manage announcements" ON public.anuncios_globales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles_usuarios 
      WHERE perfiles_usuarios.id = auth.uid() 
      AND perfiles_usuarios.role = 'super_admin'
    )
  );`;
                            navigator.clipboard.writeText(sqlText);
                            setCopiedSql(true);
                            setTimeout(() => setCopiedSql(false), 2500);
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] uppercase font-sans font-bold flex items-center gap-1 transition-colors"
                        >
                          {copiedSql ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar SQL</>}
                        </button>
                      </div>
                      <p className="text-slate-400 font-sans text-[11px]">
                        Ejecuta esto en Supabase -&gt; SQL Editor si necesitas crear o actualizar la tabla de anuncios con soporte para mensajes individuales.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isPublishing || !newAnnouncementMsg.trim()}
                      className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black uppercase text-xs tracking-widest px-8 py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex justify-center items-center gap-2"
                    >
                      {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <><Megaphone size={16} /> Publicar Mensaje</>}
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
                        <div key={ann.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row gap-4 justify-between transition-all ${
                          !ann.is_active 
                            ? 'bg-slate-50 border-slate-200 opacity-60' 
                            : ann.type === 'urgent'
                            ? 'bg-rose-50 border-rose-200'
                            : ann.type === 'warning' 
                            ? 'bg-amber-50 border-amber-200' 
                            : ann.type === 'success' 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : 'bg-sky-50 border-sky-200'
                        }`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded ${
                                !ann.is_active 
                                  ? 'bg-slate-200 text-slate-600' 
                                  : ann.type === 'urgent'
                                  ? 'bg-rose-200 text-rose-800'
                                  : ann.type === 'warning' 
                                  ? 'bg-amber-200 text-amber-800' 
                                  : ann.type === 'success' 
                                  ? 'bg-emerald-200 text-emerald-800' 
                                  : 'bg-sky-200 text-sky-800'
                              }`}>
                                {ann.type === 'urgent' ? '🚨 Urgente' : ann.type === 'warning' ? '⚠️ Alerta' : ann.type === 'success' ? '✨ Novedad' : 'ℹ️ Info'}
                              </span>
                              {ann.target_user_email ? (
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-1 border border-purple-200">
                                  <User size={10} /> Para usuario: {ann.target_user_email}
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-1 border border-blue-200">
                                  <Globe size={10} /> Global (Todos los usuarios)
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ann.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {ann.is_active ? '🟢 Activo (se activa al abrir app)' : '⚪ Desactivado'}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(ann.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{ann.message}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toggleAnnouncement(ann.id, ann.is_active)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                                ann.is_active 
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              }`}
                            >
                              {ann.is_active ? 'Desactivar' : 'Reactivar'}
                            </button>
                            <button
                              onClick={() => deleteAnnouncement(ann.id)}
                              className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              title="Eliminar permanentemente"
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
      
      {showLinesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-tighter">
                Seleccionar Líneas de Recetas
              </h3>
              <button onClick={() => setShowLinesModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
                 <button onClick={() => setSelectedLines(availableLines)} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors">Seleccionar Todas</button>
                 <button onClick={() => setSelectedLines([])} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors">Ninguna</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-4 bg-slate-50 min-h-[200px]">
                 {availableLines.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-8">No se encontraron líneas en el archivo.</div>
                 ) : (
                    availableLines.map(line => (
                        <label key={line} className="flex items-center gap-3 p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl cursor-pointer transition-all shadow-sm">
                           <input type="checkbox" checked={selectedLines.includes(line)} onChange={(e) => {
                              if (e.target.checked) setSelectedLines(p => [...p, line]);
                              else setSelectedLines(p => p.filter(l => l !== line));
                           }} className="w-5 h-5 rounded text-sky-600 cursor-pointer" />
                           <span className="text-sm font-bold text-slate-700">{line || 'Sin Línea'}</span>
                        </label>
                    ))
                 )}
            </div>
            <div className="mt-6 flex justify-end">
               <button onClick={() => setShowLinesModal(false)} className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-black uppercase text-[10px] tracking-widest py-4 px-8 rounded-xl transition-colors shadow-lg hover:shadow-xl">
                  Confirmar Selección ({selectedLines.length})
               </button>
            </div>
          </div>
        </div>
      )}
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
