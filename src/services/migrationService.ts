import { supabase } from './supabaseClient';

/**
 * SERVICIO DE MIGRACIÓN DEFINITIVO
 * Procesa JSONs y sube/actualiza a Supabase con control de usuario.
 */

// Guardar datos masivos para el usuario activo
export const saveBulkData = async (userId: string, data: any) => {
  const { aluminum, glasses, accessories, recipes, treatments, blindPanels, dvhInputs, quotes, config } = data;
  
  // Helper para preparar datos con user_id
  const prepare = (list: any[]) => {
    if (!list || !Array.isArray(list)) return [];
    return list.map(item => ({
      user_id: userId,
      master_ref: item.id,
      code: item.code || item.type || item.name || '',
      detail: item.detail || ''
    }));
  };

  const ops = [];

  // Mapeos a las tablas que definimos en SQL
  if (aluminum) {
    const arr = aluminum.map((a: any) => ({
      user_id: userId,
      master_ref: a.id,
      code: a.code || '',
      detail: a.detail || '',
      weight_per_meter: a.weightPerMeter !== undefined ? a.weightPerMeter : (a.weight_per_meter || 0),
      bar_length: a.barLength !== undefined ? a.barLength : (a.bar_length || 6000),
      thickness: a.thickness !== undefined ? a.thickness : (a.thickness || 0),
      is_glazing_bead: a.isGlazingBead !== undefined ? a.isGlazingBead : (a.is_glazing_bead || false),
      glazing_bead_style: a.glazingBeadStyle || a.glazing_bead_style || 'Recto',
      min_glass_thickness: a.minGlassThickness !== undefined ? a.minGlassThickness : (a.min_glass_thickness || 0),
      max_glass_thickness: a.maxGlassThickness !== undefined ? a.maxGlassThickness : (a.max_glass_thickness || 0),
      treatment_cost: a.treatmentCost !== undefined ? a.treatmentCost : (a.treatment_cost || 0)
    }));
    ops.push(supabase.from('materiales_perfiles_usuario').upsert(arr, { onConflict: 'user_id,master_ref' }));
  }
  
  if (glasses) {
    const arr = glasses.map((g: any) => ({
      user_id: userId,
      master_ref: g.id,
      code: g.code || g.name || '',
      detail: g.detail || '',
      thickness: g.thickness || 0,
      is_mirror: g.is_mirror || g.isMirror || false,
      price_per_m2: g.price_per_m2 || g.pricePerM2 || 0
    }));
    ops.push(supabase.from('materiales_vidrios_usuario').upsert(arr, { onConflict: 'user_id,master_ref' }));
  }
  
  if (accessories) {
    const arr = accessories.map((a: any) => ({
      user_id: userId,
      master_ref: a.id,
      code: a.code || '',
      detail: a.detail || '',
      unit_price: a.unit_price || a.unitPrice || 0
    }));
    ops.push(supabase.from('materiales_accesorios_usuario').upsert(arr, { onConflict: 'user_id,master_ref' }));
  }
    
  if (treatments) {
    const arr = treatments.map((t: any) => ({
      user_id: userId,
      master_ref: t.id,
      name: t.name || 'Sin nombre',
      price_per_kg: t.pricePerKg || 0,
      hex_color: t.hexColor || ''
    }));
    ops.push(supabase.from('tratamientos_usuario').upsert(arr, { onConflict: 'user_id,master_ref' }));
  }

  if (blindPanels) {
    const arr = blindPanels.map((p: any) => ({
      user_id: userId,
      master_ref: p.id,
      code: p.code || '',
      detail: p.detail || '',
      price: p.price || 0,
      unit: p.unit || 'm2'
    }));
    ops.push(supabase.from('paneles_usuario').upsert(arr, { onConflict: 'user_id,master_ref' }));
  }

  if (dvhInputs) {
    const arr = dvhInputs.map((d: any) => ({
      user_id: userId,
      master_ref: d.id,
      type: d.type || 'Cámara',
      detail: d.detail || '',
      cost: d.cost || 0,
      thickness: d.thickness || 0
    }));
    ops.push(supabase.from('dvh_usuario').upsert(arr, { onConflict: 'user_id,master_ref' }));
  }
  
  if (recipes) {
    const recetasFormateadas = recipes.map((r: any) => ({
      user_id: userId,
      master_ref: r.id,
      name: r.name || 'Sin nombre',
      data: r
    }));
    ops.push(supabase.from('recetas_usuario').upsert(recetasFormateadas, { onConflict: 'user_id,master_ref' }));
  }

  if (quotes && quotes.length > 0) {
    const preArr = quotes.map((q: any) => ({
      user_id: userId,
      numero_presupuesto: q.number || 0,
      cliente_nombre: q.clientName || '',
      cliente_email: q.clientEmail || '',
      total: q.total || 0,
      items: q.items || [],
      estado: q.status || 'borrador',
      created_at: q.date || new Date().toISOString()
    }));
    // We cannot easily upsert quotes on a random ID without a master_ref map, so quotes usually are managed separately, 
    // but for initial sync from JSON, doing a simple insert is a risk of duplication if ran multiple times.
    // For now we'll do an insert ONLY if this is an explicit migration.
    // Real App: quotes are handled one by one in QuotesHistory.tsx
    // oops.push(supabase.from('presupuestos').insert(preArr));
  }

  if (config) {
    ops.push(supabase.from('configuracion_usuario').upsert([{ user_id: userId, config_data: config }], { onConflict: 'user_id' }));
  }

  const results = await Promise.all(ops);
  const errors = results.filter(r => r.error).map(r => r.error?.message || 'Error desconocido');
  
  return { success: errors.length === 0, errors };
};

// Limpiar datos del usuario
export const wipeUserInventory = async (userId: string) => {
  const tables = [
    'materiales_perfiles_usuario', 
    'materiales_vidrios_usuario', 
    'materiales_accesorios_usuario', 
    'recetas_usuario',
    'tratamientos_usuario',
    'paneles_usuario',
    'dvh_usuario'
  ];
  const results = await Promise.all(tables.map(table => supabase.from(table).delete().eq('user_id', userId)));
  const errors = results.filter(r => r.error).map(r => r.error?.message || 'Error desconocido');
  return { success: errors.length === 0, errors };
};

// Traer actualizaciones desde las tablas maestras al usuario
export const pullUpdatesFromMaster = async (userId: string) => {
  const masterTables = [
    { master: 'maestro_perfiles', user: 'materiales_perfiles_usuario' },
    { master: 'maestro_vidrios', user: 'materiales_vidrios_usuario' },
    { master: 'maestro_accesorios', user: 'materiales_accesorios_usuario' },
    { master: 'maestro_recetas', user: 'recetas_usuario' },
    { master: 'maestro_tratamientos', user: 'tratamientos_usuario' },
    { master: 'maestro_paneles', user: 'paneles_usuario' },
    { master: 'maestro_dvh', user: 'dvh_usuario' }
  ];

  let addedCount = 0;
  const errors: string[] = [];

  for (const t of masterTables) {
    const { data: masters, error: fetchErr } = await supabase.from(t.master).select('*');
    if (fetchErr) {
      errors.push(fetchErr.message);
      continue;
    }

    if (masters && masters.length > 0) {
      const { data: existingUserItems } = await supabase.from(t.user).select('master_ref').eq('user_id', userId);
      const existingRefs = new Set((existingUserItems || []).map(ei => ei.master_ref));

      const newItems = masters.filter(m => !existingRefs.has(m.id)).map(m => {
        if (t.master === 'maestro_recetas') {
            return {
                user_id: userId,
                master_ref: m.id,
                name: m.name || 'Sin nombre',
                data: m.data || {}
            };
        }
        if (t.master === 'maestro_tratamientos') {
            return {
                user_id: userId,
                master_ref: m.id,
                name: m.name || 'Sin nombre',
                price_per_kg: m.price_per_kg || 0,
                hex_color: m.hex_color || ''
            };
        }
        if (t.master === 'maestro_paneles') {
            return {
                user_id: userId,
                master_ref: m.id,
                code: m.code || '',
                detail: m.detail || '',
                price: m.price || 0,
                unit: m.unit || 'm2'
            };
        }
        if (t.master === 'maestro_dvh') {
            return {
                user_id: userId,
                master_ref: m.id,
                type: m.type || 'Cámara',
                detail: m.detail || '',
                cost: m.cost || 0,
                thickness: m.thickness || 0
            };
        }
        if (t.master === 'maestro_perfiles') {
            return {
                user_id: userId,
                master_ref: m.id,
                code: m.code || '',
                detail: m.detail || '',
                weight_per_meter: m.weight_per_meter || 0,
                bar_length: m.bar_length || 6000,
                thickness: m.thickness || 0,
                is_glazing_bead: m.is_glazing_bead || false,
                glazing_bead_style: m.glazing_bead_style || 'Recto',
                min_glass_thickness: m.min_glass_thickness || 0,
                max_glass_thickness: m.max_glass_thickness || 0,
                treatment_cost: m.treatment_cost || 0
            };
        }
        if (t.master === 'maestro_vidrios') {
            return {
                user_id: userId,
                master_ref: m.id,
                code: m.code || '',
                detail: m.detail || '',
                thickness: m.thickness || 0,
                is_mirror: m.is_mirror || false,
                price_per_m2: m.price_per_m2 || 0
            };
        }
        if (t.master === 'maestro_accesorios') {
            return {
                user_id: userId,
                master_ref: m.id,
                code: m.code || '',
                detail: m.detail || '',
                unit_price: m.unit_price || 0
            };
        }
        return {
          user_id: userId,
          master_ref: m.id,
          code: m.code || m.name || '',
          detail: m.detail || ''
        };
      });

      if (newItems.length > 0) {
        const { error: upsertErr } = await supabase.from(t.user).upsert(newItems, { onConflict: 'user_id,master_ref' });
        if (upsertErr) {
          errors.push(upsertErr.message);
        } else {
          addedCount += newItems.length;
        }
      }
    }
  }

  return { success: errors.length === 0, added: addedCount, errors };
};
