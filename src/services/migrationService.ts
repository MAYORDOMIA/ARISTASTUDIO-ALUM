import { supabase } from "./supabaseClient";

/**
 * SERVICIO DE MIGRACIÓN DEFINITIVO
 * Procesa JSONs y sube/actualiza a Supabase con control de usuario.
 */

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

  // Realizamos pre-fetch de los IDs existentes para poder hacer upsert 
  // usando la llave principal (Primary Key 'id') en lugar de depender
  // de la restricción UNIQUE(user_id, master_ref) que pudimos haber borrado.
  const [aluRes, glsRes, accRes, trtRes, pnlRes, dvhRes, recRes] = await Promise.all([
    supabase.from("materiales_perfiles_usuario").select("id, master_ref").eq("user_id", userId),
    supabase.from("materiales_vidrios_usuario").select("id, master_ref").eq("user_id", userId),
    supabase.from("materiales_accesorios_usuario").select("id, master_ref").eq("user_id", userId),
    supabase.from("tratamientos_usuario").select("id, master_ref").eq("user_id", userId),
    supabase.from("paneles_usuario").select("id, master_ref").eq("user_id", userId),
    supabase.from("dvh_usuario").select("id, master_ref").eq("user_id", userId),
    supabase.from("recetas_usuario").select("id, master_ref").eq("user_id", userId),
  ]);

  const mapIds = (res: any) => {
    const map = new Map<string, string>();
    if (res?.data) {
      res.data.forEach((r: any) => {
        if (r.master_ref) map.set(r.master_ref, r.id);
      });
    }
    return map;
  };

  const maps = {
    alu: mapIds(aluRes),
    gls: mapIds(glsRes),
    acc: mapIds(accRes),
    trt: mapIds(trtRes),
    pnl: mapIds(pnlRes),
    dvh: mapIds(dvhRes),
    rec: mapIds(recRes)
  };

  const ops = [];

  // Mapeos a las tablas que definimos en SQL
  if (aluminum) {
    const arr = aluminum.map((a: any) => {
      const payload: any = {
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
      };
      if (maps.alu.has(a.id)) payload.id = maps.alu.get(a.id);
      return payload;
    });
    ops.push(supabase.from("materiales_perfiles_usuario").upsert(arr));
  }

  if (glasses) {
    const arr = glasses.map((g: any) => {
      const payload: any = {
        user_id: userId,
        master_ref: g.id,
        code: g.code || g.name || "",
        detail: g.detail || "",
        thickness: g.thickness || 0,
        is_mirror: g.is_mirror || g.isMirror || false,
        price_per_m2: g.price_per_m2 || g.pricePerM2 || 0,
      };
      if (maps.gls.has(g.id)) payload.id = maps.gls.get(g.id);
      return payload;
    });
    ops.push(supabase.from("materiales_vidrios_usuario").upsert(arr));
  }

  if (accessories) {
    const arr = accessories.map((a: any) => {
      const payload: any = {
        user_id: userId,
        master_ref: a.id,
        code: a.code || "",
        detail: a.detail || "",
        unit_price: a.unit_price || a.unitPrice || 0,
      };
      if (maps.acc.has(a.id)) payload.id = maps.acc.get(a.id);
      return payload;
    });
    ops.push(supabase.from("materiales_accesorios_usuario").upsert(arr));
  }

  if (treatments) {
    const arr = treatments.map((t: any) => {
      const payload: any = {
        user_id: userId,
        master_ref: t.id,
        name: t.name || "Sin nombre",
        price_per_kg: t.pricePerKg || 0,
        hex_color: t.hexColor || "",
      };
      if (maps.trt.has(t.id)) payload.id = maps.trt.get(t.id);
      return payload;
    });
    ops.push(supabase.from("tratamientos_usuario").upsert(arr));
  }

  if (blindPanels) {
    const arr = blindPanels.map((p: any) => {
      const payload: any = {
        user_id: userId,
        master_ref: p.id,
        code: p.code || "",
        detail: p.detail || "",
        price: p.price || 0,
        unit: p.unit || "m2",
      };
      if (maps.pnl.has(p.id)) payload.id = maps.pnl.get(p.id);
      return payload;
    });
    ops.push(supabase.from("paneles_usuario").upsert(arr));
  }

  if (dvhInputs) {
    const arr = dvhInputs.map((d: any) => {
      const payload: any = {
        user_id: userId,
        master_ref: d.id,
        type: d.type || "Cámara",
        detail: d.detail || "",
        cost: d.cost || 0,
        thickness: d.thickness || 0,
      };
      if (maps.dvh.has(d.id)) payload.id = maps.dvh.get(d.id);
      return payload;
    });
    ops.push(supabase.from("dvh_usuario").upsert(arr));
  }

  if (recipes) {
    const recetasFormateadas = recipes.map((r: any) => {
      const payload: any = {
        user_id: userId,
        master_ref: r.id,
        name: r.name || "Sin nombre",
        data: r,
      };
      if (maps.rec.has(r.id)) payload.id = maps.rec.get(r.id);
      return payload;
    });
    ops.push(supabase.from("recetas_usuario").upsert(recetasFormateadas));
  }

  if (quotes && quotes.length > 0) {
    // Presupuestos no se suben solos aqui habitualmente
  }

  if (config) {
    ops.push(
      supabase
        .from("configuracion_usuario")
        .upsert([{ user_id: userId, config_data: config }], {
          onConflict: "user_id",
        }),
    );
  }

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
        const { error: upsertErr } = await supabase
          .from(t.user)
          .insert(newItems);
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
