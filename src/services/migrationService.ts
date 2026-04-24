import { supabase } from './supabaseClient';

/**
 * Servicio de Base de Datos (V4)
 * Adaptado estrictamente al schema final.
 */

// Función para limpiar absolutamente todo el inventario del usuario actual
export const wipeUserInventory = async (userId: string) => {
  const tables = [
    'materiales_perfiles_usuario',
    'materiales_vidrios_usuario',
    'materiales_accesorios_usuario',
    'recetas_usuario',
    'tratamientos_usuario',
    'paneles_usuario',
    'dvh_usuario',
    'presupuestos'
  ];

  const results = await Promise.all(
    tables.map(table => supabase.from(table).delete().eq('user_id', userId))
  );

  const errors = results.filter(r => r.error).map(r => r.error?.message || 'Error desconocido');
  return { success: errors.length === 0, errors };
};

// Guardar datos masivos (adaptado al schema)
export const saveBulkData = async (userId: string, data: any) => {
  const { aluminum, glasses, accessories, recipes, treatments, blindPanels, dvhInputs } = data;
  
  const prepare = (list: any[], mapper: (x: any) => any) => {
    if (!list || !Array.isArray(list)) return [];
    return list.map(item => ({
      ...mapper(item),
      user_id: userId,
      master_ref: item.id
    }));
  };

  const ops = [];

  if (aluminum) ops.push(supabase.from('materiales_perfiles_usuario').upsert(prepare(aluminum, x => ({
    code: x.code || '', 
    detail: x.detail || '', 
    weight_per_meter: x.weightPerMeter || 0, 
    bar_length: x.barLength || 6000,
    is_glazing_bead: !!x.isGlazingBead, 
    treatment_cost: x.treatmentCost || 0
  })), { onConflict: 'user_id,master_ref' }));

  if (glasses) ops.push(supabase.from('materiales_vidrios_usuario').upsert(prepare(glasses, x => ({
    code: x.code || '', 
    detail: x.detail || '', 
    price_per_m2: x.pricePerM2 || 0
  })), { onConflict: 'user_id,master_ref' }));

  if (accessories) ops.push(supabase.from('materiales_accesorios_usuario').upsert(prepare(accessories, x => ({
    code: x.code || '', 
    detail: x.detail || '', 
    unit_price: x.unitPrice || 0
  })), { onConflict: 'user_id,master_ref' }));

  if (recipes) ops.push(supabase.from('recetas_usuario').upsert(prepare(recipes, x => ({
    name: x.name || 'Sin Nombre',
    data: x
  })), { onConflict: 'user_id,master_ref' }));

  if (treatments) ops.push(supabase.from('tratamientos_usuario').upsert(prepare(treatments, x => ({
    name: x.name || '', 
    price_per_kg: x.pricePerKg || 0, 
    hex_color: x.hexColor || '#000000'
  })), { onConflict: 'user_id,master_ref' }));

  if (blindPanels) ops.push(supabase.from('paneles_usuario').upsert(prepare(blindPanels, x => ({
    code: x.code || '', 
    detail: x.detail || '', 
    price: x.price || 0, 
    unit: x.unit || 'm2'
  })), { onConflict: 'user_id,master_ref' }));

  if (dvhInputs) ops.push(supabase.from('dvh_usuario').upsert(prepare(dvhInputs, x => ({
    type: x.type || 'Cámara', 
    detail: x.detail || '', 
    cost: x.cost || 0,
    thickness: x.thickness || 0
  })), { onConflict: 'user_id,master_ref' }));

  const results = await Promise.all(ops);
  const errors = results.filter(r => r.error).map(r => r.error?.message || 'Error desconocido');
  
  return { success: errors.length === 0, errors };
};

// Traer actualizaciones desde las tablas maestras al usuario
export const pullUpdatesFromMaster = async (userId: string) => {
  const masterTables = [
    { master: 'maestro_perfiles', user: 'materiales_perfiles_usuario', map: (x: any) => ({ master_ref: x.id, code: x.code, detail: x.detail, weight_per_meter: x.weight_per_meter || 0, bar_length: x.bar_length || 6000, is_glazing_bead: x.is_glazing_bead || false, treatment_cost: 0 }) },
    { master: 'maestro_vidrios', user: 'materiales_vidrios_usuario', map: (x: any) => ({ master_ref: x.id, code: x.code, detail: x.detail, price_per_m2: x.price_per_m2 || 0 }) },
    { master: 'maestro_accesorios', user: 'materiales_accesorios_usuario', map: (x: any) => ({ master_ref: x.id, code: x.code, detail: x.detail, unit_price: x.unit_price || 0 }) },
    { master: 'maestro_recetas', user: 'recetas_usuario', map: (x: any) => ({ master_ref: x.id, name: x.name, data: x.data }) },
    { master: 'maestro_tratamientos', user: 'tratamientos_usuario', map: (x: any) => ({ master_ref: x.id, name: x.name, price_per_kg: x.price_per_kg || 0, hex_color: x.hex_color || '#000000' }) },
    { master: 'maestro_paneles', user: 'paneles_usuario', map: (x: any) => ({ master_ref: x.id, code: x.code, detail: x.detail, price: x.price || 0, unit: x.unit || 'm2' }) },
    { master: 'maestro_dvh', user: 'dvh_usuario', map: (x: any) => ({ master_ref: x.id, type: x.type, detail: x.detail, cost: x.cost || 0, thickness: x.thickness || 0 }) }
  ];

  let addedCount = 0;
  const errors: string[] = [];

  for (const t of masterTables) {
    console.log(`Pulling from ${t.master}...`);
    const { data: masters, error: fetchErr } = await supabase.from(t.master).select('*');
    if (fetchErr) {
      console.error(`Error fetching ${t.master}:`, fetchErr);
      errors.push(fetchErr.message);
      continue;
    }

    if (masters && masters.length > 0) {
      const { data: existingUserItems } = await supabase.from(t.user).select('master_ref').eq('user_id', userId);
      const existingRefs = new Set((existingUserItems || []).map(ei => ei.master_ref));

      const newItems = masters.filter(m => !existingRefs.has(m.id)).map(m => ({
        ...t.map(m),
        user_id: userId
      }));

      if (newItems.length > 0) {
        console.log(`Adding ${newItems.length} items to ${t.user}`);
        const { error: upsertErr } = await supabase.from(t.user).upsert(newItems, { onConflict: 'user_id,master_ref' });
        if (upsertErr) {
          console.error(`Error upserting ${t.user}:`, upsertErr);
          errors.push(upsertErr.message);
        } else {
          addedCount += newItems.length;
        }
      } else {
        console.log(`${t.user} already up to date.`);
      }
    } else {
      console.log(`No items found in master table ${t.master}`);
    }
  }

  return { success: errors.length === 0, added: addedCount, errors };
};

// Función para guardar datos maestros (Solo Admin)
export const saveMasterData = async (data: any) => {
  const { aluminum, glasses, accessories, recipes, treatments, blindPanels, dvhInputs } = data;
  
  const ops = [];

  if (aluminum) ops.push(supabase.from('maestro_perfiles').upsert(aluminum.map((x: any) => ({
    id: x.id,
    code: x.code || 'SIN_COD',
    detail: x.detail || '',
    weight_per_meter: x.weightPerMeter || 0,
    bar_length: x.barLength || 6000,
    is_glazing_bead: !!x.isGlazingBead,
    min_glass_thickness: x.minGlassThickness || 0,
    max_glass_thickness: x.maxGlassThickness || 0
  })), { onConflict: 'id' }));

  if (glasses) ops.push(supabase.from('maestro_vidrios').upsert(glasses.map((x: any) => ({
    id: x.id,
    code: x.code || 'SIN_COD',
    detail: x.detail || '',
    thickness: x.thickness || 0,
    price_per_m2: x.pricePerM2 || 0,
    is_mirror: !!x.isMirror
  })), { onConflict: 'id' }));

  if (accessories) ops.push(supabase.from('maestro_accesorios').upsert(accessories.map((x: any) => ({
    id: x.id,
    code: x.code || 'SIN_COD',
    detail: x.detail || '',
    unit_price: x.unitPrice || 0
  })), { onConflict: 'id' }));

  if (recipes) ops.push(supabase.from('maestro_recetas').upsert(recipes.map((x: any) => ({
    id: x.id,
    name: x.name || 'Sin Nombre',
    data: x
  })), { onConflict: 'id' }));

  if (treatments) ops.push(supabase.from('maestro_tratamientos').upsert(treatments.map((x: any) => ({
    id: x.id,
    name: x.name || '',
    price_per_kg: x.pricePerKg || 0,
    hex_color: x.hexColor || '#000000'
  })), { onConflict: 'id' }));

  if (blindPanels) ops.push(supabase.from('maestro_paneles').upsert(blindPanels.map((x: any) => ({
    id: x.id,
    code: x.code || 'SIN_COD',
    detail: x.detail || '',
    price: x.price || 0,
    unit: x.unit || 'm2'
  })), { onConflict: 'id' }));

  if (dvhInputs) ops.push(supabase.from('maestro_dvh').upsert(dvhInputs.map((x: any) => ({
    id: x.id,
    type: x.type || 'Cámara',
    detail: x.detail || '',
    cost: x.cost || 0,
    thickness: x.thickness || 0
  })), { onConflict: 'id' }));

  const results = await Promise.all(ops);
  const errors = results.filter(r => r.error).map(r => r.error?.message || 'Error desconocido');
  
  return { success: errors.length === 0, errors };
};
