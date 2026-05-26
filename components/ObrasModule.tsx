import React, { useState, useMemo, useEffect } from "react";
import {
  Trash2,
  CheckCircle,
  Briefcase,
  AlertCircle,
  FileText,
  Package,
  Ruler,
  ChevronRight,
  Database,
  Calculator,
  Hash,
  Edit3,
} from "lucide-react";
import {
  QuoteItem,
  Quote,
  ProductRecipe,
  GlobalConfig,
  AluminumProfile,
  BlindPanel,
} from "../types";
import { evaluateFormula } from "../services/calculator";
import { supabase, isSupabaseConfigured } from "../src/services/supabaseClient";
interface Props {
  items: QuoteItem[];
  setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
  quotes: Quote[];
  setQuotes: (quotes: Quote[]) => void;
  recipes: ProductRecipe[];
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
  aluminum: AluminumProfile[];
  blindPanels: BlindPanel[];
  onEditItem?: (item: QuoteItem) => void;
  activeQuote?: Quote | null;
  setActiveQuote?: (quote: Quote | null) => void;
}
const ObrasModule: React.FC<Props> = ({
  items,
  setItems,
  quotes,
  setQuotes,
  recipes,
  config,
  setConfig,
  aluminum,
  blindPanels,
  onEditItem,
  activeQuote,
  setActiveQuote,
}) => {
  const [clientName, setClientName] = useState("");
  useEffect(() => {
    if (activeQuote) {
      setClientName(activeQuote.clientName);
    } else if (items.length === 0) {
      setClientName("");
    }
  }, [activeQuote, items.length]);
  useEffect(() => {
    if (items.length > 0) {
      const currentMargin = config.laborPercentage || 0; // Quick check
      // if the first item's margin already matches to avoid infinite loop
      const firstItem = items[0];
      if (firstItem.breakdown && firstItem.breakdown.materialCost > 0) {
        const impliedMargin =
          (firstItem.breakdown.laborCost / firstItem.breakdown.materialCost) *
          100; // Avoid updating
        // if the difference is very small (floating point precision)
        if (Math.abs(impliedMargin - currentMargin) < 0.1) {
          return;
        }
      }
      setItems((prevItems) =>
        prevItems.map((item) => {
          if (!item.breakdown) return item;
          const materialCost = item.breakdown.materialCost || 0;
          const newLaborCost = materialCost * (currentMargin / 100);
          const hasHandrail = (item.breakdown.handrailExtraCost || 0) > 0;
          const hasMampara = (item.breakdown.mamparaExtraCost || 0) > 0;
          const handrailExtraCost = hasHandrail
            ? (materialCost + newLaborCost) *
              (Number(config.handrailExtraIncrement || 0) / 100)
            : 0;
          const mamparaExtraCost = hasMampara
            ? (materialCost + newLaborCost) *
              (Number(config.mamparaExtraIncrement || 0) / 100)
            : 0;
          const finalPrice =
            materialCost + newLaborCost + handrailExtraCost + mamparaExtraCost;
          return {
            ...item,
            calculatedCost: Math.round(finalPrice),
            breakdown: {
              ...item.breakdown,
              laborCost: newLaborCost,
              handrailExtraCost,
              mamparaExtraCost,
            },
          };
        }),
      );
    }
  }, [config.laborPercentage]); // Only when config.laborPercentage changes from
  // settings or elsewhere
  const handleMarginChange = (val: string) => {
    const newMargin = parseFloat(val) || 0;
    setConfig((prev) => ({ ...prev, laborPercentage: newMargin }));
  };
  const removeItem = (id: string) =>
    setItems(items.filter((item) => item.id !== id));
  const updateQuantity = (id: string, qty: number) =>
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, qty) } : item,
      ),
    );
  const consolidatedProfiles = useMemo(() => {
    const summary = new Map<
      string,
      { code: string; detail: string; totalLength: number; totalWeight: number }
    >();
    (items || []).forEach((item) => {
      const validModules = (item?.composition?.modules || []).filter(
        (m) => m && typeof m.x === "number" && typeof m.y === "number",
      );
      if (validModules.length === 0) return;
      const xs = validModules.map((m) => m.x);
      const ys = validModules.map((m) => m.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      validModules.forEach((mod) => {
        const recipe = recipes.find((r) => r.id === mod.recipeId);
        if (!recipe) return;
        const colRatio = item.composition.colRatios[mod.x - minX] || 0;
        const rowRatio = item.composition.rowRatios[mod.y - minY] || 0; // CORRECCIÓN: USAR LAS MEDIDAS REALES DEL MÓDULO PARA EL CONSOLIDADO
        const modW = Number(colRatio);
        const modH = Number(rowRatio);
        const transomTemplate = (recipe.profiles || []).find(
          (rp) =>
            rp.role === "Travesaño" ||
            (rp.role && rp.role.toLowerCase().includes("trave")),
        );
        const recipeTransomFormula =
          transomTemplate?.formula || recipe.transomFormula || "W";
        const recipeTransomQty = transomTemplate?.quantity || 1;
        
        const visualType = (recipe.visualType || "").toLowerCase();
        let numLeaves = recipe.leaves || 1;
        if (!recipe.leaves) {
          if (visualType.includes("sliding_3") || visualType.includes("corrediza_3")) numLeaves = 3;
          else if (visualType.includes("sliding_4") || visualType.includes("corrediza_4")) numLeaves = 4;
          else if (visualType.includes("sliding") || visualType.includes("corrediza")) numLeaves = 2;
          else if (visualType.includes("double") || visualType.includes("doble") || visualType.includes("2h")) numLeaves = 2;
        }

        recipe.profiles.forEach((rp) => {
          const role = rp.role?.toLowerCase() || "";
          if (role.includes("trave")) return;
          const isMosq = role.includes("mosquitero") || rp.profileId === recipe.mosquiteroProfileId;
          if (isMosq && (!item.extras?.mosquitero || item.extras?.mosquiteroRecipeId)) return;
          
          const pDef = aluminum.find((a) => a.id === rp.profileId);
          if (!pDef) return;
          const cutLen = evaluateFormula(rp.formula, modW, modH);
          const totalCutLen =
            (cutLen + config.discWidth) * rp.quantity * item.quantity;
          const weight = (totalCutLen / 1000) * pDef.weightPerMeter;
          const existing = summary.get(pDef.id) || {
            code: pDef.code,
            detail: pDef.detail,
            totalLength: 0,
            totalWeight: 0,
          };
          existing.totalLength += totalCutLen;
          existing.totalWeight += weight;
          summary.set(pDef.id, existing);
        }); 

        // SUMAR MOSQUITERO INDEPENDIENTE
        if (item.extras?.mosquitero && item.extras?.mosquiteroRecipeId) {
          const mosqRecipe = recipes.find(r => r.id === item.extras!.mosquiteroRecipeId);
          if (mosqRecipe) {
            let mosqW = modW;
            if (visualType.includes("sliding") || numLeaves > 1) {
                mosqW = modW / Math.max(1, numLeaves);
            }
            mosqRecipe.profiles.forEach((rp) => {
              const pDef = aluminum.find((a) => a.id === rp.profileId);
              if (!pDef) return;
              const cutLen = evaluateFormula(rp.formula, mosqW, modH);
              const totalCutLen =
                (cutLen + config.discWidth) * rp.quantity * item.quantity;
              const weight = (totalCutLen / 1000) * pDef.weightPerMeter;
              const existing = summary.get(pDef.id) || {
                code: pDef.code,
                detail: pDef.detail,
                totalLength: 0,
                totalWeight: 0,
              };
              existing.totalLength += totalCutLen;
              existing.totalWeight += weight;
              summary.set(pDef.id, existing);
            });
          }
        }
        
        // SUMAR TRAVESAÑOS AL CONSOLIDADO TÉCNICO
        if (mod.transoms && mod.transoms.length > 0) {
          mod.transoms.forEach((t) => {
            const trProf = aluminum.find((p) => p.id === t.profileId);
            if (trProf) {
              const f = t.formula || recipeTransomFormula;
              const cutLen = evaluateFormula(f, modW, modH);
              const totalCutLen =
                (cutLen + config.discWidth) * recipeTransomQty * item.quantity;
              const weight = (totalCutLen / 1000) * trProf.weightPerMeter;
              const existing = summary.get(trProf.id) || {
                code: trProf.code,
                detail: trProf.detail,
                totalLength: 0,
                totalWeight: 0,
              };
              existing.totalLength += totalCutLen;
              existing.totalWeight += weight;
              summary.set(trProf.id, existing);
            }
          });
        }
        // Pre-cálculo de dimensiones de vidrio para Tablillas
        const adjustedW = modW - Number(recipe.glassDeductionW || 0);
        const adjustedH = modH - Number(recipe.glassDeductionH || 0);
        let leafBaseW = adjustedW;
        if (visualType.includes("sliding") || numLeaves > 1) leafBaseW = adjustedW / numLeaves;
        const gW = evaluateFormula(
          mod.dvhCameraId ? (recipe.dvhFormulaW || recipe.glassFormulaW || "W") : (recipe.glassFormulaW || "W"),
          leafBaseW,
          adjustedH
        );

        const isDVH = mod.dvhCameraId !== undefined;
        const transomGlassDeduction =
          isDVH && recipe.dvhTransomGlassDeduction !== undefined
            ? Number(recipe.dvhTransomGlassDeduction)
            : Number(recipe.transomGlassDeduction || 0);

        const panesHeights: number[] = [];
        if (!mod.transoms || mod.transoms.length === 0) {
          const gHForm = mod.dvhCameraId ? (recipe.dvhFormulaH || recipe.glassFormulaH || "H") : (recipe.glassFormulaH || "H");
          panesHeights.push(evaluateFormula(gHForm, adjustedW, adjustedH));
        } else {
          const sorted = [...mod.transoms].sort((a, b) => a.height - b.height);
          let lastY = 0;
          sorted.forEach((t, idx) => {
            const trProf = aluminum.find((p) => p.id === t.profileId);
            const transomThickness = Number(trProf?.thickness || recipe.transomThickness || 40);
            let ph =
              idx === 0
                ? Number(t.height) -
                  transomThickness / 2 -
                  Number(recipe.glassDeductionH || 0) / (mod.transoms.length + 1) -
                  transomGlassDeduction
                : Number(t.height) - lastY - transomThickness - transomGlassDeduction;
            panesHeights.push(ph);
            lastY = Number(t.height);
          });
          const lastTrProf = aluminum.find((p) => p.id === sorted[sorted.length - 1].profileId);
          const lastTransomThickness = Number(lastTrProf?.thickness || recipe.transomThickness || 40);
          panesHeights.push(
            modH -
              lastY -
              (lastTrProf ? lastTransomThickness / 2 : 0) -
              Number(recipe.glassDeductionH || 0) / (mod.transoms.length + 1) -
              transomGlassDeduction
          );
        }

        // Lógica de Tablillas
        if (mod.slatProfileIds) {
          Object.entries(mod.slatProfileIds).forEach(([paneIdxStr, slatId]) => {
            const slatProf = aluminum.find((a) => a.id === slatId);
            const paneIdx = parseInt(paneIdxStr);
            if (slatProf) {
              const slatCoverage = slatProf.thickness > 0 ? slatProf.thickness : 120;
              const paneH = panesHeights[paneIdx] || panesHeights[0];
              
              if (paneH > 0 && slatCoverage > 0) {
                const numSlats = Math.ceil(paneH / slatCoverage);
                const totalCutLen =
                  (gW + config.discWidth) * numSlats * numLeaves * item.quantity;
                const weight = (totalCutLen / 1000) * (slatProf.weightPerMeter || 0);
                const existing = summary.get(slatProf.id) || {
                  code: slatProf.code,
                  detail: slatProf.detail,
                  totalLength: 0,
                  totalWeight: 0,
                };
                existing.totalLength += totalCutLen;
                existing.totalWeight += weight;
                summary.set(slatId as string, existing);
              }
            }
          });
        }
        // Lógica de Paneles Ciegos (ML)
        if (mod.blindPaneIds && mod.blindPanes) {
          mod.blindPanes.forEach((pIdx) => {
            const bpId = mod.blindPaneIds![pIdx];
            if (bpId) {
              const bp = blindPanels.find((x) => x.id === bpId);
              // Ignore if it's already counted as a slat OR not an "ml" panel.
              const slatId = mod.slatProfileIds?.[pIdx];
              if (bp && bp.unit === "ml" && !slatId) {
                const leafW = visualType.includes("sliding") || numLeaves > 1 ? modW / numLeaves : modW;
                const totalCutLen = (leafW + config.discWidth) * numLeaves * item.quantity;
                const weight = (totalCutLen / 1000) * (bp.weightPerMeter || 0);
                const existing = summary.get(bp.id) || {
                  code: bp.code,
                  detail: bp.detail,
                  totalLength: 0,
                  totalWeight: 0,
                };
                existing.totalLength += totalCutLen;
                existing.totalWeight += weight;
                summary.set(bp.id, existing);
              }
            }
          });
        }
        // Lógica de Pasamano (Baranda)
        if (mod.handrailProfileId) {
          const hrProfile = aluminum.find((p) => p.id === mod.handrailProfileId);
          if (hrProfile) {
            const totalCutLen = (modW + config.discWidth) * item.quantity;
            const weight = (totalCutLen / 1000) * (hrProfile.weightPerMeter || 0);
            const existing = summary.get(hrProfile.id) || {
              code: hrProfile.code,
              detail: hrProfile.detail,
              totalLength: 0,
              totalWeight: 0,
            };
            existing.totalLength += totalCutLen;
            existing.totalWeight += weight;
            summary.set(hrProfile.id, existing);
          }
        }
      });
      // Lógica de Tapajuntas
      if (item.extras.tapajuntas && validModules.length > 0) {
        const firstRecipe = recipes.find(
          (r) => r.id === validModules[0].recipeId,
        );
        let tjProfile = aluminum.find(
          (p) => p.id === firstRecipe?.defaultTapajuntasProfileId,
        );
        if (!tjProfile && firstRecipe) {
          const tjRef = firstRecipe.profiles.find((p) => p.role === "Tapajuntas");
          if (tjRef) tjProfile = aluminum.find((p) => p.id === tjRef.profileId);
        }
        if (!tjProfile) {
          tjProfile = aluminum.find(
            (p) =>
              p.code.toUpperCase().includes("TJ") ||
              p.detail.toLowerCase().includes("tapajunta"),
          );
        }
        if (tjProfile) {
          const tjThick = Number(tjProfile.thickness || 30);
          const { top, bottom, left, right } = item.extras.tapajuntasSides;
          let tjLenTotal = 0;
          if (top)
            tjLenTotal += item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
          if (bottom)
            tjLenTotal += item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
          if (left)
            tjLenTotal += item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
          if (right)
            tjLenTotal += item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0);

          const weight = (tjLenTotal / 1000) * (tjProfile.weightPerMeter || 0);
          const existing = summary.get(tjProfile.id) || {
            code: tjProfile.code,
            detail: tjProfile.detail,
            totalLength: 0,
            totalWeight: 0,
          };
          existing.totalLength += tjLenTotal * item.quantity;
          existing.totalWeight += weight * item.quantity;
          summary.set(tjProfile.id, existing);
        }
      }
    });
    return Array.from(summary.values()).sort(
      (a, b) => b.totalWeight - a.totalWeight,
    );
  }, [items, recipes, aluminum, config.discWidth]);
  const finalizeWork = async () => {
    if (items.length === 0) return alert("Cargue al menos una carpintería.");
    if (!clientName.trim()) return alert("Asigne un nombre a la obra.");
    const subtotal = items.reduce(
      (acc, i) => acc + i.calculatedCost * i.quantity,
      0,
    );
    const totalPrice = Math.round(subtotal * (1 + config.taxRate / 100));
    let quoteToSave: Quote;
    if (activeQuote) {
      quoteToSave = {
        ...activeQuote,
        clientName,
        items: [...items],
        totalPrice,
        date: new Date().toISOString(),
      };
      setQuotes(quotes.map((q) => (q.id === activeQuote.id ? quoteToSave : q)));
    } else {
      quoteToSave = {
        id: crypto.randomUUID(),
        clientName,
        date: new Date().toISOString(),
        items: [...items],
        totalPrice,
      };
      setQuotes([quoteToSave, ...quotes]);
    }
    setItems([]);
    setClientName("");
    if (setActiveQuote) setActiveQuote(null);
    if (isSupabaseConfigured) {
      const userRes = await supabase.auth.getUser();
      if (userRes.data.user) {
        const cleanItemsForDb = quoteToSave.items.map((i) => ({
          ...i,
          previewImage: i.previewImage && i.previewImage.length > 50000 
            ? undefined 
            : i.previewImage,
        }));
        
        const payload = {
          id: quoteToSave.id,
          user_id: userRes.data.user.id,
          cliente_nombre: quoteToSave.clientName,
          total: quoteToSave.totalPrice,
          items: cleanItemsForDb,
          created_at: quoteToSave.date,
          estado: "borrador",
        };
        const { error } = await supabase
          .from("presupuestos")
          .upsert(payload, { onConflict: "id" });
        if (error) {
          console.error("Error saving quote to DB", error);
          alert("Error al guardar en la nube: " + error.message);
        }
      }
    }
    alert(`Obra ${activeQuote ? "actualizada" : "guardada"} con éxito.`);
  };
  const subtotal = items.reduce(
    (acc, i) => acc + i.calculatedCost * i.quantity,
    0,
  );
  const tax = Math.round(subtotal * (config.taxRate / 100));
  const total = subtotal + tax;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full animate-in fade-in duration-500">
      <div className="col-span-1 lg:col-span-8 space-y-6">
        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-white shrink-0">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800 ">
                Terminal de Obra Activa
              </h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase">
                {items.length} Carpinterías en Sistema
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setItems([])}
              className="text-[8px] font-black text-slate-400 uppercase hover:text-red-600 transition-colors self-end sm:self-auto"
            >
              VACIAR COLA
            </button>
          )}
        </div>
        <div className="space-y-3">
          {items.map((item, idx) => {
            const moduleNames = item.composition.modules
              .map((m) => recipes.find((r) => r.id === m.recipeId)?.name)
              .filter(Boolean);
            const compositeName =
              moduleNames.length > 1
                ? `${moduleNames.join(" + ")}`
                : moduleNames[0] || "Producto Desconocido";
            return (
              <div
                key={item.id}
                className="bg-white border-b border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 hover:bg-slate-50 transition-all group"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-16 h-12 bg-sky-50 rounded-lg flex flex-col items-center justify-center border border-sky-100 shrink-0">
                    <span className="text-[8px] font-black text-sky-400 uppercase">
                      ABER.
                    </span>
                    <span className="text-[10px] font-black text-sky-600 truncate max-w-full px-1">
                      {item.itemCode || `POS#${idx + 1}`}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">
                      {compositeName}
                    </h3>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">
                        {item.width} x {item.height} mm
                      </span>
                      <span className="text-[9px] font-black text-sky-500 uppercase truncate">
                        {moduleNames.length > 1
                          ? "CONJUNTO"
                          : recipes.find(
                              (r) =>
                                r.id === item.composition.modules[0].recipeId,
                            )?.line || "-"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                  <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-sky-600 font-bold"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-black w-6 text-center ">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-sky-600 font-bold"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right min-w-[80px] sm:min-w-[100px]">
                    <span className="text-[11px] font-black text-slate-900 font-mono">
                      ${(item.calculatedCost * item.quantity).toLocaleString()}
                    </span>
                  </div>
                  {onEditItem && (
                    <button
                      onClick={() => onEditItem(item)}
                      className="text-slate-200 hover:text-sky-500 p-2 ml-2"
                      title="Editar apertura en Panel de Ingeniería"
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-slate-200 hover:text-red-500 p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {items.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
            <div className="bg-slate-900 p-4 px-6 flex justify-between items-center">
              <h3 className="text-[9px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                <Database size={14} className="text-sky-400" /> Consolidado
                Maestro de Materiales (Ingeniería)
              </h3>
              <span className="text-[8px] font-bold text-slate-400">
                BASADO EN RECETAS DE USUARIO
              </span>
            </div>
            <div className="p-2 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="p-3">Perfil</th>
                    <th className="p-3">Descripción Técnica</th>
                    <th className="p-3 text-right">Metros Totales</th>
                    <th className="p-3 text-right">Peso (KG)</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedProfiles.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-3 text-[10px] font-black text-sky-600">
                        {p.code}
                      </td>
                      <td className="p-3 text-[9px] font-bold text-slate-600 uppercase">
                        {p.detail}
                      </td>
                      <td className="p-3 text-[10px] font-mono text-right font-bold">
                        {(p.totalLength / 1000).toFixed(2)} m
                      </td>
                      <td className="p-3 text-[10px] font-mono text-right font-black text-slate-900">
                        {p.totalWeight.toFixed(2)} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-sky-50 p-3 px-6 text-center">
              <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest">
                Peso Total de Aluminio en Obra:
                {consolidatedProfiles
                  .reduce((acc, p) => acc + p.totalWeight, 0)
                  .toFixed(2)}
                KG
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="col-span-1 lg:col-span-4">
        <div className="bg-white border border-slate-200 rounded-[1.5rem] lg:rounded-[2.5rem] p-6 lg:p-8 shadow-sm space-y-6 lg:space-y-8 lg:sticky lg:top-6">
          <h3 className="text-[10px] font-black uppercase text-sky-600 tracking-widest border-b border-slate-50 pb-4 flex items-center gap-2">
            <FileText size={14} /> Cierre de Expediente
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase px-1">
                Nombre / Ref. de Obra
              </label>
              <input
                type="text"
                placeholder="CLIENTE O REFERENCIA..."
                className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-[10px] font-black uppercase outline-none focus:border-sky-500 transition-all shadow-inner"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase px-1">
                Margen de Obra (%)
              </label>
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                <input
                  type="number"
                  min="0"
                  className="w-full bg-transparent p-3.5 text-[11px] font-black uppercase outline-none text-right font-mono"
                  value={
                    config.laborPercentage !== undefined
                      ? config.laborPercentage
                      : ""
                  }
                  onChange={(e) => handleMarginChange(e.target.value)}
                  placeholder="%"
                />
                <div className="bg-slate-100 px-4 flex items-center justify-center border-l border-slate-200 text-[10px] font-black text-slate-400">
                  %
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase">
                Subtotal Neto
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-600">
                ${subtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase">
                IVA ({config.taxRate}%)
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-600">
                ${tax.toLocaleString()}
              </span>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center px-1">
              <span className="text-[11px] font-black text-slate-900 uppercase">
                Total Obra
              </span>
              <span className="text-2xl font-mono font-black text-sky-600 tracking-tighter">
                ${total.toLocaleString()}
              </span>
            </div>
          </div>
          <button
            onClick={finalizeWork}
            disabled={items.length === 0 || !clientName}
            className={`w-full py-5 rounded-2xl uppercase text-[10px] font-black tracking-[0.2em] shadow-lg transition-all active:scale-95 border-b-4 ${items.length > 0 && clientName ? "bg-sky-600 text-white border-sky-800 hover:bg-sky-700" : "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"}`}
          >
            Validar y Guardar Obra
          </button>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <p className="text-[8px] font-bold uppercase text-slate-400 leading-relaxed">
              Al validar, el listado actual se archivará en el historial técnico
              y se liberará la cola de carga.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ObrasModule;
