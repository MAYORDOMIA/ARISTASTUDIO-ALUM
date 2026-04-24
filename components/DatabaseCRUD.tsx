
import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Search, CheckCircle2, Download, Database as DbIcon, Palette, Droplets, Thermometer, Box, AlertTriangle, Info, ShieldCheck, Zap, Database, Cloud, RefreshCw } from 'lucide-react';
import { AluminumProfile, Glass, BlindPanel, Accessory, DVHInput, Treatment, GlobalConfig, ProductRecipe, Quote } from '../types';
import { DATABASE_TABS } from '../constants';
import * as XLSX from 'xlsx';
import { pullUpdatesFromMaster, saveBulkData, wipeUserInventory } from '../src/services/migrationService';

interface Props {
  aluminum: AluminumProfile[];
  setAluminum: (data: AluminumProfile[]) => void;
  glasses: Glass[];
  setGlasses: (data: Glass[]) => void;
  blindPanels: BlindPanel[];
  setBlindPanels: (data: BlindPanel[]) => void;
  accessories: Accessory[];
  setAccessories: (data: Accessory[]) => void;
  dvhInputs: DVHInput[];
  setDvhInputs: (data: DVHInput[]) => void;
  treatments: Treatment[];
  setTreatments: (data: Treatment[]) => void;
  config: GlobalConfig;
  setConfig: (config: GlobalConfig) => void;
  session: any;
  recipes: ProductRecipe[];
  setRecipes: (data: ProductRecipe[]) => void;
  quotes: Quote[];
}

const DatabaseCRUD: React.FC<Props> = ({ 
  aluminum, setAluminum, 
  glasses, setGlasses, 
  blindPanels, setBlindPanels,
  accessories, setAccessories, 
  dvhInputs, setDvhInputs, 
  treatments, setTreatments,
  config, setConfig,
  session,
  recipes, setRecipes, quotes
}) => {
  const [activeSubTab, setActiveSubTab] = useState('aluminum');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filter = (val: any) => String(val || '').toLowerCase().includes(search.toLowerCase());

  // MAPEADOR TÉCNICO DE CABECERAS (Normaliza variaciones de Excel)
  const normalizeKey = (key: string): string => {
    const k = key.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9]/g, ""); // Quitar espacios y símbolos
    
    // Identificadores
    if (['codigo', 'cod', 'code', 'articulo', 'art', 'id', 'sku', 'ref'].includes(k)) return 'code';
    if (['descripcion', 'desc', 'detalle', 'detail', 'description', 'nombre', 'perfil', 'producto', 'item'].includes(k)) return 'detail';
    if (['tipo', 'type', 'tipoinsumo'].includes(k)) return 'type';
    
    // Medidas Físicas
    if (['peso', 'kg', 'kgm', 'weight', 'pesopormetro', 'pesometros', 'kilogramos', 'pesokg', 'pesolineal', 'pesokgm'].includes(k)) return 'weightPerMeter';
    if (['largo', 'barra', 'length', 'largobarra', 'medidabarra', 'longitud', 'mts', 'metros', 'largom'].includes(k)) return 'barLength';
    if (['espesor', 'thickness', 'profundidad', 'mm', 'anchoala', 'espesordb', 'grosor', 'espesormm'].includes(k)) return 'thickness';
    if (['ancho', 'width', 'dimx', 'base', 'anchoplancha', 'anchomm'].includes(k)) return 'width';
    if (['alto', 'height', 'dimy', 'altura', 'altoplancha', 'altomm'].includes(k)) return 'height';
    
    // Precios y Costos
    if (['preciom2', 'costom2', 'm2', 'priceperm2', 'pm2', 'preciopormetrocuadrado', 'glassprice'].includes(k)) return 'pricePerM2';
    if (['costo', 'precio', 'unitario', 'unitprice', 'preciounitario', 'punit', 'costounitario', 'unid', 'cadauno', 'valor'].includes(k)) return 'unitPrice';
    if (['preciokg', 'pkg', 'priceperkg', 'costokg', 'valorkg', 'pintura'].includes(k)) return 'pricePerKg';
    if (['costoextra', 'treatmentcost', 'costotratamiento', 'extraperfil'].includes(k)) return 'treatmentCost';
    
    // Atributos
    if (['unidad', 'unit', 'medida', 'tipo'].includes(k)) return 'unit';
    if (['hex', 'color', 'hexcolor', 'html', 'codigocolor'].includes(k)) return 'hexColor';
    if (['espejo', 'mirror', 'ismirror', 'reflectante', 'esespejo'].includes(k)) return 'isMirror';
    
    // Contravidrios
    if (['contravidrio', 'escontravidrio', 'isglazingbead', 'bead'].includes(k)) return 'isGlazingBead';
    if (['estilo', 'style', 'beadstyle', 'tipocontravidrio', 'estilocontravidrio'].includes(k)) return 'glazingBeadStyle';
    if (['minvidrio', 'minglass', 'vidriomin', 'glassmin'].includes(k)) return 'minGlassThickness';
    if (['maxvidrio', 'maxglass', 'vidriomax', 'glassmax'].includes(k)) return 'maxGlassThickness';

    return k;
  };

  const [isPullingUpdates, setIsPullingUpdates] = useState(false);

  const [showWipeModal, setShowWipeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  const handleFetchUpdates = async () => {
    if (!session?.user?.id) return;
    
    // We explicitly avoid showing this to the master user themselves (though they shouldn't need it)
    if (session.user.email === 'aristastudiouno@gmail.com') {
      alert("No necesitas buscar actualizaciones porque tú eres el usuario maestro.");
      return;
    }

    if (!confirm("¿Deseas buscar nuevos productos en la base de datos del Administrador? Esto NO borrará tus datos actuales, solo agregará lo que falte.")) return;

    setIsPullingUpdates(true);
    try {
      const res = await pullUpdatesFromMaster(session.user.id);
      
      if (res.errors.length > 0) {
        console.error("Errores parciales al actualizar:", res.errors);
      }
      
      if (res.added > 0) {
        alert(`¡Sincronización exitosa! Se añadieron ${res.added} productos nuevos a tu base de datos.\nLa página se recargará para mostrar los cambios.`);
        window.location.reload();
      } else {
        alert("Tu base de datos ya está al día. No se encontraron productos nuevos en el servidor del Administrador.");
      }
    } catch (e: any) {
      alert("Hubo un error al buscar actualizaciones: " + e.message);
    } finally {
      setIsPullingUpdates(false);
    }
  };

  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Generar datos con nombres de columna exactos pedidos por el usuario
    const exportAlu = aluminum.map(p => ({ 
      "Código": p.code, 
      "Descripción": p.detail, 
      "Peso_KG_M": p.weightPerMeter, 
      "Largo_M": p.barLength, 
      "Espesor_MM": p.thickness, 
      "Costo_Extra": p.treatmentCost,
      "Es_Contravidrio": p.isGlazingBead ? 'SI' : 'NO',
      "Estilo_Contravidrio": p.glazingBeadStyle || '',
      "Min_Vidrio": p.minGlassThickness || 0,
      "Max_Vidrio": p.maxGlassThickness || 0
    }));
    const exportGlass = glasses.map(g => ({ "Código": g.code, "Descripción": g.detail, "Ancho_MM": g.width, "Alto_MM": g.height, "Precio_M2": g.pricePerM2, "Es_Espejo": g.isMirror ? 'SI' : 'NO' }));
    const exportAcc = accessories.map(a => ({ "Código": a.code, "Descripción": a.detail, "Costo": a.unitPrice }));
    const exportBlind = blindPanels.map(b => ({ "Código": b.code, "Descripción": b.detail, "Costo": b.price, "Unidad": b.unit }));
    const exportDVH = dvhInputs.map(d => ({ "Tipo": d.type, "Descripción": d.detail, "Costo": d.cost }));
    const exportTreat = treatments.map(t => ({ "Nombre": t.name, "Precio_KG": t.pricePerKg, "HEX": t.hexColor }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportAlu), "Aluminio");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportGlass), "Vidrios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportAcc), "Accesorios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportBlind), "Paneles");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportDVH), "DVH");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportTreat), "Pinturas");
    
    XLSX.writeFile(wb, `BACKUP_ARISTA_SISTEMAS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportToJSON = () => {
    const backupData = {
      aluminum,
      glasses,
      blindPanels,
      accessories,
      dvhInputs,
      treatments,
      recipes, // Added missing payload
      quotes, // Added missing payload
      version: "2.0",
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RESPALDO_TECNICO_ARISTA_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFromJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingImportFile(file);
    setShowImportModal(true);
    if (e.target) e.target.value = ''; // Reset input so it can be selected again
  };

  const processJSONImport = (wantsOverwrite: boolean) => {
    if (!pendingImportFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        
        const mergeArrays = (existing: any[], incoming: any[]) => {
           if (wantsOverwrite) return incoming; // If overwrite, just return the incoming data
           
           if (!existing || existing.length === 0) return incoming;
           if (!incoming || incoming.length === 0) return existing;
           const map = new Map(existing.map(x => [x.id, x]));
           incoming.forEach(x => map.set(x.id, x));
           return Array.from(map.values());
        };

        if (imported.aluminum) setAluminum(mergeArrays(aluminum, imported.aluminum));
        if (imported.glasses) setGlasses(mergeArrays(glasses, imported.glasses));
        if (imported.blindPanels) setBlindPanels(mergeArrays(blindPanels, imported.blindPanels));
        if (imported.accessories) setAccessories(mergeArrays(accessories, imported.accessories));
        if (imported.dvhInputs) setDvhInputs(mergeArrays(dvhInputs, imported.dvhInputs));
        if (imported.treatments) setTreatments(mergeArrays(treatments, imported.treatments));
        
        if (imported.recipes) {
            setRecipes(mergeArrays(recipes, imported.recipes));
        }
        
        setShowImportModal(false);
        setPendingImportFile(null);
        // We use a small visual toast instead of alert, or just let them see the UI update.
        // Alert is blocked in iframes too, so no alert here either.
      } catch (err) {
        setShowImportModal(false);
        setPendingImportFile(null);
      }
    };
    reader.readAsText(pendingImportFile);
  };

  const handleWipeDatabase = () => {
    setShowWipeModal(true);
  };

  const confirmWipeDatabase = () => {
    setAluminum([]);
    setGlasses([]);
    setBlindPanels([]);
    setAccessories([]);
    setDvhInputs([]);
    setTreatments([]);
    setRecipes([]);
    setShowWipeModal(false);
  };

  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');
  const [showDriveModal, setShowDriveModal] = useState(false);

  const handleSyncWithDrive = async () => {
    if (!driveUrl) {
      alert("Por favor ingresa el link de tu Google Sheet.");
      return;
    }
    setSyncingDrive(true);
    try {
      // Extract the spreadsheet ID from the URL
      const match = driveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error("Link inválido. Asegúrate de que sea un link de Google Sheets.");
      }
      const sheetId = match[1];
      
      // We need the sheet to be published to the web as CSV, or we can use the export endpoint
      // The easiest way without API keys is the export endpoint if the sheet is public "Anyone with the link can view"
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
      
      const response = await fetch(exportUrl);
      if (!response.ok) throw new Error("No se pudo acceder al archivo. Asegúrate de que el link tenga permisos de 'Cualquier persona con el enlace puede leer'.");
      
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      
      // Re-use the import logic
      const processSheet = (possibleNames: string[], entityType: 'alu' | 'glass' | 'acc' | 'blind' | 'dvh' | 'trt') => {
          const sheetKey = Object.keys(wb.Sheets).find(k => 
              possibleNames.some(name => k.toLowerCase().includes(name.toLowerCase()))
          );
          
          if (!sheetKey) return null;
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetKey], { defval: "" }) as any[];
          if (raw.length === 0) return null;

          return raw.map((row, idx) => {
              const normalizedRow: any = { id: row.id || `${Date.now()}-${idx}` };
              Object.keys(row).forEach(key => {
                  let normKey = normalizeKey(key);
                  let val = row[key];

                  // Reasignación inteligente de precios según entidad
                  if (entityType === 'glass' && normKey === 'unitPrice') normKey = 'pricePerM2';
                  if (entityType === 'blind' && normKey === 'unitPrice') normKey = 'price';
                  if (entityType === 'dvh' && normKey === 'unitPrice') normKey = 'cost';

                  // Sanitización de tipo DVH
                  if (entityType === 'dvh' && normKey === 'type') {
                      if (String(val).toLowerCase().includes('camara')) val = 'Cámara';
                  }

                  // Sanitización numérica fuerte
                  if (['weightPerMeter', 'barLength', 'thickness', 'pricePerM2', 'price', 'unitPrice', 'cost', 'width', 'height', 'pricePerKg', 'treatmentCost'].includes(normKey)) {
                      val = parseFloat(String(val).replace(',', '.')) || 0;
                  }
                  if (normKey === 'isMirror') {
                      val = String(val).toUpperCase().includes('SI') || val === true || val === 1;
                  }
                  if (normKey === 'isGlazingBead') {
                      val = String(val).toUpperCase().includes('SI') || val === true || val === 1;
                  }
                  if (normKey === 'minGlassThickness' || normKey === 'maxGlassThickness') {
                      val = parseFloat(String(val).replace(',', '.')) || 0;
                  }
                  normalizedRow[normKey] = val;
              });
              return normalizedRow;
          });
      };

      const mergeData = (existing: any[], incoming: any[]) => {
         if (!existing || existing.length === 0) return incoming;
         if (!incoming || incoming.length === 0) return existing;
         const map = new Map(existing.map(x => [x.id, x]));
         incoming.forEach(x => map.set(x.id, x));
         return Array.from(map.values());
      };

      const newAlu = processSheet(['aluminio', 'perfil', 'alu'], 'alu');
      if (newAlu) setAluminum(mergeData(aluminum, newAlu));

      const newGlass = processSheet(['vidrio', 'cristal', 'glass'], 'glass');
      if (newGlass) setGlasses(mergeData(glasses, newGlass));

      const newAcc = processSheet(['accesorio', 'herraje', 'acc'], 'acc');
      if (newAcc) setAccessories(mergeData(accessories, newAcc));

      const newBlind = processSheet(['panel', 'ciego', 'blind'], 'blind');
      if (newBlind) setBlindPanels(mergeData(blindPanels, newBlind));

      const newDVH = processSheet(['dvh', 'camara', 'insumo'], 'dvh');
      if (newDVH) setDvhInputs(mergeData(dvhInputs, newDVH));

      const newTreat = processSheet(['pintura', 'tratamiento', 'color'], 'trt');
      if (newTreat) setTreatments(mergeData(treatments, newTreat));

      alert("¡Base de datos sincronizada exitosamente desde Google Drive!");
      setShowDriveModal(false);
    } catch (error: any) {
      console.error("Error al sincronizar Drive (msg):", error?.message || error);
      const errorMessage = error.message === 'Failed to fetch' 
        ? "Error de conexión: El navegador bloqueó la solicitud (posiblemente por políticas de CORS). Asegúrate de que el archivo es público o utiliza el botón 'Importar' para subir el archivo descargado manualmente." 
        : "Error al sincronizar: " + error.message;
      alert(errorMessage);
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleImportFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const processSheet = (possibleNames: string[], entityType: 'alu' | 'glass' | 'acc' | 'blind' | 'dvh' | 'trt') => {
            const sheetKey = Object.keys(wb.Sheets).find(k => 
                possibleNames.some(name => k.toLowerCase().includes(name.toLowerCase()))
            );
            
            if (!sheetKey) return null;
            const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetKey], { defval: "" }) as any[];
            if (raw.length === 0) return null;

            return raw.map((row, idx) => {
                const normalizedRow: any = { id: row.id || `${Date.now()}-${idx}` };
                Object.keys(row).forEach(key => {
                    let normKey = normalizeKey(key);
                    let val = row[key];

                    // Reasignación inteligente de precios según entidad
                    if (entityType === 'glass' && normKey === 'unitPrice') normKey = 'pricePerM2';
                    if (entityType === 'blind' && normKey === 'unitPrice') normKey = 'price';
                    if (entityType === 'dvh' && normKey === 'unitPrice') normKey = 'cost';

                    // Sanitización de tipo DVH
                    if (entityType === 'dvh' && normKey === 'type') {
                        if (String(val).toLowerCase().includes('camara')) val = 'Cámara';
                    }

                    // Sanitización numérica fuerte
                    if (['weightPerMeter', 'barLength', 'thickness', 'pricePerM2', 'price', 'unitPrice', 'cost', 'width', 'height', 'pricePerKg', 'treatmentCost'].includes(normKey)) {
                        val = parseFloat(String(val).replace(',', '.')) || 0;
                    }
                    if (normKey === 'isMirror') {
                        val = String(val).toUpperCase().includes('SI') || val === true || val === 1;
                    }
                    if (normKey === 'isGlazingBead') {
                        val = String(val).toUpperCase().includes('SI') || val === true || val === 1;
                    }
                    if (normKey === 'minGlassThickness' || normKey === 'maxGlassThickness') {
                        val = parseFloat(String(val).replace(',', '.')) || 0;
                    }
                    normalizedRow[normKey] = val;
                });
                return normalizedRow;
            });
        };

        const alu = processSheet(["Aluminio", "Perfil", "Barras"], 'alu');
        const gls = processSheet(["Vidrios", "Glass", "Cristal", "Espejo"], 'glass');
        const acc = processSheet(["Accesorios", "Herraje", "Wind", "Accessory"], 'acc');
        const bld = processSheet(["Ciegos", "Panel", "Blind"], 'blind');
        const dvh = processSheet(["DVH", "Camara", "InsumosDVH"], 'dvh');
        const trt = processSheet(["Pinturas", "Colores", "Tratamientos"], 'trt');

        if (alu) setAluminum(alu);
        if (gls) setGlasses(gls);
        if (acc) setAccessories(acc);
        if (bld) setBlindPanels(bld);
        if (dvh) setDvhInputs(dvh);
        if (trt) setTreatments(trt);

        alert("Base de Datos Sincronizada Correctamente.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        alert("Error crítico al procesar el Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderTable = () => {
    switch (activeSubTab) {
      case 'aluminum':
        return (
          <TableWrapper headers={['Cód. Perfil', 'Descripción', 'Peso (KG/M)', 'Largo (M)', 'Espesor DB', 'Costo Extra', 'Contravidrio?', 'Estilo', 'Rango Vidrio', 'Acciones']} onAdd={() => setAluminum([...aluminum, { id: Date.now().toString(), code: 'NUEVO', detail: 'Nuevo Perfil', weightPerMeter: 0, barLength: 6, treatmentCost: 0, thickness: 0, isGlazingBead: false, minGlassThickness: 0, maxGlassThickness: 0 }])}>
            {aluminum.filter(p => filter(p.code) || filter(p.detail)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-sky-800 uppercase" value={item.code || ''} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail || ''} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><input type="number" step="0.001" className="input-technical font-mono font-black text-slate-900" value={item.weightPerMeter || 0} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, weightPerMeter: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical font-mono font-black text-slate-900" value={item.barLength || 0} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, barLength: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical font-mono font-black text-sky-600 bg-sky-50/50 rounded-lg px-2" value={item.thickness || 0} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, thickness: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-slate-400 font-mono font-bold">$<input type="number" className="bg-transparent w-16 outline-none" value={item.treatmentCost || 0} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, treatmentCost: parseFloat(e.target.value) || 0} : x))} /></div></td>
                
                {/* Nuevas columnas para Contravidrios */}
                <td className="cell-style text-center">
                    <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded cursor-pointer accent-sky-600" 
                        checked={item.isGlazingBead || false} 
                        onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, isGlazingBead: e.target.checked} : x))} 
                    />
                </td>
                <td className="cell-style">
                    {item.isGlazingBead && (
                        <select 
                            className="bg-transparent text-[10px] font-black uppercase outline-none text-sky-600"
                            value={item.glazingBeadStyle || 'Recto'}
                            onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, glazingBeadStyle: e.target.value as any} : x))}
                        >
                            <option value="Recto">Recto</option>
                            <option value="Curvo">Curvo</option>
                        </select>
                    )}
                </td>
                <td className="cell-style">
                    {item.isGlazingBead && (
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                className="w-8 bg-slate-100 dark:bg-slate-800 rounded px-1 text-[9px] font-mono text-center" 
                                placeholder="Min"
                                value={item.minGlassThickness || 0}
                                onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, minGlassThickness: parseFloat(e.target.value) || 0} : x))}
                            />
                            <span className="text-[8px] text-slate-400">-</span>
                            <input 
                                type="number" 
                                className="w-8 bg-slate-100 dark:bg-slate-800 rounded px-1 text-[9px] font-mono text-center" 
                                placeholder="Max"
                                value={item.maxGlassThickness || 0}
                                onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, maxGlassThickness: parseFloat(e.target.value) || 0} : x))}
                            />
                        </div>
                    )}
                </td>

                <td className="cell-style text-right"><button onClick={() => setAluminum(aluminum.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'glasses':
        return (
          <TableWrapper headers={['Cód. Vidrio', 'Descripción', 'Espesor (mm)', 'Ancho (mm)', 'Alto (mm)', 'Costo M2', 'Espejo', 'Acciones']} onAdd={() => setGlasses([...glasses, { id: Date.now().toString(), code: 'V-00', detail: 'Nuevo Cristal', width: 2400, height: 1800, pricePerM2: 0, isMirror: false, thickness: 4 }])}>
            {glasses.filter(g => filter(g.detail) || filter(g.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-sky-800" value={item.code || ''} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, code: e.target.value} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail || ''} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16 font-mono font-bold text-sky-600 bg-sky-50/50 rounded-lg px-2" value={item.thickness || ''} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, thickness: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16 font-mono font-bold" value={item.width || 0} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, width: parseInt(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16 font-mono font-bold" value={item.height || 0} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, height: parseInt(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-20 outline-none" value={item.pricePerM2 || 0} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, pricePerM2: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style text-center">
                    <input type="checkbox" className="w-4 h-4 rounded cursor-pointer" checked={item.isMirror || false} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, isMirror: e.target.checked} : x))} />
                </td>
                <td className="cell-style text-right"><button onClick={() => setGlasses(glasses.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'accessories':
        return (
          <TableWrapper headers={['Código', 'Descripción', 'Costo ($)', 'Acciones']} onAdd={() => setAccessories([...accessories, { id: Date.now().toString(), code: 'ACC-00', detail: 'Nuevo Herraje', unitPrice: 0 }])}>
            {accessories.filter(a => filter(a.detail) || filter(a.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style w-40"><input className="input-technical font-black text-sky-800 uppercase" value={item.code || ''} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail || ''} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style w-40"><div className="flex items-center text-green-800 font-mono font-black bg-green-50/30 px-3 py-1.5 rounded-xl border border-green-100">$<input type="number" className="bg-transparent w-full outline-none ml-1" value={item.unitPrice || 0} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, unitPrice: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style w-20 text-right"><button onClick={() => setAccessories(accessories.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'dvh':
        return (
          <TableWrapper headers={['Tipo Insumo', 'Descripción', 'Espesor (mm)', 'Costo Unitario', 'Acciones']} onAdd={() => setDvhInputs([...dvhInputs, { id: Date.now().toString(), type: 'Cámara', detail: 'Nuevo Insumo DVH', cost: 0, thickness: 12 }])}>
            {dvhInputs.filter(i => filter(i.detail) || filter(i.type)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style">
                    <select className="bg-transparent outline-none font-black text-sky-800 uppercase text-[10px]" value={item.type === 'Camara' ? 'Cámara' : item.type} onChange={e => setDvhInputs(dvhInputs.map(x => x.id === item.id ? {...x, type: e.target.value as any} : x))}>
                        <option value="Cámara">Cámara</option>
                        <option value="Butilo">Butilo</option>
                        <option value="Sales">Sales</option>
                        <option value="Escuadras">Escuadras</option>
                    </select>
                </td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail || ''} onChange={e => setDvhInputs(dvhInputs.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16 font-mono font-bold text-sky-600 bg-sky-50/50 rounded-lg px-2 disabled:opacity-50" value={item.thickness || ''} onChange={e => setDvhInputs(dvhInputs.map(x => x.id === item.id ? {...x, thickness: parseFloat(e.target.value) || 0} : x))} disabled={item.type !== 'Cámara'} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-20 outline-none" value={item.cost || 0} onChange={e => setDvhInputs(dvhInputs.map(x => x.id === item.id ? {...x, cost: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style text-right"><button onClick={() => setDvhInputs(dvhInputs.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'treatments':
        return (
          <TableWrapper headers={['Nombre Acabado', 'Costo Extra / KG', 'HEX', 'Vista', 'Acciones']} onAdd={() => setTreatments([...treatments, { id: Date.now().toString(), name: 'Nuevo Color', pricePerKg: 0, hexColor: '#475569' }])}>
            {treatments.filter(t => filter(t.name)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-slate-900" value={item.name || ''} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, name: e.target.value} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-24 outline-none" value={item.pricePerKg || 0} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, pricePerKg: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style"><input className="input-technical font-mono text-[10px]" value={item.hexColor || ''} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, hexColor: e.target.value} : x))} /></td>
                <td className="cell-style">
                    <input type="color" className="w-10 h-10 rounded-xl border-none cursor-pointer shadow-sm" value={item.hexColor || '#000000'} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, hexColor: e.target.value} : x))} />
                </td>
                <td className="cell-style text-right"><button onClick={() => setTreatments(treatments.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'blindPanels':
        return (
          <TableWrapper headers={['Cód. Panel', 'Descripción', 'Costo', 'Unidad', 'Acciones']} onAdd={() => setBlindPanels([...blindPanels, { id: Date.now().toString(), code: 'P-00', detail: 'Nuevo Panel', price: 0, unit: 'm2' }])}>
            {blindPanels.filter(b => filter(b.detail) || filter(b.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-sky-800 uppercase" value={item.code || ''} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail || ''} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-16 outline-none" value={item.price || 0} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, price: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style">
                    <select className="bg-transparent text-[10px] font-black text-slate-900 outline-none" value={item.unit} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, unit: e.target.value as any} : x))}>
                        <option value="m2">M2</option>
                        <option value="ml">ML</option>
                    </select>
                </td>
                <td className="cell-style text-right"><button onClick={() => setBlindPanels(blindPanels.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
          {DATABASE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-3 px-6 py-2 rounded-lg transition-all text-[10px] uppercase font-black tracking-widest whitespace-nowrap ${
                activeSubTab === tab.id ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
         <div className="flex flex-wrap gap-2 lg:gap-3 justify-end items-center">
            {session?.user?.email !== 'aristastudiouno@gmail.com' && (
              <button 
                onClick={handleFetchUpdates} 
                disabled={isPullingUpdates}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
              >
                  <RefreshCw size={12} /> {isPullingUpdates ? 'Sincronizando...' : 'Actualizar Catálogo'}
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <button onClick={handleExportToJSON} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-sky-500 transition-all shadow-sm">
                <Download size={12} /> Backup JSON
            </button>
            
            <input type="file" id="json-restore" className="hidden" accept=".json" onChange={handleImportFromJSON} />
            <button onClick={() => document.getElementById('json-restore')?.click()} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-amber-500 transition-all shadow-sm">
                <Upload size={12} /> Restaurar JSON
            </button>
            
            <button onClick={handleWipeDatabase} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-red-100 dark:border-red-900/50">
                <Trash2 size={12} /> Limpiar Todo
            </button>
        </div>
      </div>

      {/* DATABASE RESET & SAVE HEADER */}
      <div className="mb-6 p-6 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200 dark:shadow-none ring-4 ring-indigo-50 dark:ring-indigo-900/20"><Database size={24} /></div>
          <div className="flex flex-col">
              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none">Gestión de Datos en Nube (V3)</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Servidor Supabase Conectado | Modo: Estricto
              </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={async () => {
                if(!confirm("¿ESTÁS SEGURO? Esto eliminará todos tus datos actuales en la nube para siempre. Esta acción NO se puede deshacer.")) return;
                try {
                  const { success, errors } = await wipeUserInventory(session.user.id);
                  if (success) {
                    alert("¡BASE DE DATOS EN CERO! Todo el inventario ha sido eliminado de la nube. Recarga para ver los cambios.");
                    location.reload();
                  } else {
                    alert("Error al limpiar: " + (errors ? errors.join(', ') : 'Error desconocido'));
                  }
                } catch(e: any) {
                  alert("Error crítico: " + e.message);
                }
              }}
              className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 border border-rose-200"
            >
              <Trash2 size={14} /> Recetear Todo (Cero)
            </button>

            <button 
                onClick={async () => {
                   const btn = document.getElementById('btn-save-cloud');
                   if(btn) {
                     btn.innerHTML = "PROCESANDO...";
                     btn.classList.add('opacity-50', 'cursor-not-allowed');
                   }
                   try {

                     const data = { 
                       aluminum, 
                       glasses, 
                       accessories, 
                       treatments, 
                       blindPanels, 
                       dvhInputs,
                       recipes, 
                       quotes: [] 
                     };
                     
                     const { success, errors } = await saveBulkData(session.user.id, data);
                     
                     if (success) {
                        alert(`¡OPERACIÓN EXITOSA!\nTodos los datos han sido sincronizados con Supabase correctamente.`);
                        if(btn) {
                          btn.innerHTML = "Guardar Catálogo Actual";
                          btn.classList.remove('opacity-50', 'cursor-not-allowed');
                        }
                     } else {
                        const errorMsg = errors && errors.length > 0 
                          ? errors.join('\n') 
                          : 'Error desconocido en el servidor';
                        
                        console.error("Errores reportados por el servicio:", errors);
                        alert("ERROR EN LA SINCRONIZACIÓN:\n" + errorMsg);
                        
                        if(btn) {
                          btn.innerHTML = "Error (Reintentar)";
                          btn.classList.remove('opacity-50', 'cursor-not-allowed');
                        }
                     }
                  } catch (e: any) {
                     console.error("Fallo crítico en el botón de guardado:", e);
                     alert("FALLO CRÍTICO: " + (e.message || "Error al conectar con el servidor. Revisa tu conexión."));
                     if(btn) {
                       btn.innerHTML = "Error (Reintentar)";
                       btn.classList.remove('opacity-50', 'cursor-not-allowed');
                     }
                  }
                }}
                id="btn-save-cloud"
                className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Cloud size={14} /> Guardar Catálogo Actual
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden shadow-sm transition-colors">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-950/20">
            <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Filtrar registros en tiempo real..." className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-11 pr-4 py-2.5 rounded-xl text-[11px] focus:outline-none focus:border-sky-500 transition-all font-black text-slate-900 dark:text-slate-100 shadow-sm placeholder:text-slate-400" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="text-[9px] text-slate-900 dark:text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-3">
                <CheckCircle2 size={14} className="text-green-600" /> Sincronización Industrial Activa
            </div>
        </div>
        <div className="max-h-[64vh] overflow-y-auto custom-scrollbar">
            {renderTable()}
        </div>
      </div>

      <style>{`
        .row-style { border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s; }
        .dark .row-style { border-bottom: 1px solid #1e293b; }
        .row-style:hover { background-color: #f8fafc; }
        .dark .row-style:hover { background-color: #1e293b; }
        .cell-style { padding: 1rem 1.5rem; vertical-align: middle; font-size: 11px; color: #0f172a; }
        .dark .cell-style { color: #f1f5f9; }
        .input-technical { background-color: transparent; width: 100%; outline: none; border: none; font-size: 11px; font-weight: 800; color: #0f172a; }
        .dark .input-technical { color: #f1f5f9; }
        .btn-delete { color: #cbd5e1; transition: all 0.2s; padding: 0.5rem; border-radius: 8px; }
        .btn-delete:hover { color: #ef4444; background-color: #fef2f2; }
      `}</style>

      {/* WIP: Delete User Modal (Wait, this is DatabaseCRUD, adding wipe modals) */}
      {showWipeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-slate-900 border-none">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-red-500/30">
            <div className="p-6 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20">
              <h3 className="text-xl font-black text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-3">
                <Trash2 size={24} /> Limpiar Base de Datos
              </h3>
            </div>
            <div className="p-8 space-y-4 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">
                ⚠️ PELIGRO EXTREMO
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ¿Estás seguro de que quieres BURRAR TODO tu catálogo de la memoria de tu dispositivo?
              </p>
              <p className="text-xs text-slate-400 mt-4 bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-left font-mono">
                Esto dejará tu pantalla en blanco para que puedas importar un JSON limpio.<br/>NO afectará a La Nube a menos que presiones "Guardar Catálogo Oficial" después.
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3 justify-end border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setShowWipeModal(false)}
                className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmWipeDatabase}
                className="px-6 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-500/20 transition-all"
              >
                Sí, Borrar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Replace Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-slate-900 border-none">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-3">
                <Upload size={24} className="text-amber-500" /> Método de Restauración
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Has seleccionado un archivo de respaldo. ¿Cómo deseas aplicarlo?
              </p>
              
              <div 
                onClick={() => processJSONImport(true)}
                className="w-full text-left p-4 rounded-xl border-2 border-red-200 dark:border-red-900/30 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-all group"
              >
                <h4 className="font-black text-sm uppercase tracking-widest text-red-600 dark:text-red-400">Sobrescribir Totalmente (Recomendado)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Borra todos los datos actuales y deja SOLO los datos del archivo. Útil para reiniciar de forma limpia o aplicar una copia de seguridad oficial.
                </p>
              </div>

              <div 
                onClick={() => processJSONImport(false)}
                className="w-full text-left p-4 rounded-xl border-2 border-sky-200 dark:border-sky-900/30 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer transition-all group"
              >
                <h4 className="font-black text-sm uppercase tracking-widest text-sky-600 dark:text-sky-400">Combinar Inteligente / Anexar</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Mantiene lo que ya tienes y agrega lo del archivo. Si hay repetidos, el archivo manda.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 text-right border-t border-slate-100 dark:border-slate-800">
               <button 
                onClick={() => { setShowImportModal(false); setPendingImportFile(null); }}
                className="px-6 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black uppercase tracking-widest text-slate-500 transition-colors"
               >
                 Cancelar Importación
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Drive Sync Modal */}
      {showDriveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-widest">
                <DbIcon className="w-5 h-5 text-emerald-500" />
                Sincronizar con Google Drive
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                  Pega el link de tu archivo de Google Sheets. Asegúrate de que el archivo tenga permisos de <strong>"Cualquier persona con el enlace puede leer"</strong>.
                </p>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                  Link de Google Sheets
                </label>
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-0 outline-none transition-colors font-mono text-xs"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => setShowDriveModal(false)}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSyncWithDrive}
                disabled={syncingDrive || !driveUrl}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {syncingDrive ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  'Sincronizar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TableWrapper: React.FC<{ headers: string[], children: React.ReactNode, onAdd: () => void }> = ({ headers, children, onAdd }) => (
  <div className="w-full overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
        <tr>{headers.map((h, i) => <th key={i} className="px-6 py-4">{h}</th>)}</tr>
      </thead>
      <tbody>
        {children}
        <tr>
          <td colSpan={headers.length} className="p-6">
            <button onClick={onAdd} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-sky-600 hover:border-sky-600 transition-all flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest bg-slate-50/30 dark:bg-slate-900/10 group">
              <Plus size={16} className="group-hover:scale-125 transition-transform" /> Insertar Registro Manual
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default DatabaseCRUD;
