
import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Search, CheckCircle2, Download, Database as DbIcon, Palette, Droplets, Thermometer, Box, AlertTriangle, Info, ShieldCheck, Zap } from 'lucide-react';
import { AluminumProfile, Glass, BlindPanel, Accessory, DVHInput, Treatment, GlobalConfig, ProductRecipe, Quote } from '../types';
import { DATABASE_TABS } from '../constants';
import * as XLSX from 'xlsx';
import { migrateAppDataToTables } from '../src/services/migrationService';

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
  isMigrated: boolean;
  setIsMigrated: (val: boolean) => void;
  recipes: ProductRecipe[];
  quotes: Quote[];
}

const DatabaseCRUD: React.FC<Props> = ({ 
  aluminum, setAluminum, 
  glasses, setGlasses, 
  blindPanels, setBlindPanels,
  accessories, setAccessories, 
  dvhInputs, setDvhInputs, 
  treatments, setTreatments,
  session, isMigrated, setIsMigrated,
  recipes, quotes
}) => {
  const [activeSubTab, setActiveSubTab] = useState('aluminum');
  const [search, setSearch] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filter = (val: any) => String(val || '').toLowerCase().includes(search.toLowerCase());

  const handleStartMigration = async () => {
    alert("¡Boton presionado! Iniciando validación...");
    console.log("Migration button clicked - Start");
    
    if (!session?.user?.id) {
      console.error("No session ID");
      alert("Error: No se encontró ID de usuario.");
      return;
    }
    
    console.log("Session verified:", session.user.id);
    
    const confirmed = confirm("ADVERTENCIA: Vas a migrar tus datos a la nueva arquitectura relacional. Esto mejorará drásticamente la velocidad y estabilidad. ¿Deseas continuar?");
    if (!confirmed) {
      console.log("Migration cancelled by user");
      return;
    }
    
    console.log("Starting migration process...");
    setIsMigrating(true);
    alert("Procesando migración... por favor espera unos segundos.");
    const data = { aluminum, glasses, blindPanels, accessories, dvhInputs, treatments, recipes, quotes };
    console.log("Payload prepared:", Object.keys(data));
    
    try {
      const result = await migrateAppDataToTables(session.user.id, data);
      console.log("Migration result:", result);
      
      if (result.success) {
        alert("¡MIGRACIÓN COMPLETADA! Ahora tu aplicación funciona con tablas dedicadas.");
        setIsMigrated(true);
        window.location.reload();
      } else {
        console.error("Migration failed with errors:", result.errors);
        alert("Error en la migración: " + (result.errors?.join(", ") || "Error desconocido"));
      }
    } catch (err: any) {
      console.error("Critical error during migration:", err);
      alert("Error crítico durante la migración: " + (err.message || String(err)));
    } finally {
      setIsMigrating(false);
    }
  };

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
      // Note: In DatabaseCRUD we don't have access to all state, but we can export what we have
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
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (imported.aluminum) setAluminum(imported.aluminum);
        if (imported.glasses) setGlasses(imported.glasses);
        if (imported.blindPanels) setBlindPanels(imported.blindPanels);
        if (imported.accessories) setAccessories(imported.accessories);
        if (imported.dvhInputs) setDvhInputs(imported.dvhInputs);
        if (imported.treatments) setTreatments(imported.treatments);
        
        alert("Restauración de Respaldo JSON completada con éxito.");
      } catch (err) {
        alert("Error al procesar el archivo de respaldo JSON.");
      }
    };
    reader.readAsText(file);
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

      const newAlu = processSheet(['aluminio', 'perfil', 'alu'], 'alu');
      if (newAlu) setAluminum(newAlu);

      const newGlass = processSheet(['vidrio', 'cristal', 'glass'], 'glass');
      if (newGlass) setGlasses(newGlass);

      const newAcc = processSheet(['accesorio', 'herraje', 'acc'], 'acc');
      if (newAcc) setAccessories(newAcc);

      const newBlind = processSheet(['panel', 'ciego', 'blind'], 'blind');
      if (newBlind) setBlindPanels(newBlind);

      const newDVH = processSheet(['dvh', 'camara', 'insumo'], 'dvh');
      if (newDVH) setDvhInputs(newDVH);

      const newTreat = processSheet(['pintura', 'tratamiento', 'color'], 'trt');
      if (newTreat) setTreatments(newTreat);

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
        <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
            <button onClick={() => setShowDriveModal(true)} className="flex-1 flex items-center justify-center gap-3 px-4 lg:px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                <DbIcon size={14} /> Sincronizar Drive
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImportFromExcel} className="hidden" accept=".xlsx,.xls" />
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-3 px-4 lg:px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-sky-600 transition-all shadow-sm">
                <Upload size={14} /> Importar Excel
            </button>
            <button onClick={handleExportToExcel} className="flex-1 flex items-center justify-center gap-3 px-4 lg:px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all shadow-sm">
                <Download size={14} /> Excel
            </button>
            <button onClick={handleExportToJSON} className="flex-1 flex items-center justify-center gap-3 px-4 lg:px-6 py-3 bg-slate-900 dark:bg-sky-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 transition-all shadow-xl active:scale-95">
                <Download size={14} /> Backup JSON
            </button>
            <input type="file" id="json-restore" className="hidden" accept=".json" onChange={handleImportFromJSON} />
            <button onClick={() => document.getElementById('json-restore')?.click()} className="flex-1 flex items-center justify-center gap-3 px-4 lg:px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                <Upload size={14} /> Restaurar JSON
            </button>
        </div>
      </div>

      <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="w-10 h-10 bg-sky-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg"><Info size={20} /></div>
          <div className="flex flex-col">
              <p className="text-[10px] font-black text-sky-900 dark:text-sky-300 uppercase tracking-widest leading-none">Terminal de Sincronización Industrial</p>
              <p className="text-[9px] font-bold text-sky-600/70 dark:text-sky-400/50 uppercase mt-1">
                {isMigrated ? 'Arquitectura Relacional Activa (Alta Velocidad)' : 'Advertencia: Usando Arquitectura Mono-Celda (Riesgo de bloqueo)'}
              </p>
          </div>
        </div>
        {!isMigrated && (
          <div className="flex flex-col items-end gap-2">
            <button 
              onClick={handleStartMigration}
              disabled={isMigrating}
              className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {isMigrating ? <Zap size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {isMigrating ? 'Migrando...' : 'Iniciar Migración Profesional'}
            </button>
            <span className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter">
              ID: {session?.user?.id?.substring(0, 8) || 'SIN SESIÓN'} | M: {String(isMigrated)}
            </span>
          </div>
        )}
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
