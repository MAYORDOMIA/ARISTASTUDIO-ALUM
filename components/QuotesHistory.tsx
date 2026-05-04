import React, { useState } from "react";
import {
  Search,
  FileText,
  Trash2,
  Download,
  ExternalLink,
  Calendar,
  User,
  ArrowRight,
  Hammer,
  PackageCheck,
  Scissors,
  Layers,
  ChevronRight,
  X,
  Wallet,
} from "lucide-react";
import {
  Quote,
  GlobalConfig,
  ProductRecipe,
  AluminumProfile,
  Accessory,
  Glass,
  DVHInput,
  Treatment,
  BlindPanel,
} from "../types";
import {
  generateClientDetailedPDF,
  generateMaterialsOrderPDF,
  generateAssemblyOrderPDF,
  generateBarOptimizationPDF,
  generateGlassOptimizationPDF,
  generateCostsPDF,
} from "../services/pdfGenerator";
import { calculateCompositePrice } from "../services/calculator";
import { supabase, isSupabaseConfigured } from "../src/services/supabaseClient";
interface Props {
  quotes: Quote[];
  setQuotes: (quotes: Quote[]) => void;
  config: GlobalConfig;
  recipes: ProductRecipe[];
  aluminum: AluminumProfile[];
  accessories: Accessory[];
  glasses: Glass[];
  dvhInputs: DVHInput[];
  treatments: Treatment[];
  blindPanels: BlindPanel[];
  onEditQuote: (quote: Quote) => void;
}
const QuotesHistory: React.FC<Props> = ({
  quotes,
  setQuotes,
  config,
  recipes,
  aluminum,
  accessories,
  glasses,
  dvhInputs,
  treatments,
  blindPanels,
  onEditQuote,
}) => {
  const [search, setSearch] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const filteredQuotes = quotes
    .filter(
      (q) =>
        q.clientName.toLowerCase().includes(search.toLowerCase()) ||
        q.id.includes(search),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const deleteQuote = async (id: string) => {
    if (
      window.confirm(
        "¿Está seguro de eliminar esta cotización permanentemente?",
      )
    ) {
      setQuotes(quotes.filter((q) => q.id !== id));
      if (selectedQuote?.id === id) setSelectedQuote(null);
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("presupuestos")
          .delete()
          .eq("id", id);
        if (error) console.error(error);
      }
    }
  };
  const downloadReport = (
    quote: Quote,
    type:
      | "presupuesto"
      | "taller"
      | "materiales"
      | "barras"
      | "vidrios"
      | "costos",
  ) => {
    try {
      switch (type) {
        case "presupuesto":
          generateClientDetailedPDF(
            quote,
            config,
            recipes,
            glasses,
            dvhInputs,
            treatments,
          );
          break;
        case "taller":
          generateAssemblyOrderPDF(
            quote,
            recipes,
            aluminum,
            glasses,
            dvhInputs,
          );
          break;
        case "materiales":
          generateMaterialsOrderPDF(
            quote,
            recipes,
            aluminum,
            accessories,
            glasses,
            dvhInputs,
            config,
            blindPanels,
          );
          break;
        case "barras":
          generateBarOptimizationPDF(
            quote,
            recipes,
            aluminum,
            config,
            blindPanels,
            glasses,
            dvhInputs,
          );
          break;
        case "vidrios":
          generateGlassOptimizationPDF(
            quote,
            recipes,
            glasses,
            aluminum,
            dvhInputs,
            blindPanels,
          );
          break;
        case "costos":
          generateCostsPDF(quote, config, recipes, aluminum);
          break;
      }
    } catch (error: any) {
      console.error(
        "Error al generar el reporte técnico (msg):",
        error?.message || error,
      );
      alert("Error al generar el reporte técnico.");
    }
  };
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 bg-white p-4 lg:p-8 rounded-[1.5rem] lg:rounded-[2.5rem] border-2 border-slate-300 shadow-xl ring-1 ring-slate-200 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-600/20 border-2 border-sky-700/30 shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-sm lg:text-xl font-black uppercase tracking-widest text-slate-800 ">
              Historial de Obras
            </h2>
            <p className="text-[8px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Registros de Ingeniería y Presupuestos
            </p>
          </div>
        </div>
        <div className="relative w-full lg:w-96">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
            size={16}
          />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full bg-slate-50 border-2 border-slate-200 pl-11 lg:pl-12 pr-4 lg:pr-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl text-xs lg:text-sm focus:outline-none focus:border-sky-600 transition-all font-medium text-[#0f172a] shadow-inner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-4">
          {filteredQuotes.length > 0 ? (
            filteredQuotes.map((q) => (
              <div
                key={q.id}
                onClick={() => setSelectedQuote(q)}
                className={`group relative p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between shadow-sm ${selectedQuote?.id === q.id ? "bg-white border-sky-600 shadow-2xl scale-[1.02] ring-1 ring-sky-400/20" : "bg-white border-slate-200 hover:border-sky-300"}`}
              >
                <div className="flex items-center gap-5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors border-2 ${selectedQuote?.id === q.id ? "bg-sky-600 text-white border-sky-700" : "bg-slate-50 text-slate-400 border-slate-200 group-hover:bg-sky-100 group-hover:text-sky-600 group-hover:border-sky-200"}`}
                  >
                    <User size={20} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-sky-600 font-black uppercase tracking-widest">
                      {formatDate(q.date)}
                    </div>
                    <div className="text-sm font-black text-slate-800 uppercase group-hover:text-sky-600 transition-colors truncate max-w-[200px]">
                      {q.clientName}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                      ID: {q.id.substring(0, 8)} | {q.items.length} ÍTEMS
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm font-black text-slate-900 font-mono">
                    ${q.totalPrice.toLocaleString()}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuote(q.id);
                    }}
                    className="p-2 text-slate-300 hover:text-red-600 transition-colors border border-transparent hover:border-slate-200 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-12 rounded-[2rem] border-4 border-dashed border-slate-200 text-center text-slate-300">
              <Calendar size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-xs font-black uppercase tracking-widest">
                No se encontraron registros
              </p>
            </div>
          )}
        </div>
        <div className="xl:col-span-7">
          {selectedQuote ? (
            <div className="bg-white rounded-[1.5rem] lg:rounded-[3rem] border-2 border-slate-300 shadow-2xl p-4 lg:p-10 space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col ring-1 ring-slate-200 transition-colors">
              <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4 lg:pb-8">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                    <span className="text-[8px] lg:text-[10px] text-sky-600 font-black uppercase tracking-widest bg-sky-600/10 px-3 py-1 rounded-full border-2 border-sky-600/20">
                      Expediente Industrial
                    </span>
                    <span className="text-[8px] lg:text-[10px] text-slate-400 font-mono">
                      MOD_VER_2.5
                    </span>
                  </div>
                  <h3 className="text-xl lg:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                    {selectedQuote.clientName}
                  </h3>
                  <p className="text-[10px] lg:text-xs text-slate-500 font-bold">
                    Cotizado el {formatDate(selectedQuote.date)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="p-2 lg:p-3 text-slate-400 hover:text-slate-800 transition-colors bg-slate-50 rounded-xl lg:rounded-2xl border-2 border-slate-200 shadow-sm"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={() => onEditQuote(selectedQuote)}
                  className="p-2 lg:p-3 text-sky-600 hover:text-white hover:bg-sky-600 transition-colors bg-sky-50 rounded-xl lg:rounded-2xl border-2 border-sky-100 shadow-sm"
                >
                  Editar
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-4">
                <button
                  onClick={() => downloadReport(selectedQuote, "presupuesto")}
                  className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-slate-200 hover:border-sky-600 transition-all group shadow-sm ring-1 ring-transparent hover:ring-sky-600/10"
                >
                  <div className="w-10 h-10 bg-sky-600/10 rounded-xl flex items-center justify-center text-sky-600 group-hover:bg-sky-600 group-hover:text-white border-2 border-sky-600/20 group-hover:border-sky-700 transition-all">
                    <FileText size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                      Presupuesto
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">
                      Comercial
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => downloadReport(selectedQuote, "costos")}
                  className="flex items-center gap-4 p-5 bg-amber-50 rounded-2xl border-2 border-amber-200 hover:border-amber-500 transition-all group shadow-sm ring-1 ring-transparent hover:ring-amber-500/10"
                >
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white border-2 border-amber-500/20 group-hover:border-amber-600 transition-all">
                    <Wallet size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                      Costos
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">
                      Auditoría Interna
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => downloadReport(selectedQuote, "taller")}
                  className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all group shadow-sm ring-1 ring-transparent hover:ring-blue-500/10"
                >
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white border-2 border-blue-500/20 group-hover:border-blue-600 transition-all">
                    <Hammer size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                      Hoja de Armado
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">
                      Taller
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => downloadReport(selectedQuote, "materiales")}
                  className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-slate-200 hover:border-green-500 transition-all group shadow-sm ring-1 ring-transparent hover:ring-green-500/10"
                >
                  <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-500 group-hover:text-white border-2 border-green-500/20 group-hover:border-green-600 transition-all">
                    <PackageCheck size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                      Materiales
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">
                      Consolidado
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => downloadReport(selectedQuote, "barras")}
                  className="flex items-center gap-4 p-5 bg-sky-50 rounded-2xl border-2 border-sky-200 hover:border-sky-600 transition-all group shadow-sm ring-1 ring-transparent hover:ring-sky-600/10"
                >
                  <div className="w-10 h-10 bg-sky-600/10 rounded-xl flex items-center justify-center text-sky-600 group-hover:bg-sky-600 group-hover:text-white border-2 border-sky-600/20 group-hover:border-sky-700 transition-all">
                    <Scissors size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                      Corte Barras
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">
                      Optimización Lineal
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => downloadReport(selectedQuote, "vidrios")}
                  className="flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border-2 border-blue-200 hover:border-blue-600 transition-all group shadow-sm ring-1 ring-transparent hover:ring-blue-600/10"
                >
                  <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white border-2 border-blue-600/20 group-hover:border-blue-600 transition-all">
                    <Layers size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                      Corte Vidrios
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">
                      Optimización Planchas
                    </div>
                  </div>
                </button>
              </div>
              <div className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 overflow-y-auto custom-scrollbar space-y-3 shadow-inner">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">
                  Desglose de Ítems ({selectedQuote.items.length})
                </h4>
                {selectedQuote.items.map((item, idx) => {
                  const moduleNames = item.composition.modules
                    .map((m) => recipes.find((r) => r.id === m.recipeId)?.name)
                    .filter(Boolean);
                  const compositeName =
                    moduleNames.length > 1
                      ? `CONJUNTO: ${moduleNames.join(" + ")}`
                      : moduleNames[0] || "Producto";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm transition-all hover:border-sky-600/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-10 bg-slate-50 rounded-lg flex flex-col items-center justify-center border border-slate-100 ">
                          <span className="text-[6px] font-black text-slate-400 uppercase">
                            ABER.
                          </span>
                          <span className="text-[9px] font-black text-sky-600 truncate max-w-full px-1">
                            {item.itemCode || `POS#${idx + 1}`}
                          </span>
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-800 uppercase">
                            {compositeName}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono font-bold">
                            {item.width} x {item.height} mm | {item.quantity}
                            UNID.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select
                          className="text-[9px] font-black uppercase bg-slate-50 p-2 rounded-lg border border-slate-200 "
                          value={item.colorId}
                          onChange={async (e) => {
                            const newColorId = e.target.value;
                            const treatment = treatments.find(
                              (t) => t.id === newColorId,
                            );
                            if (!treatment) return;
                            const updatedItems = selectedQuote.items.map(
                              (it) => {
                                if (it.id === item.id) {
                                  const { finalPrice, breakdown } =
                                    calculateCompositePrice(
                                      { ...it, colorId: newColorId },
                                      recipes,
                                      aluminum,
                                      config,
                                      treatment,
                                      glasses,
                                      accessories,
                                      dvhInputs,
                                      blindPanels,
                                      it.glazingBeadStyle || "Recto",
                                    );
                                  return {
                                    ...it,
                                    colorId: newColorId,
                                    calculatedCost: finalPrice,
                                    breakdown,
                                  };
                                }
                                return it;
                              },
                            );
                            const subtotal = updatedItems.reduce(
                              (acc, it) =>
                                acc + it.calculatedCost * it.quantity,
                              0,
                            );
                            const totalPrice = Math.round(
                              subtotal * (1 + config.taxRate / 100),
                            );
                            const updatedQuote = {
                              ...selectedQuote,
                              items: updatedItems,
                              totalPrice,
                            };
                            setSelectedQuote(updatedQuote);
                            setQuotes(
                              quotes.map((q) =>
                                q.id === selectedQuote.id ? updatedQuote : q,
                              ),
                            );
                            if (isSupabaseConfigured) {
                              const userRes = await supabase.auth.getUser();
                              if (userRes.data.user) {
                                const { error } = await supabase
                                  .from("presupuestos")
                                  .upsert(
                                    {
                                      id: updatedQuote.id,
                                      user_id: userRes.data.user.id,
                                      cliente_nombre: updatedQuote.clientName,
                                      total: updatedQuote.totalPrice,
                                      items: updatedQuote.items,
                                      created_at: updatedQuote.date,
                                      estado: "borrador",
                                    },
                                    { onConflict: "id" },
                                  );
                                if (error) {
                                  console.error(
                                    "Error updating quote in DB",
                                    error,
                                  );
                                  alert(
                                    "Error al actualizar en la nube: " +
                                      error.message,
                                  );
                                }
                              }
                            }
                          }}
                        >
                          {treatments.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs font-black text-slate-900 font-mono">
                          $
                          {(
                            item.calculatedCost * item.quantity
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-6 border-t-2 border-slate-100 flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Liquidación Final Total
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none font-mono">
                  ${selectedQuote.totalPrice.toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[3rem] border-4 border-dashed border-slate-200 text-slate-200 space-y-6 transition-colors">
              <Calendar size={80} className="animate-pulse-soft opacity-10" />
              <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-300 ">
                Seleccione una cotización para ver ingeniería
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default QuotesHistory;
