import { supabase } from "./supabaseClient";

/**
 * SERVICIO DE MIGRACIÓN DEFINITIVO
 * Procesa JSONs y sube/actualiza a Supabase con control de usuario.
 */

// Helper para realizar upsert resiliente y auto-reparable en caso de columnas faltantes o conflictos de restricción
async function safeUpsert(table: string, records: any[], onConflict: string): Promise<{ data: any; error: any }> {
  if (!records || records.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.from(table).upsert(records, { onConflict });
  if (error) {
    console.warn(`[safeUpsert warning] Falló upsert en ${table} (onConflict: ${onConflict}):`, error);

    // Caso 1: Columna no existe (Postgres error 42703)
    if (error.code === "42703") {
      const match = error.message.match(/column "([^"]+)"/);
      if (match && match[1]) {
        const missingColumn = match[1];
        console.log(`[Self-Healing] Removiendo columna faltante "${missingColumn}" de la tabla "${table}" y reintentando...`);
        const cleanedRecords = records.map((rec) => {
          const copy = { ...rec };
          delete copy[missingColumn];
          return copy;
        });
        
        let newOnConflict = onConflict;
        if (onConflict.includes(missingColumn)) {
          if (table === "recetas_usuario") {
            newOnConflict = "user_id,master_ref";
          }
        }
        return safeUpsert(table, cleanedRecords, newOnConflict);
      }
    }

    // Caso 2: Conflicto de restricción UNIQUE (Postgres error 42P10)
    if (error.code === "42P10" && table === "recetas_usuario") {
      const nextOnConflict = onConflict === "user_id,master_ref" ? "user_id,receta_id" : "user_id,master_ref";
      console.log(`[Self-Healing] Reintentando recetas_usuario con restricción "${nextOnConflict}"`);
      const cleanedRecords = records.map((rec) => ({
        ...rec,
        receta_id: rec.receta_id || rec.master_ref || "receta-unknown",
      }));
      return safeUpsert(table, cleanedRecords, nextOnConflict);
    }

    // Caso 3: Violación de restricción de no nulo (Postgres error 23502)
    if (error.code === "23502" && error.message.includes("receta_id") && table === "recetas_usuario") {
      console.log(`[Self-Healing] Rellenando columna receta_id faltante en recetas_usuario`);
      const cleanedRecords = records.map((rec) => ({
        ...rec,
        receta_id: rec.receta_id || rec.master_ref || "receta-unknown",
      }));
      return safeUpsert(table, cleanedRecords, onConflict);
    }
  }
  return { data, error };
}

// Guardar datos masivos para el usuario activo
export const saveBulkData = async (userId: string, data: any) => {
  const {
    aluminum,
    glasses,
    accessories,
    recipes,
    treatments,
    blindPanels,
    dvhInputs,
    quotes,
    config,
  } = data;

  const deleteOps = [];
  const ops = [];

  // Mapeos a las tablas que definimos en SQL
  if (aluminum) {
    const validRefs = aluminum.map((a: any) => a.id).filter(Boolean);
    if (validRefs.length > 0) {
      deleteOps.push(supabase.from("materiales_perfiles_usuario").delete().eq("user_id", userId).not("master_ref", "in", `(${validRefs.join(",")})`));
    } else {
      deleteOps.push(supabase.from("materiales_perfiles_usuario").delete().eq("user_id", userId));
    }
    const arr = aluminum.map((a: any) => ({
      user_id: userId,
      master_ref: a.id,
      code: a.code || "",
      detail: a.detail || "",
      weight_per_meter: a.weightPerMeter !== undefined ? a.weightPerMeter : a.weight_per_meter || 0,
      bar_length: a.barLength !== undefined ? a.barLength : a.bar_length || 6000,
      thickness: a.thickness !== undefined ? a.thickness : a.thickness || 0,
      is_glazing_bead: a.isGlazingBead !== undefined ? a.isGlazingBead : a.is_glazing_bead || false,
      glazing_bead_style: a.glazingBeadStyle || a.glazing_bead_style || "Recto",
      min_glass_thickness: a.minGlassThickness !== undefined ? a.minGlassThickness : a.min_glass_thickness || 0,
      max_glass_thickness: a.maxGlassThickness !== undefined ? a.maxGlassThickness : a.max_glass_thickness || 0,
      treatment_cost: a.treatmentCost !== undefined ? a.treatmentCost : a.treatment_cost || 0,
    }));
    ops.push(safeUpsert("materiales_perfiles_usuario", arr, "user_id,master_ref"));
  }

  if (glasses) {
    const validRefs = glasses.map((a: any) => a.id).filter(Boolean);
    if (validRefs.length > 0) {
      deleteOps.push(supabase.from("materiales_vidrios_usuario").delete().eq("user_id", userId).not("master_ref", "in", `(${validRefs.join(",")})`));
    } else {
      deleteOps.push(supabase.from("materiales_vidrios_usuario").delete().eq("user_id", userId));
    }
    const arr = glasses.map((g: any) => ({
      user_id: userId,
      master_ref: g.id,
      code: g.code || g.name || "",
      detail: g.detail || "",
      thickness: g.thickness || 0,
      is_mirror: g.is_mirror || g.isMirror || false,
      price_per_m2: g.price_per_m2 || g.pricePerM2 || 0,
    }));
    ops.push(safeUpsert("materiales_vidrios_usuario", arr, "user_id,master_ref"));
  }

  if (accessories) {
    const validRefs = accessories.map((a: any) => a.id).filter(Boolean);
    if (validRefs.length > 0) {
      deleteOps.push(supabase.from("materiales_accesorios_usuario").delete().eq("user_id", userId).not("master_ref", "in", `(${validRefs.join(",")})`));
    } else {
      deleteOps.push(supabase.from("materiales_accesorios_usuario").delete().eq("user_id", userId));
    }
    const arr = accessories.map((a: any) => ({
      user_id: userId,
      master_ref: a.id,
      code: a.code || "",
      detail: a.detail || "",
      unit_price: a.unit_price || a.unitPrice || 0,
    }));
    ops.push(safeUpsert("materiales_accesorios_usuario", arr, "user_id,master_ref"));
  }

  if (treatments) {
    const validRefs = treatments.map((a: any) => a.id).filter(Boolean);
    if (validRefs.length > 0) {
      deleteOps.push(supabase.from("tratamientos_usuario").delete().eq("user_id", userId).not("master_ref", "in", `(${validRefs.join(",")})`));
    } else {
      deleteOps.push(supabase.from("tratamientos_usuario").delete().eq("user_id", userId));
    }
    const arr = treatments.map((t: any) => ({
      user_id: userId,
      master_ref: t.id,
      name: t.name || "Sin nombre",
      price_per_kg: t.pricePerKg || 0,
      hex_color: t.hexColor || "",
    }));
    ops.push(safeUpsert("tratamientos_usuario", arr, "user_id,master_ref"));
  }

  if (blindPanels) {
    const validRefs = blindPanels.map((a: any) => a.id).filter(Boolean);
    if (validRefs.length > 0) {
      deleteOps.push(supabase.from("paneles_usuario").delete().eq("user_id", userId).not("master_ref", "in", `(${validRefs.join(",")})`));
    } else {
      deleteOps.push(supabase.from("paneles_usuario").delete().eq("user_id", userId));
    }
    const arr = blindPanels.map((p: any) => ({
      user_id: userId,
      master_ref: p.id,
      code: p.code || "",
      detail: p.detail || "",
      price: p.price || 0,
      unit: p.unit || "m2",
      aluminum_profile_id: p.aluminumProfileId || null,
      thickness: p.thickness !== undefined ? p.thickness : 0,
      weight_per_meter: p.weightPerMeter !== undefined ? p.weightPerMeter : 0,
      bar_length: p.barLength !== undefined ? p.barLength : 6,
    }));
    ops.push(safeUpsert("paneles_usuario", arr, "user_id,master_ref"));
  }

  if (dvhInputs) {
    const validRefs = dvhInputs.map((a: any) => a.id).filter(Boolean);
    if (validRefs.length > 0) {
      deleteOps.push(supabase.from("dvh_usuario").delete().eq("user_id", userId).not("master_ref", "in", `(${validRefs.join(",")})`));
    } else {
      deleteOps.push(supabase.from("dvh_usuario").delete().eq("user_id", userId));
    }
    const arr = dvhInputs.map((d: any) => ({
      user_id: userId,
      master_ref: d.id,
      type: d.type || "Cámara",
      detail: d.detail || "",
      cost: d.cost || 0,
      thickness: d.thickness || 0,
    }));
    ops.push(safeUpsert("dvh_usuario", arr, "user_id,master_ref"));
  }

  if (recipes) {
    // Recipes might not be cleanly synced this way if they are large, but let's do it
    const validRefs = recipes.map((a: any) => a.id).filter(Boolean);
    if (validRefs.length > 0) {
      deleteOps.push(supabase.from("recetas_usuario").delete().eq("user_id", userId).not("master_ref", "in", `(${validRefs.join(",")})`));
    } else {
      deleteOps.push(supabase.from("recetas_usuario").delete().eq("user_id", userId));
    }
    const recetasFormateadas = recipes.map((r: any) => ({
      user_id: userId,
      master_ref: r.id,
      receta_id: r.id || "receta-" + Math.random().toString(36).substring(2, 9),
      name: r.name || "Sin nombre",
      data: r,
    }));
    ops.push(safeUpsert("recetas_usuario", recetasFormateadas, "user_id,master_ref"));
  }

  if (quotes && quotes.length > 0) {
    // Presupuestos no se suben solos aqui habitualmente
  }

  if (config) {
    ops.push(
      safeUpsert("configuracion_usuario", [{ user_id: userId, config_data: config }], "user_id")
    );
  }

  // Ejecutamos primero los borrados para evitar duplicados residuales o conflictos max limit
  await Promise.all(deleteOps);

  const results = await Promise.all(ops);
  const errors = results
    .filter((r) => r.error)
    .map((r) => r.error?.message || "Error desconocido");

  return { success: errors.length === 0, errors };
};

// Limpiar datos del usuario
export const wipeUserInventory = async (userId: string) => {
  const tables = [
    "materiales_perfiles_usuario",
    "materiales_vidrios_usuario",
    "materiales_accesorios_usuario",
    "recetas_usuario",
    "tratamientos_usuario",
    "paneles_usuario",
    "dvh_usuario",
  ];
  const results = await Promise.all(
    tables.map((table) => supabase.from(table).delete().eq("user_id", userId)),
  );
  const errors = results
    .filter((r) => r.error)
    .map((r) => r.error?.message || "Error desconocido");
  return { success: errors.length === 0, errors };
};

// Traer actualizaciones desde las tablas maestras al usuario
export const pullUpdatesFromMaster = async (userId: string) => {
  const masterTables = [
    { master: "maestro_perfiles", user: "materiales_perfiles_usuario" },
    { master: "maestro_vidrios", user: "materiales_vidrios_usuario" },
    { master: "maestro_accesorios", user: "materiales_accesorios_usuario" },
    { master: "maestro_recetas", user: "recetas_usuario" },
    { master: "maestro_tratamientos", user: "tratamientos_usuario" },
    { master: "maestro_paneles", user: "paneles_usuario" },
    { master: "maestro_dvh", user: "dvh_usuario" },
  ];

  let addedCount = 0;
  const errors: string[] = [];

  for (const t of masterTables) {
    const { data: masters, error: fetchErr } = await supabase
      .from(t.master)
      .select("*")
      .limit(50000);
    if (fetchErr) {
      errors.push(fetchErr.message);
      continue;
    }

    if (masters && masters.length > 0) {
      const { data: existingUserItems } = await supabase
        .from(t.user)
        .select("master_ref")
        .eq("user_id", userId)
        .limit(50000);
      const existingRefs = new Set(
        (existingUserItems || []).map((ei) => ei.master_ref),
      );

      const newItems = masters
        .filter((m) => !existingRefs.has(m.id))
        .map((m) => {
          if (t.master === "maestro_recetas") {
            return {
              user_id: userId,
              master_ref: m.id,
              name: m.name || "Sin nombre",
              data: m.data || {},
            };
          }
          if (t.master === "maestro_tratamientos") {
            return {
              user_id: userId,
              master_ref: m.id,
              name: m.name || "Sin nombre",
              price_per_kg: m.price_per_kg || 0,
              hex_color: m.hex_color || "",
            };
          }
          if (t.master === "maestro_paneles") {
            return {
              user_id: userId,
              master_ref: m.id,
              code: m.code || "",
              detail: m.detail || "",
              price: m.price || 0,
              unit: m.unit || "m2",
              aluminum_profile_id: m.aluminum_profile_id || null,
              thickness: m.thickness || 0,
              weight_per_meter: m.weight_per_meter || 0,
              bar_length: m.bar_length || 6,
            };
          }
          if (t.master === "maestro_dvh") {
            return {
              user_id: userId,
              master_ref: m.id,
              type: m.type || "Cámara",
              detail: m.detail || "",
              cost: m.cost || 0,
              thickness: m.thickness || 0,
            };
          }
          if (t.master === "maestro_perfiles") {
            return {
              user_id: userId,
              master_ref: m.id,
              code: m.code || "",
              detail: m.detail || "",
              weight_per_meter: m.weight_per_meter || 0,
              bar_length: m.bar_length || 6000,
              thickness: m.thickness || 0,
              is_glazing_bead: m.is_glazing_bead || false,
              glazing_bead_style: m.glazing_bead_style || "Recto",
              min_glass_thickness: m.min_glass_thickness || 0,
              max_glass_thickness: m.max_glass_thickness || 0,
              treatment_cost: m.treatment_cost || 0,
            };
          }
          if (t.master === "maestro_vidrios") {
            return {
              user_id: userId,
              master_ref: m.id,
              code: m.code || "",
              detail: m.detail || "",
              thickness: m.thickness || 0,
              is_mirror: m.is_mirror || false,
              price_per_m2: m.price_per_m2 || 0,
            };
          }
          if (t.master === "maestro_accesorios") {
            return {
              user_id: userId,
              master_ref: m.id,
              code: m.code || "",
              detail: m.detail || "",
              unit_price: m.unit_price || 0,
            };
          }
          return {
            user_id: userId,
            master_ref: m.id,
            code: m.code || m.name || "",
            detail: m.detail || "",
          };
        });

      if (newItems.length > 0) {
        const { error: upsertErr } = await safeUpsert(t.user, newItems, "user_id,master_ref");
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
