import { DVHInput, ProductRecipe, isComplementaryRecipe } from "../types";

/**
 * Extracts numeric camera thickness (e.g. 6, 8, 9, 10, 12, 14, 15, 16, 19, 20 mm)
 * from codes, details, or thickness attributes.
 */
export const extractsDVHThickness = (str: string, itemObj?: any): number | null => {
  if (itemObj?.thickness && typeof itemObj.thickness === "number" && itemObj.thickness > 0) {
    return itemObj.thickness;
  }
  const s = (str || "").toUpperCase();

  // 1. CMRA09, CRRA 09, CMRA-12, CMRA_09
  let m = s.match(/C[MR]RA\s*[-_]?\s*0?(\d+)/);
  if (m) return parseInt(m[1], 10);

  // 2. ESCUADRA 09, ESCUADRA-9, ESC 09, ESCUADRA DE 9, ESCUADRA CAMARA 9
  m = s.match(/ESC(?:UADRA)?\s*[-_]?(?:(?:DE|PARA|CAMARA|CÁMARA)\s*)*0?(\d+)/);
  if (m) return parseInt(m[1], 10);

  // 3. CAMARA 09, CAMARA DE 12, CÁMARA 9
  m = s.match(/C[AÁ]MARA\s*[-_]?(?:DE\s*)?0?(\d+)/);
  if (m) return parseInt(m[1], 10);

  // 4. 09 MM, 12MM
  m = s.match(/\b0?(\d+)\s*MM\b/);
  if (m) return parseInt(m[1], 10);

  // 5. Ending in -09 or -12
  m = s.match(/[-_]0?(\d{1,2})$/);
  if (m) {
    const val = parseInt(m[1], 10);
    if ([6, 8, 9, 10, 12, 14, 15, 16, 18, 19, 20, 24].includes(val)) return val;
  }

  return null;
};

/**
 * Searches and identifies the complementary DVH recipe in the recipe list.
 * Prioritizes complementary recipes categorized as 'dvh' or named 'DVH',
 * while explicitly avoiding standard window/door recipes like 'Ventana Corrediza DVH'.
 */
export const findDVHRecipe = (recipes: ProductRecipe[]): ProductRecipe | null => {
  if (!recipes || !Array.isArray(recipes) || recipes.length === 0) return null;

  // Priority 1: Complementary recipe with complementCategory === "dvh" or requiresDVH
  let found = recipes.find(
    (r) =>
      r &&
      (r.complementCategory === "dvh" ||
        r.activationRule?.requiresDVH === true ||
        (r.activationRule?.triggerType === "glass_type" && r.activationRule?.requiresDVH))
  );
  if (found) return found;

  // Priority 2: Complementary recipe with DVH in name or line
  found = recipes.find((r) => {
    if (!r) return false;
    const isComp =
      r.isComplementary === true ||
      r.recipeNature === "complementary" ||
      r.type === "Complementaria" ||
      Boolean(r.complementCategory);
    const n = (r.name || "").toUpperCase();
    const l = (r.line || "").toUpperCase();
    return isComp && (n.includes("DVH") || l.includes("DVH"));
  });
  if (found) return found;

  // Priority 3: Recipe whose name explicitly is DVH / INSUMOS DVH / DVH-INSUMOS
  found = recipes.find((r) => {
    if (!r) return false;
    const n = (r.name || "").trim().toUpperCase();
    return (
      n === "DVH" ||
      n === "DVH-INSUMOS" ||
      n === "INSUMOS DVH" ||
      n === "RECETA DVH" ||
      n === "CAMARA DVH" ||
      n === "DOBLE VIDRIADO" ||
      n.startsWith("DVH ") ||
      n.endsWith(" DVH")
    );
  });
  if (found) return found;

  // Priority 4: Any recipe with DVH in name that is NOT a traditional door/window opening
  found = recipes.find((r) => {
    if (!r) return false;
    const n = (r.name || "").toUpperCase();
    const isStandardTypo = [
      "VENTANA",
      "PUERTA",
      "PAÑO FIJO",
      "BANDEROLA",
      "MAMPARA",
      "CORREDIZA",
      "BATIENTE",
      "OSCILOBATIENTE",
      "PIEL DE VIDRIO",
      "BARANDA",
    ].some((t) => n.includes(t));
    return n.includes("DVH") && !isStandardTypo;
  });

  return found || null;
};

/**
 * Returns the extra profiles and accessories from the complementary DVH recipe.
 * If accessories/profiles are missing from the recipe, it supplements them from
 * available dvhInputs and accessories catalogs.
 */
export const getDVHExtras = (
  recipes: ProductRecipe[],
  isDVH: boolean,
  dvhInputs?: any[],
  accessoriesList?: any[],
  aluminumList?: any[]
) => {
  if (!isDVH || !recipes) {
    return { profiles: [], accessories: [], recipe: null };
  }

  const dvhRecipe = findDVHRecipe(recipes);

  let profiles = dvhRecipe?.profiles ? [...dvhRecipe.profiles] : [];
  let accessories = dvhRecipe?.accessories ? [...dvhRecipe.accessories] : [];

  // Fallback: If no profiles in recipe but aluminum has camera profiles
  if (profiles.length === 0 && aluminumList && aluminumList.length > 0) {
    const camProfs = aluminumList.filter((a: any) => {
      const s = `${a.code || ""} ${a.detail || ""}`.toUpperCase();
      return s.includes("CMRA") || s.includes("CAMARA") || s.includes("CÁMARA");
    });
    camProfs.forEach((cp: any) => {
      profiles.push({
        profileId: cp.id,
        quantity: 2,
        formula: "W",
        cutStart: "90",
        cutEnd: "90",
        role: "Otro",
      });
      profiles.push({
        profileId: cp.id,
        quantity: 2,
        formula: "H",
        cutStart: "90",
        cutEnd: "90",
        role: "Otro",
      });
    });
  }

  // Fallback: Check if accessories list has Sales, Escuadras, Butilo
  const hasSales = accessories.some((a) => {
    const def = (accessoriesList || []).find((x: any) => x.id === a.accessoryId || x.code === a.accessoryId) || (dvhInputs || []).find((x: any) => x.id === a.accessoryId);
    const s = `${def?.code || ""} ${def?.detail || ""}`.toUpperCase();
    return s.includes("SAL") || s.includes("TAMIZ");
  });
  const hasEscuadra = accessories.some((a) => {
    const def = (accessoriesList || []).find((x: any) => x.id === a.accessoryId || x.code === a.accessoryId) || (dvhInputs || []).find((x: any) => x.id === a.accessoryId);
    const s = `${def?.code || ""} ${def?.detail || ""}`.toUpperCase();
    return s.includes("ESCUADRA") && (s.includes("CMRA") || s.includes("CAMARA") || s.includes("CÁMARA") || s.includes("DVH"));
  });
  const hasButilo = accessories.some((a) => {
    const def = (accessoriesList || []).find((x: any) => x.id === a.accessoryId || x.code === a.accessoryId) || (dvhInputs || []).find((x: any) => x.id === a.accessoryId);
    const s = `${def?.code || ""} ${def?.detail || ""}`.toUpperCase();
    return s.includes("BUTILO");
  });

  if (!hasSales) {
    const salAcc = (accessoriesList || []).find((a: any) => {
      const s = `${a.code || ""} ${a.detail || ""}`.toUpperCase();
      return s.includes("SAL") || s.includes("TAMIZ");
    }) || (dvhInputs || []).find((d: any) => d.type === "Sales" || (d.detail || "").toUpperCase().includes("SAL") || (d.detail || "").toUpperCase().includes("TAMIZ"));
    if (salAcc) {
      accessories.push({
        accessoryId: salAcc.id,
        quantity: 1,
        isLinear: false,
        label: "Sal / Tamiz DVH",
      });
    }
  }

  if (!hasEscuadra) {
    const escAccs = (accessoriesList || []).filter((a: any) => {
      const s = `${a.code || ""} ${a.detail || ""}`.toUpperCase();
      return (
        s.includes("ESCUADRA") &&
        (s.includes("CMRA") || s.includes("CAMARA") || s.includes("CÁMARA") || s.includes("DVH"))
      );
    });
    if (escAccs.length > 0) {
      escAccs.forEach((ea: any) => {
        accessories.push({
          accessoryId: ea.id,
          quantity: 4,
          isLinear: false,
          label: "Escuadra DVH",
        });
      });
    } else {
      const dvhEscs = (dvhInputs || []).filter((d: any) => d.type === "Escuadras");
      dvhEscs.forEach((de: any) => {
        accessories.push({
          accessoryId: de.id,
          quantity: 4,
          isLinear: false,
          label: "Escuadra DVH",
        });
      });
    }
  }

  if (!hasButilo) {
    const butAcc = (accessoriesList || []).find((a: any) => {
      const s = `${a.code || ""} ${a.detail || ""}`.toUpperCase();
      return s.includes("BUTILO");
    }) || (dvhInputs || []).find((d: any) => d.type === "Butilo" || (d.detail || "").toUpperCase().includes("BUTILO"));
    if (butAcc) {
      accessories.push({
        accessoryId: butAcc.id,
        quantity: 1,
        isLinear: true,
        formula: "(W+H)*4",
        label: "Butilo DVH",
      });
    }
  }

  // Ensure accessories have descriptive labels
  accessories = accessories.map((a) => ({
    ...a,
    label: a.label || (dvhRecipe?.name ? `Insumo (${dvhRecipe.name})` : "Insumo DVH"),
  }));

  return {
    profiles,
    accessories,
    recipe: dvhRecipe,
  };
};

/**
 * Filters profiles or accessories based on the selected camera thickness:
 * - Spacer profiles: only keeps the camera profile for the chosen thickness.
 * - Escuadras: only keeps the corner key for the chosen camera thickness.
 * - Butilo & Sales: kept for perimeter/salt calculations.
 * - Standard carpentry profiles: unaffected.
 */
export const filterDVHProfiles = <T extends { profileId?: string; accessoryId?: string; role?: string }>(
  items: T[],
  isDVH: boolean,
  dvhCameraId: string | undefined,
  dvhInputs: any[],
  lookupArray: any[]
): T[] => {
  const isContravidrioItem = (item: any): boolean => {
    const role = (item.role || "").toLowerCase();
    return role.includes("contravidrio") || role.includes("contra");
  };

  if (!isDVH || !dvhCameraId) {
    return items.filter((item) => {
      if (isContravidrioItem(item)) return true;
      const def = lookupArray.find((a) => a.id === (item.profileId || item.accessoryId)) || (dvhInputs || []).find((d) => d.id === (item.profileId || item.accessoryId));
      if (!def) return true;
      const codeDetail = `${def.code || ""} ${def.detail || ""}`.toUpperCase();
      const isDvhExclusive =
        codeDetail.includes("DVH") ||
        codeDetail.includes("CAMARA") ||
        codeDetail.includes("CÁMARA") ||
        codeDetail.includes("CMRA") ||
        codeDetail.includes("BUTILO") ||
        codeDetail.includes("SALES") ||
        codeDetail.includes("TAMIZ");
      return !isDvhExclusive;
    });
  }

  const camInput = dvhInputs.find((i) => i.id === dvhCameraId);
  let camThick = camInput?.thickness || 12;
  if (!camInput?.thickness && typeof camInput?.detail === "string") {
    const m = camInput.detail.match(/(\d+)\s*mm/i);
    if (m) camThick = parseInt(m[1], 10);
    else {
      const ext = extractsDVHThickness(camInput.detail);
      if (ext) camThick = ext;
    }
  }

  return items.filter((item) => {
    if (isContravidrioItem(item)) return true;
    const defId = item.profileId || item.accessoryId;
    const def = lookupArray.find(
      (a) => String(a.id) === String(defId) || String(a.code) === String(defId)
    ) || (dvhInputs || []).find(
      (d) => String(d.id) === String(defId)
    );
    if (!def) return true;

    const str = `${def.code || ""} ${def.detail || ""}`.toUpperCase();
    const t = extractsDVHThickness(str, def);

    const isDvhThicknessSpecific =
      str.includes("CMRA") ||
      str.includes("CAMARA") ||
      str.includes("CÁMARA") ||
      (str.includes("ESCUADRA") &&
        (str.includes("CMRA") ||
          str.includes("CAMARA") ||
          str.includes("CÁMARA") ||
          str.includes("DVH")));

    if (t !== null && isDvhThicknessSpecific) {
      return t === camThick;
    }

    return true; // Keep generic items like "BUTILO", "SALES", or general frame items
  });
};

/**
 * Calculates the exact weight in grams of desiccant salt (molecular sieve)
 * required based on camera perimeter (in meters) and camera thickness.
 * Standard carpentry consumption rates:
 * - <= 6mm: 22.5 g/m
 * - 8mm: 30.0 g/m
 * - 9mm: 37.5 g/m
 * - 10mm: 42.0 g/m
 * - 12mm: 52.5 g/m
 * - 14mm: 60.0 g/m
 * - 16mm: 67.5 g/m
 * - 19/20mm: 87.5 g/m
 */
export const calculateSalesGrams = (perimeterMeters: number, camThick: number): number => {
  let gramsPerMeter = 37.5;
  if (camThick <= 6) gramsPerMeter = 22.5;
  else if (camThick <= 8) gramsPerMeter = 30.0;
  else if (camThick <= 9) gramsPerMeter = 37.5;
  else if (camThick <= 10) gramsPerMeter = 42.0;
  else if (camThick <= 12) gramsPerMeter = 52.5;
  else if (camThick <= 14) gramsPerMeter = 60.0;
  else if (camThick <= 16) gramsPerMeter = 67.5;
  else if (camThick <= 19) gramsPerMeter = 82.5;
  else if (camThick <= 20) gramsPerMeter = 87.5;
  else gramsPerMeter = camThick * 4.4;
  return Math.round(perimeterMeters * gramsPerMeter * 10) / 10;
};

export interface DVHPaneCalculation {
  width: number;
  height: number;
  perimeterMeters: number;
  cameraThickness: number;
  cameraDetail: string;
  glassOuterDetail: string;
  glassInnerDetail: string;
  totalGlassThickness: number;
  salesGrams: number;
  salesKg: number;
  escuadrasCount: number;
  escuadraDetail: string;
  butiloMeters: number;
}

export const calculateDVHPaneDetails = (
  paneW: number,
  paneH: number,
  cameraThickness: number,
  cameraDetail: string,
  glassOuter?: any,
  glassInner?: any,
  escuadraDetail?: string
): DVHPaneCalculation => {
  const pMeters = ((Math.max(paneW, 0) + Math.max(paneH, 0)) * 2) / 1000;
  const salesGrams = calculateSalesGrams(pMeters, cameraThickness);
  const salesKg = Math.round((salesGrams / 1000) * 1000) / 1000;
  const gOutThick = glassOuter?.thickness || extractsDVHThickness(glassOuter?.detail || "") || 4;
  const gInThick = glassInner?.thickness || extractsDVHThickness(glassInner?.detail || "") || 4;
  const totalGlassThickness = gOutThick + cameraThickness + gInThick;

  return {
    width: Math.round(paneW),
    height: Math.round(paneH),
    perimeterMeters: Math.round(pMeters * 100) / 100,
    cameraThickness,
    cameraDetail,
    glassOuterDetail: glassOuter?.detail || `${gOutThick} mm`,
    glassInnerDetail: glassInner?.detail || `${gInThick} mm`,
    totalGlassThickness,
    salesGrams,
    salesKg,
    escuadrasCount: 4,
    escuadraDetail: escuadraDetail || `Escuadra Cámara ${cameraThickness}mm`,
    butiloMeters: Math.round(pMeters * 2 * 100) / 100,
  };
};
