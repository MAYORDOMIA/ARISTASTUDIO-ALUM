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

    // Reparación Profesional: Auto-balanceo de paréntesis
    let balanced = cleanFormula;
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
    console.error(
      "Error parsing formula (msg):",
      formula,
      (e as any)?.message || e,
    );
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
    );

    totalAluCost += result.aluCost;
    totalGlassCost += result.glassCost;
    totalAccCost += result.accCost;
    totalAluWeight += result.totalAluWeight;
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
    const tjProfile = profiles.find(
      (p) => p.id === firstRecipe?.defaultTapajuntasProfileId,
    );
    if (tjProfile) {
      const tjThick = Number(tjProfile.thickness || 30);
      const { top, bottom, left, right } = item.extras.tapajuntasSides;
      let totalTjMm = 0;

      // 1. Perímetro Exterior
      if (top)
        totalTjMm += item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
      if (bottom)
        totalTjMm += item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
      if (left)
        totalTjMm += item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
      if (right)
        totalTjMm += item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0);

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
) => {
  let totalAluWeight = 0;
  let aluCost = 0;
  let glassCost = 0;
  let accCost = 0;

  // 1. Calcular espesor total del vidrio para este módulo
  const outerGlassObj = glasses.find((g) => g.id === glassOuterId);
  const innerGlassObj =
    isDVH && glassInnerId ? glasses.find((g) => g.id === glassInnerId) : null;
  const dvhCameraObj =
    isDVH && dvhCameraId ? dvhInputs.find((i) => i.id === dvhCameraId) : null;

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

  const transomTemplate = (recipe.profiles || []).find(
    (rp) =>
      rp.role === "Travesaño" ||
      (rp.role && rp.role.toLowerCase().includes("trave")),
  );
  const recipeTransomFormula =
    transomTemplate?.formula || recipe.transomFormula || "W";
  const recipeTransomQty = Number(transomTemplate?.quantity || 1);

  const activeProfiles = (recipe.profiles || []).filter((rp) => {
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
    if (isMosq && !extras?.mosquitero) return false;

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
        const cutMeasure = evaluateFormula(rp.formula, width, height);
        const weight =
          ((cutMeasure + Number(config.discWidth || 0)) / 1000) *
          Number(rp.quantity || 0) *
          Number(profile.weightPerMeter || 0);
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
  const adjustedH = height - Number(recipe.glassDeductionH || 0);
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
    if (slatId) {
      const slatProfile = profiles.find((p) => p.id === slatId);
      const pH = panesHeights[paneIdx];
      if (slatProfile && slatProfile.thickness > 0 && pH > 0) {
        const numSlats = Math.ceil(pH / slatProfile.thickness);
        const totalLinealMm =
          (gW + Number(config.discWidth || 0)) * numSlats * numLeaves;
        const slatWeight =
          (totalLinealMm / 1000) * Number(slatProfile.weightPerMeter || 0);
        totalAluWeight += slatWeight;
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

  const activeAccessories =
    overriddenAccessories && overriddenAccessories.length > 0
      ? overriddenAccessories
      : recipe.accessories || [];

  activeAccessories.forEach((ra) => {
    if (ra.isAlternative) return;

    const acc = accessories.find(
      (a) => a.id === ra.accessoryId || a.code === ra.accessoryId,
    );
    if (acc) {
      const uPrice = Number(acc.unitPrice || 0);
      if (ra.isLinear && ra.formula) {
        const lengthMm = evaluateFormula(ra.formula, width, height);
        const totalMeters = (lengthMm / 1000) * Number(ra.quantity || 0);
        accCost += uPrice * totalMeters;
      } else if (ra.isSpaced && ra.spacingMm && ra.formula) {
        const lengthMm = evaluateFormula(ra.formula, width, height);
        const count = Math.ceil(lengthMm / ra.spacingMm);
        accCost += uPrice * count * Number(ra.quantity || 1);
      } else {
        accCost += uPrice * Number(ra.quantity || 0);
      }
    }
  });

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

  const outerGlass = glasses.find((g) => g.id === glassOuterId);
  const innerGlass =
    isDVH && glassInnerId ? glasses.find((g) => g.id === glassInnerId) : null;
  const dvhCamera =
    isDVH && dvhCameraId
      ? dvhInputs.find((i) => i.id === dvhCameraId && i.type === "Cámara")
      : null;

  if (quotingMode !== "Solo Marcos") {
    glassPanes.forEach((pane, index) => {
      const areaM2 = (pane.w * pane.h) / 1000000;
      const billingAreaPerPiece = Math.max(areaM2, 0.5);
      const totalBillingArea = billingAreaPerPiece * numLeaves;

      if (visualType === "mosquitero") {
        glassCost += Number(config.meshPricePerM2 || 25.0) * totalBillingArea;
        return;
      }

      if (blindPanes.includes(index)) {
        if (slatProfileIds[index]) {
          return;
        }
        const specificBlind = blindPanels.find(
          (bp) => bp.id === blindPaneIds[index],
        );
        if (specificBlind) {
          const unitValue =
            specificBlind.unit === "ml" ? pane.w / 1000 : billingAreaPerPiece;
          glassCost += Number(specificBlind.price || 0) * unitValue * numLeaves;
        } else {
          glassCost +=
            Number(config.blindPanelPricePerM2 || 0) * totalBillingArea;
        }
      } else {
        if (outerGlass)
          glassCost += Number(outerGlass.pricePerM2 || 0) * totalBillingArea;
        if (innerGlass)
          glassCost += Number(innerGlass.pricePerM2 || 0) * totalBillingArea;
        if (isDVH) {
          if (dvhCamera)
            glassCost +=
              Number(dvhCamera.cost || 0) *
              (((pane.w + pane.h) * 2) / 1000) *
              numLeaves;
          dvhInputs
            .filter((i) => i.type !== "Cámara")
            .forEach(
              (input) =>
                (glassCost += Number(input.cost || 0) * areaM2 * numLeaves),
            );
        }
      }
    });

    // Lógica de Tela Mosquitera como Extra (Costo de Malla)
    if (extras?.mosquitero && visualType !== "mosquitero") {
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
