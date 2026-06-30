import {
  ProductRecipe,
  AluminumProfile,
  GlobalConfig,
  Treatment,
  Glass,
  Accessory,
  DVHInput,
  RecipeAccessory,
  BlindPanel,
  QuoteItem,
  QuoteItemBreakdown,
  MeasurementModule,
} from "../types";
import { filterDVHProfiles, calculateSalesGrams, getDVHExtras } from "./dvhHelper";

export const evaluateFormula = (
  formula: string,
  W: number,
  H: number,
): number => {
  try {
    const raw = (formula || "").toString().toUpperCase();
    if (!raw) return 0;

    // Handle implicit multiplication for variables e.g. 2W -> 2*W, W2 -> W*2, 2(W) -> 2*(W) handled later
    let preCleaned = raw
      .replace(/([0-9.])([WH])/g, "$1*$2")
      .replace(/([WH])([0-9.])/g, "$1*$2");

    const cleanFormula = preCleaned
      .replace(/W/g, (W || 0).toString())
      .replace(/H/g, (H || 0).toString());

    // Sanitización estricta: solo permite números, operadores matemáticos básicos, paréntesis y espacios
    if (!/^[0-9+\-*/().\s]+$/.test(cleanFormula)) {
      console.warn("Caracteres inválidos en la fórmula:", formula);
      return 0;
    }

    // Reparación Profesional: Elimina operadores y paréntesis de apertura incompletos al final (útil al escribir en tiempo real)
    let balanced = cleanFormula.trim();
    while (/[+\-*/(\s]$/.test(balanced)) {
      balanced = balanced.replace(/[+\-*/(\s]+$/, "").trim();
    }
    if (!balanced) return 0;

    // Reparación Profesional: Auto-balanceo de paréntesis
    const openP = (balanced.match(/\(/g) || []).length;
    const closeP = (balanced.match(/\)/g) || []).length;

    if (openP > closeP) {
      balanced += ")".repeat(openP - closeP);
    } else if (closeP > openP) {
      // Si sobran paréntesis de cierre, intentamos limpiar el excedente al final
      // o simplemente invalidamos si es estructuralmente incorrecto
      console.warn("Fórmula con exceso de paréntesis de cierre:", formula);
      return 0;
    }

    // Fix implicit multiplication with optional spaces
    // e.g., "2 (W)" -> "2 * (W)", "(W) (H)" -> "(W) * (H)", "(W) 2" -> "(W) * 2"
    balanced = balanced
      .replace(/\)\s*(?=[0-9(.])/g, ")*")
      .replace(/([0-9.])\s*(?=\()/g, "$1*");

    const result = new Function(`return ${balanced}`)();
    return isFinite(result) ? result : 0;
  } catch (e) {
    // Evitamos usar console.error con el prefijo "Error parsing formula" para no contaminar logs del sistema
    return 0;
  }
};

export const calculateModuleDimensions = (
  mod: { x: number; y: number; width?: number; height?: number; [key: string]: any },
  colRatios: number[],
  rowRatios: number[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  realDeduction: number,
  isManualDim?: boolean,
): { modW: number; modH: number } => {
  let modW = 0;
  let modH = 0;

  if (isManualDim && mod.width && mod.height) {
    modW = mod.width;
    modH = mod.height;
  } else {
    const totalW = colRatios.reduce((a, b) => a + b, 0);
    const totalH = rowRatios.reduce((a, b) => a + b, 0);

    const numCols = colRatios.length;
    const numRows = rowRatios.length;

    const netW = totalW - (numCols > 1 ? (numCols - 1) * realDeduction : 0);
    const netH = totalH - (numRows > 1 ? (numRows - 1) * realDeduction : 0);

    const ratioW = totalW > 0 ? (colRatios[mod.x - minX] || 0) / totalW : 0;
    const ratioH = totalH > 0 ? (rowRatios[mod.y - minY] || 0) / totalH : 0;

    modW = netW * ratioW;
    modH = netH * ratioH;
  }

  return { modW, modH };
};

export const calculateCompositePrice = (
  item: QuoteItem,
  recipes: ProductRecipe[],
  profiles: AluminumProfile[],
  config: GlobalConfig,
  treatment: Treatment,
  glasses: Glass[],
  accessories: Accessory[],
  dvhInputs: DVHInput[],
  blindPanels: BlindPanel[],
  glazingBeadStylePreference: "Recto" | "Curvo" = "Recto",
): {
  materialCost: number;
  totalAluWeight: number;
  finalPrice: number;
  breakdown: QuoteItemBreakdown;
} => {
  let totalAluCost = 0;
  let totalGlassCost = 0;
  let totalAccCost = 0;
  let totalAluWeight = 0;

  const {
    modules,
    colRatios,
    rowRatios,
    couplingDeduction: baseDeduction,
    isManualDim,
  } = item.composition;

  const cProfile = item.couplingProfileId
    ? profiles.find((p) => p.id === item.couplingProfileId)
    : null;
  const realDeduction = Number(cProfile?.thickness ?? baseDeduction ?? 0);

  const validModules = (modules || []).filter(
    (m) => m && typeof m.x === "number" && typeof m.y === "number",
  );
  let hasHandrail = false;
  let hasMampara = false;

  if (validModules.length === 0) {
    const emptyBreakdown: QuoteItemBreakdown = {
      aluCost: 0,
      glassCost: 0,
      accCost: 0,
      laborCost: 0,
      materialCost: 0,
      totalWeight: 0,
    };
    return {
      materialCost: 0,
      totalAluWeight: 0,
      finalPrice: 0,
      breakdown: emptyBreakdown,
    };
  }

  const minX = Math.min(...validModules.map((m) => m.x));
  const minY = Math.min(...validModules.map((m) => m.y));
  const maxX = Math.max(...validModules.map((m) => m.x));
  const maxY = Math.max(...validModules.map((m) => m.y));
  const isSet = validModules.length > 1;

  validModules.forEach((mod) => {
    const recipe = recipes.find((r) => r.id === mod.recipeId);
    if (!recipe) return;
    if (recipe.type === "Baranda") hasHandrail = true;
    if (recipe.type === "Mampara") hasMampara = true;

    const { modW, modH } = calculateModuleDimensions(
      mod,
      colRatios,
      rowRatios,
      minX,
      maxX,
      minY,
      maxY,
      realDeduction,
      isManualDim,
    );

    const result = calculateItemPrice(
      recipe,
      recipes,
      modW,
      modH,
      profiles,
      config,
      treatment,
      glasses,
      accessories,
      dvhInputs,
      mod.isDVH,
      mod.glassOuterId,
      mod.glassInnerId,
      mod.dvhCameraId,
      item.extras,
      undefined,
      mod.transoms,
      mod.overriddenAccessories,
      mod.blindPanes,
      mod.blindPaneIds,
      blindPanels,
      isSet,
      mod.slatProfileIds,
      glazingBeadStylePreference,
      mod.handrailProfileId,
      mod.handrailType,
      undefined,
      mod.leafAlternative,
      !!validModules.find((m) => m.x === mod.x - 1 && m.y === mod.y), // isRightModule
      !!validModules.find((m) => m.x === mod.x && m.y === mod.y - 1), // isBottomModule
      item.quotingMode,
      mod.leftHeight,
      mod.rightHeight,
      mod.perLeafConfiguration
    );

    totalAluCost += result.aluCost;
    totalGlassCost += result.glassCost;
    totalAccCost += result.accCost;
    totalAluWeight += result.totalAluWeight;
    
    // Si tiene mosquitero y una receta de mosquitero seleccionada
    if (item.extras?.mosquitero && item.extras?.mosquiteroRecipeId) {
      const mosqRecipe = recipes.find(r => r.id === item.extras!.mosquiteroRecipeId);
      if (mosqRecipe) {
        let mosqW = modW;
        const visualTypeLower = (recipe.visualType || "").toLowerCase();
        let numLeaves = recipe.leaves || 1;
        if (!recipe.leaves) {
          if (visualTypeLower.includes("sliding_3") || visualTypeLower.includes("corrediza_3")) numLeaves = 3;
          else if (visualTypeLower.includes("sliding_4") || visualTypeLower.includes("corrediza_4")) numLeaves = 4;
          else if (visualTypeLower.includes("sliding") || visualTypeLower.includes("corrediza")) numLeaves = 2;
          else if (visualTypeLower.includes("double") || visualTypeLower.includes("doble")) numLeaves = 2;
        }

        if (visualTypeLower.includes("sliding") || numLeaves > 1) {
            mosqW = modW / Math.max(1, numLeaves);
        }
        
        const mosqResult = calculateItemPrice(
           mosqRecipe,
           recipes,
           mosqW,
           modH,
           profiles,
           config,
           treatment,
           glasses,
           accessories,
           dvhInputs,
           false, // isDVH
           mod.glassOuterId,
           undefined,
           undefined,
           { 
             mosquitero: true, 
             tapajuntas: false, 
             tapajuntasSides: { top: false, bottom: false, left: false, right: false } 
           }, // extras
           undefined, // coupling
           [], // transoms
           [], // overridden
           [],
           {},
           blindPanels,
           false, // isSet
           {},
           glazingBeadStylePreference,
        );

        totalAluCost += mosqResult.aluCost;
        totalGlassCost += mosqResult.glassCost;
        totalAccCost += mosqResult.accCost;
        totalAluWeight += mosqResult.totalAluWeight;
      }
    }
  });

  const baseAluPrice =
    Number(config.aluminumPricePerKg || 0) + Number(treatment.pricePerKg || 0);

  // Cálculo de Acoples
  if (cProfile && isSet) {
    const pWeight = Number(cProfile.weightPerMeter || 0);
    let totalCouplingMm = 0;
    if (colRatios.length > 1) {
      for (let x = minX; x < maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const modL = validModules.find((m) => m.x === x && m.y === y);
          const modR = validModules.find((m) => m.x === x + 1 && m.y === y);
          if (modL && modR) {
            let overlap = 0;
            if (isManualDim && modL.manualOffsetY !== undefined && modR.manualOffsetY !== undefined && modL.height !== undefined && modR.height !== undefined) {
              const y1 = modL.manualOffsetY;
              const h1 = modL.height;
              const y2 = modR.manualOffsetY;
              const h2 = modR.height;
              overlap = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
            } else {
              const hL = isManualDim && modL.height ? modL.height : Number(rowRatios[y - minY] || 0);
              const hR = isManualDim && modR.height ? modR.height : Number(rowRatios[y - minY] || 0);
              overlap = Math.min(hL, hR);
            }
            totalCouplingMm += overlap;
          }
        }
      }
    }
    if (rowRatios.length > 1) {
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const modT = validModules.find((m) => m.x === x && m.y === y);
          const modB = validModules.find((m) => m.x === x && m.y === y + 1);
          if (modT && modB) {
            let overlap = 0;
            if (isManualDim && modT.manualOffsetX !== undefined && modB.manualOffsetX !== undefined && modT.width !== undefined && modB.width !== undefined) {
              const x1 = modT.manualOffsetX;
              const w1 = modT.width;
              const x2 = modB.manualOffsetX;
              const w2 = modB.width;
              overlap = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
            } else {
              const wT = isManualDim && modT.width ? modT.width : Number(colRatios[x - minX] || 0);
              const wB = isManualDim && modB.width ? modB.width : Number(colRatios[x - minX] || 0);
              overlap = Math.min(wT, wB);
            }
            totalCouplingMm += overlap;
          }
        }
      }
    }
    const cWeight = (totalCouplingMm / 1000) * pWeight;
    totalAluCost += cWeight * baseAluPrice;
    totalAluWeight += cWeight;
  }

  // Cálculo de Tapajuntas Unificado (Para Individuales y Conjuntos)
  if (item.extras.tapajuntas && validModules.length > 0) {
    const firstRecipe = recipes.find((r) => r.id === validModules[0].recipeId);
    let tjProfile = profiles.find(
      (p) => p.id === firstRecipe?.defaultTapajuntasProfileId,
    );
    if (!tjProfile && firstRecipe) {
      const tjRef = firstRecipe.profiles.find((p) => p.role === "Tapajuntas");
      if (tjRef) tjProfile = profiles.find((p) => p.id === tjRef.profileId);
    }
    if (!tjProfile) {
      tjProfile = profiles.find(
        (p) =>
          p.code.toUpperCase().includes("TJ") ||
          p.detail.toLowerCase().includes("tapajunta"),
      );
    }

    if (tjProfile) {
      const tjThick = Number(tjProfile.thickness || 30);
      const { top, bottom, left, right } = item.extras.tapajuntasSides;
      let totalTjMm = 0;

      const firstTrapMod = validModules.find((m) => {
        const r = recipes.find((x) => x.id === m.recipeId);
        if (!r) return false;
        return (
          (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
          m.leftHeight !== undefined &&
          m.rightHeight !== undefined &&
          m.leftHeight > 0 &&
          m.rightHeight > 0 &&
          m.leftHeight !== m.rightHeight
        );
      });

      let lh = item.height;
      let rh = item.height;
      let isTrap = false;

      if (isSet) {
        const realDeduction = Number(cProfile?.thickness ?? item.composition.couplingDeduction ?? 0);

        // LHS total height
        let lhsSum = 0;
        let lhsCouplings = 0;
        for (let y = minY; y <= maxY; y++) {
          const mod = validModules.find((m) => m.x === minX && m.y === y);
          if (mod) {
            const r = recipes.find((x) => x.id === mod.recipeId);
            const { modH } = calculateModuleDimensions(
              mod,
              colRatios,
              rowRatios,
              minX,
              maxX,
              minY,
              maxY,
              realDeduction,
              isManualDim,
            );
            
            const isModTrap = r &&
              (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
              mod.leftHeight !== undefined &&
              mod.rightHeight !== undefined &&
              mod.leftHeight > 0 &&
              mod.rightHeight > 0 &&
              mod.leftHeight !== mod.rightHeight;

            const modLh = isModTrap ? mod.leftHeight! : modH;
            lhsSum += modLh;
            if (y < maxY) {
              const belowMod = validModules.find((m) => m.x === minX && m.y === y + 1);
              if (belowMod) {
                lhsCouplings += realDeduction;
              }
            }
          }
        }
        lh = lhsSum + lhsCouplings;

        // RHS total height
        let rhsSum = 0;
        let rhsCouplings = 0;
        for (let y = minY; y <= maxY; y++) {
          const mod = validModules.find((m) => m.x === maxX && m.y === y);
          if (mod) {
            const r = recipes.find((x) => x.id === mod.recipeId);
            const { modH } = calculateModuleDimensions(
              mod,
              colRatios,
              rowRatios,
              minX,
              maxX,
              minY,
              maxY,
              realDeduction,
              isManualDim,
            );
            
            const isModTrap = r &&
              (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
              mod.leftHeight !== undefined &&
              mod.rightHeight !== undefined &&
              mod.leftHeight > 0 &&
              mod.rightHeight > 0 &&
              mod.leftHeight !== mod.rightHeight;

            const modRh = isModTrap ? mod.rightHeight! : modH;
            rhsSum += modRh;
            if (y < maxY) {
              const belowMod = validModules.find((m) => m.x === maxX && m.y === y + 1);
              if (belowMod) {
                rhsCouplings += realDeduction;
              }
            }
          }
        }
        rh = rhsSum + rhsCouplings;
        isTrap = !!firstTrapMod;
      } else {
        isTrap = !!firstTrapMod;
        lh = isTrap ? firstTrapMod!.leftHeight! : item.height;
        rh = isTrap ? firstTrapMod!.rightHeight! : item.height;
      }

      const inclinedTJTop = isTrap
        ? Math.sqrt(Math.pow(item.width, 2) + Math.pow(rh - lh, 2))
        : item.width;

      // 1. Perímetro Exterior
      if (top) {
        const baseLen = isTrap ? inclinedTJTop : item.width;
        totalTjMm += baseLen + (left ? tjThick : 0) + (right ? tjThick : 0);
      }
      if (bottom) {
        totalTjMm += item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
      }
      if (left) {
        totalTjMm += lh + (top ? tjThick : 0) + (bottom ? tjThick : 0);
      }
      if (right) {
        totalTjMm += rh + (top ? tjThick : 0) + (bottom ? tjThick : 0);
      }

      // 2. Desniveles Verticales (Solo aplica en conjuntos)
      if (isSet && colRatios.length > 1) {
        for (let x = minX; x < maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            const mL = validModules.find((m) => m.x === x && m.y === y);
            const mR = validModules.find((m) => m.x === x + 1 && m.y === y);
            if (mL && mR) {
              if (isManualDim && mL.manualOffsetY !== undefined && mR.manualOffsetY !== undefined && mL.height !== undefined && mR.height !== undefined) {
                // El desnivel arriba (diferencia de Ys) y el desnivel abajo (diferencia de Y+Hs)
                const y1 = mL.manualOffsetY;
                const h1 = mL.height;
                const y2 = mR.manualOffsetY;
                const h2 = mR.height;
                // Calculamos cuánto perfil queda descubierto
                totalTjMm += Math.abs(y1 - y2) + Math.abs((y1 + h1) - (y2 + h2));
              } else {
                const hL = isManualDim && mL.height ? mL.height : Number(rowRatios[y - minY] || 0);
                const hR = isManualDim && mR.height ? mR.height : Number(rowRatios[y - minY] || 0);
                totalTjMm += Math.abs(hL - hR);
              }
            }
          }
        }
      }

      // 3. Desniveles Horizontales (Solo aplica en conjuntos)
      if (isSet && rowRatios.length > 1) {
        for (let y = minY; y < maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const mT = validModules.find((m) => m.x === x && m.y === y);
            const mB = validModules.find((m) => m.x === x && m.y === y + 1);
            if (mT && mB) {
              if (isManualDim && mT.manualOffsetX !== undefined && mB.manualOffsetX !== undefined && mT.width !== undefined && mB.width !== undefined) {
                const x1 = mT.manualOffsetX;
                const w1 = mT.width;
                const x2 = mB.manualOffsetX;
                const w2 = mB.width;
                totalTjMm += Math.abs(x1 - x2) + Math.abs((x1 + w1) - (x2 + w2));
              } else {
                const wT = isManualDim && mT.width ? mT.width : Number(colRatios[x - minX] || 0);
                const wB = isManualDim && mB.width ? mB.width : Number(colRatios[x - minX] || 0);
                totalTjMm += Math.abs(wT - wB);
              }
            }
          }
        }
      }

      const tjWeight =
        (totalTjMm / 1000) * Number(tjProfile.weightPerMeter || 0);
      totalAluCost += tjWeight * baseAluPrice;
      totalAluWeight += tjWeight;
    }
  }

  const materialCost = totalAluCost + totalGlassCost + totalAccCost;
  const laborCost = materialCost * (Number(config.laborPercentage || 0) / 100);
  const handrailExtraCost = hasHandrail
    ? (materialCost + laborCost) *
      (Number(config.handrailExtraIncrement || 0) / 100)
    : 0;
  const mamparaExtraCost = hasMampara
    ? (materialCost + laborCost) *
      (Number(config.mamparaExtraIncrement || 0) / 100)
    : 0;
  const finalPrice =
    materialCost + laborCost + handrailExtraCost + mamparaExtraCost;

  const breakdown: QuoteItemBreakdown = {
    aluCost: totalAluCost,
    glassCost: totalGlassCost,
    accCost: totalAccCost,
    laborCost: laborCost,
    materialCost: materialCost,
    totalWeight: totalAluWeight,
    handrailExtraCost: handrailExtraCost,
    mamparaExtraCost: mamparaExtraCost,
  };

  return { materialCost, totalAluWeight, finalPrice, breakdown };
};

export const calculateItemPrice = (
  recipe: ProductRecipe,
  recipes: ProductRecipe[],
  width: number,
  height: number,
  profiles: AluminumProfile[],
  config: GlobalConfig,
  treatment: Treatment,
  glasses: Glass[],
  accessories: Accessory[],
  dvhInputs: DVHInput[],
  isDVH: boolean,
  glassOuterId: string,
  glassInnerId?: string,
  dvhCameraId?: string,
  extras?: {
    mosquitero: boolean;
    mosquiteroRecipeId?: string;
    tapajuntas: boolean;
    tapajuntasSides: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
    };
  },
  coupling?: { profileId?: string; position: string },
  transoms?: { height: number; profileId: string; formula?: string }[],
  overriddenAccessories?: RecipeAccessory[],
  blindPanes: number[] = [],
  blindPaneIds: Record<number, string> = {},
  blindPanels: BlindPanel[] = [],
  isSet: boolean = false,
  slatProfileIds: Record<number, string> = {},
  glazingBeadStylePreference: "Recto" | "Curvo" = "Recto",
  handrailProfileId?: string,
  handrailType?: "recta" | "inclinada",
  leafWidths?: number[],
  leafAlternative?: "A" | "B",
  isRightModule?: boolean,
  isBottomModule?: boolean,
  quotingMode?: "Completa" | "Solo Marcos" | "Solo Hojas",
  leftHeight?: number,
  rightHeight?: number,
  perLeafConfiguration?: Record<number, { transoms: { height: number; profileId: string; formula?: string }[]; blindPanes: number[]; blindPaneIds: Record<number, string>; slatProfileIds: Record<number, string>; glassOuterId?: string; isDVH?: boolean; }>
) => {
  let totalAluWeight = 0;
  let aluCost = 0;
  let glassCost = 0;
  let accCost = 0;

  const isTrapezoid =
    (recipe.type === "Paño Fijo" ||
     recipe.name.toLowerCase().includes("paño fijo") ||
     recipe.name.toLowerCase().includes("pf") ||
     recipe.id === "vidrio_solo" ||
     recipe.name.toLowerCase().includes("vidrio")) &&
    leftHeight !== undefined &&
    rightHeight !== undefined &&
    leftHeight > 0 &&
    rightHeight > 0 &&
    leftHeight !== rightHeight;

  const inclinedW = isTrapezoid
    ? Math.sqrt(Math.pow(width, 2) + Math.pow(rightHeight! - leftHeight!, 2))
    : width;

  // 1. Calcular espesor total del vidrio para este módulo
  const outerGlassObj = glasses.find((g) => g.id === glassOuterId);
  const innerGlassObj =
    isDVH && glassInnerId ? glasses.find((g) => g.id === glassInnerId) : null;
  const defaultCamInput = dvhInputs.find((i) => i.type === "Cámara") || dvhInputs[0];
  const effectiveCameraId = isDVH ? (dvhCameraId || defaultCamInput?.id) : undefined;
  const dvhCameraObj =
    isDVH && effectiveCameraId ? dvhInputs.find((i) => i.id === effectiveCameraId) : null;

  // Estimación simple del espesor de la cámara (si el nombre contiene mm, o un valor por defecto)
  let cameraThickness = 0;
  if (dvhCameraObj) {
    cameraThickness = dvhCameraObj.thickness || 12; // Default 12mm si no se detecta
    if (!dvhCameraObj.thickness) {
      const match = dvhCameraObj.detail.match(/(\d+)\s*mm/i);
      if (match) cameraThickness = parseInt(match[1]);
    }
  }

  const getGlassThick = (g: Glass | undefined) => {
    if (!g) return 0;
    if (g.thickness) return g.thickness;
    // Intento buscar número + mm en el detalle
    const match = g.detail.match(/(\d+)\s*mm/i);
    if (match) return parseInt(match[1]);
    // Intento buscar en el código
    const matchCode = g.code.match(/(\d+)\s*mm/i);
    if (matchCode) return parseInt(matchCode[1]);
    return 4; // Default
  };

  const calculatedGlassThickness =
    getGlassThick(outerGlassObj) +
    (isDVH ? getGlassThick(innerGlassObj) + cameraThickness : 0);

  const filteredRecipeProfiles = filterDVHProfiles(recipe.profiles || [], isDVH, dvhCameraId, dvhInputs, profiles) as any[];

  const transomTemplate = filteredRecipeProfiles.find(
    (rp) =>
      rp.role === "Travesaño" ||
      (rp.role && rp.role.toLowerCase().includes("trave")),
  );
  const recipeTransomFormula =
    transomTemplate?.formula || recipe.transomFormula || "W";
  const recipeTransomQty = Number(transomTemplate?.quantity || 1);

  const activeProfiles = filteredRecipeProfiles.filter((rp) => {
    const role = (rp.role || "").toLowerCase();
    const p = profiles.find((x) => x.id === rp.profileId);
    if (!p) return true;

    // Filtro por alternativa
    if (rp.alternative && rp.alternative !== (leafAlternative || "A"))
      return false;

    // Filtro estricto de Tapajuntas: Siempre se excluyen de la receta base
    // para ser manejados por el cálculo centralizado de perímetro/lados activos.
    const isTJ =
      role.includes("tapa") ||
      String(p.code || "")
        .toUpperCase()
        .includes("TJ") ||
      p.id === recipe.defaultTapajuntasProfileId;
    if (isTJ) return false;

    const isMosq =
      role.includes("mosquitero") || p.id === recipe.mosquiteroProfileId;
    const isMosqRecipe = recipe.type === "Mosquitero" || (recipe.visualType || "").toLowerCase().includes("mosquitero") || (recipe.name || "").toLowerCase().includes("mosq");
    if (!isMosqRecipe && isMosq && (!extras?.mosquitero || extras?.mosquiteroRecipeId)) return false;

    if (quotingMode === "Solo Marcos") {
      if (role.includes("hoja") || role.includes("contravidrio") || isMosq) return false;
    } else if (quotingMode === "Solo Hojas") {
      if (role.includes("marco") || role.includes("zócalo") || role.includes("zocalo") || role.includes("acople") || role.includes("columna") || role.includes("viga") || role.includes("encuentro")) return false;
    }

    return true;
  });

  const baseAluPrice =
    Number(config.aluminumPricePerKg || 0) + Number(treatment.pricePerKg || 0);

  let removedColumna = false;
  let removedViga = false;

  let totalPlainHorizontalMarcoQty = 0;
  activeProfiles.forEach((rp) => {
    const roleLower = (rp.role || "").toLowerCase();
    const formulaUpper = (rp.formula || "").toUpperCase();
    const isPlainHorizontalMarco =
      (roleLower.includes("marco") || roleLower.includes("marcos")) &&
      formulaUpper.includes("W") &&
      !formulaUpper.includes("H") &&
      !roleLower.includes("cabe") &&
      !roleLower.includes("dintel") &&
      !roleLower.includes("superior") &&
      !roleLower.includes("sup") &&
      !roleLower.includes("umbra") &&
      !roleLower.includes("inferior") &&
      !roleLower.includes("inf") &&
      !roleLower.includes("zoc") &&
      !roleLower.includes("zócalo") &&
      !roleLower.includes("zocalo");
    if (isPlainHorizontalMarco) {
      totalPlainHorizontalMarcoQty += Number(rp.quantity || 0);
    }
  });

  let processedPlainHorizontalMarcoQty = 0;

  activeProfiles.forEach((rp) => {
    let profile = profiles.find((p) => p.id === rp.profileId);

    // Lógica de Contravidrio Dinámico
    if (rp.glazingBeadOptions && rp.glazingBeadOptions.length > 0) {
      // ... (code for glazing bead, kept same) ...
      const candidates = profiles.filter((p) =>
        rp.glazingBeadOptions?.includes(p.id),
      );

      // 1. Filtrar por estilo preferido
      let styleMatches = candidates.filter(
        (p) => p.glazingBeadStyle === glazingBeadStylePreference,
      );
      if (styleMatches.length === 0) styleMatches = candidates; // Fallback si no hay del estilo preferido

      // 2. Filtrar por espesor
      const thicknessMatch = styleMatches.find((p) => {
        const min = p.minGlassThickness || 0;
        const max = p.maxGlassThickness || 100;
        return (
          calculatedGlassThickness >= min && calculatedGlassThickness <= max
        );
      });

      if (thicknessMatch) {
        profile = thicknessMatch;
      } else {
        // Si no hay match exacto de espesor, buscar en TODOS los candidatos (ignorando estilo)
        const anyThicknessMatch = candidates.find((p) => {
          const min = p.minGlassThickness || 0;
          const max = p.maxGlassThickness || 100;
          return (
            calculatedGlassThickness >= min && calculatedGlassThickness <= max
          );
        });
        if (anyThicknessMatch) profile = anyThicknessMatch;
      }
    }

    if (profile) {
      let shouldRemove = false;
      const profileRole = (rp.role || "").toLowerCase();
      console.log(`[DEBUG] Final verification: isRight=${!!isRightModule}, isBottom=${!!isBottomModule}, ProfileRole: ${profileRole}`);
      
      if (recipe.name.toLowerCase() === "frente integral") {
        // Remove 1 'columna' for each right-coupled module
        if (isRightModule && profileRole === "columna" && !removedColumna) {
          console.log(`[DEBUG] REMOVING: Column for RIGHT coupled module. Profile role: ${profileRole}`);
          shouldRemove = true;
          removedColumna = true;
        } 
        // Remove 1 'viga' for each bottom-coupled module
        else if (isBottomModule && profileRole === "viga" && !removedViga) {
          console.log(`[DEBUG] REMOVING: Beam for BOTTOM coupled module. Profile role: ${profileRole}`);
          shouldRemove = true;
          removedViga = true;
        }
      }


      if (!shouldRemove) {
        let weight = 0;
        if (isTrapezoid) {
          const isContravidrio = profileRole === "contravidrio" || profileRole.includes("contra");
          const isVertical =
            profileRole.includes("jamba") ||
            profileRole.includes("lateral") ||
            profileRole.includes("parante") ||
            profileRole.includes("mocheta") ||
            (!profileRole.includes("cabe") && !profileRole.includes("dintel") && !profileRole.includes("umbra") && !profileRole.includes("zoc") && rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W"));

          const isTopHorizontal =
            profileRole.includes("dintel") ||
            profileRole.includes("cabezal") ||
            profileRole.includes("superior");

          if (isContravidrio) {
            // Contravidrios dinámicos de trapecio: adaptan sus largos
            if (rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W")) {
              const qtyLeft = Math.ceil(Number(rp.quantity || 0) / 2);
              const qtyRight = Math.floor(Number(rp.quantity || 0) / 2);
              
              const cutLeft = evaluateFormula(rp.formula, width, leftHeight!);
              const cutRight = evaluateFormula(rp.formula, width, rightHeight!);
              
              const weightLeft = ((cutLeft + Number(config.discWidth || 0)) / 1000) * qtyLeft * Number(profile.weightPerMeter || 0);
              const weightRight = ((cutRight + Number(config.discWidth || 0)) / 1000) * qtyRight * Number(profile.weightPerMeter || 0);
              weight = weightLeft + weightRight;
            } else {
              const qtyBottom = Math.ceil(Number(rp.quantity || 0) / 2);
              const qtyTop = Math.floor(Number(rp.quantity || 0) / 2);
              
              const cutBottom = evaluateFormula(rp.formula, width, height);
              const cutTop = evaluateFormula(rp.formula, inclinedW, height);
              
              const weightBottom = ((cutBottom + Number(config.discWidth || 0)) / 1000) * qtyBottom * Number(profile.weightPerMeter || 0);
              const weightTop = ((cutTop + Number(config.discWidth || 0)) / 1000) * qtyTop * Number(profile.weightPerMeter || 0);
              weight = weightBottom + weightTop;
            }
          } else if (isVertical) {
            const qtyLeft = Math.ceil(Number(rp.quantity || 0) / 2);
            const qtyRight = Math.floor(Number(rp.quantity || 0) / 2);
            
            const cutLeft = evaluateFormula(rp.formula, width, leftHeight!);
            const cutRight = evaluateFormula(rp.formula, width, rightHeight!);
            
            const weightLeft = ((cutLeft + Number(config.discWidth || 0)) / 1000) * qtyLeft * Number(profile.weightPerMeter || 0);
            const weightRight = ((cutRight + Number(config.discWidth || 0)) / 1000) * qtyRight * Number(profile.weightPerMeter || 0);
            weight = weightLeft + weightRight;
          } else if (isTopHorizontal) {
            const cutMeasure = evaluateFormula(rp.formula, inclinedW, height);
            weight = ((cutMeasure + Number(config.discWidth || 0)) / 1000) * Number(rp.quantity || 0) * Number(profile.weightPerMeter || 0);
          } else if (
            (profileRole.includes("marco") || profileRole.includes("marcos")) &&
            rp.formula.toUpperCase().includes("W") &&
            !rp.formula.toUpperCase().includes("H") &&
            !profileRole.includes("cabe") &&
            !profileRole.includes("dintel") &&
            !profileRole.includes("superior") &&
            !profileRole.includes("sup") &&
            !profileRole.includes("umbra") &&
            !profileRole.includes("inferior") &&
            !profileRole.includes("inf") &&
            !profileRole.includes("zoc") &&
            !profileRole.includes("zócalo") &&
            !profileRole.includes("zocalo")
          ) {
            const qty = Number(rp.quantity || 0);
            let qtyBottom = 0;
            let qtyTop = 0;
            for (let k = 0; k < qty; k++) {
              const globalIdx = processedPlainHorizontalMarcoQty + k;
              if (globalIdx < Math.ceil(totalPlainHorizontalMarcoQty / 2)) {
                qtyBottom++;
              } else {
                qtyTop++;
              }
            }
            processedPlainHorizontalMarcoQty += qty;

            const cutBottom = evaluateFormula(rp.formula, width, height);
            const cutTop = evaluateFormula(rp.formula, inclinedW, height);

            const weightBottom = ((cutBottom + Number(config.discWidth || 0)) / 1000) * qtyBottom * Number(profile.weightPerMeter || 0);
            const weightTop = ((cutTop + Number(config.discWidth || 0)) / 1000) * qtyTop * Number(profile.weightPerMeter || 0);
            weight = weightBottom + weightTop;
          } else {
            const cutMeasure = evaluateFormula(rp.formula, width, height);
            weight = ((cutMeasure + Number(config.discWidth || 0)) / 1000) * Number(rp.quantity || 0) * Number(profile.weightPerMeter || 0);
          }
        } else {
          const cutMeasure = evaluateFormula(rp.formula, width, height);
          weight =
            ((cutMeasure + Number(config.discWidth || 0)) / 1000) *
            Number(rp.quantity || 0) *
            Number(profile.weightPerMeter || 0);
        }
        totalAluWeight += weight;
      }
    }
  });

  // 2. Travesaños y Contravidrios Extra
  if (transoms && transoms.length > 0) {
    const transomCount = transoms.length;

    // Identificar perfiles de contravidrio únicos usados en esta receta
    const usedGlazingBeadIds = new Set<string>();
    activeProfiles.forEach((rp) => {
      const role = (rp.role || "").toLowerCase();
      if (role === "contravidrio") {
        // Encontrar qué perfil se usaría para este contravidrio
        let pId = rp.profileId;
        if (rp.glazingBeadOptions && rp.glazingBeadOptions.length > 0) {
          const candidates = profiles.filter((p) =>
            rp.glazingBeadOptions?.includes(p.id),
          );
          let styleMatches = candidates.filter(
            (p) => p.glazingBeadStyle === glazingBeadStylePreference,
          );
          if (styleMatches.length === 0) styleMatches = candidates;
          const thicknessMatch =
            styleMatches.find((p) => {
              const min = p.minGlassThickness || 0;
              const max = p.maxGlassThickness || 100;
              return (
                calculatedGlassThickness >= min &&
                calculatedGlassThickness <= max
              );
            }) ||
            candidates.find((p) => {
              const min = p.minGlassThickness || 0;
              const max = p.maxGlassThickness || 100;
              return (
                calculatedGlassThickness >= min &&
                calculatedGlassThickness <= max
              );
            });
          if (thicknessMatch) pId = thicknessMatch.id;
        }
        usedGlazingBeadIds.add(pId);
      }
    });

    transoms.forEach((t) => {
      const isFrenteIntegral = recipe.name.toLowerCase().includes("frente integral");
      const trProf = profiles.find((p) => p.id === t.profileId);
      if (trProf) {
        const f = t.formula || recipeTransomFormula;
        const tCut = evaluateFormula(f, width, height);
        
        // 1. Calculate the profile explicitly selected by the user
        totalAluWeight +=
          ((tCut + Number(config.discWidth || 0)) / 1000) *
          recipeTransomQty *
          Number(trProf.weightPerMeter || 0);

        // 2. Extra for Frente Integral: Sum any other profiles in the recipe with the "Travesaño" role
        if (isFrenteIntegral) {
          const transomRecipeProfiles = (recipe.profiles || []).filter(
            (rp) =>
              rp.role === "Travesaño" ||
              (rp.role && rp.role.toLowerCase().includes("trave")),
          );

          // Identify if the selected profile is one of the recipe profiles to avoid double counting
          const alreadySummed = transomRecipeProfiles.some(rp => rp.profileId === t.profileId);

          transomRecipeProfiles.forEach((rp, idx) => {
            // Already added as trProf
            if (rp.profileId === t.profileId) return;
            
            // If the selected profile was an alternative (not in recipe), 
            // we assume it replaces the first profile of that role in the recipe.
            if (!alreadySummed && idx === 0) return;

            const otherProf = profiles.find((p) => p.id === rp.profileId);
            if (otherProf) {
              const rf = rp.formula || f;
              const rCut = evaluateFormula(rf, width, height);
              totalAluWeight +=
                ((rCut + Number(config.discWidth || 0)) / 1000) *
                Number(rp.quantity || 1) *
                Number(otherProf.weightPerMeter || 0);
            }
          });
        }

        // Sumar 2 contravidrios extra del mismo largo que el travesaño por cada tipo de contravidrio detectado
        usedGlazingBeadIds.forEach((gbId) => {
          const gbProf = profiles.find((p) => p.id === gbId);
          if (gbProf) {
            // El largo debe ser el mismo que el del travesaño (tCut) y a inglete
            const gbExtraWeight =
              ((tCut + Number(config.discWidth || 0)) / 1000) *
              2 *
              Number(gbProf.weightPerMeter || 0);
            totalAluWeight += gbExtraWeight;
          }
        });
      }
    });
  }

  // Lógica de Costo de Tapajuntas (Si está activo en extras)
  if (extras?.tapajuntas) {
    let tjProfile = profiles.find(
      (p) => p.id === recipe.defaultTapajuntasProfileId,
    );
    if (!tjProfile) {
      const tjRef = (recipe.profiles || []).find(
        (p) =>
          p.role === "Tapajuntas" ||
          (p.role && p.role.toLowerCase().includes("tapa")),
      );
      if (tjRef) tjProfile = profiles.find((p) => p.id === tjRef.profileId);
    }

    // Fallback global: Buscar cualquier perfil que sea Tapajuntas si la receta no lo especifica
    if (!tjProfile) {
      tjProfile = profiles.find(
        (p) =>
          p.code.toUpperCase().includes("TJ") ||
          p.detail.toLowerCase().includes("tapajunta"),
      );
    }

    if (tjProfile) {
      const sides = extras.tapajuntasSides || {
        top: true,
        bottom: true,
        left: true,
        right: true,
      };
      let totalLen = 0;
      const tjThick = Number(tjProfile.thickness || 30); // Ancho estimado del perfil si no está definido

      // Cálculo aproximado considerando los cortes a 45 grados
      if (sides.top)
        totalLen +=
          width + (sides.left ? tjThick : 0) + (sides.right ? tjThick : 0);
      if (sides.bottom)
        totalLen +=
          width + (sides.left ? tjThick : 0) + (sides.right ? tjThick : 0);
      if (sides.left)
        totalLen +=
          height + (sides.top ? tjThick : 0) + (sides.bottom ? tjThick : 0);
      if (sides.right)
        totalLen +=
          height + (sides.top ? tjThick : 0) + (sides.bottom ? tjThick : 0);

      totalAluWeight +=
        ((totalLen + Number(config.discWidth || 0) * 4) / 1000) *
        Number(tjProfile.weightPerMeter || 0);
    }
  }

  const getFormulaW = () =>
    isDVH && recipe.dvhFormulaW
      ? recipe.dvhFormulaW
      : recipe.glassFormulaW || "W";
  const getFormulaH = () =>
    isDVH && recipe.dvhFormulaH
      ? recipe.dvhFormulaH
      : recipe.glassFormulaH || "H";

  const adjustedW = width - Number(recipe.glassDeductionW || 0);
  const adjustedH = isTrapezoid
    ? Math.max(leftHeight!, rightHeight!) - Number(recipe.glassDeductionH || 0)
    : height - Number(recipe.glassDeductionH || 0);
  const visualType = (recipe.visualType || "").toLowerCase();
  let numLeaves = recipe.leaves || 1;

  if (!recipe.leaves) {
    if (visualType.includes("sliding_3") || visualType.includes("corrediza_3"))
      numLeaves = 3;
    else if (
      visualType.includes("sliding_4") ||
      visualType.includes("corrediza_4")
    )
      numLeaves = 4;
    else if (visualType.includes("sliding") || visualType.includes("corrediza"))
      numLeaves = 2;
    else if (
      visualType.includes("double") ||
      visualType.includes("doble") ||
      visualType.includes("2h")
    )
      numLeaves = 2;
  }

  let leafBaseW = adjustedW;
  if (visualType.includes("sliding") || numLeaves > 1)
    leafBaseW = adjustedW / numLeaves;
  const gW = evaluateFormula(getFormulaW(), leafBaseW, adjustedH);

  const transomGlassDeduction =
    isDVH && recipe.dvhTransomGlassDeduction !== undefined
      ? Number(recipe.dvhTransomGlassDeduction)
      : Number(recipe.transomGlassDeduction || 0);
  const panesHeights: number[] = [];
  if (!transoms || transoms.length === 0) {
    panesHeights.push(evaluateFormula(getFormulaH(), adjustedW, adjustedH));
  } else {
    const sorted = [...transoms].sort((a, b) => a.height - b.height);
    let lastY = 0;
    sorted.forEach((t, idx) => {
      const trProf = profiles.find((p) => p.id === t.profileId);
      const transomThickness = Number(
        trProf?.thickness || recipe.transomThickness || 40,
      );
      let ph =
        idx === 0
          ? Number(t.height) -
            transomThickness / 2 -
            Number(recipe.glassDeductionH || 0) / (transoms.length + 1) -
            transomGlassDeduction
          : Number(t.height) - lastY - transomThickness - transomGlassDeduction;
      panesHeights.push(ph);
      lastY = Number(t.height);
    });
    const lastTrProf = profiles.find(
      (p) => p.id === sorted[sorted.length - 1].profileId,
    );
    const lastTransomThickness = Number(
      lastTrProf?.thickness || recipe.transomThickness || 40,
    );
    panesHeights.push(
      height -
        lastY -
        (lastTrProf ? lastTransomThickness / 2 : 0) -
        Number(recipe.glassDeductionH || 0) / (transoms.length + 1) -
        transomGlassDeduction,
    );
  }

  blindPanes.forEach((paneIdx) => {
    const slatId = slatProfileIds[paneIdx];
    const specificBlind = blindPanels.find(
      (bp) => bp.id === blindPaneIds[paneIdx]
    );
    const slatProfile = profiles.find(
      (p) => p.id === slatId || (specificBlind && (p.id === specificBlind.aluminumProfileId || (p.code && p.code.trim().toLowerCase() === specificBlind.code.trim().toLowerCase())))
    );
    if (slatProfile) {
      const pH = panesHeights[paneIdx];
      const thickness = slatProfile.thickness > 0 ? slatProfile.thickness : (specificBlind && specificBlind.thickness > 0 ? specificBlind.thickness : 120);
      const slatCoverage = thickness > 0 ? thickness : 120;
      if (pH > 0) {
        const numSlats = Math.ceil(pH / slatCoverage);
        let totalLinealMm = 0;
        if (leafWidths && leafWidths.length > 0) {
          leafWidths.forEach((lw) => {
            const w = lw - Number(recipe.glassDeductionW || 0);
            const leafGW = evaluateFormula(getFormulaW(), w, adjustedH);
            totalLinealMm += (leafGW + Number(config.discWidth || 0)) * numSlats;
          });
        } else {
          totalLinealMm = (gW + Number(config.discWidth || 0)) * numSlats * numLeaves;
        }
        const slatWeight =
          (totalLinealMm / 1000) * Number(slatProfile.weightPerMeter || 0);
        const extraFactor = (Number(config.blindPanelExtraIncrement || 0) / 100);
        totalAluWeight += slatWeight * (1 + extraFactor);
      }
    }
  });

  aluCost = totalAluWeight * baseAluPrice;

  // 3.5 Lógica de Pasamano para Barandas
  if (handrailProfileId) {
    const handrailProf = profiles.find((p) => p.id === handrailProfileId);
    if (handrailProf) {
      const hWeight = (width / 1000) * Number(handrailProf.weightPerMeter || 0);
      totalAluWeight += hWeight;
      aluCost += hWeight * baseAluPrice;
    }
  }

  let activeAccessories =
    overriddenAccessories && overriddenAccessories.length > 0
      ? overriddenAccessories
      : recipe.accessories || [];
      
  if (isDVH && dvhCameraId) {
     const { accessories: dvhAccs } = getDVHExtras(recipes, isDVH);
     activeAccessories = [...activeAccessories, ...dvhAccs.map((a: any) => ({ ...a, isAlternative: false }))];
  }
      
  activeAccessories = filterDVHProfiles(activeAccessories, isDVH, dvhCameraId, dvhInputs, accessories) as any[];

  const glassPanes: { w: number; h: number }[] = [];

  // Ajuste de ancho de vidrio para barandas inclinadas (+1000mm para cálculo de valor)
  const getGWForCost = (w: number) =>
    recipe.type === "Baranda" && handrailType === "inclinada"
      ? evaluateFormula(getFormulaW(), w, adjustedH) + 1000
      : evaluateFormula(getFormulaW(), w, adjustedH);

  if (leafWidths && leafWidths.length > 0) {
    leafWidths.forEach((lw) => {
      const w = lw - Number(recipe.glassDeductionW || 0);
      if (!transoms || transoms.length === 0) {
        glassPanes.push({
          w: getGWForCost(w),
          h: evaluateFormula(getFormulaH(), w, adjustedH),
        });
      } else {
        panesHeights.forEach((ph) =>
          glassPanes.push({ w: getGWForCost(w), h: ph }),
        );
      }
    });
  } else {
    const gW = evaluateFormula(getFormulaW(), leafBaseW, adjustedH);
    const gH = evaluateFormula(getFormulaH(), adjustedW, adjustedH);
    if (!transoms || transoms.length === 0) {
      glassPanes.push({
        w:
          recipe.type === "Baranda" && handrailType === "inclinada"
            ? gW + 1000
            : gW,
        h: gH,
      });
    } else {
      panesHeights.forEach((ph) =>
        glassPanes.push({
          w:
            recipe.type === "Baranda" && handrailType === "inclinada"
              ? gW + 1000
              : gW,
          h: ph,
        }),
      );
    }
  }

  activeAccessories.forEach((ra) => {
    if (ra.isAlternative) return;

    const acc = accessories.find(
      (a) => a.id === ra.accessoryId || a.code === ra.accessoryId,
    );
    if (acc) {
      // Calculate sales quantity if it's SALES
      let calculatedQty = Number(ra.quantity || 0);
      if (isDVH && dvhCameraId) {
         if (acc.detail.toUpperCase().includes('SAL') || acc.code.toUpperCase().includes('SAL')) {
            let camInput = dvhInputs.find(c => c.id === dvhCameraId);
            let camThick = camInput?.thickness || 12;
            if (!camInput?.thickness && typeof camInput?.detail === 'string') {
              const m = camInput.detail.match(/(\d+)\s*mm/i);
              if (m) camThick = parseInt(m[1], 10);
            }
            // Sum perimeter of all glass panes in this module
            const totalPerimeterMeters = glassPanes.reduce((acc, pane, index) => {
               if (blindPanes.includes(index)) return acc;
               return acc + ((Math.max(pane.w || 0, 0) + Math.max(pane.h || 0, 0)) * 2) / 1000;
            }, 0);
            calculatedQty = calculateSalesGrams(totalPerimeterMeters, camThick);
         } else if (acc.detail.toUpperCase().includes('ESCUADRA') || acc.code.toUpperCase().includes('ESCUADRA')) {
            const panesCount = glassPanes.filter((_, index) => !blindPanes.includes(index)).length;
            calculatedQty = Number(ra.quantity || 4) * panesCount;
         }
      }

      const isMosqAcc = acc.detail.toLowerCase().includes("mosquitero") || acc.code.toLowerCase().includes("mosquitero") || acc.detail.toLowerCase().includes("malla");
      const isMosqRecipe = recipe.type === "Mosquitero" || (recipe.visualType || "").toLowerCase().includes("mosquitero") || (recipe.name || "").toLowerCase().includes("mosq");
      if (!isMosqRecipe && isMosqAcc && (!extras?.mosquitero || extras?.mosquiteroRecipeId)) return;

      const uPrice = Number(acc.unitPrice || 0);
      let calcPrice = uPrice;
      if (isDVH && dvhCameraId && (acc.detail.toUpperCase().includes('SAL') || acc.code.toUpperCase().includes('SAL'))) {
         // uPrice is per KG, so we need to divide by 1000 since we have grams
         calcPrice = uPrice / 1000;
      }
      
      if (ra.isLinear && ra.formula) {
        const lengthMm = evaluateFormula(ra.formula, width, height);
        const totalMeters = (lengthMm / 1000) * calculatedQty;
        accCost += calcPrice * totalMeters;
      } else if (ra.isSpaced && ra.spacingMm && ra.formula) {
        const lengthMm = evaluateFormula(ra.formula, width, height);
        const count = Math.ceil(lengthMm / ra.spacingMm);
        accCost += calcPrice * count * (calculatedQty === 0 ? 1 : calculatedQty);
      } else {
        accCost += calcPrice * calculatedQty;
      }
    }
  });

  const outerGlass = glasses.find((g) => g.id === glassOuterId);
  const innerGlass =
    isDVH && glassInnerId ? glasses.find((g) => g.id === glassInnerId) : null;
  const defaultCamInputGlass = dvhInputs.find((i) => i.type === "Cámara") || dvhInputs[0];
  const effectiveCameraIdGlass = isDVH ? (dvhCameraId || defaultCamInputGlass?.id) : undefined;
  const dvhCamera =
    isDVH && effectiveCameraIdGlass
      ? dvhInputs.find((i) => i.id === effectiveCameraIdGlass && i.type === "Cámara")
      : null;

  if (quotingMode !== "Solo Marcos") {
    const leafMultiplier = (leafWidths && leafWidths.length > 0) ? 1 : numLeaves;
    const panesCountPerLeaf = (transoms && transoms.length > 0) ? transoms.length + 1 : 1;
    glassPanes.forEach((pane, index) => {
      const areaM2 = (pane.w * pane.h) / 1000000;
      const billingAreaPerPiece = Math.max(areaM2, 0.5);
      const totalBillingArea = billingAreaPerPiece * leafMultiplier;

      if (visualType.includes("mosquitero") || recipe.type === "Mosquitero") {
        glassCost += Number(config.meshPricePerM2 || 25.0) * totalBillingArea;
        return;
      }

      const sectionIndex = index % panesCountPerLeaf;

      if (blindPanes.includes(sectionIndex)) {
        const specificBlind = blindPanels.find(
          (bp) => bp.id === blindPaneIds[sectionIndex],
        );
        const extraFactor = (Number(config.blindPanelExtraIncrement || 0) / 100);
        if (specificBlind) {
          if (specificBlind.unit === "ml") {
            const slatId = slatProfileIds[sectionIndex];
            const slatProfile = profiles.find(
              (p) => p.id === slatId || p.id === specificBlind.aluminumProfileId || (p.code && p.code.trim().toLowerCase() === specificBlind.code.trim().toLowerCase())
            );
            const thickness = slatProfile && slatProfile.thickness > 0 ? slatProfile.thickness : (specificBlind.thickness || 120);
            const numSlats = Math.ceil(pane.h / (thickness || 120));
            
            let totalLinealMm = 0;
            if (leafWidths && leafWidths.length > 0) {
              leafWidths.forEach((lw) => {
                const w = lw - Number(recipe.glassDeductionW || 0);
                const leafGW = evaluateFormula(getFormulaW(), w, adjustedH);
                totalLinealMm += (leafGW + Number(config.discWidth || 0)) * numSlats;
              });
            } else {
              totalLinealMm = (pane.w + Number(config.discWidth || 0)) * numSlats * leafMultiplier;
            }
            const totalLinealMeters = totalLinealMm / 1000;
            
            glassCost += Number(specificBlind.price || 0) * totalLinealMeters * (1 + extraFactor);
            
            // Add weight to aluminum if it wasn't already handled by slatProfileIds in Section 2
            if (!slatProfileIds[sectionIndex]) {
              const weightPerMeter = Number(slatProfile?.weightPerMeter || specificBlind.weightPerMeter || 0);
              if (weightPerMeter > 0) {
                const bpWeight = totalLinealMeters * weightPerMeter;
                totalAluWeight += bpWeight;
                aluCost += bpWeight * baseAluPrice;
              }
            }
          } else {
            // unit === "m2"
            glassCost += Number(specificBlind.price || 0) * billingAreaPerPiece * leafMultiplier * (1 + extraFactor);
          }
        } else {
          glassCost +=
            Number(config.blindPanelPricePerM2 || 0) * totalBillingArea * (1 + extraFactor);
        }
      } else {
        let glassSurcharge = 1.0;
        if (isTrapezoid && (recipe.id === "vidrio_solo" || recipe.name.toLowerCase().includes("vidrio"))) {
          glassSurcharge = 1.30; // 30% recargo por corte en falsa escuadra para vidrios solos
        }
        if (outerGlass)
          glassCost += Number(outerGlass.pricePerM2 || 0) * totalBillingArea * glassSurcharge;
        if (innerGlass)
          glassCost += Number(innerGlass.pricePerM2 || 0) * totalBillingArea * glassSurcharge;
        if (isDVH) {
          if (dvhCamera)
            glassCost +=
              Number(dvhCamera.cost || 0) *
              (((pane.w + pane.h) * 2) / 1000) *
              leafMultiplier;
          dvhInputs
            .filter((i) => i.type !== "Cámara")
            .forEach(
              (input) =>
                (glassCost += Number(input.cost || 0) * areaM2 * leafMultiplier),
            );
          
          if (!blindPanes.includes(sectionIndex) && effectiveCameraIdGlass) {
             const { profiles: rawDvhProfs } = getDVHExtras(recipes, isDVH);
             const dvhProfs = filterDVHProfiles(rawDvhProfs, isDVH, effectiveCameraIdGlass, dvhInputs, profiles) as any[];
             const wasteFactor = 1.1; // Default 10% waste for DVH profiles
             dvhProfs.forEach(rp => {
                 const p = profiles.find((x) => x.id === rp.profileId);
                 if (p) {
                     const lenMm = evaluateFormula(rp.formula, pane.w, pane.h);
                     const totalMeters = (lenMm / 1000) * Number(rp.quantity || 1) * 2 * leafMultiplier * wasteFactor;
                     totalAluWeight += totalMeters * p.weightPerMeter;
                     aluCost += totalMeters * p.weightPerMeter * baseAluPrice;
                 }
             });
          }
        }
      }
    });

    // Lógica de Tela Mosquitera como Extra (Costo de Malla)
    if (extras?.mosquitero && visualType !== "mosquitero" && !extras?.mosquiteroRecipeId) {
      let meshArea = (width * height) / 1000000;
      // Ajuste para corredizas (generalmente la mitad)
      if (visualType.includes("sliding")) {
        meshArea = meshArea / 2;
      }
      // Mínimo de facturación
      const billingArea = Math.max(meshArea, 0.5);
      glassCost += Number(config.meshPricePerM2 || 25.0) * billingArea;
    }
  }

  const materialCost = aluCost + glassCost + accCost;
  const laborCost = materialCost * (Number(config.laborPercentage || 0) / 100);
  const handrailExtraCost =
    recipe.type === "Baranda"
      ? (materialCost + laborCost) *
        (Number(config.handrailExtraIncrement || 0) / 100)
      : 0;
  const mamparaExtraCost =
    recipe.type === "Mampara"
      ? (materialCost + laborCost) *
        (Number(config.mamparaExtraIncrement || 0) / 100)
      : 0;
  const finalPrice =
    materialCost + laborCost + handrailExtraCost + mamparaExtraCost;

  return {
    totalAluWeight,
    aluCost,
    glassCost,
    accCost,
    laborCost,
    materialCost,
    finalPrice,
    glassPanes,
    handrailExtraCost,
    mamparaExtraCost,
  };
};
