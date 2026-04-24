import { supabase } from './supabaseClient';

/**
 * Servicio de Base de Datos (V5)
 * Adaptado estrictamente al schema final y requerimientos de columnas exactas.
 */

// Helper: Verificar si el usuario es admin
const checkIfAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('configuracion_admin')
    .select('email')
    .eq('email', (await supabase.auth.getUser()).data.user?.email);
  return !!data && data.length > 0;
};

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

// Guardar datos masivos
export const saveBulkData = async (userId: string, data: any) => {
  const isAdmin = await checkIfAdmin(userId);
  const { aluminum, glasses, accessories, recipes, treatments, blindPanels, dvhInputs } = data;
  
  const prepare = (list: any[], tableType: 'master'|'user', mapper: (x: any) => any) => {
    if (!list || !Array.isArray(list)) return [];
    return list.map(item => {
        const mapped = mapper(item);
        return tableType === 'user' ? { 
            ...mapped, 
            user_id: userId, 
            master_ref: item.id 
        } : mapped;
    });
  };

  const ops = [];

  // Mapear materiales a las columnas de la tabla de usuario
  const mapMaterialUser = (x: any, table: string) => {
      const common = { code: x.code || '', detail: x.detail || '' };
      if (table === 'perfiles') return { ...common, weight_per_meter: x.weightPerMeter || 0, bar_length: x.barLength || 6000, is_glazing_bead: !!x.isGlazingBead, treatment_cost: 0 };
      if (table === 'vidrios') return { ...common, price_per_m2: x.pricePerM2 || 0 };
      if (table === 'accesorios') return { ...common, unit_price: x.unitPrice || 0 };
      return common;
  };

  if (aluminum) {
      if (isAdmin) ops.push(supabase.from('maestro_perfiles').upsert(prepare(aluminum, 'master', x => x), { onConflict: 'id' }));
      else ops.push(supabase.from('materiales_perfiles_usuario').upsert(prepare(aluminum, 'user', x => mapMaterialUser(x, 'perfiles')), { onConflict: 'user_id,master_ref' }));
  }

  if (glasses) {
      if (isAdmin) ops.push(supabase.from('maestro_vidrios').upsert(prepare(glasses, 'master', x => x), { onConflict: 'id' }));
      else ops.push(supabase.from('materiales_vidrios_usuario').upsert(prepare(glasses, 'user', x => mapMaterialUser(x, 'vidrios')), { onConflict: 'user_id,master_ref' }));
  }

  if (accessories) {
      if (isAdmin) ops.push(supabase.from('maestro_accesorios').upsert(prepare(accessories, 'master', x => x), { onConflict: 'id' }));
      else ops.push(supabase.from('materiales_accesorios_usuario').upsert(prepare(accessories, 'user', x => mapMaterialUser(x, 'accesorios')), { onConflict: 'user_id,master_ref' }));
  }

  if (recipes) {
      const mapRecipeUser = (x: any) => ({
          name: x.name || 'Sin Nombre',
          data: x // JSONB
      });
      if (isAdmin) ops.push(supabase.from('maestro_recetas').upsert(prepare(recipes, 'master', x => ({id: x.id, name: x.name, data: x})), { onConflict: 'id' }));
      else ops.push(supabase.from('recetas_usuario').upsert(prepare(recipes, 'user', mapRecipeUser), { onConflict: 'user_id,master_ref' }));
  }

  const results = await Promise.all(ops);
  const errors = results.filter(r => r.error).map(r => r.error?.message || 'Error desconocido');
  
  return { success: errors.length === 0, errors };
};

// Traer actualizaciones desde las tablas maestras al usuario
export const pullUpdatesFromMaster = async (userId: string) => {
  const masterTables = [
    { master: 'maestro_perfiles', user: 'materiales_perfiles_usuario' },
    { master: 'maestro_vidrios', user: 'materiales_vidrios_usuario' },
    { master: 'maestro_accesorios', user: 'materiales_accesorios_usuario' },
    { master: 'maestro_recetas', user: 'recetas_usuario' }
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

      const newItems = masters.filter(m => !existingRefs.has(m.id)).map(m => ({
        ...m,
        user_id: userId,
        master_ref: m.id
      }));

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
