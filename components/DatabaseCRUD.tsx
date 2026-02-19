
import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Search, CheckCircle2, Download, Database as DbIcon, Palette, Droplets, Thermometer, Box, AlertTriangle, Info } from 'lucide-react';
import { AluminumProfile, Glass, BlindPanel, Accessory, DVHInput, Treatment, GlobalConfig } from '../types';
import { DATABASE_TABS } from '../constants';
import * as XLSX from 'xlsx';

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
}

const DatabaseCRUD: React.FC<Props> = ({ 
  aluminum, setAluminum, 
  glasses, setGlasses, 
  blindPanels, setBlindPanels,
  accessories, setAccessories, 
  dvhInputs, setDvhInputs, 
  treatments, setTreatments 
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
    
    // Medidas Físicas
    if (['peso', 'kg', 'kgm', 'weight', 'pesopormetro', 'pesometros', 'kilogramos', 'pesokg', 'pesolineal'].includes(k)) return 'weightPerMeter';
    if (['largo', 'barra', 'length', 'largobarra', 'medidabarra', 'longitud', 'mts', 'metros'].includes(k)) return 'barLength';
    if (['espesor', 'thickness', 'profundidad', 'mm', 'anchoala', 'espesordb', 'grosor', 'espesormm'].includes(k)) return 'thickness';
    if (['ancho', 'width', 'dimx', 'base', 'ancho_plancha'].includes(k)) return 'width';
    if (['alto', 'height', 'dimy', 'altura', 'alto_plancha'].includes(k)) return 'height';
    
    // Precios y Costos
    if (['preciom2', 'costom2', 'm2', 'priceperm2', 'p_m2', 'preciopormetrocuadrado', 'glass_price'].includes(k)) return 'pricePerM2';
    if (['costo', 'precio', 'unitario', 'unitprice', 'preciounitario', 'p_unit', 'costounitario', 'unid', 'cadauno', 'valor'].includes(k)) return 'unitPrice';
    if (['preciokg', 'p_kg', 'priceperkg', 'costokg', 'valorkg', 'pintura'].includes(k)) return 'pricePerKg';
    if (['costo_extra', 'treatmentcost', 'costotratamiento', 'extra_perfil'].includes(k)) return 'treatmentCost';
    
    // Atributos
    if (['unidad', 'unit', 'medida', 'tipo'].includes(k)) return 'unit';
    if (['hex', 'color', 'hexcolor', 'html', 'codigo_color'].includes(k)) return 'hexColor';
    if (['espejo', 'mirror', 'is_mirror', 'reflectante'].includes(k)) return 'isMirror';
    
    // Contravidrios
    if (['contravidrio', 'es_contravidrio', 'is_glazing_bead', 'bead'].includes(k)) return 'isGlazingBead';
    if (['estilo', 'style', 'bead_style', 'tipo_contravidrio'].includes(k)) return 'glazingBeadStyle';
    if (['min_vidrio', 'min_glass', 'vidrio_min', 'glass_min'].includes(k)) return 'minGlassThickness';
    if (['max_vidrio', 'max_glass', 'vidrio_max', 'glass_max'].includes(k)) return 'maxGlassThickness';

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
                <td className="cell-style"><input className="input-technical font-black text-indigo-800 uppercase" value={item.code} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><input type="number" step="0.001" className="input-technical font-mono font-black text-slate-900" value={item.weightPerMeter} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, weightPerMeter: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical font-mono font-black text-slate-900" value={item.barLength} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, barLength: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical font-mono font-black text-indigo-600 bg-indigo-50/50 rounded-lg px-2" value={item.thickness} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, thickness: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-slate-400 font-mono font-bold">$<input type="number" className="bg-transparent w-16 outline-none" value={item.treatmentCost} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, treatmentCost: parseFloat(e.target.value) || 0} : x))} /></div></td>
                
                {/* Nuevas columnas para Contravidrios */}
                <td className="cell-style text-center">
                    <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded cursor-pointer accent-indigo-600" 
                        checked={item.isGlazingBead || false} 
                        onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, isGlazingBead: e.target.checked} : x))} 
                    />
                </td>
                <td className="cell-style">
                    {item.isGlazingBead && (
                        <select 
                            className="bg-transparent text-[10px] font-black uppercase outline-none text-indigo-600"
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
          <TableWrapper headers={['Cód. Vidrio', 'Descripción', 'Ancho (mm)', 'Alto (mm)', 'Costo M2', 'Espejo', 'Acciones']} onAdd={() => setGlasses([...glasses, { id: Date.now().toString(), code: 'V-00', detail: 'Nuevo Cristal', width: 2400, height: 1800, pricePerM2: 0, isMirror: false }])}>
            {glasses.filter(g => filter(g.detail) || filter(g.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-indigo-800" value={item.code} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, code: e.target.value} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16 font-mono font-bold" value={item.width} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, width: parseInt(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16 font-mono font-bold" value={item.height} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, height: parseInt(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-20 outline-none" value={item.pricePerM2} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, pricePerM2: parseFloat(e.target.value) || 0} : x))} /></div></td>
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
                <td className="cell-style w-40"><input className="input-technical font-black text-indigo-800 uppercase" value={item.code} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style w-40"><div className="flex items-center text-green-800 font-mono font-black bg-green-50/30 px-3 py-1.5 rounded-xl border border-green-100">$<input type="number" className="bg-transparent w-full outline-none ml-1" value={item.unitPrice} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, unitPrice: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style w-20 text-right"><button onClick={() => setAccessories(accessories.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'dvh':
        return (
          <TableWrapper headers={['Tipo Insumo', 'Descripción', 'Costo Unitario', 'Acciones']} onAdd={() => setDvhInputs([...dvhInputs, { id: Date.now().toString(), type: 'Cámara', detail: 'Nuevo Insumo DVH', cost: 0 }])}>
            {dvhInputs.filter(i => filter(i.detail) || filter(i.type)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style">
                    <select className="bg-transparent outline-none font-black text-indigo-800 uppercase text-[10px]" value={item.type} onChange={e => setDvhInputs(dvhInputs.map(x => x.id === item.id ? {...x, type: e.target.value as any} : x))}>
                        <option value="Cámara">Cámara</option>
                        <option value="Butilo">Butilo</option>
                        <option value="Sales">Sales</option>
                        <option value="Escuadras">Escuadras</option>
                    </select>
                </td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setDvhInputs(dvhInputs.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-20 outline-none" value={item.cost} onChange={e => setDvhInputs(dvhInputs.map(x => x.id === item.id ? {...x, cost: parseFloat(e.target.value) || 0} : x))} /></div></td>
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
                <td className="cell-style"><input className="input-technical font-black text-slate-900" value={item.name} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, name: e.target.value} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-24 outline-none" value={item.pricePerKg} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, pricePerKg: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style"><input className="input-technical font-mono text-[10px]" value={item.hexColor} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, hexColor: e.target.value} : x))} /></td>
                <td className="cell-style">
                    <input type="color" className="w-10 h-10 rounded-xl border-none cursor-pointer shadow-sm" value={item.hexColor} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, hexColor: e.target.value} : x))} />
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
                <td className="cell-style"><input className="input-technical font-black text-indigo-800 uppercase" value={item.code} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-16 outline-none" value={item.price} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, price: parseFloat(e.target.value) || 0} : x))} /></td>
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
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
          {DATABASE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-3 px-6 py-2 rounded-lg transition-all text-[10px] uppercase font-black tracking-widest whitespace-nowrap ${
                activeSubTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
            <input type="file" ref={fileInputRef} onChange={handleImportFromExcel} className="hidden" accept=".xlsx,.xls" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-600 transition-all shadow-sm">
                <Upload size={14} /> Importar Base
            </button>
            <button onClick={handleExportToExcel} className="flex items-center gap-3 px-6 py-3 bg-slate-900 dark:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
                <Download size={14} /> Backup Maestro
            </button>
        </div>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 p-4 rounded-2xl flex gap-4 items-center">
        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg"><Info size={20} /></div>
        <div className="flex flex-col">
            <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest leading-none">Terminal de Sincronización Industrial</p>
            <p className="text-[9px] font-bold text-indigo-600/70 dark:text-indigo-400/50 uppercase mt-1">La tabla Accesorios está configurada con: Código | Descripción | Costo</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden shadow-sm transition-colors">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-950/20">
            <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Filtrar registros en tiempo real..." className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-11 pr-4 py-2.5 rounded-xl text-[11px] focus:outline-none focus:border-indigo-500 transition-all font-black text-slate-900 dark:text-slate-100 shadow-sm placeholder:text-slate-400" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <button onClick={onAdd} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest bg-slate-50/30 dark:bg-slate-900/10 group">
              <Plus size={16} className="group-hover:scale-125 transition-transform" /> Insertar Registro Manual
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default DatabaseCRUD;
