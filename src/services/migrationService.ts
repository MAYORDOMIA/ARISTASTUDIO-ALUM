import { supabase } from './supabaseClient';

export const migrateAppDataToTables = async (userId: string, appData: any) => {
  console.log("Iniciando migración de datos a tablas relacionales...");
  const errors: string[] = [];

  try {
    // 1. Aluminio
    if (appData.aluminum && Array.isArray(appData.aluminum)) {
      console.log("Migrando aluminio...");
      const { error } = await supabase.from('aluminum_inventory').delete().eq('user_id', userId);
      if (error) errors.push(`Error limpiando aluminio: ${error.message}`);
      
      const toInsert = appData.aluminum.map((item: any) => ({
        id: item.id,
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
        const { error: insError } = await supabase.from('aluminum_inventory').upsert(toInsert);
        if (insError) errors.push(`Error insertando aluminio: ${insError.message}`);
      }
      console.log("Aluminio migrado.");
    }

    // 2. Vidrios
    if (appData.glasses && Array.isArray(appData.glasses)) {
      console.log("Migrando vidrios...");
      const toInsert = appData.glasses.map((item: any) => ({
        id: item.id,
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
        const { error } = await supabase.from('glass_inventory').upsert(toInsert);
        if (error) errors.push(`Error insertando vidrios: ${error.message}`);
      }
      console.log("Vidrios migrados.");
    }

    // 3. Accesorios
    if (appData.accessories && Array.isArray(appData.accessories)) {
      console.log("Migrando accesorios...");
      const toInsert = appData.accessories.map((item: any) => ({
        id: item.id,
        user_id: userId,
        code: item.code,
        detail: item.detail,
        unit_price: item.unitPrice
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('accessory_inventory').upsert(toInsert);
        if (error) errors.push(`Error insertando accesorios: ${error.message}`);
      }
      console.log("Accesorios migrados.");
    }

    // 4. DVH
    if (appData.dvhInputs && Array.isArray(appData.dvhInputs)) {
      console.log("Migrando DVH...");
      const toInsert = appData.dvhInputs.map((item: any) => ({
        id: item.id,
        user_id: userId,
        type: item.type,
        detail: item.detail,
        thickness: item.thickness,
        cost: item.cost
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('dvh_inventory').upsert(toInsert);
        if (error) errors.push(`Error insertando DVH: ${error.message}`);
      }
      console.log("DVH migrado.");
    }

    // 5. Tratamientos
    if (appData.treatments && Array.isArray(appData.treatments)) {
      console.log("Migrando tratamientos...");
      const toInsert = appData.treatments.map((item: any) => ({
        id: item.id,
        user_id: userId,
        name: item.name,
        price_per_kg: item.pricePerKg,
        hex_color: item.hexColor
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('treatment_inventory').upsert(toInsert);
        if (error) errors.push(`Error insertando tratamientos: ${error.message}`);
      }
      console.log("Tratamientos migrados.");
    }

    // 6. Paneles
    if (appData.blindPanels && Array.isArray(appData.blindPanels)) {
      console.log("Migrando paneles...");
      const toInsert = appData.blindPanels.map((item: any) => ({
        id: item.id,
        user_id: userId,
        code: item.code,
        detail: item.detail,
        price: item.price,
        unit: item.unit
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('panel_inventory').upsert(toInsert);
        if (error) errors.push(`Error insertando paneles: ${error.message}`);
      }
      console.log("Paneles migrados.");
    }

    // 7. Recetas
    if (appData.recipes && Array.isArray(appData.recipes)) {
      console.log("Migrando recetas...");
      const toInsert = appData.recipes.map((item: any) => ({
        id: item.id,
        user_id: userId,
        name: item.name,
        data: item
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('recipes').upsert(toInsert);
        if (error) errors.push(`Error insertando recetas: ${error.message}`);
      }
      console.log("Recetas migradas.");
    }

    // 8. Quotes
    if (appData.quotes && Array.isArray(appData.quotes)) {
      console.log("Migrando presupuestos...");
      const toInsert = appData.quotes.map((item: any) => ({
        id: item.id,
        user_id: userId,
        customer_name: item.customerName,
        data: item
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('quotes').upsert(toInsert);
        if (error) errors.push(`Error insertando presupuestos: ${error.message}`);
      }
      console.log("Presupuestos migrados.");
    }

    if (errors.length === 0) {
      // 9. Marcar el perfil como migrado
      const { error: profError } = await supabase.from('profiles').update({ is_migrated: true }).eq('id', userId);
      if (profError) errors.push(`Error marcando perfil como migrado: ${profError.message}`);
      
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
