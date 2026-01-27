
import { 
  ProductRecipe, AluminumProfile, GlobalConfig, Treatment, Glass, 
  Accessory, DVHInput, RecipeAccessory, BlindPanel, QuoteItem, QuoteItemBreakdown
} from '../types';

export const evaluateFormula = (formula: string, W: number, H: number): number => {
  try {
    const cleanFormula = (formula || '').toString().toUpperCase().replace(/W/g, W.toString()).replace(/H/g, H.toString());
    if (!cleanFormula) return 0;
    return new Function(`return ${cleanFormula}`)();
  } catch (e) {
    console.error("Error parsing formula:", formula, e);
    return 0;
  }
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
  blindPanels: BlindPanel[]
): { materialCost: number, totalAluWeight: number, finalPrice: number, breakdown: QuoteItemBreakdown } => {
  let totalAluCost = 0;
  let totalGlassCost = 0;
  let totalAccCost = 0;
  let totalAluWeight = 0;

  const { modules, colRatios, rowRatios, couplingDeduction } = item.composition;
  const validModules = (modules || []).filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
  
  if (validModules.length === 0) {
    const emptyBreakdown: QuoteItemBreakdown = { aluCost: 0, glassCost: 0, accCost: 0, laborCost: 0, materialCost: 0, totalWeight: 0 };
    return { materialCost: 0, totalAluWeight: 0, finalPrice: 0, breakdown: emptyBreakdown };
  }

  const minX = Math.min(...validModules.map(m => m.x)); 
  const minY = Math.min(...validModules.map(m => m.y));
  const isSet = validModules.length > 1;

  validModules.forEach(mod => {
    const recipe = recipes.find(r => r.id === mod.recipeId);
    if (!recipe) return;
    
    let modW = colRatios[mod.x - minX] || 0; 
    let modH = rowRatios[mod.y - minY] || 0;
    
    if (colRatios.length > 1) {
       if (mod.x !== minX) modW -= (couplingDeduction / 2);
       if (mod.x !== (minX + colRatios.length - 1)) modW -= (couplingDeduction / 2);
    }
    if (rowRatios.length > 1) {
       if (mod.y !== minY) modH -= (couplingDeduction / 2);
       if (mod.y !== (minY + rowRatios.length - 1)) modH -= (couplingDeduction / 2);
    }

    const result = calculateItemPrice(
      recipe, modW, modH, profiles, config, treatment, glasses, accessories, dvhInputs, mod.isDVH,
      mod.glassOuterId, mod.glassInnerId, mod.dvhCameraId, item.extras, undefined, mod.transoms, 
      mod.overriddenAccessories,
      mod.blindPanes, mod.blindPaneIds, blindPanels,
      isSet 
    );
    
    totalAluCost += result.aluCost;
    totalGlassCost += result.glassCost;
    totalAccCost += result.accCost;
    totalAluWeight += result.totalAluWeight;
  });

  // Costo de Acoples (Aluminio)
  if (item.couplingProfileId && isSet) {
    const cProfile = profiles.find(p => p.id === item.couplingProfileId);
    if (cProfile) {
      const unitCostPerM = (config.aluminumPricePerKg + treatment.pricePerKg) * cProfile.weightPerMeter;
      let totalCouplingMm = 0;
      if (colRatios.length > 1) totalCouplingMm += item.height * (colRatios.length - 1);
      if (rowRatios.length > 1) totalCouplingMm += item.width * (rowRatios.length - 1);
      
      const cCost = (totalCouplingMm / 1000) * unitCostPerM;
      const cWeight = (totalCouplingMm / 1000) * cProfile.weightPerMeter;
      
      totalAluCost += cCost;
      totalAluWeight += cWeight;
    }
  }

  const materialCost = totalAluCost + totalGlassCost + totalAccCost;
  const laborCost = materialCost * (config.laborPercentage / 100);
  const finalPrice = materialCost + laborCost;

  const breakdown: QuoteItemBreakdown = {
    aluCost: totalAluCost,
    glassCost: totalGlassCost,
    accCost: totalAccCost,
    laborCost: laborCost,
    materialCost: materialCost,
    totalWeight: totalAluWeight
  };

  return { materialCost, totalAluWeight, finalPrice, breakdown };
};

export const calculateItemPrice = (
  recipe: ProductRecipe, width: number, height: number, profiles: AluminumProfile[],
  config: GlobalConfig, treatment: Treatment, glasses: Glass[], accessories: Accessory[],
  dvhInputs: DVHInput[], isDVH: boolean, glassOuterId: string, glassInnerId?: string,
  dvhCameraId?: string, extras?: { mosquitero: boolean, tapajuntas: boolean, tapajuntasSides: { top: boolean, bottom: boolean, left: boolean, right: boolean } },
  coupling?: { profileId?: string, position: string }, transoms?: { height: number; profileId: string }[],
  overriddenAccessories?: RecipeAccessory[], blindPanes: number[] = [], blindPaneIds: Record<number, string> = {}, allBlindPanels: BlindPanel[] = [],
  isSet: boolean = false
) => {
  let totalAluWeight = 0;
  let aluCost = 0;
  let glassCost = 0;
  let accCost = 0;

  // 1. CÁLCULO DE ALUMINIO (BASE + PINTURA)
  const isFixed = recipe.type === 'Paño Fijo';
  const activeProfiles = (recipe.profiles || []).filter(rp => {
    const p = profiles.find(x => x.id === rp.profileId);
    if (!p) return true;
    const isTJ = String(p.code || '').toUpperCase().includes('TJ') || p.id === recipe.defaultTapajuntasProfileId;
    if (isTJ && !extras?.tapajuntas) return false;
    return true;
  });

  activeProfiles.forEach(rp => {
    const profile = profiles.find(p => p.id === rp.profileId);
    if (profile) {
      const cutMeasure = evaluateFormula(rp.formula, width, height);
      const weight = ((cutMeasure + config.discWidth) / 1000) * rp.quantity * profile.weightPerMeter;
      totalAluWeight += weight;
    }
  });

  if (transoms) {
    transoms.forEach(t => {
      const trProf = profiles.find(p => p.id === t.profileId);
      if (trProf) totalAluWeight += ((width + config.discWidth) / 1000) * trProf.weightPerMeter;
    });
  }

  aluCost = totalAluWeight * (config.aluminumPricePerKg + treatment.pricePerKg);

  // 2. CÁLCULO DE ACCESORIOS (CRÍTICO: Validar IDs y Códigos)
  const activeAccessories = (overriddenAccessories && overriddenAccessories.length > 0) 
    ? overriddenAccessories 
    : (recipe.accessories || []);

  activeAccessories.forEach(ra => {
    // Intenta encontrar por ID único y como fallback por código (importante en migraciones de datos)
    const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId);
    if (acc) {
      accCost += acc.unitPrice * ra.quantity;
    }
  });

  // 3. CÁLCULO DE VIDRIOS / CIEGOS
  const adjustedW = width - (recipe.glassDeductionW || 0); 
  const adjustedH = height - (recipe.glassDeductionH || 0);
  const gW = evaluateFormula(recipe.glassFormulaW || 'W', adjustedW, adjustedH);
  const gH = evaluateFormula(recipe.glassFormulaH || 'H', adjustedW, adjustedH);
  
  const glassPanes: { w: number, h: number }[] = [];
  const tProfile = profiles.find(p => p.id === recipe.defaultTransomProfileId);
  const transomThickness = tProfile?.thickness || recipe.transomThickness || (recipe.visualType?.startsWith('door_') ? 68 : 38); 
  const transomGlassDeduction = recipe.transomGlassDeduction || 0; 

  if (!transoms || transoms.length === 0) { glassPanes.push({ w: gW, h: gH }); } 
  else {
    const sorted = [...transoms].sort((a, b) => a.height - b.height);
    let lastY = 0;
    sorted.forEach((t, idx) => {
      const currentTProf = profiles.find(p => p.id === t.profileId);
      const currentTThickness = currentTProf?.thickness || transomThickness;
      const paneH = (idx === 0) ? (t.height - (currentTThickness / 2) - transomGlassDeduction) : (t.height - lastY - currentTThickness - transomGlassDeduction);
      if (paneH > 0) glassPanes.push({ w: gW, h: paneH });
      lastY = t.height;
    });
    const lastPaneH = (gH - lastY - (transomThickness / 2) - transomGlassDeduction);
    if (lastPaneH > 0) glassPanes.push({ w: gW, h: lastPaneH });
  }

  const outerGlass = glasses.find(g => g.id === glassOuterId);
  const innerGlass = isDVH && glassInnerId ? glasses.find(g => g.id === glassInnerId) : null;
  const dvhCamera = isDVH && dvhCameraId ? dvhInputs.find(i => i.id === dvhCameraId && i.type === 'Cámara') : null;

  glassPanes.forEach((pane, index) => {
    const areaM2 = (pane.w * pane.h) / 1000000;
    const billingArea = Math.max(areaM2, 0.5); 
    if (blindPanes.includes(index)) {
      const specificBlind = allBlindPanels.find(bp => bp.id === blindPaneIds[index]);
      if (specificBlind) glassCost += specificBlind.unit === 'ml' ? (specificBlind.price * (pane.w / 1000)) : (specificBlind.price * billingArea);
      else glassCost += (config.blindPanelPricePerM2 || 0) * billingArea;
    } else {
      if (outerGlass) glassCost += outerGlass.pricePerM2 * billingArea;
      if (innerGlass) glassCost += innerGlass.pricePerM2 * billingArea;
      if (isDVH) {
        if (dvhCamera) glassCost += dvhCamera.cost * ((pane.w + pane.h) * 2 / 1000);
        dvhInputs.filter(i => i.type !== 'Cámara').forEach(input => glassCost += input.cost * areaM2);
      }
    }
  });

  if (extras?.mosquitero && !isFixed) {
      const mProfile = profiles.find(p => p.id === recipe.mosquiteroProfileId);
      if (mProfile) {
          const mW = evaluateFormula(recipe.mosquiteroFormulaW || 'W/2', width, height);
          const mH = evaluateFormula(recipe.mosquiteroFormulaH || 'H-45', width, height);
          glassCost += ((mW * mH) / 1000000) * 25.0;
          const frameWeight = ((mW * 2) + (mH * 2)) / 1000 * mProfile.weightPerMeter;
          aluCost += frameWeight * (config.aluminumPricePerKg + treatment.pricePerKg);
          totalAluWeight += frameWeight;
      }
  }
  
  if (extras?.tapajuntas && extras.tapajuntasSides) {
    const tjProfile = profiles.find(p => p.id === recipe.defaultTapajuntasProfileId);
    if (tjProfile) {
        const tjThick = tjProfile.thickness || recipe.tapajuntasThickness || 30;
        const { top, bottom, left, right } = extras.tapajuntasSides;
        let totalTJMm = 0;
        if (top) totalTJMm += width + (left ? tjThick : 0) + (right ? tjThick : 0);
        if (bottom) totalTJMm += width + (left ? tjThick : 0) + (right ? tjThick : 0);
        if (left) totalTJMm += height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
        if (right) totalTJMm += height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
        const tjWeight = (totalTJMm / 1000) * tjProfile.weightPerMeter;
        aluCost += tjWeight * (config.aluminumPricePerKg + treatment.pricePerKg);
        totalAluWeight += tjWeight;
    }
  }

  const materialCost = aluCost + glassCost + accCost;
  const laborCost = materialCost * (config.laborPercentage / 100);
  const finalPrice = materialCost + laborCost;

  return { 
    totalAluWeight, 
    aluCost, 
    glassCost, 
    accCost, 
    laborCost,
    materialCost, 
    finalPrice, 
    glassPanes 
  };
};
