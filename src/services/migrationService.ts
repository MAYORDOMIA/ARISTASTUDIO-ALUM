import { supabase } from './supabaseClient';

export const migrateAppDataToTables = async (userId: string, appData: any) => {
  console.log("Iniciando migración de datos a tablas relacionales...");
  const errors: string[] = [];

  try {
    // 1. Aluminio
    if (appData.aluminum && Array.isArray(appData.aluminum)) {
      console.log("Migrando aluminio...");
      // REMOVED delete to prevent wiping data
      const toInsert = appData.aluminum.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        code: item.code,
        detail: item.detail,
        weight_per_meter: item.weightPerMeter,
        bar_length: item.barLength,
        thickness: item.thickness,
        treatment_cost: item.treatmentCost,
        is_glazing_bead: item.isGlazingBead,
        glazing_bead_style: item.glazingBeadStyle,
        min_glass_thickness: item.minGlassThickness,
        max_glass_thickness: item.maxGlassThickness
      }));
      if (toInsert.length > 0) {
        const { error: insError } = await supabase.from('aluminum_inventory').upsert(toInsert, { onConflict: 'id' });
        if (insError) errors.push(`Error insertando aluminio: ${insError.message}`);
      }
      console.log("Aluminio migrado.");
    }

    // 2. Vidrios
    if (appData.glasses && Array.isArray(appData.glasses)) {
      console.log("Migrando vidrios...");
      const toInsert = appData.glasses.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        code: item.code,
        detail: item.detail,
        width: item.width,
        height: item.height,
        thickness: item.thickness,
        price_per_m2: item.pricePerM2,
        is_mirror: item.isMirror
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('glass_inventory').upsert(toInsert, { onConflict: 'id' });
        if (error) errors.push(`Error insertando vidrios: ${error.message}`);
      }
      console.log("Vidrios migrados.");
    }

    // 3. Accesorios
    if (appData.accessories && Array.isArray(appData.accessories)) {
      console.log("Migrando accesorios...");
      const toInsert = appData.accessories.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        code: item.code,
        detail: item.detail,
        unit_price: item.unitPrice
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('accessory_inventory').upsert(toInsert, { onConflict: 'id' });
        if (error) errors.push(`Error insertando accesorios: ${error.message}`);
      }
      console.log("Accesorios migrados.");
    }

    // 4. DVH
    if (appData.dvhInputs && Array.isArray(appData.dvhInputs)) {
      console.log("Migrando DVH...");
      const toInsert = appData.dvhInputs.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        type: item.type,
        detail: item.detail,
        thickness: item.thickness,
        cost: item.cost
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('dvh_inventory').upsert(toInsert, { onConflict: 'id' });
        if (error) errors.push(`Error insertando DVH: ${error.message}`);
      }
      console.log("DVH migrado.");
    }

    // 5. Tratamientos
    if (appData.treatments && Array.isArray(appData.treatments)) {
      console.log("Migrando tratamientos...");
      const toInsert = appData.treatments.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        name: item.name,
        price_per_kg: item.pricePerKg,
        hex_color: item.hexColor
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('treatment_inventory').upsert(toInsert, { onConflict: 'id' });
        if (error) errors.push(`Error insertando tratamientos: ${error.message}`);
      }
      console.log("Tratamientos migrados.");
    }

    // 6. Paneles
    if (appData.blindPanels && Array.isArray(appData.blindPanels)) {
      console.log("Migrando paneles...");
      const toInsert = appData.blindPanels.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        code: item.code,
        detail: item.detail,
        price: item.price,
        unit: item.unit
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('panel_inventory').upsert(toInsert, { onConflict: 'id' });
        if (error) errors.push(`Error insertando paneles: ${error.message}`);
      }
      console.log("Paneles migrados.");
    }

    // 7. Recetas
    if (appData.recipes && Array.isArray(appData.recipes)) {
      console.log("Migrando recetas...");
      const toInsert = appData.recipes.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        name: item.name,
        data: item
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('recipes').upsert(toInsert, { onConflict: 'id' });
        if (error) errors.push(`Error insertando recetas: ${error.message}`);
      }
      console.log("Recetas migradas.");
    }

    // 8. Quotes
    if (appData.quotes && Array.isArray(appData.quotes)) {
      console.log("Migrando presupuestos...");
      const toInsert = appData.quotes.map((item: any) => ({
        id: String(item.id).includes(`_${userId}`) ? item.id : `${item.id}_${userId}`,
        user_id: userId,
        customer_name: item.customerName,
        data: item
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('quotes').upsert(toInsert, { onConflict: 'id' });
        if (error) errors.push(`Error insertando presupuestos: ${error.message}`);
      }
      console.log("Presupuestos migrados.");
    }

    if (errors.length === 0) {
      // 9. Marcar el perfil como migrado
      const { error: profError } = await supabase.from('profiles').update({ is_migrated: true }).eq('id', userId);
      if (profError) errors.push(`Error marcando perfil como migrado: ${profError?.message || JSON.stringify(profError)}`);
      
      if (errors.length === 0) {
        console.log("Migración completada exitosamente.");
        return { success: true };
      }
    }
    
    console.error("Migración con errores:", errors);
    return { success: false, errors };

  } catch (e: any) {
    console.error("Fallo crítico en migración:", e.message);
    return { success: false, errors: [e.message] };
  }
};

/**
 * Función profesional para sincronizar el inventario maestro con las tablas de un usuario.
 * Útil para rescates tras migraciones parciales o fallidas.
 */
export const syncMasterInventoryToTables = async (targetUserId: string, masterAppData: any) => {
  console.log(`Iniciando sincronización de inventario maestro para usuario: ${targetUserId}`);
  
  // Solo sincronizamos inventarios básicos si están vacíos o se requiere refrescar
  // No tocamos recetas ni presupuestos para no sobrescribir el trabajo del usuario
  const entitiesToSync = [
    { key: 'aluminum', table: 'aluminum_inventory' },
    { key: 'glasses', table: 'glass_inventory' },
    { key: 'accessories', table: 'accessory_inventory' },
    { key: 'dvhInputs', table: 'dvh_inventory' },
    { key: 'treatments', table: 'treatment_inventory' },
    { key: 'blindPanels', table: 'panel_inventory' }
  ];

  const errors: string[] = [];

  for (const entity of entitiesToSync) {
    try {
      const data = masterAppData[entity.key];
      if (data && Array.isArray(data) && data.length > 0) {
        console.log(`Sincronizando ${entity.key}...`);
        
        // Mapeo dinámico según la tabla
        let toInsert: any[] = [];
        
        if (entity.key === 'aluminum') {
          toInsert = data.map((item: any) => ({
            id: item.id,
            user_id: targetUserId,
            code: item.code,
            detail: item.detail,
            weight_per_meter: item.weightPerMeter,
            bar_length: item.barLength,
            thickness: item.thickness,
            treatment_cost: item.treatmentCost,
            is_glazing_bead: item.isGlazingBead,
            glazing_bead_style: item.glazingBeadStyle,
            min_glass_thickness: item.minGlassThickness,
            max_glass_thickness: item.maxGlassThickness
          }));
        } else if (entity.key === 'glasses') {
          toInsert = data.map((item: any) => ({
            id: item.id,
            user_id: targetUserId,
            code: item.code,
            detail: item.detail,
            width: item.width,
            height: item.height,
            thickness: item.thickness,
            price_per_m2: item.pricePerM2,
            is_mirror: item.isMirror
          }));
        } else if (entity.key === 'accessories') {
          toInsert = data.map((item: any) => ({
            id: item.id,
            user_id: targetUserId,
            code: item.code,
            detail: item.detail,
            unit_price: item.unitPrice
          }));
        } else if (entity.key === 'dvhInputs') {
           toInsert = data.map((item: any) => ({
             id: item.id,
             user_id: targetUserId,
             type: item.type,
             detail: item.detail,
             thickness: item.thickness,
             cost: item.cost
           }));
        } else if (entity.key === 'treatments') {
          toInsert = data.map((item: any) => ({
            id: item.id,
            user_id: targetUserId,
            name: item.name,
            price_per_kg: item.pricePerKg,
            hex_color: item.hexColor
          }));
        } else if (entity.key === 'blindPanels') {
          toInsert = data.map((item: any) => ({
            id: item.id,
            user_id: targetUserId,
            code: item.code,
            detail: item.detail,
            price: item.price,
            unit: item.unit
          }));
        }

        if (toInsert.length > 0) {
          const { error } = await supabase.from(entity.table).upsert(toInsert);
          if (error) errors.push(`Error sincronizando ${entity.key}: ${error.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`Fallo en bloque ${entity.key}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, errors };
};

/**
 * Clona el inventario completo de un usuario origen a un usuario destino.
 * Es la forma más robusta de restaurar datos entre cuentas profesionales.
 */
export const cloneInventoryBetweenUsers = async (sourceUserId: string, targetUserId: string) => {
  console.log(`Clonando inventario industrial de ${sourceUserId} a ${targetUserId}...`);
  
  const entities = [
    { table: 'aluminum_inventory', fields: ['code', 'detail', 'weight_per_meter', 'bar_length', 'thickness', 'treatment_cost', 'is_glazing_bead', 'glazing_bead_style', 'min_glass_thickness', 'max_glass_thickness'] },
    { table: 'glass_inventory', fields: ['code', 'detail', 'width', 'height', 'thickness', 'price_per_m2', 'is_mirror'] },
    { table: 'accessory_inventory', fields: ['code', 'detail', 'unit_price'] },
    { table: 'dvh_inventory', fields: ['type', 'detail', 'thickness', 'cost'] },
    { table: 'treatment_inventory', fields: ['name', 'price_per_kg', 'hex_color'] },
    { table: 'panel_inventory', fields: ['code', 'detail', 'price', 'unit'] },
    { table: 'recipes', fields: ['name', 'data'] },
    { table: 'quotes', fields: ['customer_name', 'data'] }
  ];

  const errors: string[] = [];

  for (const entity of entities) {
    try {
      // 1. Obtener datos del origen
      const { data, error: fetchError } = await supabase.from(entity.table).select('*').eq('user_id', sourceUserId);
      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        // 2. Preparar para el destino (quitamos ID original y generamos uno unívoco para el usuario)
        const toInsert = data.map(item => {
          const prefix = entity.table.substring(0, 3);
          const newId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${targetUserId}`;
          const newItem: any = { id: newId, user_id: targetUserId };
          entity.fields.forEach(f => { newItem[f] = item[f]; });
          return newItem;
        });

        // 3. Insertar
        const { error: insertError } = await supabase.from(entity.table).upsert(toInsert, { onConflict: 'id' });
        if (insertError) errors.push(`Error en ${entity.table}: ${insertError.message}`);
      }
    } catch (e: any) {
      errors.push(`Fallo crítico en clonación de ${entity.table}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, errors };
};

/**
 * Obtiene solo los elementos NUEVOS de la base maestra y los inyecta en la cuenta del usuario.
 * Respeta 100% las modificaciones de precios o ítems existentes del usuario.
 */
export const pullUpdatesFromMaster = async (userId: string, masterEmail: string = 'aristastudiouno@gmail.com') => {
  console.log(`Buscando actualizaciones desde la Base Maestra (${masterEmail})...`);
  
  const entities = [
    { table: 'aluminum_inventory', idPrefix: 'alu' },
    { table: 'glass_inventory', idPrefix: 'glass' },
    { table: 'accessory_inventory', idPrefix: 'acc' },
    { table: 'dvh_inventory', idPrefix: 'dvh' },
    { table: 'treatment_inventory', idPrefix: 'trt' },
    { table: 'panel_inventory', idPrefix: 'bnd' }
  ];

  const results = { added: 0, errors: [] as string[] };

  try {
    // 1. Encontrar el ID del master
    const { data: masterProf, error: errProf } = await supabase.from('profiles').select('id').eq('email', masterEmail).single();
    if (errProf || !masterProf) throw new Error("No se pudo contactar con la base maestra.");
    const masterId = masterProf.id;

    for (const entity of entities) {
       // 2. Obtenemos datos del Master
       const { data: masterData, error: errMaster } = await supabase.from(entity.table).select('*').eq('user_id', masterId);
       if (errMaster) throw errMaster;

       // 3. Obtenemos datos del Usuario actual
       const { data: userData, error: errUser } = await supabase.from(entity.table).select('code, id').eq('user_id', userId);
       if (errUser) throw errUser;

       if (!masterData || masterData.length === 0) continue;

       // 4. Comparamos códigos para encontrar los "faltantes" en el usuario
       // Usamos el 'code' (código de artículo) como identificador único entre cuentas
       const userCodes = new Set((userData || []).map(u => u.code?.toString().trim().toLowerCase()).filter(Boolean));
       
       const newItems = masterData.filter(masterItem => {
          const masterCode = masterItem.code?.toString().trim().toLowerCase();
          if (!masterCode) return false;
          return !userCodes.has(masterCode);
       });

       if (newItems.length > 0) {
          // Inyectamos sólo los nuevos
          const payload = newItems.map(item => {
             const { id, user_id, ...rest } = item;
             // Creamos un ID único para el usuario destino
             const newId = `${entity.idPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${userId}`;
             return { id: newId, user_id: userId, ...rest };
          });

          const { error: insErr } = await supabase.from(entity.table).insert(payload);
          if (insErr) {
             results.errors.push(`Error en ${entity.table}: ${insErr.message}`);
          } else {
             results.added += newItems.length;
          }
       }
    }
  } catch (error: any) {
    results.errors.push(`Fallo global de actualización: ${error.message}`);
  }

  return results;
};
