const fs = require('fs');
let code = fs.readFileSync('src/components/SuperAdminDashboard.tsx', 'utf-8');

// 1. Add showLinesModal state
code = code.replace(
  'const [isDeploying, setIsDeploying] = useState(false);',
  'const [isDeploying, setIsDeploying] = useState(false);\n  const [showLinesModal, setShowLinesModal] = useState(false);'
);

// 2. Change the Recetas checkbox section (Lines 492-531 roughly)
const oldCheckboxUI = `                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={selectedCategories.recetas} onChange={(e) => setSelectedCategories(p => ({...p, recetas: e.target.checked}))} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                          Recetas
                       </label>`;

const newCheckboxUI = `                       <div className="flex items-center gap-3">
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
                       </div>`;
code = code.replace(oldCheckboxUI, newCheckboxUI);

// 3. Remove inline UI
const inlineUIStart = '{selectedCategories.recetas && availableLines.length > 0 && (';
const inlineUIEndStr = ')}';
const fullCodeStr = code;
const startIdx = fullCodeStr.indexOf(inlineUIStart);

if (startIdx !== -1) {
    // Find where the block ends. It's inside <div className="bg-white border border-slate-200 p-5 rounded-2xl">
    // Looking at the view_file, it ends right before `                 </div>\n\n                 <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">`
    const nextDivIdx = fullCodeStr.indexOf('<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">', startIdx);
    if (nextDivIdx !== -1) {
        // extract the block to remove
        const blockToRemove = fullCodeStr.substring(startIdx, nextDivIdx - 19); // roughly up to the closing div
        code = code.replace(blockToRemove, '');
    }
}

// 4. Add the modal at the bottom before passwordResetUserId
const modalUI = `
      {showLinesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-tighter">
                Seleccionar Líneas de Recetas
              </h3>
              <button onClick={() => setShowLinesModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
                 <button onClick={() => setSelectedLines(availableLines)} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors">Seleccionar Todas</button>
                 <button onClick={() => setSelectedLines([])} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors">Ninguna</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-4 bg-slate-50 min-h-[200px]">
                 {availableLines.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-8">No se encontraron líneas en el archivo.</div>
                 ) : (
                    availableLines.map(line => (
                        <label key={line} className="flex items-center gap-3 p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl cursor-pointer transition-all shadow-sm">
                           <input type="checkbox" checked={selectedLines.includes(line)} onChange={(e) => {
                              if (e.target.checked) setSelectedLines(p => [...p, line]);
                              else setSelectedLines(p => p.filter(l => l !== line));
                           }} className="w-5 h-5 rounded text-sky-600 cursor-pointer" />
                           <span className="text-sm font-bold text-slate-700">{line || 'Sin Línea'}</span>
                        </label>
                    ))
                 )}
            </div>
            <div className="mt-6 flex justify-end">
               <button onClick={() => setShowLinesModal(false)} className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-black uppercase text-[10px] tracking-widest py-4 px-8 rounded-xl transition-colors shadow-lg hover:shadow-xl">
                  Confirmar Selección ({selectedLines.length})
               </button>
            </div>
          </div>
        </div>
      )}
      {passwordResetUserId && (`;
code = code.replace('{passwordResetUserId && (', modalUI);

fs.writeFileSync('src/components/SuperAdminDashboard.tsx', code);
console.log('Patched');
