
import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  Save,
  Image as ImageIcon,
  ShieldCheck,
  Zap,
  Percent,
  Layers,
  FileText,
  Hammer,
  PackageCheck,
  Scissors,
  Briefcase,
  Download,
  Box,
  Settings,
  Building2,
  Phone,
  MapPin,
  Upload,
  Sun,
  Moon
} from 'lucide-react';
import { 
  GlobalConfig, 
  AluminumProfile, 
  Glass, 
  BlindPanel, 
  Accessory, 
  DVHInput, 
  Treatment, 
  ProductRecipe, 
  Quote,
  QuoteItem,
  CustomVisualType
} from './types';
import { MENU_ITEMS } from './constants';
import DatabaseCRUD from './components/DatabaseCRUD';
import ProductRecipeEditor from './components/ProductRecipeEditor';
import QuotingModule from './components/QuotingModule';
import QuotesHistory from './components/QuotesHistory';
import ObrasModule from './components/ObrasModule';
import { 
  generateClientDetailedPDF, 
  generateMaterialsOrderPDF, 
  generateAssemblyOrderPDF, 
  generateBarOptimizationPDF, 
  generateGlassOptimizationPDF 
} from './services/pdfGenerator';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('quoter');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('aristastudio-theme');
    return (savedTheme as 'light' | 'dark') || 'light';
  });
  
  const [config, setConfig] = useState<GlobalConfig>({
    aluminumPricePerKg: 15.0,
    laborPercentage: 45,
    discWidth: 4,
    taxRate: 21,
    blindPanelPricePerM2: 85.0, 
    companyName: 'ARISTASTUDIO ALUM',
    companyAddress: 'Planta Industrial Central',
    companyPhone: '+54 11 0000 0000',
    companyLogo: ''
  });

  const [aluminum, setAluminum] = useState<AluminumProfile[]>([]);
  const [glasses, setGlasses] = useState<Glass[]>([]);
  const [blindPanels, setBlindPanels] = useState<BlindPanel[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [dvhInputs, setDvhInputs] = useState<DVHInput[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customVisualTypes, setCustomVisualTypes] = useState<CustomVisualType[]>([]);

  const [currentWorkItems, setCurrentWorkItems] = useState<QuoteItem[]>([]);
  const [activeQuoteItem, setActiveQuoteItem] = useState<QuoteItem | null>(null);

  // Gestión de Tema
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('aristastudio-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const saved = localStorage.getItem('maicol_engine_data_data_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.aluminum) setAluminum(parsed.aluminum);
        if (parsed.glasses) setGlasses(parsed.glasses);
        if (parsed.blindPanels) setBlindPanels(parsed.blindPanels);
        if (parsed.accessories) setAccessories(parsed.accessories);
        if (parsed.dvhInputs) setDvhInputs(parsed.dvhInputs);
        if (parsed.treatments) setTreatments(parsed.treatments);
        if (parsed.recipes) setRecipes(parsed.recipes);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.quotes) setQuotes(parsed.quotes);
        if (parsed.customVisualTypes) setCustomVisualTypes(parsed.customVisualTypes);
        if (parsed.currentWorkItems) setCurrentWorkItems(parsed.currentWorkItems);
      } catch (e) {
        console.error("Error crítico de hidratación:", e);
      }
    }
  }, []);

  useEffect(() => {
    const data = { aluminum, glasses, blindPanels, accessories, dvhInputs, treatments, recipes, config, quotes, customVisualTypes, currentWorkItems };
    setIsSaving(true);
    const timer = setTimeout(() => {
      try {
        const storageKey = 'maicol_engine_data_data_v2';
        const stringified = JSON.stringify(data);
        localStorage.setItem(storageKey, stringified);
      } catch (e) {
        console.error("Error en persistencia (Quota Exceeded):", e);
        try {
            const cleanedQuotes = quotes.map((q, idx) => ({
                ...q,
                items: q.items.map(item => ({
                    ...item,
                    previewImage: idx < 5 ? item.previewImage : undefined
                }))
            }));
            const cleanedData = { ...data, quotes: cleanedQuotes };
            localStorage.setItem('maicol_engine_data_data_v2', JSON.stringify(cleanedData));
        } catch (retryError) {
            console.error("Fallo crítico de almacenamiento:", retryError);
        }
      }
      setIsSaving(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [aluminum, glasses, blindPanels, accessories, dvhInputs, treatments, recipes, config, quotes, customVisualTypes, currentWorkItems]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig(prev => ({ ...prev, companyLogo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLiveReport = (type: 'presupuesto' | 'taller' | 'materiales' | 'barras' | 'vidrios') => {
    const itemsToReport = activeTab === 'obras' ? currentWorkItems : (activeQuoteItem ? [activeQuoteItem] : []);
    if (itemsToReport.length === 0) {
        alert("No hay carpinterías cargadas para generar el reporte.");
        return;
    }
    const tempQuote: Quote = {
        id: 'REPORTE-' + Date.now().toString().substring(8),
        clientName: 'INGENIERÍA ACTIVA',
        date: new Date().toISOString(),
        items: itemsToReport,
        totalPrice: Math.round(itemsToReport.reduce((acc, i) => acc + (i.calculatedCost * i.quantity), 0) * (1 + config.taxRate/100))
    };
    try {
        switch (type) {
            case 'presupuesto': 
              generateClientDetailedPDF(tempQuote, config, recipes, glasses, dvhInputs, treatments); 
              break;
            case 'taller': 
              generateAssemblyOrderPDF(tempQuote, recipes, aluminum, glasses, dvhInputs); 
              break;
            case 'materiales': 
              generateMaterialsOrderPDF(tempQuote, recipes, aluminum, accessories, glasses, dvhInputs, config); 
              break;
            case 'barras': 
              generateBarOptimizationPDF(tempQuote, recipes, aluminum, config); 
              break;
            case 'vidrios': 
              generateGlassOptimizationPDF(tempQuote, recipes, glasses, aluminum, dvhInputs); 
              break;
        }
    } catch (err) {
        console.error(err);
        alert("Error al generar reporte técnico.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] dark:bg-slate-950 text-[#0f172a] dark:text-slate-100 transition-colors duration-300">
      <aside className={`transition-all duration-300 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          {isSidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg text-lg italic">A</div>
              <div className="flex flex-col">
                <div className="flex items-baseline italic">
                  <span className="font-black tracking-tighter text-md leading-none text-[#0f172a] dark:text-white">ARISTA</span>
                  <span className="font-black tracking-tighter text-md leading-none text-indigo-600">STUDIO</span>
                </div>
                <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold tracking-[0.2em]">ALUM v2.8</span>
              </div>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all hover:text-indigo-600">
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group border ${
                activeTab === item.id 
                ? 'bg-indigo-600 text-white font-black shadow-lg border-indigo-700' 
                : 'text-gray-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 border-transparent hover:border-slate-100 dark:hover:border-slate-800'
              }`}
            >
              <div className="relative">
                <span className={`shrink-0 transition-transform ${activeTab === item.id ? 'scale-105' : 'group-hover:scale-105'}`}>{item.icon}</span>
                {item.id === 'obras' && currentWorkItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full animate-pulse border border-white">
                    {currentWorkItems.length}
                  </span>
                )}
              </div>
              {isSidebarOpen && <span className="text-[11px] truncate uppercase font-black tracking-wider">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <div className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-[9px] font-black uppercase tracking-wider ${isSaving ? 'text-indigo-600 border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-green-600 border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30'}`}>
                {isSaving ? <Zap size={12} className="animate-pulse" /> : <ShieldCheck size={12} />}
                {isSidebarOpen && (isSaving ? "Guardando..." : "Sincronizado")}
            </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shadow-sm z-10 transition-colors">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-[#0f172a] dark:text-white">
              {MENU_ITEMS.find(m => m.id === activeTab)?.label || activeTab}
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3 border-r pr-6 border-slate-100 dark:border-slate-800">
                <button 
                  onClick={toggleTheme}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-all border border-slate-200 dark:border-slate-700"
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest">P. ALUMINIO BASE</span>
                <span className="text-sm font-mono text-indigo-600 dark:text-indigo-400 font-black">${config.aluminumPricePerKg.toFixed(2)} / KG</span>
             </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar bg-[#f8fafc] dark:bg-slate-950 transition-colors">
          {activeTab === 'database' && <DatabaseCRUD aluminum={aluminum} setAluminum={setAluminum} glasses={glasses} setGlasses={setGlasses} blindPanels={blindPanels} setBlindPanels={setBlindPanels} accessories={accessories} setAccessories={setAccessories} dvhInputs={dvhInputs} setDvhInputs={setDvhInputs} treatments={treatments} setTreatments={setTreatments} config={config} setConfig={setConfig} />}
          {activeTab === 'recipes' && <ProductRecipeEditor recipes={recipes} setRecipes={setRecipes} aluminum={aluminum} accessories={accessories} customVisualTypes={customVisualTypes} setCustomVisualTypes={setCustomVisualTypes} glasses={glasses} treatments={treatments} dvhInputs={dvhInputs} config={config} />}
          {activeTab === 'quoter' && (
            <QuotingModule 
              recipes={recipes} 
              aluminum={aluminum} 
              glasses={glasses} 
              blindPanels={blindPanels} 
              accessories={accessories} 
              dvhInputs={dvhInputs} 
              treatments={treatments} 
              config={config} 
              quotes={quotes} 
              setQuotes={setQuotes} 
              onUpdateActiveItem={setActiveQuoteItem}
              currentWorkItems={currentWorkItems}
              setCurrentWorkItems={setCurrentWorkItems}
            />
          )}
          {activeTab === 'obras' && (
            <ObrasModule 
              items={currentWorkItems} 
              setItems={setCurrentWorkItems} 
              quotes={quotes} 
              setQuotes={setQuotes} 
              recipes={recipes} 
              config={config} 
              aluminum={aluminum}
            />
          )}
          {activeTab === 'history' && <QuotesHistory quotes={quotes} setQuotes={setQuotes} config={config} recipes={recipes} aluminum={aluminum} accessories={accessories} glasses={glasses} dvhInputs={dvhInputs} treatments={treatments} />}
          {activeTab === 'config' && (
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2 border-b dark:border-slate-800 pb-4"><Zap size={14} /> Económicos y Técnicos</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Alu Crudo ($/KG)</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-2 rounded-xl font-mono text-xs font-bold dark:text-white" value={config.aluminumPricePerKg} onChange={(e) => setConfig({...config, aluminumPricePerKg: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Margen Obra %</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-2 rounded-xl font-mono text-xs font-bold dark:text-white" value={config.laborPercentage} onChange={(e) => setConfig({...config, laborPercentage: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">IVA %</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-2 rounded-xl font-mono text-xs font-bold dark:text-white" value={config.taxRate} onChange={(e) => setConfig({...config, taxRate: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Hoja Corte (mm)</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-2 rounded-xl font-mono text-xs font-bold dark:text-white" value={config.discWidth} onChange={(e) => setConfig({...config, discWidth: parseFloat(e.target.value) || 0})} />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2 border-b dark:border-slate-800 pb-4"><Building2 size={14} /> Identidad Corporativa</h2>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase px-1">Nombre Comercial</label>
                                <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-2 rounded-xl text-xs font-bold dark:text-white" value={config.companyName} onChange={(e) => setConfig({...config, companyName: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase px-1">Dirección Legal/Planta</label>
                                <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-2 rounded-xl text-xs font-bold dark:text-white" value={config.companyAddress} onChange={(e) => setConfig({...config, companyAddress: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase px-1">Teléfono Contacto</label>
                                <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-2 rounded-xl text-xs font-bold dark:text-white" value={config.companyPhone} onChange={(e) => setConfig({...config, companyPhone: e.target.value})} />
                            </div>
                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all">
                                    <Upload size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Subir Logo de Empresa</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                </label>
                            </div>
                        </div>
                    </div>
                  </div>
              </div>
          )}
        </section>
      </main>

      <style>{`
        .report-btn { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          gap: 4px; 
          padding: 8px 12px; 
          border-radius: 12px; 
          transition: all 0.2s; 
          border: 1px solid transparent;
        }
        .report-btn:hover { background-color: #f1f5f9; border-color: #e2e8f0; }
        .dark .report-btn:hover { background-color: #1e293b; border-color: #334155; }
        .icon-style { color: #64748b; transition: color 0.2s; }
        .report-btn:hover .icon-style { color: #4f46e5; }
        .label-style { font-size: 7px; font-weight: 900; color: #94a3b8; letter-spacing: 0.1em; transition: color 0.2s; }
        .report-btn:hover .label-style { color: #4f46e5; }
      `}</style>
    </div>
  );
};

export default App;
