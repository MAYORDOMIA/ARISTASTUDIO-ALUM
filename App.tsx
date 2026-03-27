import React, { useState, useEffect, useMemo } from 'react';
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
  Tag,
  Wallet,
  Wind,
  LogOut,
  MonitorOff
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
import SuperAdminDashboard from './src/components/SuperAdminDashboard';
import Auth from './src/components/Auth';
import { supabase } from './src/services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { 
  generateClientDetailedPDF, 
  generateMaterialsOrderPDF, 
  generateAssemblyOrderPDF, 
  generateBarOptimizationPDF, 
  generateGlassOptimizationPDF,
  generateCostsPDF
} from './services/pdfGenerator';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [deviceLimitReached, setDeviceLimitReached] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState('quoter');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isSaving, setIsSaving] = useState(false);
  
  const [config, setConfig] = useState<GlobalConfig>({
    aluminumPricePerKg: 15.0,
    laborPercentage: 45,
    discWidth: 4,
    taxRate: 21,
    blindPanelPricePerM2: 85.0, 
    meshPricePerM2: 25.0,
    companyName: 'ARISTASTUDIO ALUM',
    companyAddress: 'Planta Industrial Central',
    companyPhone: '+54 11 0000 0000',
    companyLogo: '',
    handrailExtraIncrement: 0,
    mamparaExtraIncrement: 0
  });

  const [aluminum, setAluminum] = useState<AluminumProfile[]>([]);
  const [glasses, setGlasses] = useState<Glass[]>([]);
  const [blindPanels, setBlindPanels] = useState<BlindPanel[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [dvhInputs, setDvhInputs] = useState<DVHInput[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user);
      else {
        setProfile(null);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Suscripción en tiempo real para sincronización entre dispositivos
  useEffect(() => {
    if (!session?.user?.id || !isDataLoaded) return;

    const channel = supabase
      .channel(`realtime_sync_${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          // Solo sincronizamos si el cambio viene de la base de datos y NO estamos guardando nosotros
          // Esto evita bucles infinitos y colisiones mientras el usuario escribe
          if (payload.new && payload.new.app_data && !isSaving) {
            console.log("Sincronización remota detectada, actualizando datos...");
            hydrateData(payload.new.app_data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, isDataLoaded, isSaving]);

  const getDeviceId = () => {
    let id = localStorage.getItem('arista_device_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('arista_device_id', id);
    }
    return id;
  };

  const hydrateData = (parsed: any) => {
    console.log("Hydrating data:", parsed);
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
  };

  const fetchProfile = async (user: any) => {
    console.log("Fetching profile for user:", user.id);
    // 1. Obtener perfil del usuario actual para permisos
    const { data: currentUserProfile, error: userError } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
    
    if (userError) {
        console.error("Error fetching user profile:", userError);
    }
    console.log("Current user profile:", currentUserProfile);

    // 2. Obtener perfil del administrador para datos compartidos
    const { data: adminProfile, error: adminError } = await supabase.from('perfiles').select('*').eq('email', 'aristastudiouno@gmail.com').single();
    
    if (adminError) {
        console.error("Error fetching admin profile:", adminError);
    }
    console.log("Admin profile:", adminProfile);

    if (currentUserProfile) {
      let dataToHydrate;
      
      // Si el usuario es el administrador, siempre usa sus propios datos
      if (currentUserProfile.email === 'aristastudiouno@gmail.com') {
          dataToHydrate = currentUserProfile.app_data || {};
      } 
      // Si el usuario no es admin y no tiene datos (es nuevo), copia los del admin
      else if (!currentUserProfile.app_data || Object.keys(currentUserProfile.app_data).length === 0) {
          dataToHydrate = adminProfile?.app_data || {};
          // Guardar la copia inicial en su perfil
          await supabase.from('perfiles').update({ app_data: dataToHydrate }).eq('id', user.id);
      } 
      // Si ya tiene datos, usa los suyos (independencia)
      else {
          dataToHydrate = currentUserProfile.app_data;
      }
      
      hydrateData(dataToHydrate);
      setIsDataLoaded(true);
      checkDeviceAccess(currentUserProfile);
    } else {
      // Auto-crear el perfil si no existe
      const adminData = adminProfile?.app_data || {};
      const { data: newProfile } = await supabase.from('perfiles').insert([
        { 
          id: user.id, 
          email: user.email, 
          is_active: user.email === 'aristastudiouno@gmail.com',
          max_devices: 1,
          registered_devices: [],
          app_data: adminData
        }
      ]).select().single();
      
      hydrateData(adminData);
      setIsDataLoaded(true);

      if (newProfile) checkDeviceAccess(newProfile);
      else setAuthLoading(false);
    }
  };

  const checkDeviceAccess = async (profileData: any) => {
    // Si no hay perfil, no dejamos pasar
    if (!profileData) {
      setAuthLoading(false);
      return;
    }

    // Si es super admin, no limitamos dispositivos
    if (profileData.email === 'aristastudiouno@gmail.com') {
      setProfile(profileData);
      setAuthLoading(false);
      return;
    }

    // Si no está activo, lo dejamos pasar a la pantalla de "En revisión"
    if (!profileData.is_active) {
      setProfile(profileData);
      setAuthLoading(false);
      return;
    }

    const deviceId = getDeviceId();
    let devices = profileData.registered_devices || [];
    const maxDevices = profileData.max_devices || 1;

    if (!devices.includes(deviceId)) {
      if (devices.length < maxDevices) {
        // Registrar nuevo dispositivo
        const newDevices = [...devices, deviceId];
        const { error } = await supabase.from('perfiles').update({ registered_devices: newDevices }).eq('id', profileData.id);
        
        if (error) {
          console.error("Error al registrar el dispositivo en la base de datos:", error);
          alert("Hubo un problema al registrar tu dispositivo. Por favor, contacta al administrador.");
          await supabase.auth.signOut();
          setAuthLoading(false);
          return;
        }
        
        setProfile({ ...profileData, registered_devices: newDevices });
      } else {
        // Límite alcanzado
        setDeviceLimitReached(true);
        setProfile(profileData);
      }
    } else {
      setProfile(profileData);
    }
    setAuthLoading(false);
  };

  useEffect(() => {
    if (!isDataLoaded) return;
    const barandaRecipes: ProductRecipe[] = [
      {
        id: 'std_baranda_1',
        name: 'BARANDA POSTE ALTO',
        line: 'ESTÁNDAR',
        type: 'Baranda',
        visualType: 'baranda_poste_alto',
        profiles: [],
        accessories: [],
        glassFormulaW: 'W - 40',
        glassFormulaH: 'H - 10',
        isLocked: false
      },
      {
        id: 'std_baranda_2',
        name: 'BARANDA POSTE ALTO PASAMANO',
        line: 'ESTÁNDAR',
        type: 'Baranda',
        visualType: 'baranda_poste_alto_pasamano',
        profiles: [],
        accessories: [],
        glassFormulaW: 'W - 40',
        glassFormulaH: 'H - 50',
        isLocked: false
      },
      {
        id: 'std_baranda_3',
        name: 'BARANDA MINI POSTE',
        line: 'ESTÁNDAR',
        type: 'Baranda',
        visualType: 'baranda_mini_poste',
        profiles: [],
        accessories: [],
        glassFormulaW: 'W - 10',
        glassFormulaH: 'H - 10',
        isLocked: false
      },
      {
        id: 'std_baranda_4',
        name: 'BARANDA MINI POSTE Y PASAMANO',
        line: 'ESTÁNDAR',
        type: 'Baranda',
        visualType: 'baranda_mini_poste_pasamano',
        profiles: [],
        accessories: [],
        glassFormulaW: 'W - 10',
        glassFormulaH: 'H - 50',
        isLocked: false
      }
    ];

    setRecipes(prev => {
      const existingNames = prev.map(r => r.name);
      const missing = barandaRecipes.filter(r => !existingNames.includes(r.name));
      if (missing.length === 0) return prev;
      return [...prev, ...missing];
    });
  }, [isDataLoaded]);

  const [customVisualTypes, setCustomVisualTypes] = useState<CustomVisualType[]>([]);

  const [currentWorkItems, setCurrentWorkItems] = useState<QuoteItem[]>([]);
  const [activeQuoteItem, setActiveQuoteItem] = useState<QuoteItem | null>(null);
  const [currentRecipeName, setCurrentRecipeName] = useState<string | null>(null);

  const openingName = useMemo(() => {
    if (activeTab === 'quoter' && currentRecipeName) return currentRecipeName;
    if (!activeQuoteItem || !activeQuoteItem.composition.modules.length) return null;
    const firstModule = activeQuoteItem.composition.modules[0];
    const recipe = recipes.find(r => r.id === firstModule.recipeId);
    return recipe ? recipe.name : null;
  }, [activeQuoteItem, recipes, currentRecipeName, activeTab]);

  useEffect(() => {
    // Force light mode
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('aristastudio-theme');
  }, []);

  useEffect(() => {
    if (!isDataLoaded || !session?.user?.id) return;

    const data = { aluminum, glasses, blindPanels, accessories, dvhInputs, treatments, recipes, config, quotes, customVisualTypes, currentWorkItems };
    setIsSaving(true);
    
    const timer = setTimeout(async () => {
      try {
        // Guardado local
        const storageKey = 'maicol_engine_data_data_v2';
        const stringified = JSON.stringify(data);
        localStorage.setItem(storageKey, stringified);

        // Guardado en la nube (Supabase)
        const { error } = await supabase.from('perfiles').update({ app_data: data }).eq('id', session.user.id);
        if (error) {
          console.error("Error al guardar en la nube:", error);
        }
      } catch (e) {
        console.error("Error en persistencia:", e);
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
            await supabase.from('perfiles').update({ app_data: cleanedData }).eq('id', session.user.id);
        } catch (retryError) {
            console.error("Fallo crítico de almacenamiento:", retryError);
        }
      }
      setIsSaving(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [aluminum, glasses, blindPanels, accessories, dvhInputs, treatments, recipes, config, quotes, customVisualTypes, currentWorkItems, isDataLoaded, session]);

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

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f1f5f9] dark:bg-[#1c1c1c]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white"><ShieldCheck size={24} /></div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const isSuperAdmin = session.user.email === 'aristastudiouno@gmail.com';

  if (deviceLimitReached && !isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f1f5f9] dark:bg-[#1c1c1c] p-4">
        <div className="text-center p-8 bg-white dark:bg-[#252525] rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full">
          <MonitorOff className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-widest">Límite de Dispositivos</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Has alcanzado el límite máximo de dispositivos permitidos para tu cuenta. Contacta al administrador si necesitas acceder desde este nuevo dispositivo.</p>
          <button 
            onClick={() => { supabase.auth.signOut(); setDeviceLimitReached(false); }} 
            className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest py-3 rounded-xl transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (profile && !profile.is_active && !isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f1f5f9] dark:bg-[#1c1c1c] p-4">
        <div className="text-center p-8 bg-white dark:bg-[#252525] rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full">
          <ShieldCheck className="mx-auto text-amber-500 mb-4" size={48} />
          <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-widest">Cuenta en revisión</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Tu cuenta ha sido creada exitosamente, pero un administrador debe activarla para que puedas acceder al cotizador.</p>
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest py-3 rounded-xl transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!profile && !isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f1f5f9] dark:bg-[#1c1c1c] p-4">
        <div className="text-center p-8 bg-white dark:bg-[#252525] rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full">
          <ShieldCheck className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-widest">Error de Perfil</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">No se pudo cargar tu perfil correctamente. Por favor, contacta al administrador.</p>
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest py-3 rounded-xl transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] dark:bg-[#1c1c1c] text-[#0f172a] dark:text-slate-100 transition-colors duration-300">
      <aside className={`fixed lg:relative transition-all duration-300 bg-white dark:bg-[#252525] border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 shadow-xl h-full ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 w-0 lg:w-20'}`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden">
          {(isSidebarOpen || window.innerWidth >= 1024) && (
            <div className={`flex items-center gap-2 transition-opacity duration-300 ${!isSidebarOpen && 'lg:opacity-0'}`}>
              <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center font-black text-white shadow-lg text-lg italic">A</div>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all hover:text-sky-500">
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group border ${
                activeTab === item.id 
                ? 'bg-sky-500 text-white font-black shadow-lg border-sky-600' 
                : 'text-gray-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-sky-500 dark:hover:text-sky-400 border-transparent hover:border-slate-100 dark:hover:border-slate-800'
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
          {/* Opción de Super Admin oculta para todos excepto para ti */}
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group border ${
                activeTab === 'admin' 
                ? 'bg-red-500 text-white font-black shadow-lg border-red-600' 
                : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border-transparent'
              }`}
            >
              <ShieldCheck size={18} />
              {isSidebarOpen && <span className="text-[11px] font-black uppercase tracking-wider">Super Admin</span>}
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <div className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-[9px] font-black uppercase tracking-wider ${isSaving ? 'text-sky-500 border-sky-100 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30' : 'text-green-600 border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30'}`}>
                {isSaving ? <Zap size={12} className="animate-pulse" /> : <ShieldCheck size={12} />}
                {isSidebarOpen && (isSaving ? "Guardando..." : "Sincronizado")}
            </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative w-full">
        {isSidebarOpen && window.innerWidth < 1024 && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <header className="h-16 bg-white dark:bg-[#252525] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-6 shadow-sm z-10 transition-colors">
          <div className="flex items-center gap-3 lg:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xs lg:text-sm font-black uppercase tracking-[0.1em] lg:tracking-[0.2em] text-[#0f172a] dark:text-white truncate max-w-[150px] lg:max-w-none">
              {activeTab === 'quoter' ? (
                <div className="flex items-baseline shrink-0">
                  <span className="font-black tracking-tighter text-lg leading-none text-[#0f172a] dark:text-white">ARISTA</span>
                  <span className="font-light tracking-normal text-lg leading-none text-sky-500">STUDIO</span>
                </div>
              ) : (MENU_ITEMS.find(m => m.id === activeTab)?.label || activeTab)}
            </h1>
          </div>
          
          <div className="flex items-center gap-3 lg:gap-6">
             {activeTab === 'quoter' && openingName && (
               <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-100 dark:border-sky-800 animate-in fade-in slide-in-from-right-2">
                 <Tag size={12} className="text-sky-500" />
                 <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">
                   {openingName}
                 </span>
               </div>
             )}
             <div className="flex items-center gap-3 lg:gap-4">
                 <div className="flex flex-col items-end">
                    <span className="text-[7px] lg:text-[8px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest">P. ALU</span>
                    <span className="text-xs lg:text-sm font-mono text-sky-600 dark:text-sky-400 font-black">${config.aluminumPricePerKg.toFixed(2)}</span>
                 </div>
                 <div className="hidden sm:flex flex-col items-end pl-3 lg:pl-4 border-l border-slate-100 dark:border-slate-800">
                    <span className="text-[7px] lg:text-[8px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest">MARGEN</span>
                    <span className="text-xs lg:text-sm font-mono text-emerald-600 dark:text-emerald-400 font-black">+{config.laborPercentage}%</span>
                 </div>
                 <div className="pl-3 lg:pl-4 border-l border-slate-100 dark:border-slate-800">
                   <button onClick={() => supabase.auth.signOut()} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
                     <LogOut size={18} />
                   </button>
                 </div>
             </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar bg-[#f8fafc] dark:bg-[#1c1c1c] transition-colors">
          <div className={activeTab === 'database' ? 'h-full' : 'hidden'}>
            <DatabaseCRUD aluminum={aluminum} setAluminum={setAluminum} glasses={glasses} setGlasses={setGlasses} blindPanels={blindPanels} setBlindPanels={setBlindPanels} accessories={accessories} setAccessories={setAccessories} dvhInputs={dvhInputs} setDvhInputs={setDvhInputs} treatments={treatments} setTreatments={setTreatments} config={config} setConfig={setConfig} />
          </div>
          <div className={activeTab === 'recipes' ? 'h-full' : 'hidden'}>
            <ProductRecipeEditor recipes={recipes} setRecipes={setRecipes} aluminum={aluminum} accessories={accessories} customVisualTypes={customVisualTypes} setCustomVisualTypes={setCustomVisualTypes} glasses={glasses} treatments={treatments} dvhInputs={dvhInputs} config={config} />
          </div>
          <div className={activeTab === 'quoter' ? 'h-full' : 'hidden'}>
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
              onRecipeChange={setCurrentRecipeName}
              currentWorkItems={currentWorkItems}
              setCurrentWorkItems={setCurrentWorkItems}
            />
          </div>
          <div className={activeTab === 'obras' ? 'h-full' : 'hidden'}>
            <ObrasModule 
              items={currentWorkItems} 
              setItems={setCurrentWorkItems} 
              quotes={quotes} 
              setQuotes={setQuotes} 
              recipes={recipes} 
              config={config} 
              aluminum={aluminum}
            />
          </div>
          <div className={activeTab === 'history' ? 'h-full' : 'hidden'}>
            <QuotesHistory quotes={quotes} setQuotes={setQuotes} config={config} recipes={recipes} aluminum={aluminum} accessories={accessories} glasses={glasses} dvhInputs={dvhInputs} treatments={treatments} blindPanels={blindPanels} />
          </div>
          <div className={activeTab === 'admin' ? 'h-full' : 'hidden'}>
            <SuperAdminDashboard />
          </div>
          <div className={activeTab === 'config' ? 'h-full' : 'hidden'}>
              <div className="max-w-4xl mx-auto space-y-2 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white dark:bg-[#252525] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-600 flex items-center gap-2 border-b dark:border-slate-800 pb-1"><Zap size={14} /> Económicos y Técnicos</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Alu Crudo ($/KG)</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.aluminumPricePerKg ?? ''} onChange={(e) => setConfig({...config, aluminumPricePerKg: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Margen Obra %</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.laborPercentage ?? ''} onChange={(e) => setConfig({...config, laborPercentage: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">IVA %</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.taxRate ?? ''} onChange={(e) => setConfig({...config, taxRate: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Hoja Corte (mm)</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.discWidth ?? ''} onChange={(e) => setConfig({...config, discWidth: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Ciego ($/M2)</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.blindPanelPricePerM2 ?? ''} onChange={(e) => setConfig({...config, blindPanelPricePerM2: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1"><Wind size={8} /> Tela Mosq. ($/M2)</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.meshPricePerM2 ?? ''} onChange={(e) => setConfig({...config, meshPricePerM2: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1">Incremento Baranda %</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.handrailExtraIncrement ?? ''} onChange={(e) => setConfig({...config, handrailExtraIncrement: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1">Incremento Mampara %</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg font-mono text-xs font-bold dark:text-white" value={config.mamparaExtraIncrement ?? ''} onChange={(e) => setConfig({...config, mamparaExtraIncrement: parseFloat(e.target.value) || 0})} />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#252525] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-600 flex items-center gap-2 border-b dark:border-slate-800 pb-1"><Building2 size={14} /> Identidad Corporativa</h2>
                        <div className="space-y-1">
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase px-1">Nombre Comercial</label>
                                <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg text-xs font-bold dark:text-white" value={config.companyName || ''} onChange={(e) => setConfig({...config, companyName: e.target.value})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase px-1">Dirección Legal/Planta</label>
                                <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg text-xs font-bold dark:text-white" value={config.companyAddress || ''} onChange={(e) => setConfig({...config, companyAddress: e.target.value})} />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase px-1">Teléfono Contacto</label>
                                <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1 rounded-lg text-xs font-bold dark:text-white" value={config.companyPhone || ''} onChange={(e) => setConfig({...config, companyPhone: e.target.value})} />
                            </div>
                            <div className="pt-0.5">
                                <label className="flex items-center gap-2 cursor-pointer bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 p-2 rounded-lg border border-sky-100 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-all">
                                    <Upload size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Subir Logo de Empresa</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                </label>
                            </div>
                        </div>
                    </div>
                  </div>
              </div>
          </div>
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
        .report-btn:hover .icon-style { color: #0ea5e9; }
        .label-style { font-size: 7px; font-weight: 900; color: #94a3b8; letter-spacing: 0.1em; transition: color 0.2s; }
        .report-btn:hover .label-style { color: #0ea5e9; }
      `}</style>
    </div>
  );
};

export default App;
