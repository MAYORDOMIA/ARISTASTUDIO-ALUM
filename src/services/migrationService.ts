import { supabase } from './supabaseClient';

/**
 * SERVICIO DE MIGRACIÓN DEFINITIVO
 * Procesa JSONs y sube/actualiza a Supabase con control de usuario.
 */

// Guardar datos masivos para el usuario activo
export const saveBulkData = async (userId: string, data: any) => {
  const { aluminum, glasses, accessories, recipes } = data;
  
  // Helper para preparar datos con user_id
  const prepare = (list: any[]) => {
    if (!list || !Array.isArray(list)) return [];
    return list.map(item => ({
      user_id: userId,
      master_ref: item.id,
      code: item.code || item.name || '',
      detail: item.detail || ''
    }));
  };

  const ops = [];

  // Mapeos a las tablas que definimos en SQL
  if (aluminum) 
    ops.push(supabase.from('materiales_perfiles_usuario').upsert(prepare(aluminum), { onConflict: 'user_id,master_ref' }));
  
  if (glasses) 
    ops.push(supabase.from('materiales_vidrios_usuario').upsert(prepare(glasses), { onConflict: 'user_id,master_ref' }));
  
  if (accessories) 
    ops.push(supabase.from('materiales_accesorios_usuario').upsert(prepare(accessories), { onConflict: 'user_id,master_ref' }));
  
  if (recipes) {
    const recetasFormateadas = recipes.map((r: any) => ({
      user_id: userId,
      master_ref: r.id,
      name: r.name || 'Sin nombre'
    }));
    ops.push(supabase.from('recetas_usuario').upsert(recetasFormateadas, { onConflict: 'user_id,master_ref' }));
  }

  const results = await Promise.all(ops);
  const errors = results.filter(r => r.error).map(r => r.error?.message || 'Error desconocido');
  
  return { success: errors.length === 0, errors };
};

// Limpiar datos del usuario
export const wipeUserInventory = async (userId: string) => {
  const tables = ['materiales_perfiles_usuario', 'materiales_vidrios_usuario', 'materiales_accesorios_usuario', 'recetas_usuario'];
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

      const newItems = masters.filter(m => !existingRefs.has(m.id)).map(m => {
        if (t.master === 'maestro_recetas') {
            return {
                user_id: userId,
                master_ref: m.id,
                name: m.name || 'Sin nombre'
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
