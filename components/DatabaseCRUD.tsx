
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

  // Mapeo inteligente y agresivo de cabeceras para Excel
  const normalizeKey = (key: string): string => {
    const k = key.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9]/g, ""); // Quitar caracteres especiales
    
    if (['codigo', 'cod', 'code', 'articulo', 'art', 'id', 'sku'].includes(k)) return 'code';
    if (['detalle', 'descripcion', 'detail', 'description', 'nombre', 'perfil'].includes(k)) return 'detail';
    if (['peso', 'kg', 'kgm', 'weight', 'pesopor metro'].includes(k)) return 'weightPerMeter';
    if (['largo', 'barra', 'length', 'largobarra'].includes(k)) return 'barLength';
    if (['espesor', 'thickness', 'profundidad', 'mm'].includes(k)) return 'thickness';
    if (['precio', 'costo', 'price', 'unitario', 'm2', 'preciom2', 'costom2'].includes(k)) return 'pricePerM2';
    if (['unidad', 'unit', 'unid'].includes(k)) return 'unit';
    if (['ancho', 'width', 'dimx'].includes(k)) return 'width';
    if (['alto', 'height', 'dimy'].includes(k)) return 'height';
    if (['costounitario', 'unitprice', 'preciounitario', 'costo'].includes(k)) return 'unitPrice';
    if (['tipo', 'type', 'categoria'].includes(k)) return 'type';
    if (['costo', 'cost', 'valor'].includes(k)) return 'cost';
    return k;
  };

  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aluminum), "Aluminio");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glasses), "Vidrios");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accessories), "Accesorios");
    XLSX.writeFile(wb, `MAESTRO_INGENIERIA_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const processData = (possibleNames: string[]) => {
            // Buscar la hoja por cualquiera de los nombres posibles (case insensitive)
            const sheetKey = Object.keys(wb.Sheets).find(k => 
                possibleNames.some(name => k.toLowerCase().includes(name.toLowerCase()))
            );
            
            if (!sheetKey) return null;
            const sheet = wb.Sheets[sheetKey];
            const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
            
            return raw.map((row, idx) => {
                const normalizedRow: any = { id: row.id || `import-${idx}-${Date.now()}` };
                Object.keys(row).forEach(key => {
                    const normKey = normalizeKey(key);
                    let val = row[key];
                    // Convertir a número si la columna lo requiere, manejando comas de decimales
                    if (['weightPerMeter', 'barLength', 'thickness', 'pricePerM2', 'price', 'unitPrice', 'cost', 'width', 'height'].includes(normKey)) {
                        val = parseFloat(String(val).replace(',', '.')) || 0;
                    }
                    // Forzar a string campos que no deben ser numéricos
                    if (['code', 'detail', 'unit', 'type'].includes(normKey)) {
                        val = String(val || '');
                    }
                    normalizedRow[normKey] = val;
                });
                return normalizedRow;
            });
        };

        const aluData = processData(["Aluminio", "Perfil", "Aluminum", "Stock"]);
        const glassData = processData(["Vidrios", "Vidrio", "Glass", "Cristal", "Planchas"]);
        const accData = processData(["Accesorios", "Accesorio", "Herraje", "Accessory", "Wind"]);
        const blindData = processData(["Ciegos", "Panel", "Blind", "Laminas"]);
        const dvhData = processData(["InsumosDVH", "DVH", "Camara"]);

        let count = 0;
        if (aluData && aluData.length > 0) { setAluminum(aluData); count++; }
        if (glassData && glassData.length > 0) { setGlasses(glassData); count++; }
        if (accData && accData.length > 0) { setAccessories(accData); count++; }
        if (blindData && blindData.length > 0) { setBlindPanels(blindData); count++; }
        if (dvhData && dvhData.length > 0) { setDvhInputs(dvhData); count++; }

        if (count > 0) {
            alert(`Sincronización Exitosa: Se han actualizado ${count} categorías de la base de datos.`);
        } else {
            alert("No se detectaron hojas válidas en el Excel. Verifique que los nombres de las pestañas sean descriptivos (ej: 'Aluminio', 'Vidrios').");
        }
        
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        console.error("Critical Excel Error:", err);
        alert("Error de estructura en el archivo. Asegúrese de que las cabeceras estén en la primera fila.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderTable = () => {
    switch (activeSubTab) {
      case 'aluminum':
        return (
          <TableWrapper headers={['Código', 'Descripción Perfilería', 'Peso (KG/M)', 'Largo (M)', 'Espesor (mm)', 'Acciones']} onAdd={() => setAluminum([...aluminum, { id: Date.now().toString(), code: 'NUEVO', detail: 'Nuevo Perfil', weightPerMeter: 0, barLength: 6, treatmentCost: 0, thickness: 0 }])}>
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
          <TableWrapper headers={['Cód.', 'Vidriado / Espejo', 'Dim. Plancha', 'Costo M2', 'Acciones']} onAdd={() => setGlasses([...glasses, { id: Date.now().toString(), code: 'V-00', detail: 'Nuevo Cristal', width: 2400, height: 1800, pricePerM2: 0 }])}>
            {glasses.filter(g => filter(g.detail) || filter(g.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-indigo-800" value={item.code} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, code: e.target.value} : x))} /></td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style"><div className="flex gap-1 items-center font-mono text-xs font-black text-slate-900"><input type="number" className="w-14 bg-transparent outline-none" value={item.width} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, width: parseInt(e.target.value) || 0} : x))} />×<input type="number" className="w-14 bg-transparent outline-none" value={item.height} onChange={e => setGlasses(glasses.map(x => x.id === item.id ? {...x, height: parseInt(e.target.value) || 0} : x))} /></div></td>
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
          <TableWrapper headers={['Nombre Acabado', 'Precio por KG', 'Color Visual', 'Acciones']} onAdd={() => setTreatments([...treatments, { id: Date.now().toString(), name: 'Nuevo Color', pricePerKg: 0, hexColor: '#475569' }])}>
            {treatments.filter(t => filter(t.name)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style"><input className="input-technical font-black text-slate-900" value={item.name} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, name: e.target.value} : x))} /></td>
                <td className="cell-style"><div className="flex items-center text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-24 outline-none" value={item.pricePerKg} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, pricePerKg: parseFloat(e.target.value) || 0} : x))} /></div></td>
                <td className="cell-style">
                    <div className="flex items-center gap-3">
                        <input type="color" className="w-6 h-6 rounded-md border-none cursor-pointer" value={item.hexColor} onChange={e => setTreatments(treatments.map(x => x.id === item.id ? {...x, hexColor: e.target.value} : x))} />
                        <span className="text-[10px] font-mono font-bold text-slate-900">{item.hexColor}</span>
                    </div>
                </td>
                <td className="cell-style text-right"><button onClick={() => setTreatments(treatments.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      case 'blindPanels':
        return (
          <TableWrapper headers={['Cód.', 'Descripción Panel', 'Precio', 'Unidad', 'Acciones']} onAdd={() => setBlindPanels([...blindPanels, { id: Date.now().toString(), code: 'P-00', detail: 'Nuevo Panel', price: 0, unit: 'm2' }])}>
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
      case 'accessories':
        return (
          <TableWrapper headers={['Cód. Accesorio', 'Descripción', 'Costo Unitario', 'Acciones']} onAdd={() => setAccessories([...accessories, { id: Date.now().toString(), code: 'ACC-00', detail: 'Nuevo Herraje', unitPrice: 0 }])}>
            {accessories.filter(a => filter(a.detail) || filter(a.code)).map((item) => (
              <tr key={item.id} className="row-style group">
                <td className="cell-style font-black text-indigo-800 uppercase">{item.code}</td>
                <td className="cell-style"><input className="input-technical font-bold text-slate-900" value={item.detail} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, detail: e.target.value} : x))} /></td>
                <td className="cell-style text-green-800 font-mono font-black">$<input type="number" className="bg-transparent w-20 outline-none" value={item.unitPrice} onChange={e => setAccessories(accessories.map(x => x.id === item.id ? {...x, unitPrice: parseFloat(e.target.value) || 0} : x))} /></td>
                <td className="cell-style text-right"><button onClick={() => setAccessories(accessories.filter(x => x.id !== item.id))} className="btn-delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </TableWrapper>
        );
      default: return <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest opacity-30"><DbIcon size={64} className="mx-auto mb-4" /> Seleccione una Base Maestra</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          {DATABASE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-3 px-6 py-2 rounded-lg transition-all text-[10px] uppercase font-black tracking-widest whitespace-nowrap ${
                activeSubTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab.id === 'treatments' ? <Droplets size={14} /> : tab.id === 'dvh' ? <Thermometer size={14} /> : <Box size={14} />} 
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
            <input type="file" ref={fileInputRef} onChange={handleImportFromExcel} className="hidden" accept=".xlsx,.xls" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-600 transition-all shadow-sm">
                <Upload size={14} /> Importar Excel
            </button>
            <button onClick={handleExportToExcel} className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
                <Download size={14} /> Backup Maestro
            </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Filtrar registros por código o descripción técnica..." className="w-full bg-white border border-slate-200 pl-11 pr-4 py-2.5 rounded-xl text-[11px] focus:outline-none focus:border-indigo-500 transition-all font-black text-slate-900 shadow-sm placeholder:text-slate-400" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="text-[9px] text-slate-900 font-black uppercase tracking-[0.2em] flex items-center gap-3">
                <CheckCircle2 size={14} className="text-green-600" /> Sincronización Industrial Activa
            </div>
        </div>
        <div className="max-h-[64vh] overflow-y-auto custom-scrollbar">
            {renderTable()}
        </div>
      </div>

      <style>{`
        .row-style { border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s; }
        .row-style:hover { background-color: #f1f5f9; }
        .cell-style { padding: 0.85rem 1.5rem; vertical-align: middle; font-size: 11px; color: #0f172a; }
        .input-technical { background-color: transparent; width: 100%; outline: none; border: none; font-size: 11px; font-weight: 800; color: #0f172a; }
        .btn-delete { color: #94a3b8; transition: color 0.2s; padding: 0.5rem; }
        .btn-delete:hover { color: #ef4444; }
      `}</style>
    </div>
  );
};

const TableWrapper: React.FC<{ headers: string[], children: React.ReactNode, onAdd: () => void }> = ({ headers, children, onAdd }) => (
  <div className="w-full overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-100 text-slate-900 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10 border-b border-slate-300">
        <tr>{headers.map((h, i) => <th key={i} className="px-6 py-4">{h}</th>)}</tr>
      </thead>
      <tbody>
        {children}
        <tr>
          <td colSpan={headers.length} className="p-6 bg-slate-50/20">
            <button onClick={onAdd} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-800 hover:text-indigo-700 hover:border-indigo-700 transition-all flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest bg-white/50 group">
              <Plus size={16} className="group-hover:scale-125 transition-transform" /> Insertar Registro Manual en Maestro
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default DatabaseCRUD;
