const fs = require('fs');
let code = fs.readFileSync('src/components/SuperAdminDashboard.tsx', 'utf-8');

// 1. Add new icons
code = code.replace('Upload,', 'Upload,\n  UploadCloud,\n  Database,');

// 2. Add new states
const stateInsertionPoint = 'const fileInputRef = useRef<HTMLInputElement>(null);';
const newStates = `  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New states for Distribution tab
  const masterFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkData, setBulkData] = useState<any | null>(null);
  const [selectedCategories, setSelectedCategories] = useState({
    recetas: true,
    perfiles: true,
    accesorios: true,
    vidrios: true,
  });
  const [availableLines, setAvailableLines] = useState<string[]>([]);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);`;
code = code.replace(stateInsertionPoint, newStates);

// 3. Change activeTab type
code = code.replace(
  'const [activeTab, setActiveTab] = useState<"users" | "logs" | "announcements">("users");',
  'const [activeTab, setActiveTab] = useState<"users" | "logs" | "announcements" | "distribution">("users");'
);

// 4. Add the handler functions
const handlerInsertionPoint = 'const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {';
const newHandlers = `
  const handleMasterFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if (jsonData.perfiles && !jsonData.aluminum) jsonData.aluminum = jsonData.perfiles;
        if (jsonData.vidrios && !jsonData.glasses) jsonData.glasses = jsonData.vidrios;
        if (jsonData.accesorios && !jsonData.accessories) jsonData.accessories = jsonData.accesorios;
        if (jsonData.paneles && !jsonData.blindPanels) jsonData.blindPanels = jsonData.paneles;
        if (jsonData.dvh && !jsonData.dvhInputs) jsonData.dvhInputs = jsonData.dvh;

        setBulkData(jsonData);
        
        if (jsonData.recetas) {
          const lines = new Set<string>();
          jsonData.recetas.forEach((r: any) => {
            if (r.line) lines.add(r.line);
          });
          const uniqueLines = Array.from(lines);
          setAvailableLines(uniqueLines);
          setSelectedLines(uniqueLines);
        }
      } catch (err) {
         console.error("Error cargando JSON Maestro:", err);
         alert("Error al procesar el archivo maestro.");
      }
    };
    reader.readAsText(file);
  };

  const handleBulkInjection = async () => {
    if (!bulkData || selectedUsers.length === 0) return;
    if (!confirm(\`¿Estás seguro de que deseas inyectar estos datos a \${selectedUsers.length} usuarios? Esto sobreescribirá las categorías seleccionadas.\`)) return;

    setIsDeploying(true);
    const dataToInject: any = {};
    if (selectedCategories.perfiles) dataToInject.aluminum = bulkData.aluminum || [];
    if (selectedCategories.accesorios) dataToInject.accessories = bulkData.accessories || [];
    if (selectedCategories.vidrios) {
        dataToInject.glasses = bulkData.glasses || [];
        dataToInject.blindPanels = bulkData.blindPanels || [];
        dataToInject.dvhInputs = bulkData.dvhInputs || [];
    }
    if (selectedCategories.recetas) {
        dataToInject.recetas = (bulkData.recetas || []).filter((r: any) => selectedLines.includes(r.line));
    }

    try {
        let successCount = 0;
        for (const userId of selectedUsers) {
          const result = await saveBulkData(userId, dataToInject);
          if (result.success) successCount++;
        }
        alert(\`¡Inyección completada! Se actualizaron \${successCount} usuarios.\`);
        fetchProfiles();
    } catch (error: any) {
        alert("Error durante la inyección: " + error.message);
    } finally {
        setIsDeploying(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {`;
code = code.replace(handlerInsertionPoint, newHandlers);

// 5. Add the Distribution Tab Button
const tabsInsertionPoint = `<button
              onClick={() => setActiveTab("announcements")}`;
const newTab = `<button
              onClick={() => setActiveTab("distribution")}
              className={\`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors \${activeTab === "distribution" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}\`}
            >
              Distribución
            </button>
            <button
              onClick={() => setActiveTab("announcements")}`;
code = code.replace(tabsInsertionPoint, newTab);

// 6. Render the Distribution Tab UI
const renderInsertionPoint = '{activeTab === "users" ? (';
const newRender = `{activeTab === "distribution" ? (
          <div className="space-y-6">
             {!bulkData ? (
               <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                  <UploadCloud size={48} className="text-slate-400 mb-4" />
                  <p className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4">Cargar Archivo Maestro JSON</p>
                  <button onClick={() => masterFileInputRef.current?.click()} className="bg-sky-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-sky-700">Subir Archivo</button>
                  <input type="file" ref={masterFileInputRef} onChange={handleMasterFileUpload} accept=".json" className="hidden" />
               </div>
             ) : (
               <div className="space-y-6">
                 <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-emerald-800 uppercase tracking-widest">Archivo Maestro en Memoria</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        Contiene {bulkData.recetas?.length || 0} recetas, {bulkData.aluminum?.length || 0} perfiles, {bulkData.accessories?.length || 0} accesorios.
                      </p>
                    </div>
                    <button onClick={() => { setBulkData(null); setSelectedUsers([]); }} className="text-xs font-bold uppercase text-emerald-700 hover:text-emerald-900 px-3 py-1.5 bg-emerald-100 rounded-lg">Cambiar Archivo</button>
                 </div>

                 <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Filtros de Inyección</h3>
                    <div className="flex flex-wrap gap-4 mb-6">
                       <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={selectedCategories.recetas} onChange={(e) => setSelectedCategories(p => ({...p, recetas: e.target.checked}))} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                          Recetas
                       </label>
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

                    {selectedCategories.recetas && availableLines.length > 0 && (
                       <div className="border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-4 mb-3">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filtrar Recetas por Línea</h4>
                              <div className="flex gap-2">
                                 <button onClick={() => setSelectedLines(availableLines)} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200">Todas</button>
                                 <button onClick={() => setSelectedLines([])} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200">Ninguna</button>
                              </div>
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                             {availableLines.map(line => (
                                <label key={line} className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                   <input type="checkbox" checked={selectedLines.includes(line)} onChange={(e) => {
                                      if (e.target.checked) setSelectedLines(p => [...p, line]);
                                      else setSelectedLines(p => p.filter(l => l !== line));
                                   }} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                                   {line || 'Sin Línea'}
                                </label>
                             ))}
                          </div>
                       </div>
                    )}
                 </div>

                 <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                       <label className="flex items-center gap-3 text-sm font-bold text-slate-800 cursor-pointer">
                          <input type="checkbox" 
                                 checked={selectedUsers.length === profiles.length && profiles.length > 0} 
                                 onChange={(e) => {
                                    if (e.target.checked) setSelectedUsers(profiles.map(p => p.id));
                                    else setSelectedUsers([]);
                                 }} 
                                 className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                          Seleccionar Todos los Usuarios
                       </label>
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedUsers.length} Seleccionados</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                       {profiles.map(profile => (
                          <label key={profile.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                             <input type="checkbox" checked={selectedUsers.includes(profile.id)} onChange={(e) => {
                                 if (e.target.checked) setSelectedUsers(p => [...p, profile.id]);
                                 else setSelectedUsers(p => p.filter(id => id !== profile.id));
                             }} className="w-4 h-4 rounded text-sky-600 cursor-pointer" />
                             <div className="flex-1">
                                <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                  {profile.email}
                                  {profile.role === 'super_admin' && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Admin</span>}
                                </div>
                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider mt-0.5">
                                   {profile.recipes_count || 0} RECETAS | {profile.registered_count || 0} DISPOSITIVOS
                                </div>
                             </div>
                          </label>
                       ))}
                    </div>
                 </div>

                 <div className="flex justify-end pt-2">
                    <button
                       onClick={handleBulkInjection}
                       disabled={isDeploying || selectedUsers.length === 0}
                       className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black uppercase text-xs tracking-widest px-8 py-4 rounded-xl transition-colors flex items-center gap-3 shadow-lg hover:shadow-xl"
                    >
                       {isDeploying ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                       Inyectar Datos a {selectedUsers.length} Usuarios
                    </button>
                 </div>
               </div>
             )}
          </div>
        ) : activeTab === "users" ? (`;
code = code.replace(renderInsertionPoint, newRender);

fs.writeFileSync('src/components/SuperAdminDashboard.tsx', code);
console.log('Patched');
