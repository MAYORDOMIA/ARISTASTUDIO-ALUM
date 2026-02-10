
import { 
  ProductRecipe, AluminumProfile, GlobalConfig, Treatment, Glass, 
  Accessory, DVHInput, RecipeAccessory, BlindPanel, QuoteItem, QuoteItemBreakdown
} from '../types';

export const evaluateFormula = (formula: string, W: number, H: number): number => {
  try {
    const cleanFormula = (formula || '').toString().toUpperCase().replace(/W/g, (W || 0).toString()).replace(/H/g, (H || 0).toString());
    if (!cleanFormula) return 0;
    const result = new Function(`return ${cleanFormula}`)();
    return isFinite(result) ? result : 0;
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

  const { modules, colRatios, rowRatios, couplingDeduction: baseDeduction } = item.composition;
  
  const cProfile = item.couplingProfileId ? profiles.find(p => p.id === item.couplingProfileId) : null;
  const realDeduction = Number(cProfile?.thickness ?? baseDeduction ?? 0);

  const validModules = (modules || []).filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
  
  if (validModules.length === 0) {
    const emptyBreakdown: QuoteItemBreakdown = { aluCost: 0, glassCost: 0, accCost: 0, laborCost: 0, materialCost: 0, totalWeight: 0 };
    return { materialCost: 0, totalAluWeight: 0, finalPrice: 0, breakdown: emptyBreakdown };
  }

  const minX = Math.min(...validModules.map(m => m.x)); 
  const minY = Math.min(...validModules.map(m => m.y));
  const maxX = Math.max(...validModules.map(m => m.x));
  const maxY = Math.max(...validModules.map(m => m.y));
  const isSet = validModules.length > 1;

  validModules.forEach(mod => {
    const recipe = recipes.find(r => r.id === mod.recipeId);
    if (!recipe) return;
    
    let modW = Number(colRatios[mod.x - minX] || 0); 
    let modH = Number(rowRatios[mod.y - minY] || 0);
    
    if (colRatios.length > 1) {
       if (mod.x !== minX) modW -= (realDeduction / 2);
       if (mod.x !== maxX) modW -= (realDeduction / 2);
    }
    if (rowRatios.length > 1) {
       if (mod.y !== minY) modH -= (realDeduction / 2);
       if (mod.y !== maxY) modH -= (realDeduction / 2);
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

  const baseAluPrice = Number(config.aluminumPricePerKg || 0) + Number(treatment.pricePerKg || 0);

  // CÁLCULO DE ACOPLES (INTERMEDIOS)
  if (cProfile && isSet) {
    const pWeight = Number(cProfile.weightPerMeter || 0);
    let totalCouplingMm = 0;
    if (colRatios.length > 1) totalCouplingMm += (Number(item.height || 0) * (colRatios.length - 1));
    if (rowRatios.length > 1) totalCouplingMm += (Number(item.width || 0) * (rowRatios.length - 1));
    
    const cWeight = (totalCouplingMm / 1000) * pWeight;
    totalAluCost += cWeight * baseAluPrice;
    totalAluWeight += cWeight;
  }

  // CÁLCULO DE TAPAJUNTAS PERIMETRAL (CONJUNTO COMPLETO)
  if (item.extras?.tapajuntas) {
    const firstRecipe = recipes.find(r => r.id === validModules[0]?.recipeId);
    const tjProfile = profiles.find(p => p.id === firstRecipe?.defaultTapajuntasProfileId);
    if (tjProfile) {
        const tjThick = Number(tjProfile.thickness || 30);
        const { top, bottom, left, right } = item.extras.tapajuntasSides;
        let totalTJMm = 0;
        if (top) totalTJMm += item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
        if (bottom) totalTJMm += item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
        if (left) totalTJMm += item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
        if (right) totalTJMm += item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
        
        const tjWeight = (totalTJMm / 1000) * Number(tjProfile.weightPerMeter || 0);
        totalAluCost += tjWeight * baseAluPrice;
        totalAluWeight += tjWeight;
    }
  }

  const materialCost = totalAluCost + totalGlassCost + totalAccCost;
  const laborCost = materialCost * (Number(config.laborPercentage || 0) / 100);
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
  coupling?: { profileId?: string, position: string }, transoms?: { height: number; profileId: string; formula?: string }[],
  overriddenAccessories?: RecipeAccessory[], blindPanes: number[] = [], blindPaneIds: Record<number, string> = {}, blindPanels: BlindPanel[] = [],
  isSet: boolean = false
) => {
  let totalAluWeight = 0;
  let aluCost = 0;
  let glassCost = 0;
  let accCost = 0;

  const transomTemplate = (recipe.profiles || []).find(rp => 
      rp.role === 'Travesaño' || (rp.role && rp.role.toLowerCase().includes('trave'))
  );
  const recipeTransomFormula = transomTemplate?.formula || recipe.transomFormula || 'W';
  const recipeTransomQty = Number(transomTemplate?.quantity || 1);

  const activeProfiles = (recipe.profiles || []).filter(rp => {
    const role = (rp.role || '').toLowerCase();
    if (role.includes('trave')) return false;

    const p = profiles.find(x => x.id === rp.profileId);
    if (!p) return true;
    
    // Si es un conjunto, los tapajuntas se calculan afuera (calculateCompositePrice)
    const isTJ = role.includes('tapa') || String(p.code || '').toUpperCase().includes('TJ') || p.id === recipe.defaultTapajuntasProfileId;
    if (isTJ && (isSet || !extras?.tapajuntas)) return false;

    const isMosq = role.includes('mosq') || p.id === recipe.mosquiteroProfileId;
    if (isMosq && !extras?.mosquitero) return false;

    return true;
  });

  const baseAluPrice = Number(config.aluminumPricePerKg || 0) + Number(treatment.pricePerKg || 0);

  activeProfiles.forEach(rp => {
    const profile = profiles.find(p => p.id === rp.profileId);
    if (profile) {
      const cutMeasure = evaluateFormula(rp.formula, width, height);
      const weight = ((cutMeasure + Number(config.discWidth || 0)) / 1000) * Number(rp.quantity || 0) * Number(profile.weightPerMeter || 0);
      totalAluWeight += weight;
    }
  });

  if (transoms && transoms.length > 0) {
    transoms.forEach(t => {
      const trProf = profiles.find(p => p.id === t.profileId);
      if (trProf) {
        const f = t.formula || recipeTransomFormula;
        const tCut = evaluateFormula(f, width, height);
        totalAluWeight += ((tCut + Number(config.discWidth || 0)) / 1000) * recipeTransomQty * Number(trProf.weightPerMeter || 0);
      }
    });
  }

  aluCost = totalAluWeight * baseAluPrice;

  const activeAccessories = (overriddenAccessories && overriddenAccessories.length > 0) 
    ? overriddenAccessories 
    : (recipe.accessories || []);

  activeAccessories.forEach(ra => {
    const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId);
    if (acc) {
      const uPrice = Number(acc.unitPrice || 0);
      if (ra.isLinear && ra.formula) {
        const lengthMm = evaluateFormula(ra.formula, width, height);
        const totalMeters = (lengthMm / 1000) * Number(ra.quantity || 0);
        accCost += uPrice * totalMeters;
      } else {
        accCost += uPrice * Number(ra.quantity || 0);
      }
    }
  });

  const adjustedW = width - Number(recipe.glassDeductionW || 0); 
  const adjustedH = height - Number(recipe.glassDeductionH || 0);
  
  const visualType = recipe.visualType || '';
  let numLeaves = 1;
  if (visualType.includes('sliding_3')) numLeaves = 3;
  else if (visualType.includes('sliding_4')) numLeaves = 4;
  else if (visualType.includes('sliding')) numLeaves = 2;

  let leafBaseW = adjustedW;
  if (visualType.includes('sliding')) {
      leafBaseW = adjustedW / numLeaves;
  }
  
  const gW = evaluateFormula(recipe.glassFormulaW || 'W', leafBaseW, adjustedH);
  const gH = evaluateFormula(recipe.glassFormulaH || 'H', adjustedW, adjustedH);
  
  const glassPanes: { w: number, h: number }[] = [];
  const transomGlassDeduction = Number(recipe.transomGlassDeduction || 0); 

  if (!transoms || transoms.length === 0) { 
    glassPanes.push({ w: gW, h: gH }); 
  } else {
    const sorted = [...transoms].sort((a, b) => a.height - b.height);
    let lastY = 0;
    
    sorted.forEach((t, idx) => {
      const trProf = profiles.find(p => p.id === t.profileId);
      const transomThickness = Number(trProf?.thickness || recipe.transomThickness || 40);
      
      let paneH;
      if (idx === 0) {
        paneH = (Number(t.height) - (transomThickness / 2)) - (Number(recipe.glassDeductionH || 0) / (transoms.length + 1)) - transomGlassDeduction;
      } else {
        paneH = (Number(t.height) - lastY) - transomThickness - transomGlassDeduction;
      }
      
      if (paneH > 0) glassPanes.push({ w: gW, h: paneH });
      lastY = Number(t.height);
    });
    
    const lastTrProf = profiles.find(p => p.id === sorted[sorted.length-1].profileId);
    const lastTransomThickness = Number(lastTrProf?.thickness || recipe.transomThickness || 40);
    const finalPaneH = (height - lastY) - (lastTransomThickness / 2) - (Number(recipe.glassDeductionH || 0) / (transoms.length + 1)) - transomGlassDeduction;
    if (finalPaneH > 0) glassPanes.push({ w: gW, h: finalPaneH });
  }

  const outerGlass = glasses.find(g => g.id === glassOuterId);
  const innerGlass = isDVH && glassInnerId ? glasses.find(g => g.id === glassInnerId) : null;
  const dvhCamera = isDVH && dvhCameraId ? dvhInputs.find(i => i.id === dvhCameraId && i.type === 'Cámara') : null;

  glassPanes.forEach((pane, index) => {
    const areaM2 = (pane.w * pane.h) / 1000000;
    const billingAreaPerPiece = Math.max(areaM2, 0.5); 
    const totalBillingArea = billingAreaPerPiece * numLeaves;

    if (visualType === 'mosquitero') {
      glassCost += (Number(config.meshPricePerM2 || 25.0)) * totalBillingArea;
      return; 
    }

    if (blindPanes.includes(index)) {
      const specificBlind = blindPanels.find(bp => bp.id === blindPaneIds[index]);
      if (specificBlind) {
          const unitValue = specificBlind.unit === 'ml' ? (pane.w / 1000) : billingAreaPerPiece;
          glassCost += Number(specificBlind.price || 0) * unitValue * numLeaves;
      } else {
          glassCost += (Number(config.blindPanelPricePerM2 || 0)) * totalBillingArea;
      }
    } else {
      if (outerGlass) glassCost += Number(outerGlass.pricePerM2 || 0) * totalBillingArea;
      if (innerGlass) glassCost += Number(innerGlass.pricePerM2 || 0) * totalBillingArea;
      if (isDVH) {
        if (dvhCamera) glassCost += Number(dvhCamera.cost || 0) * ((pane.w + pane.h) * 2 / 1000) * numLeaves;
        dvhInputs.filter(i => i.type !== 'Cámara').forEach(input => glassCost += Number(input.cost || 0) * areaM2 * numLeaves);
      }
    }
  });

  if (extras?.mosquitero && visualType !== 'mosquitero') {
      const hasRoleMosq = recipe.profiles.some(rp => (rp.role || '').toLowerCase().includes('mosq'));
      if (!hasRoleMosq) {
          const mProfile = profiles.find(p => p.id === recipe.mosquiteroProfileId);
          if (mProfile) {
              const mW = evaluateFormula(recipe.mosquiteroFormulaW || 'W/2', width, height);
              const mH = evaluateFormula(recipe.mosquiteroFormulaH || 'H-45', width, height);
              const meshArea = Math.max((mW * mH) / 1000000, 0.5);
              glassCost += meshArea * (Number(config.meshPricePerM2 || 25.0));
              const frameWeight = ((mW * 2) + (mH * 2)) / 1000 * Number(mProfile.weightPerMeter || 0);
              aluCost += frameWeight * baseAluPrice;
              totalAluWeight += frameWeight;
          }
      }
  }
  
  // TAPAJUNTAS INDIVIDUALES (SOLO SI NO ES CONJUNTO)
  if (!isSet && extras?.tapajuntas && extras.tapajuntasSides) {
    const hasRoleTJ = recipe.profiles.some(rp => (rp.role || '').toLowerCase().includes('tapa'));
    if (!hasRoleTJ) {
        const tjProfile = profiles.find(p => p.id === recipe.defaultTapajuntasProfileId);
        if (tjProfile) {
            const tjThick = Number(tjProfile.thickness || recipe.tapajuntasThickness || 30);
            const { top, bottom, left, right } = extras.tapajuntasSides;
            let totalTJMm = 0;
            if (top) totalTJMm += width + (left ? tjThick : 0) + (right ? tjThick : 0);
            if (bottom) totalTJMm += width + (left ? tjThick : 0) + (right ? tjThick : 0);
            if (left) totalTJMm += height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
            if (right) totalTJMm += height + (top ? tjThick : 0) + (bottom ? tjThick : 0);
            const tjWeight = (totalTJMm / 1000) * Number(tjProfile.weightPerMeter || 0);
            aluCost += tjWeight * baseAluPrice;
            totalAluWeight += tjWeight;
        }
    }
  }

  const materialCost = aluCost + glassCost + accCost;
  const laborCost = materialCost * (Number(config.laborPercentage || 0) / 100);
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
