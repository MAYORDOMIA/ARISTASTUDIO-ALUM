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

  // Mapear materiales a: code, detail, type, technical_specs (JSONB)
  const mapMaterial = (x: any, type: string) => ({
      code: x.code || '',
      detail: x.detail || '',
      type: type,
      technical_specs: x // JSONB con todos los campos originales
  });

  if (aluminum) {
      if (isAdmin) ops.push(supabase.from('maestro_perfiles').upsert(prepare(aluminum, 'master', x => mapMaterial(x, 'perfil')), { onConflict: 'id' }));
      else ops.push(supabase.from('materiales_perfiles_usuario').upsert(prepare(aluminum, 'user', x => mapMaterial(x, 'perfil')), { onConflict: 'user_id,master_ref' }));
  }

  if (glasses) {
      if (isAdmin) ops.push(supabase.from('maestro_vidrios').upsert(prepare(glasses, 'master', x => mapMaterial(x, 'vidrio')), { onConflict: 'id' }));
      else ops.push(supabase.from('materiales_vidrios_usuario').upsert(prepare(glasses, 'user', x => mapMaterial(x, 'vidrio')), { onConflict: 'user_id,master_ref' }));
  }

  if (accessories) {
      if (isAdmin) ops.push(supabase.from('maestro_accesorios').upsert(prepare(accessories, 'master', x => mapMaterial(x, 'accesorio')), { onConflict: 'id' }));
      else ops.push(supabase.from('materiales_accesorios_usuario').upsert(prepare(accessories, 'user', x => mapMaterial(x, 'accesorio')), { onConflict: 'user_id,master_ref' }));
  }

  if (recipes) {
      const mapRecipe = (x: any) => ({
          name: x.name || 'Sin Nombre',
          config: x // JSONB
      });
      if (isAdmin) ops.push(supabase.from('maestro_recetas').upsert(prepare(recipes, 'master', mapRecipe), { onConflict: 'id' }));
      else ops.push(supabase.from('recetas_usuario').upsert(prepare(recipes, 'user', mapRecipe), { onConflict: 'user_id,master_ref' }));
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
