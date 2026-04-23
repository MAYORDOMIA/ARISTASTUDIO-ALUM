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
import { DATABASE_TABS } from './constants';
import * as XLSX from 'xlsx';
import { migrateAppDataToTables, syncMasterInventoryToTables, cloneInventoryBetweenUsers } from './src/services/migrationService';

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
import { supabase, isSupabaseConfigured } from './src/services/supabaseClient';
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
    vsDiscount: 0,
    dvhDiscount: 0,
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
  const [recipes, _setRecipes] = useState<ProductRecipe[]>([]);
  const setRecipes = (updater: ProductRecipe[] | ((prev: ProductRecipe[]) => ProductRecipe[])) => {
    _setRecipes(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Enforce uniqueness
      return Array.from(new Map<string, ProductRecipe>(next.map(r => [r.id, r])).values());
    });
  };
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isMigrated, setIsMigrated] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Modo local si Supabase no está configurado
      const localData = localStorage.getItem('maicol_engine_data_data_v2');
      if (localData) {
        try {
          hydrateData(JSON.parse(localData));
        } catch (e) {
          console.error("Error parsing local data (msg):", (e as any)?.message || e);
        }
      }
      setIsDataLoaded(true);
      setSession({ user: { id: 'local-user', email: 'local@example.com' } } as any);
      setProfile({ email: 'local@example.com', is_active: true, max_devices: 999 });
      setAuthLoading(false);
      return;
    }

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
    if (!isSupabaseConfigured || !session?.user?.id || !isDataLoaded) return;

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

  const fetchFromTables = async (userId: string) => {
    console.log("Intentando cargar datos desde tablas relacionales...");
    try {
      const [
        { data: alu },
        { data: gls },
        { data: acc },
        { data: dvh },
        { data: trt },
        { data: bld },
        { data: rec },
        { data: quo }
      ] = await Promise.all([
        supabase.from('aluminum_inventory').select('*').eq('user_id', userId),
        supabase.from('glass_inventory').select('*').eq('user_id', userId),
        supabase.from('accessory_inventory').select('*').eq('user_id', userId),
        supabase.from('dvh_inventory').select('*').eq('user_id', userId),
        supabase.from('treatment_inventory').select('*').eq('user_id', userId),
        supabase.from('panel_inventory').select('*').eq('user_id', userId),
        supabase.from('recipes').select('*').eq('user_id', userId),
        supabase.from('quotes').select('*').eq('user_id', userId)
      ]);

      // Función técnica de deduplicación y limpieza de IDs aislados
      const cleanData = (list: any[]) => {
          if (!list) return [];
          const map = new Map();
          list.forEach(item => {
              const cleanId = item.id.replace(`_${userId}`, '');
              if (!map.has(cleanId) || item.id.includes(`_${userId}`)) {
                  map.set(cleanId, { ...item, id: cleanId });
              }
          });
          return Array.from(map.values());
      };

      return {
        aluminum: cleanData(alu).map(x => ({ ...x, weightPerMeter: x.weight_per_meter, barLength: x.bar_length, treatmentCost: x.treatment_cost, isGlazingBead: x.is_glazing_bead, glazingBeadStyle: x.glazing_bead_style, minGlassThickness: x.min_glass_thickness, maxGlassThickness: x.max_glass_thickness })),
        glasses: cleanData(gls).map(x => ({ ...x, pricePerM2: x.price_per_m2, isMirror: x.is_mirror })),
        accessories: cleanData(acc).map(x => ({ ...x, unitPrice: x.unit_price })),
        dvhInputs: cleanData(dvh).map(x => ({ ...x })),
        treatments: cleanData(trt).map(x => ({ ...x, pricePerKg: x.price_per_kg, hexColor: x.hex_color })),
        blindPanels: cleanData(bld).map(x => ({ ...x })),
        recipes: cleanData(rec).map(x => x.data),
        quotes: cleanData(quo).map(x => x.data)
      };
    } catch (e) {
      console.error("Fallo al consultar tablas relacionales:", e);
      return null;
    }
  };

  const fetchProfile = async (user: any) => {
    console.log("Fetching profile for user:", user.id);
    try {
      // Optimizamos: Primero pedimos los metadatos de cuenta y estado de activación
      let { data: profileCheck, error: checkError } = await supabase
        .from('profiles')
        .select('id, is_migrated, email, is_active, max_devices, registered_devices')
        .eq('id', user.id)
        .single();
      
      if (checkError || !profileCheck) {
          console.warn("No se encontró el perfil (puede ser un usuario recién creado). Intentando crearlo manualmente...");
          // Fallback de autocompletado de perfil por precaución
          const newProfile = { id: user.id, email: user.email, is_active: false, is_migrated: false, max_devices: 1, registered_devices: [] };
          await supabase.from('profiles').insert(newProfile).select().single().then((res) => {
              if (res.data) profileCheck = res.data;
          });
      }

      const { data: adminProfile } = await supabase.from('profiles').select('id, app_data').eq('email', 'aristastudiouno@gmail.com').single();

      if (profileCheck) {
        setIsMigrated(!!profileCheck.is_migrated);
        let dataToHydrate;

        if (profileCheck.is_migrated) {
            // Ya está migrado, cargamos desde las tablas ligeras
            let dataFromTables = await fetchFromTables(user.id);
            
            const isAdmin = profileCheck.email === 'aristastudiouno@gmail.com';
            const hasInventory = (dataFromTables?.aluminum?.length || 0) > 0;
            const hasGlass = (dataFromTables?.glasses?.length || 0) > 0;

            // SOLUCIÓN PROFESIONAL: Re-sincronización forzada si el inventario está vacío
            if (!hasInventory || !hasGlass) {
                console.warn("SISTEMA DE RECUPERACIÓN: Detectadas tablas vacías. Iniciando re-vínculo técnico...");
                
                if (isAdmin) {
                    // El Admin recupera de su propio respaldo legado
                    const { data: adminFull } = await supabase.from('profiles').select('app_data').eq('id', user.id).single();
                    if (adminFull?.app_data?.aluminum?.length > 0) {
                        console.log("Admin: Migrando desde app_data legado...");
                        await migrateAppDataToTables(user.id, adminFull.app_data);
                        dataToHydrate = await fetchFromTables(user.id);
                    } else {
                        dataToHydrate = dataFromTables;
                    }
                } else if (adminProfile?.id) {
                    // El cliente clona del Admin
                    console.log("Cliente: Clonando desde base maestra del Admin...");
                    await cloneInventoryBetweenUsers(adminProfile.id, user.id);
                    dataToHydrate = await fetchFromTables(user.id);
                } else {
                    dataToHydrate = dataFromTables;
                }
            } else {
                dataToHydrate = dataFromTables;
            }

            // EMERGENCY RECOVERY: Si está migrado pero las tablas están TOTALMENTE VACÍAS (ni recetas ni aluminio)
            const hasAnyCloudData = (dataToHydrate?.aluminum?.length || 0) > 0 || (dataToHydrate?.recipes?.length || 0) > 0;
            const localRaw = localStorage.getItem('maicol_engine_data_data_v2');
            
            if (!hasAnyCloudData && localRaw) {
               console.warn("RESCATE DINÁMICO: Base de datos vacía pero detectado respaldo local. Iniciando recuperación...");
               try {
                 const localBackup = JSON.parse(localRaw);
                 if (localBackup.aluminum?.length > 0 || localBackup.recipes?.length > 0) {
                   await migrateAppDataToTables(user.id, localBackup);
                   dataToHydrate = await fetchFromTables(user.id);
                   console.log("¡Rescate local completado con éxito!");
                 }
               } catch (e) {
                 console.error("Fallo al intentar rescate local:", e);
               }
            }

            if (dataToHydrate) {
                // Solo pedimos app_data si necesitamos el config (que vive ahí temporalmente)
                const { data: profileData } = await supabase.from('profiles').select('app_data').eq('id', user.id).single();
                dataToHydrate.config = profileData?.app_data?.config || adminProfile?.app_data?.config;
                dataToHydrate.customVisualTypes = profileData?.app_data?.customVisualTypes || [];
                dataToHydrate.currentWorkItems = profileData?.app_data?.currentWorkItems || [];
            }
        } else {
            // NO está migrado, AQUÍ es donde descargamos el JSON pesado solo una última vez
            console.log("Descargando datos legacy para iniciar migración...");
            const { data: fullProfile } = await supabase.from('profiles').select('app_data').eq('id', user.id).single();
            
            if (profileCheck && profileCheck.email === 'aristastudiouno@gmail.com') {
                dataToHydrate = fullProfile?.app_data || {};
                
                // Iniciamos migración automática con estos datos
                if (dataToHydrate && (dataToHydrate.aluminum?.length > 0 || dataToHydrate.recipes?.length > 0)) {
                    migrateAppDataToTables(user.id, dataToHydrate).then(res => {
                        if (res.success) {
                            setIsMigrated(true);
                            alert("¡Migración técnica completada! Activando nueva base de datos...");
                            window.location.reload();
                        }
                    });
                }
            } 
            else if (!fullProfile?.app_data || Object.keys(fullProfile.app_data).length === 0) {
                // AQUÍ EL NUEVO USUARIO ENTRA: No tiene app_data.
                console.log("Usuario nuevo detectado. Configurando base de datos...");
                
                // 1. Mark as migrated instantly
                await supabase.from('profiles').update({ is_migrated: true }).eq('id', user.id);
                
                // 2. Clone from admin
                if (adminProfile?.id) {
                    await cloneInventoryBetweenUsers(adminProfile.id, user.id);
                }
                
                setIsMigrated(true);
                profileCheck.is_migrated = true;
                dataToHydrate = await fetchFromTables(user.id);
            } 
            else {
                dataToHydrate = fullProfile.app_data;

                // El usuario tenía un JSON legado, intentamos migrarlo con IDs seguros
                if (dataToHydrate && (dataToHydrate.aluminum?.length > 0 || dataToHydrate.recipes?.length > 0)) {
                    migrateAppDataToTables(user.id, dataToHydrate).then(res => {
                        if (res.success) {
                            setIsMigrated(true);
                            alert("¡Migración de base de datos exitosa!");
                            window.location.reload();
                        } else {
                            console.error("Error migrando secundario:", res.errors);
                        }
                    });
                }
            }
        }
        
        if (dataToHydrate) hydrateData(dataToHydrate);
        setIsDataLoaded(true);
        if (profileCheck) {
            setProfile(profileCheck); // Force state map so UI doesn't render "Error de perfil"
            checkDeviceAccess(profileCheck);
        }

        // SOLUCIÓN PROFESIONAL: Suscripción en tiempo real al estado de la cuenta
        supabase
          .channel(`profile_updates_${user.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
            (payload: any) => {
              console.log("Cambio en perfil detectado en tiempo real:", payload.new);
              setProfile(payload.new);
              if (payload.new.is_active) {
                checkDeviceAccess(payload.new);
              }
            }
          )
          .subscribe();
      }
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        console.error("Error de red detectado. Reintentando...");
        setTimeout(() => fetchProfile(user), 3000);
      } else {
        console.error("Error fatal:", err);
        setAuthLoading(false);
      }
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
        const { error } = await supabase.from('profiles').update({ registered_devices: newDevices }).eq('id', profileData.id);
        
        if (error) {
          console.error("Error al registrar el dispositivo en la base de datos (code/msg):", error?.message || error);
          alert("Hubo un problema al registrar tu dispositivo. Por favor, contacta al administrador.");
          if (isSupabaseConfigured) await supabase.auth.signOut();
          else setSession(null);
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
      const uniqueRecipes = Array.from(new Map<string, ProductRecipe>(prev.map(r => [r.id, r])).values());
      const existingIds = uniqueRecipes.map(r => r.id);
      const missing = barandaRecipes.filter(r => !existingIds.includes(r.id));
      if (missing.length === 0 && uniqueRecipes.length === prev.length) return prev;
      return [...uniqueRecipes, ...missing];
    });
  }, [isDataLoaded]);

  const [customVisualTypes, setCustomVisualTypes] = useState<CustomVisualType[]>([]);

  const [currentWorkItems, setCurrentWorkItems] = useState<QuoteItem[]>([]);
  const [activeQuoteItem, setActiveQuoteItem] = useState<QuoteItem | null>(null);
  const [currentRecipeName, setCurrentRecipeName] = useState<string | null>(null);

  const handleEditQuote = (quote: Quote) => {
    setCurrentWorkItems(quote.items);
    setActiveTab('quoter');
  };

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
    // No guardar si: no hay datos, no hay sesion, o estamos migrando
    if (!isDataLoaded || !session?.user?.id || isMigrated === false && aluminum.length > 0) {
      // Si no estamos migrados y tenemos datos, el auto-migrador se encagará.
      // No intentamos guardar el bloque JSON gigante que causa el TIMEOUT.
      return;
    }

    const data = { aluminum, glasses, blindPanels, accessories, dvhInputs, treatments, recipes, config, quotes, customVisualTypes, currentWorkItems };
    setIsSaving(true);
    
    const timer = setTimeout(async () => {
      try {
        // Guardado local
        const storageKey = 'maicol_engine_data_data_v2';
        const stringified = JSON.stringify(data);
        const dataSizeMB = stringified.length / (1024 * 1024);
        
        // Arquitectura Defensiva: No intentar guardar si el objeto es peligrosamente grande para una sola celda
        if (dataSizeMB > 5) {
          console.error(`DETENCIÓN DE SEGURIDAD: El tamaño de los datos (${dataSizeMB.toFixed(2)} MB) excede el límite de seguridad para guardado atómico único.`);
          alert(`ADVERTENCIA CRÍTICA: Los datos actuales son demasiado grandes (${dataSizeMB.toFixed(2)} MB). \n\nPara evitar que pierdas información o bloquees tu cuenta, se ha suspendido el guardado automático en la nube. \n\nPor favor, contacta a soporte para iniciar la migración profesional a tablas relacionales.`);
          setIsSaving(false);
          return;
        }

        localStorage.setItem(storageKey, stringified);

        // Guardado en la nube (Supabase)
        if (isSupabaseConfigured) {
          if (isMigrated) {
            // Guardado Profesional - Por Tablas (Seguro contra pérdida de datos)
            const syncTable = async (tableName: string, dataArray: any[], mapper: (x: any) => any) => {
               // BLOQUEO ABSOLUTO: Jamás borrar la base de datos entera por un array vacío en memoria.
               if (!dataArray || dataArray.length === 0) return; 

               try {
                 const mappedData = dataArray.map(mapper).map(o => {
                    // Reasignación forzada de IDs seguros para usuarios compartidos
                    const safeId = o.id.includes(`_${session.user.id}`) ? o.id : `${o.id}_${session.user.id}`;
                    return { ...o, id: safeId };
                 });
                 const BATCH_SIZE = 500;
                 for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
                   const chunk = mappedData.slice(i, i + BATCH_SIZE);
                   const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
                   if (error) {
                       console.error(`Error de upsert en ${tableName} lote ${i}:`, error.message);
                       alert(`FALLO AL GUARDAR ${tableName}: \n\n${error.message}\n\nPor favor, haz una captura de este error y no cierres la ventana.`);
                       throw error;
                   }
                 }
               } catch (e) {
                  console.error(`Fallo crítico al sincronizar tabla ${tableName}:`, e);
               }
            };

            await Promise.all([
              supabase.from('profiles').update({ app_data: { config, customVisualTypes, currentWorkItems } }).eq('id', session.user.id)
            ]);
            await Promise.all([
              syncTable('aluminum_inventory', aluminum, x => ({ id: x.id, user_id: session.user.id, code: x.code || '', detail: x.detail || '', weight_per_meter: x.weightPerMeter || 0, bar_length: x.barLength || 6, thickness: x.thickness || 0, treatment_cost: x.treatmentCost || 0, is_glazing_bead: x.isGlazingBead || false, glazing_bead_style: x.glazingBeadStyle || '', min_glass_thickness: x.minGlassThickness || 0, max_glass_thickness: x.maxGlassThickness || 0 })),
              syncTable('glass_inventory', glasses, x => ({ id: x.id, user_id: session.user.id, code: x.code || '', detail: x.detail || '', width: x.width || 0, height: x.height || 0, thickness: x.thickness || 0, price_per_m2: x.pricePerM2 || 0, is_mirror: x.isMirror || false })),
              syncTable('accessory_inventory', accessories, x => ({ id: x.id, user_id: session.user.id, code: x.code || '', detail: x.detail || '', unit_price: x.unitPrice || 0 })),
              syncTable('dvh_inventory', dvhInputs, x => ({ id: x.id, user_id: session.user.id, type: x.type || '', detail: x.detail || '', thickness: x.thickness || 0, cost: x.cost || 0 })),
              syncTable('treatment_inventory', treatments, x => ({ id: x.id, user_id: session.user.id, name: x.name || '', price_per_kg: x.pricePerKg || 0, hex_color: x.hexColor || '' })),
              syncTable('panel_inventory', blindPanels, x => ({ id: x.id, user_id: session.user.id, code: x.code || '', detail: x.detail || '', price: x.price || 0, unit: x.unit || 'm2' })),
              syncTable('recipes', recipes, x => ({ id: x.id, user_id: session.user.id, name: x.name || '', data: x })),
              syncTable('quotes', quotes, x => ({ id: x.id, user_id: session.user.id, customer_name: x.customerName || '', data: x }))
            ]);
            console.log("Datos guardados en tablas relacionales de forma segura mediante UP-SERT.");
          } else {
            // Guardado Legacy - Mono-Celda (Con protección de tamaño y reintentos)
            console.log("Intentando guardado legacy (JSON bloque)...");
            const { error } = await supabase.from('profiles').update({ app_data: data }).eq('id', session.user.id);
            if (error) {
              if (error.message.includes("timeout")) {
                console.error("TIMEOUT detectado en guardado legacy. Los datos son demasiado grandes para guardarse en un solo bloque.");
              } else {
                console.error("Error al guardar en la nube (Supabase) (code/msg):", error?.message || error);
              }
            }
          }
        }
      } catch (e: any) {
        console.error("Error crítico en persistencia (msg):", e?.message || e);
        try {
            const cleanedQuotes = quotes.map((q, idx) => ({
                ...q,
                items: q.items.map(item => ({
                    ...item,
                    previewImage: idx < 5 ? item.previewImage : undefined
                }))
            }));
            const cleanedData = { ...data, quotes: cleanedQuotes };
            const cleanedStringified = JSON.stringify(cleanedData);
            const cleanedSizeMB = cleanedStringified.length / (1024 * 1024);

            localStorage.setItem('maicol_engine_data_data_v2', cleanedStringified);

            if (isSupabaseConfigured && cleanedSizeMB <= 5) {
              await supabase.from('profiles').update({ app_data: cleanedData }).eq('id', session.user.id);
            } else if (cleanedSizeMB > 5) {
              console.error("No se intenta reintento en nube: El tamaño de datos limpios aún excede 5MB");
            }
        } catch (retryError: any) {
            console.error("Fallo crítico de almacenamiento en reintento (msg):", retryError?.message || retryError);
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
            onClick={() => { if (isSupabaseConfigured) supabase.auth.signOut(); else setSession(null); setDeviceLimitReached(false); }} 
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
            onClick={() => fetchProfile(session.user)} 
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black uppercase tracking-widest py-3 rounded-xl transition-colors mb-2"
          >
            Revisar estado
          </button>
          <button 
            onClick={() => { if (isSupabaseConfigured) supabase.auth.signOut(); else setSession(null); }} 
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
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            No se pudo cargar tu perfil correctamente. El proceso de registro pudo haber sido interrumpido.
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-mono mb-8 text-left overflow-hidden text-ellipsis">
            Info: {session?.user?.id || 'No User ID'}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => { fetchProfile(session.user); }} 
              className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-black uppercase tracking-widest py-3 rounded-xl transition-colors"
            >
              Reintentar
            </button>
            <button 
              onClick={() => { if (isSupabaseConfigured) supabase.auth.signOut(); else setSession(null); }} 
              className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest py-3 rounded-xl transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
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
                   <button onClick={() => { if (isSupabaseConfigured) supabase.auth.signOut(); else setSession(null); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
                     <LogOut size={18} />
                   </button>
                 </div>
             </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar bg-[#f8fafc] dark:bg-[#1c1c1c] transition-colors">
          <div className={activeTab === 'database' ? 'h-full' : 'hidden'}>
            <DatabaseCRUD 
              aluminum={aluminum} setAluminum={setAluminum} 
              glasses={glasses} setGlasses={setGlasses} 
              blindPanels={blindPanels} setBlindPanels={setBlindPanels} 
              accessories={accessories} setAccessories={setAccessories} 
              dvhInputs={dvhInputs} setDvhInputs={setDvhInputs} 
              treatments={treatments} setTreatments={setTreatments} 
              config={config} setConfig={setConfig} 
              session={session}
              isMigrated={isMigrated}
              setIsMigrated={setIsMigrated}
              recipes={recipes}
              quotes={quotes}
            />
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
            <QuotesHistory quotes={quotes} setQuotes={setQuotes} config={config} recipes={recipes} aluminum={aluminum} accessories={accessories} glasses={glasses} dvhInputs={dvhInputs} treatments={treatments} blindPanels={blindPanels} onEditQuote={handleEditQuote} />
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
