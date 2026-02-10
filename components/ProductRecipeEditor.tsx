
import { 
  Plus, Trash2, Lock, Unlock, Shapes, Ruler, Box, Wind, 
  Search, Download, Upload, FileText, Ruler as RulerIcon,
  ChevronDown, Save, AlertTriangle, Check, Link2, Split
} from 'lucide-react';
import { 
  ProductRecipe, AluminumProfile, Accessory, RecipeProfile, 
  RecipeAccessory, CustomVisualType, Glass,
  Treatment, DVHInput, GlobalConfig
} from '../types';
import { generateRecipeTechnicalPDF } from '../services/pdfGenerator';
import React, { useState, useMemo, useRef, useEffect } from 'react';

interface Props {
  recipes: ProductRecipe[];
  setRecipes: (recipes: ProductRecipe[]) => void;
  aluminum: AluminumProfile[];
  accessories: Accessory[];
  customVisualTypes: CustomVisualType[];
  setCustomVisualTypes: (data: CustomVisualType[]) => void;
  glasses: Glass[];
  treatments: Treatment[];
  dvhInputs: DVHInput[];
  config: GlobalConfig;
}

const DEFAULT_VISUAL_TYPES: CustomVisualType[] = [
  { id: 'banderola', label: 'BANDEROLA', description: 'Abre arriba (interior). Marco + Hoja.' },
  { id: 'ventiluz', label: 'VENTILUZ', description: 'Abre abajo (exterior). Marco + Hoja.' },
  { id: 'tilt_turn', label: 'OSCILOBATIENTE', description: 'Doble apertura. Marco + Hoja.' },
  { id: 'swing_door', label: 'PUERTA DE REBATIR', description: 'Hojas 45°/90°. Sin umbral. Perfil ancho.' },
  { id: 'swing_v', label: 'V. DE REBATIR', description: 'Ventana de abrir tradicional.' },
  { id: 'projecting', label: 'DESPLAZABLE', description: 'Apertura proyectante exterior.' },
  { id: 'fixed', label: 'PAÑO FIJO', description: 'Marco perimetral fijo.' },
  { id: 'mosquitero', label: 'MOSQUITERO', description: 'Sistema de tela mosquitera.' },
  { id: 'mampara_fija', label: 'MAMPARA FIJA', description: 'Perfil en L (izquierda y abajo).' },
  { id: 'mampara_rebatir', label: 'MAMPARA REBATIR', description: 'Perfil vertical lateral únicamente.' },
  { id: 'vidrio_solo', label: 'VIDRIOS', description: 'Sin perfiles perimetrales (vidrio puro).' },
  { id: 'puerta_zocalon', label: 'PUERTA ZOCALON', description: 'Zócalos altos arriba/abajo + Lateral vertical.' },
  { id: 'pf_zocalon', label: 'PAÑO FIJO ZOCALON', description: 'Zócalos altos arriba y abajo.' },
  { id: 'sliding_2_45', label: 'V.CORREDIZA 2H 45°', description: '2 hojas corte 45°.' },
  { id: 'sliding_3_45', label: 'V.CORREDIZA 3H 45°', description: '3 hojas corte 45°.' },
  { id: 'sliding_4_45', label: 'V.CORREDIZA 4H 45°', description: '4 hojas corte 45°.' },
  { id: 'sliding_2_90_low', label: 'V.CORREDIZA 2H 90° zocalo bajo', description: '2 hojas 90° zócalo bajo.' },
  { id: 'sliding_2_90_high', label: 'V.CORREDIZA 2H 90° zocalo alto', description: '2 hojas 90° zócalo alto.' },
  { id: 'sliding_3_90_low', label: 'V.CORREDIZA 3H 90° zocalo bajo', description: '3 hojas 90° zócalo bajo.' },
  { id: 'sliding_3_90_high', label: 'V.CORREDIZA 3H 90° zocalo alto', description: '3 hojas 90° zócalo alto.' },
  { id: 'sliding_4_90_low', label: 'V.CORREDIZA 4H 90° zocalo bajo', description: '4 hojas 90° zócalo bajo.' },
  { id: 'sliding_4_90_high', label: 'V.CORREDIZA 4H 90° zocalo alto', description: '4 hojas 90° zócalo alto.' },
  { id: 'sliding_2_45_90_low', label: 'V.CORREDIZA 2H (M45/H90) Z.BAJO', description: 'Marco a 45°, Hojas a 90°. Zócalo bajo.' },
  { id: 'sliding_2_45_90_high', label: 'V.CORREDIZA 2H (M45/H90) Z.ALTO', description: 'Marco a 45°, Hojas a 90°. Zócalo alto.' },
  { id: 'sliding_3_45_90_low', label: 'V.CORREDIZA 3H (M45/H90) Z.BAJO', description: 'Marco a 45°, Hojas a 90°. Zócalo bajo.' },
  { id: 'sliding_3_45_90_high', label: 'V.CORREDIZA 3H (M45/H90) Z.ALTO', description: 'Marco a 45°, Hojas a 90°. Zócalo alto.' },
  { id: 'sliding_4_45_90_low', label: 'V.CORREDIZA 4H (M45/H90) Z.BAJO', description: 'Marco a 45°, Hojas a 90°. Zócalo bajo.' },
  { id: 'sliding_4_45_90_high', label: 'V.CORREDIZA 4H (M45/H90) Z.ALTO', description: 'Marco a 45°, Hojas a 90°. Zócalo alto.' },
];

const ProductRecipeEditor: React.FC<Props> = ({ recipes, setRecipes, aluminum, accessories, config }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  
  const addNewRecipe = () => {
    const newRecipe: ProductRecipe = { 
      id: Date.now().toString(), 
      name: 'NUEVA CARPINTERÍA', 
      line: 'LÍNEA BASE', 
      type: 'Ventana', 
      visualType: 'sliding_2_45', 
      profiles: [], 
      accessories: [], 
      glassFormulaW: 'W - 50', 
      glassFormulaH: 'H - 50',
      isLocked: false
    };
    setRecipes([...recipes, newRecipe]); 
    setEditingId(newRecipe.id);
  };

  const updateRecipe = (id: string, data: Partial<ProductRecipe>) => setRecipes(recipes.map(r => r.id === id ? { ...r, ...data } : r));
  
  const handleSelectRecipe = (id: string) => {
    const recipe = recipes.find(r => r.id === id);
    if (recipe) {
      setShowWarning(true);
      setEditingId(id);
    }
  };

  const handleSaveManual = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 2000);
  };

  const recipe = recipes.find(r => r.id === editingId);

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
    r.line.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleExportRecipes = () => {
    const dataStr = JSON.stringify(recipes, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `Libreria_Arista_${new Date().toISOString().split('T')[0]}.json`);
    linkElement.click();
  };

  const handleImportRecipes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const imported = JSON.parse(evt.target?.result as string) as ProductRecipe[];
            if (Array.isArray(imported)) { setRecipes([...recipes, ...imported]); }
        } catch (err) { alert("Error al importar librería."); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-full gap-6 animate-in fade-in duration-500">
      {showWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border-2 border-amber-100 dark:border-amber-900/30 text-center space-y-6">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-500 mx-auto shadow-lg">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tighter">Precaución de Ingeniería</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Vas a acceder a un sistema con fórmulas de cálculo validadas. <br/>
                <span className="font-black text-amber-600">Cualquier cambio accidental en las variables afectará la producción y costos.</span>
              </p>
            </div>
            <button 
              onClick={() => setShowWarning(false)}
              className="w-full bg-slate-900 dark:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all"
            >
              Entendido, Acceder a Edición
            </button>
          </div>
        </div>
      )}

      <div className="w-80 flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-5 shadow-sm flex flex-col h-[85vh] transition-colors">
            <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Shapes size={20} /></div>
                <div>
                    <h3 className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-widest">Sistemas Maestros</h3>
                </div>
            </div>
            <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 pl-9 pr-3 py-2.5 rounded-xl text-[10px] font-bold uppercase dark:text-white outline-none focus:border-indigo-500 shadow-inner" placeholder="Filtrar..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 mt-4">
                {filteredRecipes.map(r => (
                    <button key={r.id} onClick={() => handleSelectRecipe(r.id)} className={`w-full text-left p-4 rounded-2xl border transition-all ${editingId === r.id ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white dark:bg-slate-800/50 border-slate-50 dark:border-slate-800 hover:border-indigo-200 text-slate-600'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${editingId === r.id ? 'text-indigo-200' : 'text-indigo-600'}`}>{r.line}</span>
                        </div>
                        <span className="text-[11px] font-black uppercase truncate block">{r.name}</span>
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={handleExportRecipes} className="flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[8px] font-black uppercase hover:bg-slate-100 border border-slate-200"><Download size={12} /> Exportar</button>
                <button onClick={() => importFileRef.current?.click()} className="flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[8px] font-black uppercase hover:bg-slate-100 border border-slate-200"><Upload size={12} /> Importar</button>
                <input type="file" ref={importFileRef} onChange={handleImportRecipes} className="hidden" accept=".json" />
            </div>
            <button onClick={addNewRecipe} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all mt-2"><Plus size={14} /> Nueva Ingeniería</button>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {recipe ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm h-[85vh] overflow-y-auto custom-scrollbar space-y-8 border-t-8 border-t-indigo-600 transition-colors">
            <div className="flex justify-between items-start gap-6">
                <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <input 
                          className={`text-2xl font-black uppercase tracking-tighter transition-colors text-slate-800 dark:text-white focus:outline-none bg-transparent w-full`} 
                          value={recipe.name} 
                          onChange={e => updateRecipe(recipe.id, { name: e.target.value.toUpperCase() })} 
                        />
                      </div>
                      <button 
                        onClick={handleSaveManual} 
                        className={`shrink-0 px-6 py-4 rounded-2xl transition-all border shadow-lg flex items-center gap-3 font-black text-[10px] uppercase tracking-widest active:scale-95 ${isSaving ? 'bg-green-600 text-white border-green-700' : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500'}`}
                      >
                        {isSaving ? <Check size={18} /> : <Save size={18} />}
                        {isSaving ? 'GUARDADO' : 'GUARDAR CAMBIOS'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center">
                        <select className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-indigo-600 outline-none" value={recipe.type} onChange={e => updateRecipe(recipe.id, { type: e.target.value as any })}>
                            {['Ventana', 'Puerta', 'Mampara', 'Paño Fijo'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <select className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none" value={recipe.visualType} onChange={e => updateRecipe(recipe.id, { visualType: e.target.value })}>
                            {DEFAULT_VISUAL_TYPES.map(vt => <option key={vt.id} value={vt.id}>{vt.label}</option>)}
                        </select>
                        <div className={`flex items-center gap-2 px-3 py-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/50`}>
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Línea:</span>
                          <input className="bg-transparent border-none text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 outline-none w-24" value={recipe.line} onChange={e => updateRecipe(recipe.id, { line: e.target.value.toUpperCase() })} />
                        </div>
                    </div>
                </div>
                <button onClick={() => { if(confirm('¿Eliminar sistema?')) { setRecipes(recipes.filter(r => r.id !== recipe.id)); setEditingId(null); } }} className="shrink-0 p-4 bg-slate-50 dark:bg-slate-800 text-slate-300 rounded-2xl hover:text-red-500 border border-slate-100 dark:border-slate-700 transition-colors"><Trash2 size={20} /></button>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><Ruler size={14} className="text-indigo-600"/> Despiece de Perfiles Estructurales</h4>
                    <button onClick={() => updateRecipe(recipe.id, { profiles: [...recipe.profiles, { profileId: aluminum[0]?.id || '', quantity: 1, formula: 'W', cutStart: '45', cutEnd: '45', role: 'Marco' }] })} className="text-[8px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">+ Insertar</button>
                </div>
                <div className="space-y-1.5">
                    {recipe.profiles.map((rp, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50/50 dark:bg-slate-800/30 p-2 rounded-xl border border-slate-100 dark:border-slate-700 group transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-100">
                            <div className="col-span-2">
                                <select className="w-full bg-transparent text-[9px] font-black uppercase outline-none dark:text-white" value={rp.role || 'Marco'} onChange={e => { const updated = [...recipe.profiles]; updated[idx].role = e.target.value as any; updateRecipe(recipe.id, { profiles: updated }); }}>
                                    {['Marco', 'Hoja', 'Zócalo', 'Travesaño', 'Encuentro', 'Acople', 'Tapajuntas', 'Mosquitero', 'Otro'].map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <select className="w-full bg-transparent text-[10px] font-black uppercase outline-none dark:text-white" value={rp.profileId} onChange={e => { const updated = [...recipe.profiles]; updated[idx].profileId = e.target.value; updateRecipe(recipe.id, { profiles: updated }); }}>{aluminum.map(a => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
                            </div>
                            <div className="col-span-1">
                                <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded text-center font-black text-[10px] dark:text-white" value={rp.quantity} onChange={e => { const updated = [...recipe.profiles]; updated[idx].quantity = parseInt(e.target.value) || 0; updateRecipe(recipe.id, { profiles: updated }); }} />
                            </div>
                            <div className="col-span-2">
                                <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1.5 rounded font-mono text-[10px] font-black text-indigo-600 dark:text-indigo-400" value={rp.formula} onChange={e => { const updated = [...recipe.profiles]; updated[idx].formula = e.target.value; updateRecipe(recipe.id, { profiles: updated }); }} />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <div className="flex gap-0.5 bg-slate-200/50 dark:bg-slate-700/50 p-0.5 rounded-md">
                                    {['45', '90'].map(deg => (
                                        <button key={deg} onClick={() => { const updated = [...recipe.profiles]; updated[idx].cutStart = deg as any; updateRecipe(recipe.id, { profiles: updated }); }} className={`flex-1 py-1 text-[8px] font-black rounded ${rp.cutStart === deg ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>{deg}°</button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <div className="flex gap-0.5 bg-slate-200/50 dark:bg-slate-700/50 p-0.5 rounded-md">
                                    {['45', '90'].map(deg => (
                                        <button key={deg} onClick={() => { const updated = [...recipe.profiles]; updated[idx].cutEnd = deg as any; updateRecipe(recipe.id, { profiles: updated }); }} className={`flex-1 py-1 text-[8px] font-black rounded ${rp.cutEnd === deg ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>{deg}°</button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-1 text-right">
                                <button onClick={() => updateRecipe(recipe.id, { profiles: recipe.profiles.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                            <Wind size={16} className="text-indigo-600" />
                            <h5 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Insumos y Accesorios</h5>
                        </div>
                        <button onClick={() => updateRecipe(recipe.id, { accessories: [...recipe.accessories, { accessoryId: accessories[0]?.id || '', quantity: 1, isLinear: false, formula: 'W' }] })} className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Añadir</button>
                    </div>
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {recipe.accessories.map((ra, idx) => (
                            <div key={idx} className="bg-slate-50/50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2 group transition-all hover:bg-white dark:hover:bg-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-8 px-2 pr-6 rounded text-[9px] font-black uppercase outline-none appearance-none dark:text-white" value={ra.accessoryId} onChange={e => { const updated = [...recipe.accessories]; updated[idx].accessoryId = e.target.value; updateRecipe(recipe.id, { accessories: updated }); }}>
                                            {accessories.map(a => <option key={a.id} value={a.id}>{a.code} - {a.detail}</option>)}
                                        </select>
                                        <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400" />
                                    </div>
                                    <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg h-8 items-center min-w-[60px]">
                                        <button onClick={() => { const updated = [...recipe.accessories]; updated[idx].isLinear = false; updateRecipe(recipe.id, { accessories: updated }); }} className={`flex-1 h-full text-[8px] font-black rounded transition-all ${!ra.isLinear ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-400'}`}>U</button>
                                        <button onClick={() => { const updated = [...recipe.accessories]; updated[idx].isLinear = true; updateRecipe(recipe.id, { accessories: updated }); }} className={`flex-1 h-full text-[8px] font-black rounded transition-all ${ra.isLinear ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>ML</button>
                                    </div>
                                    <button onClick={() => updateRecipe(recipe.id, { accessories: recipe.accessories.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input type="number" className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-7 rounded text-center font-black text-[10px] dark:text-white" value={ra.quantity} onChange={e => { const updated = [...recipe.accessories]; updated[idx].quantity = parseFloat(e.target.value) || 0; updateRecipe(recipe.id, { accessories: updated }); }} />
                                    <span className="text-[8px] font-black text-slate-400 uppercase">{ra.isLinear ? 'ML' : 'UNID'}</span>
                                    {ra.isLinear && (
                                        <input className="flex-1 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 h-7 px-2 rounded font-mono text-[9px] font-black text-indigo-600 dark:text-indigo-400 outline-none" placeholder="Fórmula (W/H)" value={ra.formula} onChange={e => { const updated = [...recipe.accessories]; updated[idx].formula = e.target.value; updateRecipe(recipe.id, { accessories: updated }); }} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">Vidriado Maestro</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <FormulaInput label="Ancho Cristal" value={recipe.glassFormulaW} onChange={v => updateRecipe(recipe.id, { glassFormulaW: v })} />
                        <FormulaInput label="Alto Cristal" value={recipe.glassFormulaH} onChange={v => updateRecipe(recipe.id, { glassFormulaH: v })} />
                        <div className="space-y-1 flex-1">
                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter ml-1">Desc. Vidrio (Travesaño)</label>
                            <input 
                              type="number" 
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg font-mono text-[9px] font-black text-indigo-600 dark:text-indigo-400 outline-none" 
                              value={recipe.transomGlassDeduction || 0} 
                              onChange={e => updateRecipe(recipe.id, { transomGlassDeduction: parseFloat(e.target.value) || 0 })} 
                            />
                        </div>
                    </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="h-[85vh] flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-300 space-y-4 transition-colors">
            <Shapes size={60} className="opacity-10" />
            <p className="text-[9px] font-black uppercase tracking-widest">Seleccione un sistema de ingeniería</p>
          </div>
        )}
      </div>
    </div>
  );
};

const FormulaInput: React.FC<{ label: string; value?: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div className="space-y-1 flex-1">
        <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter ml-1">{label}</label>
        <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg font-mono text-[9px] font-black text-indigo-600 dark:text-indigo-400 outline-none" value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
);

export default ProductRecipeEditor;
