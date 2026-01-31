
import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Search, CheckCircle2, Download, Database as DbIcon, Palette, Droplets, Thermometer, Box } from 'lucide-react';
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

  // MAPEADOR AVANZADO DE CABECERAS (SOPORTA SINÓNIMOS)
  const normalizeKey = (key: string): string => {
    const k = key.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9]/g, ""); // Quitar caracteres especiales
    
    // Mapeo para Código
    if (['codigo', 'cod', 'code', 'articulo', 'art', 'id', 'sku', 'ref', 'referencia'].includes(k)) return 'code';
    // Mapeo para Detalle
    if (['detalle', 'descripcion', 'detail', 'description', 'nombre', 'perfil', 'producto', 'item'].includes(k)) return 'detail';
    // Mapeo para Peso
    if (['peso', 'kg', 'kgm', 'weight', 'pesopormetro', 'pesometros', 'kilogramos'].includes(k)) return 'weightPerMeter';
    // Mapeo para Largo de Barra
    if (['largo', 'barra', 'length', 'largobarra', 'medidabarra', 'longitud'].includes(k)) return 'barLength';
    // Mapeo para Espesor
    if (['espesor', 'thickness', 'profundidad', 'mm', 'anchoala', 'espesordb', 'grosor'].includes(k)) return 'thickness';
    // Mapeo para Precios
    if (['preciom2', 'costom2', 'm2', 'priceperm2', 'p_m2', 'preciopormetrocuadrado', 'precio', 'costo', 'valor'].includes(k)) return 'pricePerM2';
    if (['unitario', 'unitprice', 'preciounitario', 'p_unit', 'costounitario'].includes(k)) return 'unitPrice';
    if (['preciokg', 'p_kg', 'priceperkg', 'costokg'].includes(k)) return 'pricePerKg';
    // Mapeo para Unidades
    if (['unidad', 'unit', 'unid', 'medida'].includes(k)) return 'unit';
    // Mapeo para Medidas Físicas (Vidrios)
    if (['ancho', 'width', 'dimx', 'base'].includes(k)) return 'width';
    if (['alto', 'height', 'dimy', 'altura'].includes(k)) return 'height';
    // Mapeo para Colores
    if (['hex', 'color', 'hexcolor', 'html', 'codigo_color'].includes(k)) return 'hexColor';

    return k;
  };

  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Exportar todas las tablas en un solo archivo con pestañas
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aluminum), "Aluminio");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glasses), "Vidrios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accessories), "Accesorios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(blindPanels), "Paneles Ciegos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dvhInputs), "Componentes DVH");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(treatments), "Pinturas y Colores");
    
    XLSX.writeFile(wb, `BACKUP_MAESTRO_INGENIERIA_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const processSheet = (possibleNames: string[]) => {
            const sheetKey = Object.keys(wb.Sheets).find(k => 
                possibleNames.some(name => k.toLowerCase().includes(name.toLowerCase()))
            );
            
            if (!sheetKey) return null;
            const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetKey], { defval: "" }) as any[];
            
            return raw.map((row, idx) => {
                const normalizedRow: any = { id: row.id || `${Date.now()}-${idx}` };
                Object.keys(row).forEach(key => {
                    const normKey = normalizeKey(key);
                    let val = row[key];
                    // Sanitización numérica fuerte
                    if (['weightPerMeter', 'barLength', 'thickness', 'pricePerM2', 'price', 'unitPrice', 'cost', 'width', 'height', 'pricePerKg'].includes(normKey)) {
                        val = parseFloat(String(val).replace(',', '.')) || 0;
                    }
                    normalizedRow[normKey] = val;
                });
                return normalizedRow;
            });
        };

        const alu = processSheet(["Aluminio", "Perfil", "Aluminum", "Stock", "Barras"]);
        const gls = processSheet(["Vidrios", "Vidrio", "Glass", "Cristal", "Planchas", "Espejo"]);
        const acc = processSheet(["Accesorios", "Accesorio", "Herraje", "Accessory", "Insumo"]);
        const bld = processSheet(["Ciegos", "Panel", "Blind", "Laminas", "Ciego"]);
        const dvh = processSheet(["DVH", "Camara", "Componentes"]);
        const trt = processSheet(["Pinturas", "Colores", "Treatments", "Tratamientos"]);

        if (alu) setAluminum(alu);
        if (gls) setGlasses(gls);
        if (acc) setAccessories(acc);
        if (bld) setBlindPanels(bld);
        if (dvh) setDvhInputs(dvh);
        if (trt) setTreatments(trt);

        alert("Base de datos sincronizada correctamente.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        alert("Error crítico al leer el archivo. Asegúrese de que el formato sea .xlsx");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderTable = () => {
    switch (activeSubTab) {
      case 'aluminum':
        return (
          <TableWrapper headers={['Cód. Perfil', 'Descripción Técnica', 'Peso (KG/M)', 'Largo (M)', 'Espesor DB (mm)', 'Acciones']} onAdd={() => setAluminum([...aluminum, { id: Date.now().toString(), code: 'NUEVO', detail: 'Nuevo Perfil', weightPerMeter: 0, barLength: 6, treatmentCost: 0, thickness: 0 }])}>
            {aluminum.filter(p => filter(p.code) || filter(p.detail)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-indigo-800 uppercase" value={item.code} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical font-mono font-black text-slate-900" value={item.weightPerMeter} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, weightPerMeter: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical font-mono font-black text-slate-900" value={item.barLength} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, barLength: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical font-mono font-black text-indigo-600 bg-indigo-50/50 rounded-lg px-2" value={item.thickness} onChange={e => setAluminum(aluminum.map(x => x.id === item.id ? {...x, thickness: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style text-right"><button onClick={() => setAluminum(aluminum.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'glasses':
        return (
          <TableWrapper headers={['Cód. Vidrio', 'Detalle del Cristal', 'Ancho (mm)', 'Alto (mm)', 'Costo M2', 'Acciones']} onAdd={() => setGlasses([...glasses, { id: Date.now().toString(), code: 'V-00', detail: 'Nuevo Cristal', width: 2400, height: 1800, pricePerM2: 0 }])}>
            {glasses.filter(g => filter(g.detail) || filter(g.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-indigo-800" value={item.code} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, code: e.target.value} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16" value={item.width} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, width: parseInt(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><input type="number" className="input-technical w-16" value={item.height} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, height: parseInt(e.target.value) || 0} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-20 outline-none" value={item.pricePerM2} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, pricePerM2: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style text-right"><button onClick={() => setGlasses(glasses.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'dvh':
        return (
          <TableWrapper headers={['Tipo Insumo', 'Descripción Técnica', 'Costo Unitario', 'Acciones']} onAdd={() => setDvhInputs([...dvhInputs, { id: Date.now().toString(), type: 'Cámara', detail: 'Nuevo Insumo DVH', cost: 0 }])}>
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
          <TableWrapper headers={['Nombre Acabado', 'Costo Extra por KG', 'HEX Color', 'Vista Previa', 'Acciones']} onAdd={() => setTreatments([...treatments, { id: Date.now().toString(), name: 'Nuevo Color', pricePerKg: 0, hexColor: '#475569' }])}>
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
          <TableWrapper headers={['Cód. Panel', 'Descripción', 'Costo', 'Tipo Unidad', 'Acciones']} onAdd={() => setBlindPanels([...blindPanels, { id: Date.now().toString(), code: 'P-00', detail: 'Nuevo Panel', price: 0, unit: 'm2' }])}>
            {blindPanels.filter(b => filter(b.detail) || filter(b.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-indigo-800 uppercase" value={item.code} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-16 outline-none" value={item.price} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, price: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style">
                    <select className="bg-transparent text-[10px] font-black text-slate-900 outline-none" value={item.unit} onChange={e => setBlindPanels(blindPanels.map(x => x.id === item.id ? {...x, unit: e.target.value as any} : x))}>
                        <option value="m2">M2 (Superficie)</option>
                        <option value="ml">ML (Lineal)</option>
                    </select>
                </td>
                <td className="cell-style text-right"><button onClick={() => setBlindPanels(blindPanels.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'accessories':
        return (
          <TableWrapper headers={['Cód. Accesorio', 'Descripción Técnica del Herraje', 'Costo Unitario', 'Acciones']} onAdd={() => setAccessories([...accessories, { id: Date.now().toString(), code: 'ACC-00', detail: 'Nuevo Herraje', unitPrice: 0 }])}>
            {accessories.filter(a => filter(a.detail) || filter(a.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-indigo-800 uppercase" value={item.code} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, code: e.target.value.toUpperCase()} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-20 outline-none" value={item.unitPrice} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, unitPrice: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style text-right"><button onClick={() => setAccessories(accessories.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden shadow-sm transition-colors">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-950/20">
            <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Filtrar registros por código o descripción técnica..." className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-11 pr-4 py-2.5 rounded-xl text-[11px] focus:outline-none focus:border-indigo-500 transition-all font-black text-slate-900 dark:text-slate-100 shadow-sm placeholder:text-slate-400" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        .row-style:hover { background-color: #f1f5f9; }
        .dark .row-style:hover { background-color: #1e293b; }
        .cell-style { padding: 0.85rem 1.5rem; vertical-align: middle; font-size: 11px; color: #0f172a; }
        .dark .cell-style { color: #f1f5f9; }
        .input-technical { background-color: transparent; width: 100%; outline: none; border: none; font-size: 11px; font-weight: 800; color: #0f172a; }
        .dark .input-technical { color: #f1f5f9; }
        .btn-delete { color: #94a3b8; transition: color 0.2s; padding: 0.5rem; }
        .btn-delete:hover { color: #ef4444; }
      `}</style>
    </div>
  );
};

const TableWrapper: React.FC<{ headers: string[], children: React.ReactNode, onAdd: () => void }> = ({ headers, children, onAdd }) => (
  <div className="w-full overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-300 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10 border-b border-slate-300 dark:border-slate-700">
        <tr>{headers.map((h, i) => <th key={i} className="px-6 py-4">{h}</th>)}</tr>
      </thead>
      <tbody>
        {children}
        <tr>
          <td colSpan={headers.length} className="p-6 bg-slate-50/20 dark:bg-slate-950/10">
            <button onClick={onAdd} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-400 hover:text-indigo-700 hover:border-indigo-700 transition-all flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest bg-white/50 dark:bg-slate-900/50 group">
              <Plus size={16} className="group-hover:scale-125 transition-transform" /> Insertar Registro Manual
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default DatabaseCRUD;
