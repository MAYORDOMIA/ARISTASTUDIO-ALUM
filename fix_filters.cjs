const fs = require('fs');
let code = fs.readFileSync('src/components/SuperAdminDashboard.tsx', 'utf-8');

// Find the start of the filters div
const startStr = '<h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Filtros de Inyección</h3>';
const endStr = '<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">';

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `
<h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Filtros de Inyección</h3>
                    <div className="flex flex-wrap gap-4 mb-6">
                       <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                             <input type="checkbox" checked={selectedCategories.recetas} onChange={(e) => {
                                const isChecked = e.target.checked;
                                setSelectedCategories(p => ({...p, recetas: isChecked}));
                                if (isChecked && availableLines.length > 0) setShowLinesModal(true);
                             }} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                             Recetas
                          </label>
                          {selectedCategories.recetas && availableLines.length > 0 && (
                             <button onClick={() => setShowLinesModal(true)} className="text-[10px] text-sky-600 font-bold uppercase hover:underline">
                                (Seleccionadas: {selectedLines.length}/{availableLines.length}) Editar
                             </button>
                          )}
                       </div>
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={selectedCategories.perfiles} onChange={(e) => setSelectedCategories(p => ({...p, perfiles: e.target.checked}))} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                          Perfiles
                       </label>
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={selectedCategories.accesorios} onChange={(e) => setSelectedCategories(p => ({...p, accesorios: e.target.checked}))} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                          Accesorios
                       </label>
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={selectedCategories.vidrios} onChange={(e) => setSelectedCategories(p => ({...p, vidrios: e.target.checked}))} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                          Vidrios / Paneles
                       </label>
                    </div>
                 </div>
                 
                 `;
    const before = code.substring(0, startIdx);
    const after = code.substring(endIdx);
    code = before + replacement + after;
}

fs.writeFileSync('src/components/SuperAdminDashboard.tsx', code);
console.log('Fixed');
