
import React, { useState, useMemo } from 'react';
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
  Hash
} from 'lucide-react';
import { QuoteItem, Quote, ProductRecipe, GlobalConfig, AluminumProfile } from '../types';
import { evaluateFormula } from '../services/calculator';

interface Props {
  items: QuoteItem[];
  setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
  quotes: Quote[];
  setQuotes: (quotes: Quote[]) => void;
  recipes: ProductRecipe[];
  config: GlobalConfig;
  aluminum: AluminumProfile[];
}

const ObrasModule: React.FC<Props> = ({ items, setItems, quotes, setQuotes, recipes, config, aluminum }) => {
  const [clientName, setClientName] = useState('');
  
  const removeItem = (id: string) => setItems(items.filter(item => item.id !== id));
  const updateQuantity = (id: string, qty: number) => setItems(items.map(item => item.id === id ? { ...item, quantity: Math.max(1, qty) } : item));

  const consolidatedProfiles = useMemo(() => {
    const summary = new Map<string, { code: string, detail: string, totalLength: number, totalWeight: number }>();
    
    (items || []).forEach(item => {
      const validModules = (item?.composition?.modules || []).filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
      if (validModules.length === 0) return;

      const xs = validModules.map(m => m.x);
      const ys = validModules.map(m => m.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);

      validModules.forEach(mod => {
        const recipe = recipes.find(r => r.id === mod.recipeId);
        if (!recipe) return;

        const sumCols = (item.composition.colRatios || []).reduce((a, b) => a + b, 0) || 1;
        const sumRows = (item.composition.rowRatios || []).reduce((a, b) => a + b, 0) || 1;

        const colRatio = item.composition.colRatios[mod.x - minX] || 0;
        const rowRatio = item.composition.rowRatios[mod.y - minY] || 0;

        const modW = (item.width * colRatio) / sumCols;
        const modH = (item.height * rowRatio) / sumRows;

        recipe.profiles.forEach(rp => {
            const pDef = aluminum.find(a => a.id === rp.profileId);
            if (!pDef) return;

            const cutLen = evaluateFormula(rp.formula, modW, modH);
            const totalCutLen = (cutLen + config.discWidth) * rp.quantity * item.quantity;
            const weight = (totalCutLen / 1000) * pDef.weightPerMeter;

            const existing = summary.get(pDef.id) || { code: pDef.code, detail: pDef.detail, totalLength: 0, totalWeight: 0 };
            existing.totalLength += totalCutLen;
            existing.totalWeight += weight;
            summary.set(pDef.id, existing);
        });
      });
    });

    return Array.from(summary.values()).sort((a, b) => b.totalWeight - a.totalWeight);
  }, [items, recipes, aluminum, config.discWidth]);

  const finalizeWork = () => {
    if (items.length === 0) return alert("Cargue al menos una carpintería.");
    if (!clientName.trim()) return alert("Asigne un nombre a la obra.");
    const subtotal = items.reduce((acc, i) => acc + (i.calculatedCost * i.quantity), 0);
    const totalPrice = Math.round(subtotal * (1 + config.taxRate / 100));
    const newQuote: Quote = { id: Date.now().toString(36).toUpperCase(), clientName, date: new Date().toISOString(), items: [...items], totalPrice };
    setQuotes([newQuote, ...quotes]); setItems([]); setClientName('');
    alert("Obra guardada con éxito.");
  };

  const subtotal = items.reduce((acc, i) => acc + (i.calculatedCost * i.quantity), 0);
  const tax = Math.round(subtotal * (config.taxRate / 100));
  const total = subtotal + tax;

  return (
    <div className="grid grid-cols-12 gap-6 h-full animate-in fade-in duration-500">
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Briefcase size={20} /></div>
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Terminal de Obra Activa</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{items.length} Carpinterías en Sistema</p>
                </div>
            </div>
            {items.length > 0 && <button onClick={() => setItems([])} className="text-[8px] font-black text-slate-400 uppercase hover:text-red-600 transition-colors">VACIAR COLA</button>}
        </div>

        <div className="space-y-3">
            {items.map((item, idx) => {
              const mainRecipe = recipes.find(r => r.id === item?.composition?.modules?.[0]?.recipeId);
              return (
                <div key={item.id} className="bg-white border-b border-slate-100 p-4 flex items-center gap-6 hover:bg-slate-50 transition-all group">
                  <div className="w-16 h-12 bg-indigo-50 rounded-lg flex flex-col items-center justify-center border border-indigo-100">
                    <span className="text-[8px] font-black text-indigo-400 uppercase">ABER.</span>
                    <span className="text-[10px] font-black text-indigo-600 truncate max-w-full px-1">{item.itemCode || `POS#${idx+1}`}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{mainRecipe?.name || 'Producto Desconocido'}</h3>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[9px] font-mono text-slate-500">{item.width} x {item.height} mm</span>
                      <span className="text-[9px] font-black text-indigo-500 uppercase">{mainRecipe?.line || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 text-slate-400 hover:text-indigo-600 font-bold">-</button>
                      <span className="text-[10px] font-black w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 text-slate-400 hover:text-indigo-600 font-bold">+</button>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <span className="text-[11px] font-black text-slate-900 font-mono">${(item.calculatedCost * item.quantity).toLocaleString()}</span>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-slate-200 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
        </div>

        {items.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
                <div className="bg-slate-900 p-4 px-6 flex justify-between items-center">
                    <h3 className="text-[9px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3"><Database size={14} className="text-indigo-400"/> Consolidado Maestro de Materiales (Ingeniería)</h3>
                    <span className="text-[8px] font-bold text-slate-400">BASADO EN RECETAS DE USUARIO</span>
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
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-[10px] font-black text-indigo-600">{p.code}</td>
                                    <td className="p-3 text-[9px] font-bold text-slate-600 uppercase">{p.detail}</td>
                                    <td className="p-3 text-[10px] font-mono text-right font-bold">{(p.totalLength / 1000).toFixed(2)} m</td>
                                    <td className="p-3 text-[10px] font-mono text-right font-black text-slate-900">{p.totalWeight.toFixed(2)} kg</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-indigo-50 p-3 px-6 text-center">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Peso Total de Aluminio en Obra: {consolidatedProfiles.reduce((acc, p) => acc + p.totalWeight, 0).toFixed(2)} KG</span>
                </div>
            </div>
        )}
      </div>

      <div className="col-span-12 lg:col-span-4">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-8 sticky top-6">
            <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest border-b border-slate-50 pb-4 flex items-center gap-2"><FileText size={14}/> Cierre de Expediente</h3>
            
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase px-1">Nombre / Ref. de Obra</label>
                    <input 
                      type="text" 
                      placeholder="CLIENTE O REFERENCIA..." 
                      className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-[10px] font-black uppercase outline-none focus:border-indigo-500 transition-all shadow-inner"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Subtotal Neto</span>
                    <span className="text-[11px] font-mono font-bold text-slate-600">${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">IVA ({config.taxRate}%)</span>
                    <span className="text-[11px] font-mono font-bold text-slate-600">${tax.toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center px-1">
                    <span className="text-[11px] font-black text-slate-900 uppercase">Total Obra</span>
                    <span className="text-2xl font-mono font-black text-indigo-600 tracking-tighter">${total.toLocaleString()}</span>
                </div>
            </div>

            <button 
                onClick={finalizeWork} 
                disabled={items.length === 0 || !clientName}
                className={`w-full py-5 rounded-2xl uppercase text-[10px] font-black tracking-[0.2em] shadow-lg transition-all active:scale-95 border-b-4 ${
                items.length > 0 && clientName
                ? 'bg-indigo-600 text-white border-indigo-800 hover:bg-indigo-700' 
                : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                }`}
            >
                Validar y Guardar Obra
            </button>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0" />
                <p className="text-[8px] font-bold uppercase text-slate-400 leading-relaxed">Al validar, el listado actual se archivará en el historial técnico y se liberará la cola de carga.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ObrasModule;
