import React, { useState } from "react";
import {
  Globe,
  Copy,
  ExternalLink,
  Check,
  Smartphone,
  Save,
  ShieldCheck,
  DollarSign,
  MessageCircle,
  FileText,
  Sliders,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import {
  GlobalConfig,
  ProductRecipe,
  Treatment,
  Glass,
  DVHInput,
  BlindPanel,
  AluminumProfile,
  WebQuoterConfig,
} from "../types";

interface Props {
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
  recipes: ProductRecipe[];
  treatments: Treatment[];
  glasses: Glass[];
  dvhInputs: DVHInput[];
  blindPanels: BlindPanel[];
  aluminum: AluminumProfile[];
  userId?: string;
  onOpenPublicPreview: () => void;
}

const DEFAULT_WEB_CONFIG: WebQuoterConfig = {
  enabled: true,
  publicTitle: "Cotizador Online de Aberturas",
  markupPercentage: 30,
  whatsappNumber: "+54 9 11 0000 0000",
  allowedRecipeIds: [],
  allowDVH: true,
  allowBlind: true,
  notes: "Presupuesto estimativo preliminar sujeto a verificación de medidas y condiciones técnicas en obra.",
};

export const WebQuoterSettings: React.FC<Props> = ({
  config,
  setConfig,
  recipes,
  userId,
  onOpenPublicPreview,
}) => {
  const currentWebConfig = config.webQuoterConfig || DEFAULT_WEB_CONFIG;
  const [webConfig, setWebConfig] = useState<WebQuoterConfig>({
    ...DEFAULT_WEB_CONFIG,
    ...config.webQuoterConfig,
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Generar URL pública con parámetros seguros
  const baseUrl = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}`
    : "https://arista.app";
  
  const publicUrl = `${baseUrl}?portal=cotizar${userId ? `&uid=${encodeURIComponent(userId)}` : ""}`;
  const iframeSnippet = `<iframe src="${publicUrl}" width="100%" height="800" frameborder="0" style="border:none; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.08);" title="Cotizador Web de Aberturas"></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyIframe = () => {
    navigator.clipboard.writeText(iframeSnippet);
    setCopiedIframe(true);
    setTimeout(() => setCopiedIframe(false), 2500);
  };

  const handleToggleRecipe = (recipeId: string) => {
    const current = webConfig.allowedRecipeIds || [];
    const updated = current.includes(recipeId)
      ? current.filter((id) => id !== recipeId)
      : [...current, recipeId];
    setWebConfig((prev) => ({ ...prev, allowedRecipeIds: updated }));
  };

  const handleSelectAllRecipes = () => {
    setWebConfig((prev) => ({
      ...prev,
      allowedRecipeIds: recipes.map((r) => r.id),
    }));
  };

  const handleSelectStandardRecipes = () => {
    // Filtrar tipologías habituales (ventanas, puertas, paños fijos)
    const standard = recipes
      .filter((r) =>
        ["Ventana", "Puerta", "Paño Fijo"].includes(r.type || "") &&
        !r.isComplementary
      )
      .map((r) => r.id);
    setWebConfig((prev) => ({
      ...prev,
      allowedRecipeIds: standard,
    }));
  };

  const handleSave = () => {
    setConfig((prev) => ({
      ...prev,
      webQuoterConfig: webConfig,
    }));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Cantidad de tipologías activas para publicar
  const publishedCount =
    !webConfig.allowedRecipeIds || webConfig.allowedRecipeIds.length === 0
      ? recipes.length
      : webConfig.allowedRecipeIds.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-700 rounded-3xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-xs">
              <Sparkles size={14} className="text-amber-300" />
              Módulo Web Automático
            </div>
            <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight">
              Cotizador Web para Clientes
            </h1>
            <p className="text-sky-100 text-xs sm:text-sm max-w-xl font-medium leading-relaxed">
              Permite a tus clientes y arquitectos cotizar aberturas de forma autónoma desde tu página web o enviándoles un enlace directo. Los presupuestos ingresan automáticamente a tu sistema.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              onClick={onOpenPublicPreview}
              className="px-5 py-3 rounded-2xl bg-white text-sky-700 hover:bg-sky-50 font-black uppercase text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ExternalLink size={16} /> Probar Cotizador Web
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {saveSuccess ? (
                <>
                  <Check size={16} /> Guardado
                </>
              ) : (
                <>
                  <Save size={16} /> Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Control de Activación y Enlaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Enlace Directo */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-slate-800">
                  Enlace Directo para Clientes
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Compártelo por WhatsApp, redes o correo
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                webConfig.enabled
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {webConfig.enabled ? "Online" : "Pausado"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 break-all select-all flex items-center justify-between gap-2">
            <span className="truncate">{publicUrl}</span>
            <button
              onClick={handleCopyLink}
              className="p-2 bg-white rounded-xl hover:bg-slate-100 text-slate-600 border border-slate-200 shrink-0 transition-colors"
              title="Copiar enlace"
            >
              {copiedLink ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={webConfig.enabled}
                onChange={(e) =>
                  setWebConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="w-4 h-4 text-sky-600 rounded-md focus:ring-sky-500"
              />
              <span className="text-xs font-bold text-slate-700 uppercase">
                Habilitar acceso público
              </span>
            </label>

            <button
              onClick={handleCopyLink}
              className="text-xs font-black uppercase text-sky-600 hover:text-sky-700 flex items-center gap-1.5"
            >
              {copiedLink ? "¡Enlace copiado!" : "Copiar enlace"}
            </button>
          </div>
        </div>

        {/* Widget para Embeber en Sitio Web */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-slate-800">
                  Incrustar en tu Sitio Web (Widget)
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Compatible con WordPress, TiendaNube, Wix o HTML
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900 rounded-2xl text-[11px] font-mono text-slate-300 break-all select-all relative overflow-hidden max-h-24 overflow-y-auto">
            {iframeSnippet}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400 font-medium">
              Copia y pega este código en cualquier sección de tu web.
            </span>
            <button
              onClick={handleCopyIframe}
              className="text-xs font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
            >
              {copiedIframe ? (
                <>
                  <Check size={14} className="text-emerald-500" /> ¡Código copiado!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar código HTML
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Parámetros Comerciales Web */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">
              Parámetros Comerciales Web
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Controla precios y márgenes especiales para presupuestos emitidos en línea
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Recargo Web */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>Margen / Recargo Web (%)</span>
              <span className="text-emerald-600 font-bold">+{webConfig.markupPercentage}%</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="200"
                value={webConfig.markupPercentage}
                onChange={(e) =>
                  setWebConfig((prev) => ({
                    ...prev,
                    markupPercentage: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="absolute right-3.5 top-3 text-slate-400 font-bold text-xs">%</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Margen adicional sobre el costo de taller para la venta online.
            </p>
          </div>

          {/* Teléfono WhatsApp */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <MessageCircle size={13} className="text-emerald-500" />
              <span>WhatsApp de Recepción</span>
            </label>
            <input
              type="text"
              placeholder="+54 9 11 1234 5678"
              value={webConfig.whatsappNumber || ""}
              onChange={(e) =>
                setWebConfig((prev) => ({
                  ...prev,
                  whatsappNumber: e.target.value,
                }))
              }
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-[10px] text-slate-400">
              Número al que el cliente enviará su pedido listo por WhatsApp.
            </p>
          </div>

          {/* Título en la Web */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600">
              Título en el Cotizador
            </label>
            <input
              type="text"
              placeholder="Cotizador Online de Aberturas"
              value={webConfig.publicTitle || ""}
              onChange={(e) =>
                setWebConfig((prev) => ({
                  ...prev,
                  publicTitle: e.target.value,
                }))
              }
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-[10px] text-slate-400">
              Encabezado visible para el cliente final.
            </p>
          </div>
        </div>

        {/* Opciones de Llenado Permitidas */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
            Opciones de Relleno Permitidas al Cliente
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={webConfig.allowDVH ?? true}
                onChange={(e) =>
                  setWebConfig((prev) => ({ ...prev, allowDVH: e.target.checked }))
                }
                className="w-4 h-4 text-sky-600 rounded-md focus:ring-sky-500"
              />
              <span className="text-xs font-bold text-slate-700">
                Permitir Doble Vidrio Hermético (DVH)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={webConfig.allowBlind ?? true}
                onChange={(e) =>
                  setWebConfig((prev) => ({ ...prev, allowBlind: e.target.checked }))
                }
                className="w-4 h-4 text-sky-600 rounded-md focus:ring-sky-500"
              />
              <span className="text-xs font-bold text-slate-700">
                Permitir Tablillas de Aluminio / Panel Ciego
              </span>
            </label>
          </div>
        </div>

        {/* Notas Legales */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <FileText size={13} />
            <span>Condiciones o Aclaraciones Comerciales (Visibles en el PDF y Pantalla)</span>
          </label>
          <textarea
            rows={2}
            value={webConfig.notes || ""}
            onChange={(e) =>
              setWebConfig((prev) => ({ ...prev, notes: e.target.value }))
            }
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Ej: Presupuesto estimativo preliminar sujeto a verificación de medidas en obra."
          />
        </div>
      </div>

      {/* Tipologías Publicadas */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">
                Tipologías Publicadas en la Web ({publishedCount} de {recipes.length})
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Selecciona qué aberturas están disponibles para cotización pública automática
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSelectStandardRecipes}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
            >
              Solo Estándar (Ventanas / Puertas)
            </button>
            <button
              onClick={handleSelectAllRecipes}
              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
            >
              Publicar Todas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
          {recipes.map((recipe) => {
            const isAllowed =
              !webConfig.allowedRecipeIds ||
              webConfig.allowedRecipeIds.length === 0 ||
              webConfig.allowedRecipeIds.includes(recipe.id);

            return (
              <label
                key={recipe.id}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                  isAllowed
                    ? "bg-sky-50/50 border-sky-300 text-slate-800"
                    : "bg-slate-50/50 border-slate-200 text-slate-400 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isAllowed}
                  onChange={() => handleToggleRecipe(recipe.id)}
                  className="mt-1 w-4 h-4 text-sky-600 rounded-md focus:ring-sky-500 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black uppercase truncate">
                    {recipe.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    {recipe.line || "Sin línea"} • {recipe.type || "Abertura"}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Floating Save Bar */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          className="px-8 py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95"
        >
          {saveSuccess ? (
            <>
              <Check size={18} /> ¡Cambios Guardados Exitosamente!
            </>
          ) : (
            <>
              <Save size={18} /> Guardar Ajustes del Cotizador Web
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default WebQuoterSettings;
