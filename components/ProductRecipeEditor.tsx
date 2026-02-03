
import React, { useState, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Lock, Unlock, Shapes, Maximize, Split, 
  Scissors, Wind, ArrowRightLeft, Link, Bug, Search, 
  Ruler, Box, Info, LayoutGrid, ChevronRight, Settings2,
  Download, Upload, Share2, FileText, Ruler as RulerIcon
} from 'lucide-react';
import { 
  ProductRecipe, AluminumProfile, Accessory, RecipeProfile, 
  RecipeAccessory, CustomVisualType, Glass,
  Treatment, DVHInput, GlobalConfig
} from '../types';
import { generateRecipeTechnicalPDF } from '../services/pdfGenerator';

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
  // Sistemas de Proyección y Rebatir
  { id: 'banderola', label: 'BANDEROLA', description: 'Abre arriba (interior). Marco + Hoja.' },
  { id: 'ventiluz', label: 'VENTILUZ', description: 'Abre abajo (exterior). Marco + Hoja.' },
  { id: 'tilt_turn', label: 'OSCILOBATIENTE', description: 'Doble apertura. Marco + Hoja.' },
  { id: 'swing_door', label: 'PUERTA DE REBATIR', description: 'Hojas 45°/90°. Sin umbral. Perfil ancho.' },
  { id: 'swing_v', label: 'V. DE REBATIR', description: 'Ventana de abrir tradicional.' },
  { id: 'projecting', label: 'DESPLAZABLE', description: 'Apertura proyectante exterior.' },
  { id: 'fixed', label: 'PAÑO FIJO', description: 'Marco perimetral fijo.' },
  { id: 'mosquitero', label: 'MOSQUITERO', description: 'Sistema de tela mosquitera.' },
  
  // Corredizas 45°
  { id: 'sliding_2_45', label: 'V.CORREDIZA 2H 45°', description: '2 hojas corte 45°.' },
  { id: 'sliding_3_45', label: 'V.CORREDIZA 3H 45°', description: '3 hojas corte 45°.' },
  { id: 'sliding_4_45', label: 'V.CORREDIZA 4H 45°', description: '4 hojas corte 45°.' },
  
  // Corredizas 90° - Integrales
  { id: 'sliding_2_90_low', label: 'V.CORREDIZA 2H 90° zocalo bajo', description: '2 hojas 90° zócalo bajo.' },
  { id: 'sliding_2_90_high', label: 'V.CORREDIZA 2H 90° zocalo alto', description: '2 hojas 90° zócalo alto.' },
  { id: 'sliding_3_90_low', label: 'V.CORREDIZA 3H 90° zocalo bajo', description: '3 hojas 90° zócalo bajo.' },
  { id: 'sliding_3_90_high', label: 'V.CORREDIZA 3H 90° zocalo alto', description: '3 hojas 90° zócalo alto.' },
  { id: 'sliding_4_90_low', label: 'V.CORREDIZA 4H 90° zocalo bajo', description: '4 hojas 90° zócalo bajo.' },
  { id: 'sliding_4_90_high', label: 'V.CORREDIZA 4H 90° zocalo alto', description: '4 hojas 90° zócalo alto.' },

  // NUEVAS: Corredizas Híbridas (Marco 45 / Hoja 90)
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
      defaultMosquitero: false,
      mosquiteroFormulaW: 'W / 2',
      mosquiteroFormulaH: 'H - 45'
    };
    setRecipes([...recipes, newRecipe]); setEditingId(newRecipe.id);
  };

  const updateRecipe = (id: string, data: Partial<ProductRecipe>) => setRecipes(recipes.map(r => r.id === id ? { ...r, ...data } : r));
  const recipe = recipes.find(r => r.id === editingId);

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
    r.line.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleExportRecipes = () => {
    const dataStr = JSON.stringify(recipes, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `Libreria_Sistemas_Arista_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportRecipes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const imported = JSON.parse(evt.target?.result as string) as ProductRecipe[];
            if (Array.isArray(imported)) {
                const existingKeys = new Set(recipes.map(r => `${r.line}-${r.name}`));
                const newRecipes = imported.filter(r => !existingKeys.has(`${r.line}-${r.name}`));
                if (newRecipes.length === 0) {
                    alert("No se encontraron sistemas nuevos para importar.");
                    return;
                }
                setRecipes([...recipes, ...newRecipes]);
                alert(`Se han importado ${newRecipes.length} sistemas con éxito.`);
            }
        } catch (err) {
            alert("Error al procesar el archivo de librería.");
        }
    };
    reader.readAsText(file);
  };

  const handleDownloadFicha = () => {
    if (!recipe) return;
    generateRecipeTechnicalPDF(recipe, aluminum, accessories, config);
  };

  return (
    <div className="flex h-full gap-6 animate-in fade-in duration-500">
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-5 shadow-sm flex flex-col h-[85vh] transition-colors">
            <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Shapes size={20} /></div>
                <div>
                    <h3 className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-widest">Maestro de Sistemas</h3>
                    <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Ingeniería Activa</p>
                </div>
            </div>

            <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 pl-9 pr-3 py-2.5 rounded-xl text-[10px] font-bold uppercase dark:text-white outline-none focus:border-indigo-500 transition-all shadow-inner" 
                    placeholder="Filtrar sistemas..." 
                    value={searchFilter} 
                    onChange={e => setSearchFilter(e.target.value)} 
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 mt-4">
                {filteredRecipes.map(r => (
                    <button 
                        key={r.id} 
                        onClick={() => setEditingId(r.id)} 
                        className={`w-full text-left p-4 rounded-2xl border transition-all group flex flex-col gap-1 ${editingId === r.id ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-100' : 'bg-white dark:bg-slate-800/50 border-slate-50 dark:border-slate-800 hover:border-indigo-200 text-slate-600 dark:text-slate-400'}`}
                    >
                        <span className={`text-[8px] font-black uppercase tracking-widest ${editingId === r.id ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'}`}>{r.line}</span>
                        <span className="text-[11px] font-black uppercase truncate">{r.name}</span>
                        <div className="flex justify-between items-center mt-1">
                            <span className={`text-[7px] font-bold uppercase ${editingId === r.id ? 'text-white/60' : 'text-slate-400'}`}>{r.type}</span>
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${editingId === r.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>{r.profiles.length} PERFILES</span>
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                    onClick={handleExportRecipes}
                    className="flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                >
                    <Download size={12} /> Exportar
                </button>
                <button 
                    onClick={() => importFileRef.current?.click()}
                    className="flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                >
                    <Upload size={12} /> Importar
                </button>
                <input type="file" ref={importFileRef} onChange={handleImportRecipes} className="hidden" accept=".json" />
            </div>

            <button onClick={addNewRecipe} className="w-full bg-slate-900 dark:bg-slate-800 text-white font-black py-4 rounded-xl text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-xl active:scale-95 mt-2">
                <Plus size={14} /> Nueva Ingeniería
            </button>
        </div>
      </div>

      <div className="flex-1">
        {recipe ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10 shadow-sm h-[85vh] overflow-y-auto custom-scrollbar space-y-10 border-t-8 border-t-indigo-600 transition-colors">
            <div className="flex justify-between items-start gap-10">
                <div className="flex-1 space-y-4">
                    <input 
                        className="text-3xl font-black uppercase tracking-tighter text-slate-800 dark:text-white focus:outline-none focus:text-indigo-600 bg-transparent w-full border-none p-0" 
                        value={recipe.name} 
                        onChange={e => updateRecipe(recipe.id, { name: e.target.value.toUpperCase() })} 
                    />
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Tipología Base</label>
                            <select className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 outline-none" value={recipe.type} onChange={e => updateRecipe(recipe.id, { type: e.target.value as any })}>
                                <option value="Ventana">Ventana</option>
                                <option value="Puerta">Puerta</option>
                                <option value="Mampara">Mampara</option>
                                <option value="Paño Fijo">Paño Fijo</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Sistema de Apertura</label>
                            <select className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 outline-none max-w-xs" value={recipe.visualType} onChange={e => updateRecipe(recipe.id, { visualType: e.target.value })}>
                                {DEFAULT_VISUAL_TYPES.map(vt => <option key={vt.id} value={vt.id}>{vt.label}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Línea Técnica</label>
                            <input className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 w-32 outline-none shadow-inner" value={recipe.line} onChange={e => updateRecipe(recipe.id, { line: e.target.value.toUpperCase() })} />
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 pt-4">
                    <button onClick={handleDownloadFicha} title="Descargar Ficha Técnica PDF" className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm flex flex-col items-center gap-1 group">
                        <FileText size={20} />
                        <span className="text-[7px] font-black uppercase">Ficha PDF</span>
                    </button>
                    <button onClick={() => updateRecipe(recipe.id, { isLocked: !recipe.isLocked })} className={`p-4 rounded-xl transition-all border ${recipe.isLocked ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700 hover:border-slate-300'}`}>
                        {recipe.isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                    </button>
                    <button onClick={() => { if(confirm('¿Eliminar sistema de ingeniería?')) { setRecipes(recipes.filter(r => r.id !== recipe.id)); setEditingId(null); } }} className="p-4 bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 border border-slate-100 dark:border-slate-700 rounded-xl hover:text-red-500 hover:border-red-100 transition-all shadow-sm">
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <GlobalCompCard title="Mosquitero" icon={<Bug size={14}/>} color="emerald" profileId={recipe.mosquiteroProfileId} profiles={aluminum} onSelect={id => updateRecipe(recipe.id, { mosquiteroProfileId: id })} 
                    footer={<div className="flex gap-2"><FormulaInput label="W" value={recipe.mosquiteroFormulaW} onChange={v => updateRecipe(recipe.id, { mosquiteroFormulaW: v })}/><FormulaInput label="H" value={recipe.mosquiteroFormulaH} onChange={v => updateRecipe(recipe.id, { mosquiteroFormulaH: v })}/></div>}/>
                <GlobalCompCard title="Tapajuntas" icon={<Scissors size={14}/>} color="sky" profileId={recipe.defaultTapajuntasProfileId} profiles={aluminum} onSelect={id => updateRecipe(recipe.id, { defaultTapajuntasProfileId: id })} />
                <GlobalCompCard title="Travesaño" icon={<Split size={14} className="rotate-90"/>} color="indigo" profileId={recipe.defaultTransomProfileId} profiles={aluminum} onSelect={id => updateRecipe(recipe.id, { defaultTransomProfileId: id })} 
                    footer={
                      <div className="space-y-2 mt-2 pt-2 border-t border-indigo-100/30">
                        <div className="flex gap-2">
                           <FormulaInput label="Espesor (mm)" value={recipe.transomThickness?.toString()} onChange={v => updateRecipe(recipe.id, { transomThickness: parseFloat(v) || 0 })}/>
                           <FormulaInput label="Desc. Vidrio" value={recipe.transomGlassDeduction?.toString()} onChange={v => updateRecipe(recipe.id, { transomGlassDeduction: parseFloat(v) || 0 })}/>
                        </div>
                      </div>
                    }/>
                <GlobalCompCard title="Acoples" icon={<Link size={14}/>} color="slate" profileId={recipe.defaultCouplingProfileId} profiles={aluminum} onSelect={id => updateRecipe(recipe.id, { defaultCouplingProfileId: id })} 
                    footer={<FormulaInput label="DEDUCCIÓN" value={recipe.defaultCouplingDeduction?.toString()} onChange={v => updateRecipe(recipe.id, { defaultCouplingDeduction: parseFloat(v) || 0 })}/>}/>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-3">
                    <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.2em] flex items-center gap-2"><Ruler size={16} className="text-indigo-600"/> Ingeniería de Despiece y Cortes</h4>
                    <button onClick={() => updateRecipe(recipe.id, { profiles: [...recipe.profiles, { profileId: aluminum[0]?.id || '', quantity: 1, formula: 'W', cutStart: '45', cutEnd: '45' }] })} className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all border border-indigo-100 dark:border-indigo-800 shadow-sm flex items-center gap-2">
                        <Plus size={14} /> Insertar Perfil
                    </button>
                </div>
                <div className="space-y-2">
                    {recipe.profiles.map((rp, idx) => {
                        const pDef = aluminum.find(a => a.id === rp.profileId);
                        return (
                            <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-100 dark:hover:bg-indigo-900 transition-all hover:shadow-sm">
                                <div className="col-span-4">
                                    <select className="w-full bg-transparent text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 outline-none cursor-pointer" value={rp.profileId} onChange={e => { const updated = [...recipe.profiles]; updated[idx].profileId = e.target.value; updateRecipe(recipe.id, { profiles: updated }); }}>{aluminum.map(a => <option key={a.id} value={a.id}>{a.code} - {a.detail}</option>)}</select>
                                    {pDef && <span className="text-[7px] font-black text-indigo-400 uppercase mt-0.5 block italic">Espesor DB: {pDef.thickness}mm</span>}
                                </div>
                                <div className="col-span-1">
                                    <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-2 rounded-lg text-center font-black text-[10px] dark:text-white outline-none shadow-inner" value={rp.quantity} onChange={e => { const updated = [...recipe.profiles]; updated[idx].quantity = parseInt(e.target.value) || 0; updateRecipe(recipe.id, { profiles: updated }); }} />
                                </div>
                                <div className="col-span-3">
                                    <div className="relative">
                                        <RulerIcon size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                        <input className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 pl-8 pr-3 py-2 rounded-xl font-mono text-[10px] font-black text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-400 shadow-inner" value={rp.formula} onChange={e => { const updated = [...recipe.profiles]; updated[idx].formula = e.target.value; updateRecipe(recipe.id, { profiles: updated }); }} />
                                    </div>
                                </div>
                                <div className="col-span-3 flex gap-1.5">
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex gap-1">
                                        {['45', '90'].map(deg => (
                                            <button key={deg} onClick={() => { const updated = [...recipe.profiles]; updated[idx].cutStart = deg as any; updateRecipe(recipe.id, { profiles: updated }); }} className={`flex-1 py-1 text-[8px] font-black rounded-md transition-all ${rp.cutStart === deg ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>{deg}°</button>
                                        ))}
                                    </div>
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex gap-1">
                                        {['45', '90'].map(deg => (
                                            <button key={deg} onClick={() => { const updated = [...recipe.profiles]; updated[idx].cutEnd = deg as any; updateRecipe(recipe.id, { profiles: updated }); }} className={`flex-1 py-1 text-[8px] font-black rounded-md transition-all ${rp.cutEnd === deg ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>{deg}°</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="col-span-1 text-right">
                                    <button onClick={() => updateRecipe(recipe.id, { profiles: recipe.profiles.filter((_, i) => i !== idx) })} className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors p-2"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                <div className="bg-slate-50/30 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-6 rounded-[2rem] space-y-4">
                    <h4 className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={14} className="text-indigo-500"/> Fórmulas de Vidriado</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <FormulaInput label="Ancho Cristal" value={recipe.glassFormulaW} onChange={v => updateRecipe(recipe.id, { glassFormulaW: v })} />
                        <FormulaInput label="Alto Cristal" value={recipe.glassFormulaH} onChange={v => updateRecipe(recipe.id, { glassFormulaH: v })} />
                    </div>
                </div>
                <div className="bg-slate-50/30 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-6 rounded-[2rem] space-y-4">
                    <div className="flex justify-between items-center">
                        <h5 className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><Wind size={14} className="text-indigo-500"/> Herrajes, Gomas y Felpas</h5>
                        <button onClick={() => updateRecipe(recipe.id, { accessories: [...recipe.accessories, { accessoryId: accessories[0]?.id || '', quantity: 1, isLinear: false, formula: 'W' }] })} className="text-[8px] font-black text-indigo-600 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 px-3 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-all">Añadir Insumo</button>
                    </div>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                        {recipe.accessories.map((ra, idx) => (
                            <div key={idx} className="flex flex-col gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:border-indigo-100">
                                <div className="flex items-center gap-3">
                                    <select className="flex-1 bg-transparent text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 outline-none" value={ra.accessoryId} onChange={e => { const updated = [...recipe.accessories]; updated[idx].accessoryId = e.target.value; updateRecipe(recipe.id, { accessories: updated }); }}>{accessories.map(a => <option key={a.id} value={a.id}>{a.code} - {a.detail}</option>)}</select>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                        <button onClick={() => { const updated = [...recipe.accessories]; updated[idx].isLinear = false; updateRecipe(recipe.id, { accessories: updated }); }} className={`px-2 py-0.5 text-[7px] font-black rounded-md ${!ra.isLinear ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-400'}`}>U</button>
                                        <button onClick={() => { const updated = [...recipe.accessories]; updated[idx].isLinear = true; updateRecipe(recipe.id, { accessories: updated }); }} className={`px-2 py-0.5 text-[7px] font-black rounded-md ${ra.isLinear ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>ML</button>
                                    </div>
                                    <button onClick={() => updateRecipe(recipe.id, { accessories: recipe.accessories.filter((_, i) => i !== idx) })} className="text-slate-300 dark:text-slate-600 hover:text-red-500"><Trash2 size={12}/></button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {ra.isLinear && (
                                        <div className="flex-1">
                                            <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1.5 rounded-md font-mono text-[9px] font-black text-indigo-600 outline-none" placeholder="Fórmula (W, H...)" value={ra.formula} onChange={e => { const updated = [...recipe.accessories]; updated[idx].formula = e.target.value; updateRecipe(recipe.id, { accessories: updated }); }} />
                                        </div>
                                    )}
                                    <div className="w-20">
                                        <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 p-1.5 rounded-md text-center font-black text-[9px] dark:text-white outline-none" placeholder="Cant." value={ra.quantity} onChange={e => { const updated = [...recipe.accessories]; updated[idx].quantity = parseInt(e.target.value) || 0; updateRecipe(recipe.id, { accessories: updated }); }} />
                                    </div>
                                    <span className="text-[7px] font-black text-slate-400 uppercase">{ra.isLinear ? 'VECES' : 'UNID.'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="h-[85vh] flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-300 space-y-6 transition-colors">
            <div className="relative">
                <Shapes size={80} className="opacity-10 animate-pulse-soft" />
                <Settings2 size={32} className="absolute -bottom-2 -right-2 text-indigo-600/20 animate-spin-slow" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] dark:text-slate-600">Terminal de Ingeniería Maestra</p>
          </div>
        )}
      </div>
    </div>
  );
};

const GlobalCompCard: React.FC<{ title: string; icon: React.ReactNode; color: string; profileId?: string; profiles: AluminumProfile[]; onSelect: (id: string) => void; footer?: React.ReactNode }> = ({ title, icon, color, profileId, profiles, onSelect, footer }) => {
    const pDef = profiles.find(p => p.id === profileId);
    const colorClasses: any = {
        emerald: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900',
        sky: 'bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900',
        indigo: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900',
        slate: 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800'
    };
    return (
        <div className={`p-5 rounded-3xl border-2 shadow-sm space-y-3 transition-all hover:shadow-md ${colorClasses[color] || colorClasses.slate}`}>
            <div className="flex items-center gap-2 border-b border-current/10 pb-2">
                {icon}
                <span className="text-[9px] font-black uppercase tracking-widest">{title}</span>
            </div>
            <select className="w-full bg-white dark:bg-slate-800 border border-current/10 p-2.5 rounded-xl text-[9px] font-black uppercase dark:text-white outline-none focus:ring-2 ring-current/10 cursor-pointer" value={profileId || ''} onChange={e => onSelect(e.target.value)}>
                <option value="">(NINGUNO)</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
            {pDef && <div className="text-[7px] font-bold uppercase opacity-70 flex justify-between px-1"><span>e: {pDef.thickness}mm</span><span>w: {pDef.weightPerMeter}kg</span></div>}
            {footer}
        </div>
    );
};

const FormulaInput: React.FC<{ label: string; value?: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div className="space-y-1 flex-1">
        <label className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter ml-1">{label}</label>
        <input className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-2 rounded-lg font-mono text-[9px] font-black text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-400 shadow-inner" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Fórmula" />
    </div>
);

export default ProductRecipeEditor;
