import { supabase } from "./supabaseClient";

/**
 * SERVICIO DE MIGRACIÓN DEFINITIVO
 * Procesa JSONs y sube/actualiza a Supabase con control de usuario.
 */

// Normaliza archivos JSON de respaldo (soporta claves en inglés/español o librerías de recetas en array)
export const normalizeBulkJsonPayload = (raw: any): Record<string, any> => {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return { recipes: raw };
  }

  const pickArray = (...keys: string[]) => {
    for (const k of keys) {
      if (Array.isArray(raw[k])) return raw[k];
    }
    return undefined;
  };

  const pickObject = (...keys: string[]) => {
    for (const k of keys) {
      if (raw[k] && typeof raw[k] === "object" && !Array.isArray(raw[k])) {
        return raw[k];
      }
    }
    return undefined;
  };

  const normalized: Record<string, any> = { ...raw };

  const aluminum = pickArray("aluminum", "perfiles", "aluminio");
  const glasses = pickArray("glasses", "vidrios");
  const accessories = pickArray("accessories", "accesorios");
  const recipes = pickArray("recipes", "recetas", "tipologias");
  const treatments = pickArray("treatments", "tratamientos", "pinturas");
  const blindPanels = pickArray("blindPanels", "paneles", "panelesCiegos");
  const dvhInputs = pickArray("dvhInputs", "dvh");
  const quotes = pickArray("quotes", "presupuestos");
  const config = pickObject("config", "configuracion", "globalConfig");

  if (aluminum !== undefined) normalized.aluminum = aluminum;
  if (glasses !== undefined) normalized.glasses = glasses;
  if (accessories !== undefined) normalized.accessories = accessories;
  if (recipes !== undefined) normalized.recipes = recipes;
  if (treatments !== undefined) normalized.treatments = treatments;
  if (blindPanels !== undefined) normalized.blindPanels = blindPanels;
  if (dvhInputs !== undefined) normalized.dvhInputs = dvhInputs;
  if (quotes !== undefined) normalized.quotes = quotes;
  if (config !== undefined) normalized.config = config;

  return normalized;
};

const toNum = (val: any, fallback = 0): number => {
  if (val === null || val === undefined || val === "") return fallback;
  const parsed = typeof val === "string" ? Number(val.replace(",", ".")) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractMissingColumn = (error: any): string | null => {
  const msg = String(error?.message || "");
  // Postgres 42703: column "foo" of relation "..." does not exist
  const pgMatch = msg.match(/column "([^"]+)"/);
  if (pgMatch?.[1]) return pgMatch[1];
  // PostgREST PGRST204: Could not find the 'foo' column of 'table' in the schema cache
  const pgrstMatch = msg.match(/Could not find the '([^']+)' column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];
  return null;
};

// Helper para realizar upsert resiliente, en lotes y auto-reparable en caso de columnas faltantes
async function safeUpsert(
  table: string,
  records: any[],
  onConflict: string,
  chunkSize?: number
): Promise<{ data: any; error: any }> {
  if (!records || records.length === 0) return { data: [], error: null };

  const effectiveChunkSize = chunkSize ?? (table === "recetas_usuario" ? 80 : 250);
  const removedColumns = new Set<string>();
  let currentOnConflict = onConflict;

  const stripColumns = (batch: any[]) => {
    if (removedColumns.size === 0) return batch;
    return batch.map((rec) => {
      const copy = { ...rec };
      removedColumns.forEach((col) => {
        delete copy[col];
      });
      return copy;
    });
  };

  for (let i = 0; i < records.length; i += effectiveChunkSize) {
    let chunk = stripColumns(records.slice(i, i + effectiveChunkSize));
    let attempts = 0;

    while (attempts < 8) {
      const { error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: currentOnConflict });

      if (!error) break;

      const isMissingCol =
        error.code === "42703" ||
        error.code === "PGRST204" ||
        /Could not find the '[^']+' column/i.test(error.message || "") ||
        /column "[^"]+" (of relation|does not exist)/i.test(error.message || "");

      if (isMissingCol) {
        const missingColumn = extractMissingColumn(error);
        if (missingColumn && !removedColumns.has(missingColumn)) {
          console.warn(
            `[Self-Healing] Removiendo columna faltante "${missingColumn}" de "${table}" y reintentando...`
          );
          removedColumns.add(missingColumn);
          chunk = chunk.map((rec) => {
            const copy = { ...rec };
            delete copy[missingColumn];
            return copy;
          });
          if (currentOnConflict.includes(missingColumn) && table === "recetas_usuario") {
            currentOnConflict = "user_id,master_ref";
          }
          attempts++;
          continue;
        }
      }

      console.warn(`[safeUpsert error] Falló upsert en ${table} (onConflict: ${currentOnConflict}):`, error);
      return { data: null, error };
    }
  }

  return { data: records, error: null };
}

// Borra de forma segura (sin límites de longitud de URL) los registros obsoletos que no están en validRefs
async function deleteStaleUserRows(
  table: string,
  userId: string,
  validRefs: string[]
): Promise<{ error: any }> {
  if (validRefs.length === 0) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    return { error };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from(table)
    .select("id, master_ref")
    .eq("user_id", userId)
    .limit(50000);

  if (fetchErr) {
    return { error: fetchErr };
  }

  const validSet = new Set(validRefs.map((r) => String(r)));
  const staleIds = (existing || [])
    .filter((row: any) => !row.master_ref || !validSet.has(String(row.master_ref)))
    .map((row: any) => row.id)
    .filter(Boolean);

  for (let i = 0; i < staleIds.length; i += 100) {
    const batchIds = staleIds.slice(i, i + 100);
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", batchIds);
    if (delErr) {
      return { error: delErr };
    }
  }

  return { error: null };
}

function dedupeByMasterRef(rows: any[]): any[] {
  const map = new Map<string, any>();
  rows.forEach((row) => {
    map.set(String(row.master_ref), row);
  });
  return Array.from(map.values());
}

// Guardar datos masivos para el usuario activo
export const saveBulkData = async (userId: string, rawData: any) => {
  const data = normalizeBulkJsonPayload(rawData);
  const {
    aluminum,
    glasses,
    accessories,
    recipes,
    treatments,
    blindPanels,
    dvhInputs,
    config,
  } = data;

  const errors: string[] = [];

  const syncTable = async (
    table: string,
    rows: any[],
    onConflict = "user_id,master_ref"
  ) => {
    const uniqueRows = dedupeByMasterRef(rows);
    const validRefs = uniqueRows.map((r) => String(r.master_ref)).filter(Boolean);

    const { error: delErr } = await deleteStaleUserRows(table, userId, validRefs);
    if (delErr) {
      errors.push(`${table} (limpieza): ${delErr.message || "Error al limpiar registros antiguos"}`);
      return;
    }

    if (uniqueRows.length > 0) {
      const { error: upErr } = await safeUpsert(table, uniqueRows, onConflict);
      if (upErr) {
        errors.push(`${table}: ${upErr.message || "Error al guardar registros"}`);
      }
    }
  };

  const tasks: Promise<void>[] = [];

  if (Array.isArray(aluminum)) {
    const arr = aluminum.map((a: any, idx: number) => ({
      user_id: userId,
      master_ref: String(a.id || a.master_ref || `alu-${a.code || idx}-${idx}`),
      code: String(a.code || ""),
      detail: String(a.detail || ""),
      weight_per_meter: toNum(a.weightPerMeter ?? a.weight_per_meter, 0),
      bar_length: toNum(a.barLength ?? a.bar_length, 6000),
      thickness: toNum(a.thickness, 0),
      is_glazing_bead: Boolean(a.isGlazingBead ?? a.is_glazing_bead ?? false),
      glazing_bead_style: a.glazingBeadStyle || a.glazing_bead_style || "Recto",
      min_glass_thickness: toNum(a.minGlassThickness ?? a.min_glass_thickness, 0),
      max_glass_thickness: toNum(a.maxGlassThickness ?? a.max_glass_thickness, 0),
      treatment_cost: toNum(a.treatmentCost ?? a.treatment_cost, 0),
    }));
    tasks.push(syncTable("materiales_perfiles_usuario", arr));
  }

  if (Array.isArray(glasses)) {
    const arr = glasses.map((g: any, idx: number) => ({
      user_id: userId,
      master_ref: String(g.id || g.master_ref || `gls-${g.code || g.name || idx}-${idx}`),
      code: String(g.code || g.name || ""),
      detail: String(g.detail || ""),
      thickness: toNum(g.thickness, 0),
      is_mirror: Boolean(g.is_mirror ?? g.isMirror ?? false),
      price_per_m2: toNum(g.price_per_m2 ?? g.pricePerM2, 0),
    }));
    tasks.push(syncTable("materiales_vidrios_usuario", arr));
  }

  if (Array.isArray(accessories)) {
    const arr = accessories.map((a: any, idx: number) => ({
      user_id: userId,
      master_ref: String(a.id || a.master_ref || `acc-${a.code || idx}-${idx}`),
      code: String(a.code || ""),
      detail: String(a.detail || ""),
      unit_price: toNum(a.unit_price ?? a.unitPrice, 0),
    }));
    tasks.push(syncTable("materiales_accesorios_usuario", arr));
  }

  if (Array.isArray(treatments)) {
    const arr = treatments.map((t: any, idx: number) => ({
      user_id: userId,
      master_ref: String(t.id || t.master_ref || `trt-${t.name || idx}-${idx}`),
      name: String(t.name || "Sin nombre"),
      price_per_kg: toNum(t.pricePerKg ?? t.price_per_kg, 0),
      hex_color: String(t.hexColor ?? t.hex_color ?? ""),
    }));
    tasks.push(syncTable("tratamientos_usuario", arr));
  }

  if (Array.isArray(blindPanels)) {
    const arr = blindPanels.map((p: any, idx: number) => ({
      user_id: userId,
      master_ref: String(p.id || p.master_ref || `pnl-${p.code || idx}-${idx}`),
      code: String(p.code || ""),
      detail: String(p.detail || ""),
      price: toNum(p.price, 0),
      unit: p.unit || "m2",
      aluminum_profile_id: p.aluminumProfileId ?? p.aluminum_profile_id ?? null,
      thickness: toNum(p.thickness, 0),
      weight_per_meter: toNum(p.weightPerMeter ?? p.weight_per_meter, 0),
      bar_length: toNum(p.barLength ?? p.bar_length, 6),
    }));
    tasks.push(syncTable("paneles_usuario", arr));
  }

  if (Array.isArray(dvhInputs)) {
    const arr = dvhInputs.map((d: any, idx: number) => ({
      user_id: userId,
      master_ref: String(d.id || d.master_ref || `dvh-${d.type || idx}-${idx}`),
      type: d.type || "Cámara",
      detail: String(d.detail || ""),
      cost: toNum(d.cost, 0),
      thickness: toNum(d.thickness, 0),
    }));
    tasks.push(syncTable("dvh_usuario", arr));
  }

  if (Array.isArray(recipes)) {
    const recetasFormateadas = recipes.map((r: any, idx: number) => {
      const refId = String(r.id || r.master_ref || `rec-${r.name || idx}-${idx}`);
      const recipePayload = r.data && !r.profiles ? r.data : { ...r, id: r.id || refId };
      return {
        user_id: userId,
        master_ref: refId,
        name: String(r.name || recipePayload?.name || "Sin nombre"),
        data: recipePayload,
      };
    });
    tasks.push(syncTable("recetas_usuario", recetasFormateadas));
  }

  if (config && typeof config === "object") {
    tasks.push(
      (async () => {
        const { error: confErr } = await safeUpsert(
          "configuracion_usuario",
          [{ user_id: userId, config_data: config }],
          "user_id"
        );
        if (confErr) {
          errors.push(`configuracion_usuario: ${confErr.message || "Error al guardar configuración"}`);
        }
      })()
    );
  }

  await Promise.all(tasks);

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

export interface BulkPriceIncreaseOptions {
  glassPercentage?: number;
  aluminumCrudoPercentage?: number;
  accessoryPercentage?: number;
}

export interface BulkPriceIncreaseResult {
  success: boolean;
  updatedUsers: number;
  glassesUpdated: number;
  accessoriesUpdated: number;
  aluminumConfigsUpdated: number;
  errors: string[];
}

const roundPrice2 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 100) / 100;
};

async function upsertInChunks(table: string, rows: any[], chunkSize = 200): Promise<{ count: number; error: string | null }> {
  let updated = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) {
      return { count: updated, error: error.message };
    }
    updated += chunk.length;
  }
  return { count: updated, error: null };
}

export const applyBulkPriceIncrease = async (
  userIds: string[],
  options: BulkPriceIncreaseOptions
): Promise<BulkPriceIncreaseResult> => {
  const glassPct = Number(options.glassPercentage || 0);
  const aluPct = Number(options.aluminumCrudoPercentage || 0);
  const accPct = Number(options.accessoryPercentage || 0);

  let updatedUsers = 0;
  let glassesUpdated = 0;
  let accessoriesUpdated = 0;
  let aluminumConfigsUpdated = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    let userHadChange = false;

    try {
      // 1. Base de datos completa de Vidrios ($/m2)
      if (Number.isFinite(glassPct) && glassPct !== 0) {
        const { data: glassRows, error: glassFetchErr } = await supabase
          .from("materiales_vidrios_usuario")
          .select("*")
          .eq("user_id", userId)
          .limit(50000);

        if (glassFetchErr) {
          errors.push(`Vidrios (${userId}): ${glassFetchErr.message}`);
        } else if (glassRows && glassRows.length > 0) {
          const factor = 1 + glassPct / 100;
          const updatedRows = glassRows.map((row: any) => ({
            ...row,
            price_per_m2: roundPrice2((Number(row.price_per_m2) || 0) * factor),
          }));
          const { count, error: glassUpsertErr } = await upsertInChunks(
            "materiales_vidrios_usuario",
            updatedRows
          );
          if (glassUpsertErr) {
            errors.push(`Vidrios (${userId}): ${glassUpsertErr}`);
          } else {
            glassesUpdated += count;
            if (count > 0) userHadChange = true;
          }
        }
      }

      // 2. Aluminio en el Crudo ($/KG en configuracion_usuario)
      if (Number.isFinite(aluPct) && aluPct !== 0) {
        const { data: confRow, error: confFetchErr } = await supabase
          .from("configuracion_usuario")
          .select("config_data")
          .eq("user_id", userId)
          .maybeSingle();

        if (confFetchErr && confFetchErr.code !== "PGRST116") {
          errors.push(`Aluminio Crudo (${userId}): ${confFetchErr.message}`);
        } else {
          const currentConfig = confRow?.config_data || {};
          const currentAluPrice =
            currentConfig.aluminumPricePerKg !== undefined &&
            currentConfig.aluminumPricePerKg !== null
              ? Number(currentConfig.aluminumPricePerKg) || 0
              : 15;
          const newAluPrice = roundPrice2(currentAluPrice * (1 + aluPct / 100));
          const updatedConfig = {
            ...currentConfig,
            aluminumPricePerKg: newAluPrice,
          };

          const { error: confSaveErr } = await supabase
            .from("configuracion_usuario")
            .upsert([{ user_id: userId, config_data: updatedConfig }], {
              onConflict: "user_id",
            });

          if (confSaveErr) {
            errors.push(`Aluminio Crudo (${userId}): ${confSaveErr.message}`);
          } else {
            aluminumConfigsUpdated += 1;
            userHadChange = true;
          }
        }
      }

      // 3. Base de datos completa de Accesorios (por unidad)
      if (Number.isFinite(accPct) && accPct !== 0) {
        const { data: accRows, error: accFetchErr } = await supabase
          .from("materiales_accesorios_usuario")
          .select("*")
          .eq("user_id", userId)
          .limit(50000);

        if (accFetchErr) {
          errors.push(`Accesorios (${userId}): ${accFetchErr.message}`);
        } else if (accRows && accRows.length > 0) {
          const factor = 1 + accPct / 100;
          const updatedRows = accRows.map((row: any) => ({
            ...row,
            unit_price: roundPrice2((Number(row.unit_price) || 0) * factor),
          }));
          const { count, error: accUpsertErr } = await upsertInChunks(
            "materiales_accesorios_usuario",
            updatedRows
          );
          if (accUpsertErr) {
            errors.push(`Accesorios (${userId}): ${accUpsertErr}`);
          } else {
            accessoriesUpdated += count;
            if (count > 0) userHadChange = true;
          }
        }
      }

      if (userHadChange) {
        updatedUsers += 1;
      }
    } catch (err: any) {
      errors.push(`Usuario ${userId}: ${err?.message || "Error inesperado"}`);
    }
  }

  return {
    success: errors.length === 0,
    updatedUsers,
    glassesUpdated,
    accessoriesUpdated,
    aluminumConfigsUpdated,
    errors,
  };
};

