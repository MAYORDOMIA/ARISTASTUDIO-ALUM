
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, ProductRecipe, GlobalConfig, AluminumProfile, Glass, Accessory, DVHInput, QuoteItem, Treatment, BlindPanel } from '../types';
import { evaluateFormula } from './calculator';

const TYPE_COLORS: Record<string, [number, number, number]> = {
    'Ventana': [79, 70, 229],   
    'Puerta': [220, 38, 38],    
    'Paño Fijo': [5, 150, 105], 
    'Default': [79, 70, 229]   
};

interface GlassPiece {
    id: string;
    itemCode: string;
    spec: string;
    w: number;
    h: number;
    glassId: string;
    rotated?: boolean;
}

const drawGeometricPiece = (doc: jsPDF, x: number, y: number, w: number, h: number, start: string, end: string) => {
    const sOffset = start === '45' ? h * 0.5 : 0;
    const eOffset = end === '45' ? h * 0.5 : 0;
    const ax = x + sOffset, ay = y;
    const bx = x + w - eOffset, by = y;
    const cx = x, cy = y + h;
    const dx = x + w, dy = y + h;
    doc.triangle(ax, ay, bx, by, cx, cy, 'F');
    doc.triangle(bx, by, cx, cy, dx, dy, 'F');
};

const getModuleGlassPanes = (
  item: QuoteItem, 
  mod: any, 
  recipe: ProductRecipe, 
  aluminum: AluminumProfile[]
): { w: number, h: number, isBlind: boolean }[] => {
    const { isManualDim, colRatios, rowRatios, couplingDeduction } = item.composition;
    const validModules = (item.composition.modules || []).filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
    if (validModules.length === 0) return [];
    const minX = Math.min(...validModules.map(m => m.x));
    const minY = Math.min(...validModules.map(m => m.y));
    const maxX = Math.max(...validModules.map(m => m.x));
    const maxY = Math.max(...validModules.map(m => m.y));
    const cProfile = item.couplingProfileId ? aluminum.find(p => p.id === item.couplingProfileId) : null;
    const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
    const modIdxX = mod.x - minX;
    const modIdxY = mod.y - minY;
    
    let modW = (isManualDim && mod.width) ? mod.width : Number(colRatios[modIdxX] || 0);
    let modH = (isManualDim && mod.height) ? mod.height : Number(rowRatios[modIdxY] || 0);

    if (item.composition.colRatios.length > 1) {
        if (mod.x !== minX) modW -= (realDeduction / 2);
        if (mod.x !== maxX) modW -= (realDeduction / 2);
    }
    if (item.composition.rowRatios.length > 1) {
        if (mod.y !== minY) modH -= (realDeduction / 2);
        if (mod.y !== maxY) modH -= (realDeduction / 2);
    }
    const adjustedW = modW - (recipe.glassDeductionW || 0); 
    const adjustedH = modH - (recipe.glassDeductionH || 0);
    const visualType = recipe.visualType || '';
    let numLeaves = 1;
    if (visualType.includes('sliding_3')) numLeaves = 3;
    else if (visualType.includes('sliding_4')) numLeaves = 4;
    else if (visualType.includes('sliding')) numLeaves = 2;
    let leafBaseW = adjustedW;
    if (visualType.includes('sliding')) { leafBaseW = adjustedW / numLeaves; }
    const gW = evaluateFormula(recipe.glassFormulaW || 'W', leafBaseW, adjustedH);
    const gH = evaluateFormula(recipe.glassFormulaH || 'H', adjustedW, adjustedH);
    const panes: { w: number, h: number, isBlind: boolean }[] = [];
    const transomGlassDeduction = recipe.transomGlassDeduction || 0; 
    if (!mod.transoms || mod.transoms.length === 0) {
        panes.push({ w: gW, h: gH, isBlind: mod.blindPanes?.includes(0) || false });
    } else {
        const sorted = [...mod.transoms].sort((a, b) => b.height - a.height); 
        let currentY = 0;
        const totalMm = modH;
        sorted.forEach((t, idx) => {
            const currentTProf = aluminum.find(p => p.id === t.profileId);
            const currentTThickness = currentTProf?.thickness || recipe.transomThickness || 40;
            const transomYFromTop = totalMm - t.height; 
            const paneH = (transomYFromTop - (currentTThickness/2)) - currentY;
            if (paneH > 0) panes.push({ w: gW, h: paneH, isBlind: mod.blindPanes?.includes(sorted.length - idx) || false });
            currentY = transomYFromTop + (currentTThickness/2);
        });
        const lastPaneH = totalMm - currentY;
        if (lastPaneH > 0) panes.push({ w: gW, h: lastPaneH, isBlind: mod.blindPanes?.includes(0) || false });
    }
    return panes;
};

export const generateBarOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], config: GlobalConfig, blindPanels: BlindPanel[], glasses: Glass[], dvhInputs: DVHInput[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('OPTIMIZACIÓN TÉCNICA DE CORTE DE BARRAS', 15, 12);
    doc.setFontSize(8); doc.text(`OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 18);
    const cutsByProfile = new Map<string, {len:number, type:string, cutStart:string, cutEnd:string, label:string}[]>();
    quote.items.forEach((item, posIdx) => {
        const { isManualDim, colRatios, rowRatios, couplingDeduction } = item.composition;
        const itemCode = item.itemCode || `POS#${posIdx+1}`;
        const isSet = item.composition.modules.length > 1;
        const cProfile = item.couplingProfileId ? aluminum.find(p => p.id === item.couplingProfileId) : null;
        const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
        const validModules = item.composition.modules.filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
        if (validModules.length === 0) return;
        const minX = Math.min(...validModules.map(m => m.x));
        const minY = Math.min(...validModules.map(m => m.y));
        const maxX = Math.max(...validModules.map(m => m.x));
        const maxY = Math.max(...validModules.map(m => m.y));
        
        validModules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;
            const modIdxX = mod.x - minX; const modIdxY = mod.y - minY;
            
            let modW = (isManualDim && mod.width) ? mod.width : Number(colRatios[modIdxX] || 0);
            let modH = (isManualDim && mod.height) ? mod.height : Number(rowRatios[modIdxY] || 0);

            if (item.composition.colRatios.length > 1) {
                if (mod.x !== minX) modW -= (realDeduction / 2);
                if (mod.x !== maxX) modW -= (realDeduction / 2);
            }
            if (item.composition.rowRatios.length > 1) {
                if (mod.y !== minY) modH -= (realDeduction / 2);
                if (mod.y !== maxY) modH -= (realDeduction / 2);
            }
            const transomTemplate = (recipe.profiles || []).find(rp => rp.role === 'Travesaño' || (rp.role && rp.role.toLowerCase().includes('trave')));
            const recipeTransomFormula = transomTemplate?.formula || recipe.transomFormula || 'W';
            const recipeTransomQty = transomTemplate?.quantity || 1;

            // Cálculo de espesor de vidrio para selección dinámica
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            const gInner = mod.isDVH ? glasses.find(g => g.id === mod.glassInnerId) : null;
            const dvhCam = mod.isDVH ? dvhInputs.find(i => i.id === mod.dvhCameraId) : null;
            let camThick = 12;
            if (dvhCam) { const m = dvhCam.detail.match(/(\d+)\s*mm/i); if (m) camThick = parseInt(m[1]); }
            const getThick = (g: any) => {
                if (!g) return 0;
                const m = g.detail.match(/(\d+)\s*mm/i); if (m) return parseInt(m[1]);
                const mc = g.code.match(/(\d+)\s*mm/i); if (mc) return parseInt(mc[1]);
                return 4;
            };
            const totalGlassThick = getThick(gOuter) + (mod.isDVH ? (getThick(gInner) + camThick) : 0);
            const beadStyle = item.glazingBeadStyle || 'Recto';

            recipe.profiles.forEach(rp => {
                let pDef = aluminum.find(a => a.id === rp.profileId); 
                
                // Lógica de Contravidrio Dinámico
                if (rp.glazingBeadOptions && Array.isArray(rp.glazingBeadOptions) && rp.glazingBeadOptions.length > 0) {
                    const candidates = aluminum.filter(p => (rp.glazingBeadOptions || []).includes(p.id));
                    let styleMatches = candidates.filter(p => p.glazingBeadStyle === beadStyle);
                    if (styleMatches.length === 0) styleMatches = candidates;
                    
                    let bestMatch = styleMatches.find(p => {
                        const min = p.minGlassThickness || 0; 
                        const max = p.maxGlassThickness || 100;
                        return totalGlassThick >= min && totalGlassThick <= max;
                    });

                    if (!bestMatch) {
                        bestMatch = candidates.find(p => {
                            const min = p.minGlassThickness || 0; 
                            const max = p.maxGlassThickness || 100;
                            return totalGlassThick >= min && totalGlassThick <= max;
                        });
                    }

                    if (bestMatch) pDef = bestMatch;
                }

                if (!pDef) return;
                const role = rp.role?.toLowerCase() || ''; if (role.includes('trave')) return;
                
                // Exclusión centralizada de Tapajuntas en el despiece de receta
                const isTJ = role.includes('tapa') || String(pDef.code || '').toUpperCase().includes('TJ') || pDef.id === recipe.defaultTapajuntasProfileId;
                if (isTJ) return;

                const isMosq = role.includes('mosquitero') || pDef.id === recipe.mosquiteroProfileId;
                if (isMosq && !item.extras.mosquitero) return;
                
                const cutLen = evaluateFormula(rp.formula, modW, modH); if (cutLen <= 0) return;
                const list = cutsByProfile.get(pDef.id) || [];
                for(let k=0; k < rp.quantity * item.quantity; k++) { list.push({ len: cutLen, type: recipe.type, cutStart: rp.cutStart || '90', cutEnd: rp.cutEnd || '90', label: itemCode }); }
                cutsByProfile.set(pDef.id, list);
            });
            if (mod.transoms && mod.transoms.length > 0) {
              mod.transoms.forEach(t => {
                const trProf = aluminum.find(p => p.id === t.profileId);
                if (trProf) {
                  const f = t.formula || recipeTransomFormula;
                  const cutLen = evaluateFormula(f, modW, modH);
                  if (cutLen > 0) {
                    const list = cutsByProfile.get(trProf.id) || [];
                    for(let k=0; k < recipeTransomQty * item.quantity; k++) { list.push({ len: cutLen, type: 'Travesaño', cutStart: '90', cutEnd: '90', label: itemCode }); }
                    cutsByProfile.set(trProf.id, list);
                  }
                }
              });
            }
            
            const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
            const numLeaves = (recipe.visualType?.includes('sliding_3')) ? 3 : (recipe.visualType?.includes('sliding_4')) ? 4 : (recipe.visualType?.includes('sliding') ? 2 : 1);
            panes.forEach((p, pIdx) => {
                if (p.isBlind) {
                    const bpId = mod.blindPaneIds?.[pIdx];
                    const bp = blindPanels.find(x => x.id === bpId);
                    const slatId = mod.slatProfileIds?.[pIdx];
                    if (bp && bp.unit === 'ml' && !slatId) {
                        const list = cutsByProfile.get(bp.id) || [];
                        for(let k=0; k < numLeaves * item.quantity; k++) {
                            list.push({ len: p.w, type: 'Panel Lineal', cutStart: '90', cutEnd: '90', label: itemCode });
                        }
                        cutsByProfile.set(bp.id, list);
                    }
                    if (slatId) {
                      const slatProf = aluminum.find(a => a.id === slatId);
                      if (slatProf && slatProf.thickness > 0) {
                        const numSlats = Math.ceil(p.h / slatProf.thickness);
                        const list = cutsByProfile.get(slatProf.id) || [];
                        for(let k=0; k < numSlats * numLeaves * item.quantity; k++) {
                            list.push({ len: p.w, type: 'Tablilla', cutStart: '90', cutEnd: '90', label: itemCode });
                        }
                        cutsByProfile.set(slatProf.id, list);
                      }
                    }
                }
            });
        });

        // Lógica Tapajuntas Unificada: Solo si está activado
        if (item.extras.tapajuntas) {
            const firstRecipe = recipes.find(r => r.id === validModules[0].recipeId);
            let tjProfile = aluminum.find(p => p.id === firstRecipe?.defaultTapajuntasProfileId);
            
            // Fallback: Si no hay default configurado, buscar el primer perfil con rol Tapajuntas en la receta
            if (!tjProfile && firstRecipe) {
                const tjRef = firstRecipe.profiles.find(p => p.role === 'Tapajuntas');
                if (tjRef) tjProfile = aluminum.find(p => p.id === tjRef.profileId);
            }
            
            if (tjProfile) {
                const list = cutsByProfile.get(tjProfile.id) || [];
                const tjThick = Number(tjProfile.thickness || 30);
                const { top, bottom, left, right } = item.extras.tapajuntasSides;
                
                if (top) { for(let k=0; k<item.quantity; k++) list.push({ len: item.width + (left?tjThick:0) + (right?tjThick:0), type: 'TJ Perímetro', cutStart: '45', cutEnd: '45', label: itemCode }); }
                if (bottom) { for(let k=0; k<item.quantity; k++) list.push({ len: item.width + (left?tjThick:0) + (right?tjThick:0), type: 'TJ Perímetro', cutStart: '45', cutEnd: '45', label: itemCode }); }
                if (left) { for(let k=0; k<item.quantity; k++) list.push({ len: item.height + (top?tjThick:0) + (bottom?tjThick:0), type: 'TJ Perímetro', cutStart: '45', cutEnd: '45', label: itemCode }); }
                if (right) { for(let k=0; k<item.quantity; k++) list.push({ len: item.height + (top?tjThick:0) + (bottom?tjThick:0), type: 'TJ Perímetro', cutStart: '45', cutEnd: '45', label: itemCode }); }
                
                // Sobrantes por desnivel solo en conjuntos activos
                if (isSet && item.composition.colRatios.length > 1) {
                    for (let x = minX; x < maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            const mL = validModules.find(m => m.x === x && m.y === y);
                            const mR = validModules.find(m => m.x === x + 1 && m.y === y);
                            if (mL && mR) {
                                const hL = (isManualDim && mL.height) ? mL.height : Number(rowRatios[y - minY] || 0);
                                const hR = (isManualDim && mR.height) ? mR.height : Number(rowRatios[y - minY] || 0);
                                const diff = Math.abs(hL - hR);
                                if (diff > 5) { 
                                    for(let k=0; k<item.quantity; k++) {
                                        list.push({ len: diff, type: 'TJ Sobrante Desnivel', cutStart: '90', cutEnd: '90', label: itemCode }); 
                                    }
                                }
                            }
                        }
                    }
                }
                if (isSet && item.composition.rowRatios.length > 1) {
                    for (let y = minY; y < maxY; y++) {
                        for (let x = minX; x <= maxX; x++) {
                            const mT = validModules.find(m => m.x === x && m.y === y);
                            const mB = validModules.find(m => m.x === x && m.y === y + 1);
                            if (mT && mB) {
                                const wT = (isManualDim && mT.width) ? mT.width : Number(colRatios[x - minX] || 0);
                                const wB = (isManualDim && mB.width) ? mB.width : Number(colRatios[x - minX] || 0);
                                const diff = Math.abs(wT - wB);
                                if (diff > 5) { 
                                    for(let k=0; k<item.quantity; k++) {
                                        list.push({ len: diff, type: 'TJ Sobrante Ancho', cutStart: '90', cutEnd: '90', label: itemCode }); 
                                    }
                                }
                            }
                        }
                    }
                }
                cutsByProfile.set(tjProfile.id, list);
            }
        }

        if (item.couplingProfileId && isSet) {
            const list = cutsByProfile.get(item.couplingProfileId) || [];
            if (item.composition.colRatios.length > 1) {
                for (let x = minX; x < maxX; x++) {
                    for (let y = minY; y <= maxY; y++) {
                        const mL = validModules.find(m => m.x === x && m.y === y);
                        const mR = validModules.find(m => m.x === x + 1 && m.y === y);
                        if (mL && mR) {
                            const hL = (isManualDim && mL.height) ? mL.height : Number(rowRatios[y - minY] || 0);
                            const hR = (isManualDim && mR.height) ? mR.height : Number(rowRatios[y - minY] || 0);
                            const cutLen = Math.min(hL, hR);
                            for(let k=0; k < item.quantity; k++) { list.push({ len: cutLen, type: 'Acople V', cutStart: '90', cutEnd: '90', label: itemCode }); }
                        }
                    }
                }
            }
            if (item.composition.rowRatios.length > 1) {
                for (let y = minY; y < maxY; y++) {
                    for (let x = minX; x <= maxX; x++) {
                        const mT = validModules.find(m => m.x === x && m.y === y);
                        const mB = validModules.find(m => m.x === x && m.y === y + 1);
                        if (mT && mB) {
                            const wT = (isManualDim && mT.width) ? mT.width : Number(colRatios[x - minX] || 0);
                            const wB = (isManualDim && mB.width) ? mB.width : Number(colRatios[x - minX] || 0);
                            const cutLen = Math.min(wT, wB);
                            for(let k=0; k < item.quantity; k++) { list.push({ len: cutLen, type: 'Acople H', cutStart: '90', cutEnd: '90', label: itemCode }); }
                        }
                    }
                }
            }
            cutsByProfile.set(item.couplingProfileId, list);
        }
    });
    let y = 40;
    cutsByProfile.forEach((cuts, profileId) => {
        let profile = aluminum.find(p => p.id === profileId) as any;
        if (!profile) {
            const bp = blindPanels.find(x => x.id === profileId);
            if (bp) profile = { id: bp.id, code: bp.code, detail: bp.detail, barLength: 6 };
        }
        if (!profile || cuts.length === 0) return;
        const barLenMm = profile.barLength > 100 ? profile.barLength : profile.barLength * 1000;
        cuts.sort((a, b) => b.len - a.len); const bins: typeof cuts[] = [[]];
        cuts.forEach(cut => {
            let placed = false;
            for(let i=0; i < bins.length; i++) {
                const used = bins[i].reduce((acc, c) => acc + c.len + config.discWidth, 0);
                if (used + cut.len + config.discWidth <= barLenMm) { bins[i].push(cut); placed = true; break; }
            }
            if (!placed) bins.push([cut]);
        });
        if (y > 165) { doc.addPage(); y = 30; }
        doc.setFillColor(241, 245, 249); doc.rect(10, y - 5, pageWidth - 20, 8, 'F');
        doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text(`PERFIL: ${profile.code} - ${profile.detail} | BARRAS REQUERIDAS: ${bins.length}`, 15, y + 1);
        y += 18;
        bins.forEach((bin, bIdx) => {
            if (y > 185) { doc.addPage(); y = 30; }
            const barW = pageWidth - 70; const barH = 8; 
            doc.setDrawColor(200); doc.setFillColor(248, 250, 252); doc.rect(15, y, barW, barH, 'FD');
            let curX = 15;
            bin.forEach((cut) => {
                const pieceW = (cut.len / barLenMm) * barW;
                doc.setFillColor(100, 149, 237); doc.setDrawColor(255); doc.setLineWidth(0.3);
                drawGeometricPiece(doc, curX, y, pieceW, barH, cut.cutStart, cut.cutEnd);
                doc.setTextColor(0);
                if (pieceW > 2) {
                    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
                    doc.text(`${Math.round(cut.len)}`, curX + pieceW/2, y - 1, { align: 'center' });
                    doc.setFontSize(7); doc.text(cut.label, curX + pieceW/2, y + barH + 4, { align: 'center' });
                }
                curX += pieceW + (config.discWidth / barLenMm) * barW;
            });
            const totalUsed = bin.reduce((a,b)=>a+b.len+config.discWidth, 0); const scrap = barLenMm - totalUsed;
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100);
            doc.text(`B#${bIdx+1}`, 8, y + 5); doc.text(`SCRAP: ${Math.round(scrap)} mm`, 15 + barW + 5, y + 5);
            y += 24; 
        });
        y += 10;
    });
    doc.save(`Cortes_Barras_${quote.clientName}.pdf`);
};

export const generateMaterialsOrderPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], accessories: Accessory[], glasses: Glass[], dvhInputs: DVHInput[], config: GlobalConfig, blindPanels: BlindPanel[]) => {
    const doc = new jsPDF(); const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('PEDIDO DE MATERIALES CONSOLIDADO', 15, 12);
    doc.setFontSize(8); doc.text(`OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 18);
    let currentY = 35; doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.text('1. PERFILERÍA DE ALUMINIO (BARRAS COMPLETAS)', 15, currentY); currentY += 5;
    const aluSummary = new Map<string, { code: string, detail: string, totalMm: number, barLength: number }>();
    quote.items.forEach(item => {
        const { isManualDim, colRatios, rowRatios, couplingDeduction } = item.composition;
        const isSet = item.composition.modules.length > 1; const cProfile = item.couplingProfileId ? aluminum.find(p => p.id === item.couplingProfileId) : null;
        const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
        const validModules = item.composition.modules.filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
        if (validModules.length === 0) return;
        const minX = Math.min(...validModules.map(m => m.x)); const minY = Math.min(...validModules.map(m => m.y));
        const maxX = Math.max(...validModules.map(m => m.x)); const maxY = Math.max(...validModules.map(m => m.y));
        validModules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId); if (!recipe) return;
            const modIdxX = mod.x - minX; const modIdxY = mod.y - minY;
            
            let modW = (isManualDim && mod.width) ? mod.width : Number(colRatios[modIdxX] || 0);
            let modH = (isManualDim && mod.height) ? mod.height : Number(rowRatios[modIdxY] || 0);

            if (item.composition.colRatios.length > 1) {
                if (mod.x !== minX) modW -= (realDeduction / 2); if (mod.x !== maxX) modW -= (realDeduction / 2);
            }
            if (item.composition.rowRatios.length > 1) {
                if (mod.y !== minY) modH -= (realDeduction / 2); if (mod.y !== maxY) modH -= (realDeduction / 2);
            }
            const transomTemplate = (recipe.profiles || []).find(rp => rp.role === 'Travesaño' || (rp.role && rp.role.toLowerCase().includes('trave')));
            const recipeTransomFormula = transomTemplate?.formula || recipe.transomFormula || 'W';
            const recipeTransomQty = transomTemplate?.quantity || 1;
            
            // Cálculo de espesor de vidrio para selección dinámica
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            const gInner = mod.isDVH ? glasses.find(g => g.id === mod.glassInnerId) : null;
            const dvhCam = mod.isDVH ? dvhInputs.find(i => i.id === mod.dvhCameraId) : null;
            let camThick = 12;
            if (dvhCam) { const m = dvhCam.detail.match(/(\d+)\s*mm/i); if (m) camThick = parseInt(m[1]); }
            const getThick = (g: any) => {
                if (!g) return 0;
                const m = g.detail.match(/(\d+)\s*mm/i); if (m) return parseInt(m[1]);
                const mc = g.code.match(/(\d+)\s*mm/i); if (mc) return parseInt(mc[1]);
                return 4;
            };
            const totalGlassThick = getThick(gOuter) + (mod.isDVH ? (getThick(gInner) + camThick) : 0);
            const beadStyle = (item as any).glazingBeadStyle || 'Recto';

            recipe.profiles.forEach(rp => {
                const role = rp.role?.toLowerCase() || ''; if (role.includes('trave')) return;
                let p = aluminum.find(a => a.id === rp.profileId);
                
                // Lógica de Contravidrio Dinámico
                if (rp.glazingBeadOptions && Array.isArray(rp.glazingBeadOptions) && rp.glazingBeadOptions.length > 0) {
                    const candidates = aluminum.filter(pf => (rp.glazingBeadOptions || []).includes(pf.id));
                    let styleMatches = candidates.filter(pf => pf.glazingBeadStyle === beadStyle);
                    if (styleMatches.length === 0) styleMatches = candidates;
                    
                    let bestMatch = styleMatches.find(pf => {
                        const min = pf.minGlassThickness || 0; 
                        const max = pf.maxGlassThickness || 100;
                        return totalGlassThick >= min && totalGlassThick <= max;
                    });

                    if (!bestMatch) {
                        bestMatch = candidates.find(pf => {
                            const min = pf.minGlassThickness || 0; 
                            const max = pf.maxGlassThickness || 100;
                            return totalGlassThick >= min && totalGlassThick <= max;
                        });
                    }

                    if (bestMatch) p = bestMatch;
                }

                if (!p) return;
                
                // Exclusión centralizada de Tapajuntas en materiales individuales
                const isTJ = role.includes('tapa') || String(p.code || '').toUpperCase().includes('TJ') || p.id === recipe.defaultTapajuntasProfileId;
                if (isTJ) return;

                const isMosq = role.includes('mosquitero') || p.id === recipe.mosquiteroProfileId;
                if (isMosq && !item.extras.mosquitero) return;
                const len = evaluateFormula(rp.formula, modW, modH); const totalMm = (len + config.discWidth) * rp.quantity * item.quantity;
                const existing = aluSummary.get(p.id) || { code: p.code, detail: p.detail, totalMm: 0, barLength: p.barLength };
                existing.totalMm += totalMm; aluSummary.set(p.id, existing);
            });
            if (mod.transoms && mod.transoms.length > 0) {
              mod.transoms.forEach(t => {
                const trProf = aluminum.find(p => p.id === t.profileId);
                if (trProf) {
                  const f = t.formula || recipeTransomFormula; const cutLen = evaluateFormula(f, modW, modH);
                  const totalMm = (cutLen + config.discWidth) * recipeTransomQty * item.quantity;
                  const existing = aluSummary.get(trProf.id) || { code: trProf.code, detail: trProf.detail, totalMm: 0, barLength: trProf.barLength };
                  existing.totalMm += totalMm; aluSummary.set(trProf.id, existing);
                }
              });
            }
            
            const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
            const numLeaves = (recipe.visualType?.includes('sliding_3')) ? 3 : (recipe.visualType?.includes('sliding_4')) ? 4 : (recipe.visualType?.includes('sliding') ? 2 : 1);
            panes.forEach((p, paneIdx) => {
                if (p.isBlind) {
                    const bpId = mod.blindPaneIds?.[paneIdx];
                    const bp = blindPanels.find(x => x.id === bpId);
                    const slatId = mod.slatProfileIds?.[paneIdx];
                    if (bp && bp.unit === 'ml' && !slatId) {
                        const existing = aluSummary.get(bp.id) || { code: bp.code, detail: bp.detail, totalMm: 0, barLength: 6 };
                        existing.totalMm += p.w * numLeaves * item.quantity;
                        aluSummary.set(bp.id, existing);
                    }
                    if (slatId) {
                      const slatProf = aluminum.find(a => a.id === slatId);
                      if (slatProf && slatProf.thickness > 0) {
                        const numSlats = Math.ceil(p.h / slatProf.thickness);
                        const totalMm = (p.w + config.discWidth) * numSlats * numLeaves * item.quantity;
                        const existing = aluSummary.get(slatProf.id) || { code: slatProf.code, detail: slatProf.detail, totalMm: 0, barLength: slatProf.barLength };
                        existing.totalMm += totalMm; aluSummary.set(slatId, existing);
                      }
                    }
                }
            });
        });

        // Sumatoria Unificada de Tapajuntas en el pedido de materiales
        if (item.extras.tapajuntas && validModules.length > 0) {
            const firstRecipe = recipes.find(r => r.id === validModules[0].recipeId);
            let tjProfile = aluminum.find(p => p.id === firstRecipe?.defaultTapajuntasProfileId);
            
            // Fallback: Si no hay default configurado, buscar el primer perfil con rol Tapajuntas en la receta
            if (!tjProfile && firstRecipe) {
                const tjRef = firstRecipe.profiles.find(p => p.role === 'Tapajuntas');
                if (tjRef) tjProfile = aluminum.find(p => p.id === tjRef.profileId);
            }

            if (tjProfile) {
                const tjThick = Number(tjProfile.thickness || 30);
                const { top, bottom, left, right } = item.extras.tapajuntasSides;
                let tjLenTotal = 0;
                if (top) tjLenTotal += (item.width + (left?tjThick:0) + (right?tjThick:0));
                if (bottom) tjLenTotal += (item.width + (left?tjThick:0) + (right?tjThick:0));
                if (left) tjLenTotal += (item.height + (top?tjThick:0) + (bottom?tjThick:0));
                if (right) tjLenTotal += (item.height + (top?tjThick:0) + (bottom?tjThick:0));
                
                if (isSet && item.composition.colRatios.length > 1) {
                    for (let x = minX; x < maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            const mL = validModules.find(m => m.x === x && m.y === y);
                            const mR = validModules.find(m => m.x === x + 1 && m.y === y);
                            if (mL && mR) {
                                const hL = (isManualDim && mL.height) ? mL.height : Number(rowRatios[y - minY] || 0);
                                const hR = (isManualDim && mR.height) ? mR.height : Number(rowRatios[y - minY] || 0);
                                tjLenTotal += Math.abs(hL - hR);
                            }
                        }
                    }
                }
                const existing = aluSummary.get(tjProfile.id) || { code: tjProfile.code, detail: tjProfile.detail, totalMm: 0, barLength: tjProfile.barLength };
                existing.totalMm += (tjLenTotal + config.discWidth) * item.quantity; aluSummary.set(tjProfile.id, existing);
            }
        }

        if (item.couplingProfileId && isSet) {
            const p = aluminum.find(a => a.id === item.couplingProfileId);
            if (p) {
                let totalC = 0;
                if (item.composition.colRatios.length > 1) {
                    for (let x = minX; x < maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            const mL = validModules.find(m => m.x === x && m.y === y);
                            const mR = validModules.find(m => m.x === x + 1 && m.y === y);
                            if (mL && mR) {
                                const hL = (isManualDim && mL.height) ? mL.height : Number(rowRatios[y - minY] || 0);
                                const hR = (isManualDim && mR.height) ? mR.height : Number(rowRatios[y - minY] || 0);
                                totalC += Math.min(hL, hR);
                            }
                        }
                    }
                }
                if (item.composition.rowRatios.length > 1) {
                    for (let y = minY; y < maxY; y++) {
                        for (let x = minX; x <= maxX; x++) {
                            const mT = validModules.find(m => m.x === x && m.y === y);
                            const mB = validModules.find(m => m.x === x && m.y === y + 1);
                            if (mT && mB) {
                                const wT = (isManualDim && mT.width) ? mT.width : Number(colRatios[x - minX] || 0);
                                const wB = (isManualDim && mB.width) ? mB.width : Number(colRatios[x - minX] || 0);
                                totalC += Math.min(wT, wB);
                            }
                        }
                    }
                }
                const existing = aluSummary.get(p.id) || { code: p.code, detail: p.detail, totalMm: 0, barLength: p.barLength };
                existing.totalMm += (totalC + config.discWidth) * item.quantity; aluSummary.set(p.id, existing);
            }
        }
    });
    const aluBody = Array.from(aluSummary.values()).map(s => {
        const barLenMm = s.barLength > 100 ? s.barLength : s.barLength * 1000; const totalBars = Math.ceil(s.totalMm / barLenMm);
        return [s.code, s.detail, `${(s.totalMm / 1000).toFixed(2)} m`, `${s.barLength} m`, totalBars];
    });
    autoTable(doc, { startY: currentY, head: [['CÓDIGO', 'DESCRIPCIÓN', 'METROS TOTALES', 'LARGO BARRA', 'BARRAS A COMPRAR']], body: aluBody, theme: 'grid', headStyles: { fillColor: [51, 65, 85] }, styles: { fontSize: 8 }, columnStyles: { 4: { halign: 'center', fontStyle: 'bold' } } });
    currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(11); doc.text('2. LISTADO DE CRISTALES, PANELES Y TELAS', 15, currentY); currentY += 5;
    const fillSummary = new Map<string, { spec: string, w: number, h: number, qty: number }>();
    quote.items.forEach(item => {
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId); if (!recipe) return;
            const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
            const numLeaves = (recipe.visualType?.includes('sliding_3')) ? 3 : (recipe.visualType?.includes('sliding_4')) ? 4 : (recipe.visualType?.includes('sliding') ? 2 : 1);
            panes.forEach((pane, paneIdx) => {
                if (pane.isBlind) {
                    const bpId = mod.blindPaneIds?.[paneIdx];
                    const bp = blindPanels.find(x => x.id === bpId);
                    const slatId = mod.slatProfileIds?.[paneIdx];
                    if (slatId) return;
                    if (bp && bp.unit === 'm2') {
                        const key = `CIEGO-${bp.code}-${Math.round(pane.w)}-${Math.round(pane.h)}`;
                        const existing = fillSummary.get(key) || { spec: `PANEL CIEGO: ${bp.detail}`, w: Math.round(pane.w), h: Math.round(pane.h), qty: 0 };
                        existing.qty += (item.quantity * numLeaves); fillSummary.set(key, existing);
                    }
                    return;
                }
                let spec = (recipe.visualType === 'mosquitero') ? 'TELA MOSQUITERA' : 'Vidrio';
                if (recipe.visualType !== 'mosquitero') {
                    const gOuter = glasses.find(g => g.id === mod.glassOuterId); spec = mod.isDVH ? `${gOuter?.detail || '?'} / DVH` : (gOuter?.detail || 'VS');
                }
                const key = `${spec}-${Math.round(pane.w)}-${Math.round(pane.h)}`;
                const existing = fillSummary.get(key) || { spec, w: Math.round(pane.w), h: Math.round(pane.h), qty: 0 };
                existing.qty += (item.quantity * numLeaves); fillSummary.set(key, existing);
            });
        });
    });
    const glassBody = Array.from(fillSummary.values()).map(g => [g.spec, `${g.w} x ${g.h}`, g.qty, `${((g.w * g.h / 1000000) * g.qty).toFixed(2)} m2`]);
    autoTable(doc, { startY: currentY, head: [['ESPECIFICACIÓN', 'MEDIDA (mm)', 'CANTIDAD', 'TOTAL M2']], body: glassBody, theme: 'striped', headStyles: { fillColor: [71, 85, 105] } });
    currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(11); doc.text('3. LISTADO DE HERRAJES, GOMAS Y FELPAS', 15, currentY); currentY += 5;
    const accSummary = new Map<string, { code: string, detail: string, qty: number, isLinear: boolean }>();
    quote.items.forEach(item => {
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId); if (!recipe) return;
            const activeAccs = mod.overriddenAccessories || recipe.accessories;
            activeAccs.forEach(ra => {
                if (ra.isAlternative) return;
                const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId); if (!acc) return;
                const existing = accSummary.get(acc.id) || { code: acc.code, detail: acc.detail, qty: 0, isLinear: ra.isLinear || false };
                if (ra.isLinear && ra.formula) {
                    const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
                    const lengthMm = evaluateFormula(ra.formula, panes[0]?.w || 1000, panes[0]?.h || 1000); 
                    existing.qty += (lengthMm / 1000) * ra.quantity * item.quantity;
                } else if (ra.isSpaced && ra.spacingMm && ra.formula) {
                    const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
                    const lengthMm = evaluateFormula(ra.formula, panes[0]?.w || 1000, panes[0]?.h || 1000);
                    const count = Math.ceil(lengthMm / ra.spacingMm);
                    existing.qty += count * (ra.quantity || 1) * item.quantity;
                } else { existing.qty += (ra.quantity * item.quantity); }
                accSummary.set(acc.id, existing);
            });
        });
    });
    const accBody = Array.from(accSummary.values()).map(a => [a.code, a.detail, a.isLinear ? `${a.qty.toFixed(2)} m` : a.qty]);
    autoTable(doc, { startY: currentY, head: [['CÓDIGO', 'DESCRIPCIÓN', 'CANTIDAD TOTAL']], body: accBody, theme: 'grid', headStyles: { fillColor: [100, 116, 139] }, styles: { fontSize: 8 } });
    doc.save(`Pedido_Consolidado_${quote.clientName}.pdf`);
};

export const generateClientDetailedPDF = (quote: Quote, config: GlobalConfig, recipes: ProductRecipe[], glasses: Glass[], dvhInputs: DVHInput[], treatments: Treatment[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    if (config.companyLogo) { 
        try { 
            const imgProps = doc.getImageProperties(config.companyLogo);
            const maxH = 18; const drawW = (imgProps.width * maxH) / imgProps.height;
            doc.addImage(config.companyLogo, 'PNG', (pageWidth / 2) - (drawW / 2), 10, drawW, maxH); 
        } catch(e){} 
    }
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text(config.companyName || 'PRESUPUESTO COMERCIAL', pageWidth / 2, 35, { align: 'center' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(`${config.companyAddress || ''} | Tel: ${config.companyPhone || ''}`, pageWidth / 2, 40, { align: 'center' });
    doc.setDrawColor(230); doc.line(20, 45, pageWidth - 20, 45);
    doc.setFontSize(10); doc.text(`CLIENTE: ${quote.clientName.toUpperCase()}`, 20, 55);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 20, 55, { align: 'right' });

    const tableData = quote.items.map((item, idx) => {
        const treatment = treatments.find(t => t.id === item.colorId);
        const moduleRecipes = item.composition.modules.map(m => recipes.find(r => r.id === m.recipeId)).filter(Boolean);
        const moduleNames = moduleRecipes.map(r => r?.name);
        const compositeName = moduleNames.length > 1 ? `CONJUNTO: ${moduleNames.join(' + ')}` : (moduleNames[0] || 'Abertura');
        const recipeLine = moduleRecipes[0]?.line || 'No especificada';
        let glassDetailStr = 'No definido';
        const firstMod = item.composition.modules?.[0];
        if (firstMod) {
            const recipe = recipes.find(r => r.id === firstMod.recipeId);
            if (recipe?.visualType === 'mosquitero') { glassDetailStr = 'TELA MOSQUITERA (ALUMINIO)'; } else {
                const gOuter = glasses.find(g => g.id === firstMod.glassOuterId);
                if (firstMod.isDVH) {
                    const gInner = glasses.find(g => g.id === firstMod.glassInnerId);
                    const camera = dvhInputs.find(i => i.id === firstMod.dvhCameraId);
                    glassDetailStr = `${gOuter?.detail || '?'} / ${camera?.detail || '?'} / ${gInner?.detail || '?'}`;
                } else { glassDetailStr = gOuter?.detail || 'Simple'; }
            }
        }
        let desc = `${item.itemCode || `POS#${idx+1}`}: ${compositeName}\nLínea: ${recipeLine}\nAcabado: ${treatment?.name || '-'}\nLlenado: ${glassDetailStr}`;
        if (item.extras?.mosquitero) desc += `\nAdicional: CON MOSQUITERO`;
        return [ idx + 1, '', desc, `${item.width} x ${item.height}`, item.quantity, `$${item.calculatedCost.toLocaleString()}`, `$${((item.calculatedCost * item.quantity)).toLocaleString()}` ];
    });

    autoTable(doc, {
        startY: 65, head: [['#', 'DIBUJO', 'DETALLE TÉCNICO', 'MEDIDAS', 'CANT.', 'UNIT.', 'SUBTOTAL']],
        body: tableData, theme: 'plain', headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, valign: 'middle' }, alternateRowStyles: { fillColor: [249, 250, 251] },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                const item = quote.items[data.row.index];
                if (item && item.previewImage) {
                    try {
                        const imgProps = doc.getImageProperties(item.previewImage);
                        const cellW = data.cell.width - 4; const cellH = 30; 
                        const ratio = Math.min(cellW / imgProps.width, cellH / imgProps.height);
                        const drawW = imgProps.width * ratio; const drawH = imgProps.height * ratio;
                        const offsetX = (cellW - drawW) / 2; const offsetY = (cellH - drawH) / 2;
                        doc.setDrawColor(200); doc.rect(data.cell.x + 2 + offsetX, data.cell.y + 2 + offsetY, drawW, drawH, 'D');
                        doc.addImage(item.previewImage, 'JPEG', data.cell.x + 2 + offsetX, data.cell.y + 2 + offsetY, drawW, drawH);
                    } catch(e){}
                }
            }
        },
        columnStyles: { 1: { cellWidth: 45, minCellHeight: 35 }, 2: { cellWidth: 'auto' }, 6: { halign: 'right', fontStyle: 'bold' } }
    });
    const lastTable = (doc as any).lastAutoTable; const finalY = lastTable ? lastTable.finalY + 15 : 200;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL FINAL: $${quote.totalPrice.toLocaleString()}`, pageWidth - 20, finalY, { align: 'right' });
    doc.save(`Presupuesto_${quote.clientName}.pdf`);
};

export const generateRecipeTechnicalPDF = (recipe: ProductRecipe, aluminum: AluminumProfile[], accessories: Accessory[], config: GlobalConfig) => {
    const doc = new jsPDF(); const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255); doc.setFontSize(18); doc.text('FICHA TÉCNICA DE INGENIERÍA', 15, 20);
    doc.setFontSize(10); doc.text(`SISTEMA: ${recipe.name} | LÍNEA: ${recipe.line}`, 15, 28);
    const profileData = recipe.profiles.map(rp => {
        const pDef = aluminum.find(a => a.id === rp.profileId);
        return [pDef?.code || 'S/D', pDef?.detail || 'Sin Detalle', rp.quantity, rp.formula, `${rp.cutStart}° / ${rp.cutEnd}°`];
    });
    autoTable(doc, { startY: 50, head: [['CÓDIGO', 'DETALLE TÉCNICO', 'CANT', 'FÓRMULA', 'CORTES']], body: profileData, theme: 'grid', headStyles: { fillColor: [79, 70, 229] } });
    doc.save(`Ficha_${recipe.name}.pdf`);
};

export const generateAssemblyOrderPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], glasses: Glass[], dvhInputs: DVHInput[]) => {
    const doc = new jsPDF(); const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255); doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('HOJA DE RUTA Y ARMADO DE TALLER', 15, 12);
    doc.setFontSize(9); doc.text(`OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 18);
    let currentY = 35;
    quote.items.forEach((item, idx) => {
        const { isManualDim, colRatios, rowRatios, couplingDeduction } = item.composition;
        if (currentY > 220) { doc.addPage(); currentY = 20; }
        doc.setFillColor(241, 245, 249); doc.rect(10, currentY, pageWidth - 20, 10, 'F');
        doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        const moduleRecipes = item.composition.modules.map(m => recipes.find(r => r.id === m.recipeId)).filter(Boolean);
        const moduleNames = moduleRecipes.map(r => r?.name);
        const compositeName = moduleNames.length > 1 ? `CONJUNTO: ${moduleNames.join(' + ')}` : (moduleNames[0] || 'Abertura');
        const recipeLine = moduleRecipes[0]?.line || '-'; const isSet = item.composition.modules.length > 1;
        const cProfile = item.couplingProfileId ? aluminum.find(p => p.id === item.couplingProfileId) : null;
        const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
        const validModules = item.composition.modules.filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
        if (validModules.length === 0) return;
        const minX = Math.min(...validModules.map(m => m.x)); const minY = Math.min(...validModules.map(m => m.y));
        const maxX = Math.max(...validModules.map(m => m.x)); const maxY = Math.max(...validModules.map(m => m.y));
        doc.text(`${item.itemCode || `POS#${idx+1}`} - ${compositeName} (Línea: ${recipeLine}) - CANT: ${item.quantity}`, 15, currentY + 6.5);
        currentY += 15;
        if (item.previewImage) {
            try { 
                const imgProps = doc.getImageProperties(item.previewImage);
                const drawH = 35; const drawW = (imgProps.width * drawH) / imgProps.height;
                doc.addImage(item.previewImage, 'JPEG', 15, currentY, drawW, drawH); 
            } catch(e){}
        }
        const profileCuts: any[] = [];
        validModules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId); if (!recipe) return;
            const modIdxX = mod.x - minX; const modIdxY = mod.y - minY;
            
            let modW = (isManualDim && mod.width) ? mod.width : Number(colRatios[modIdxX] || 0);
            let modH = (isManualDim && mod.height) ? mod.height : Number(rowRatios[modIdxY] || 0);

            if (item.composition.colRatios.length > 1) {
                if (mod.x !== minX) modW -= (realDeduction / 2); if (mod.x !== maxX) modW -= (realDeduction / 2);
            }
            if (item.composition.rowRatios.length > 1) {
                if (mod.y !== minY) modH -= (realDeduction / 2); if (mod.y !== maxY) modH -= (realDeduction / 2);
            }
            const transomTemplate = (recipe.profiles || []).find(rp => rp.role === 'Travesaño' || (rp.role && rp.role.toLowerCase().includes('trave')));
            const recipeTransomFormula = transomTemplate?.formula || recipe.transomFormula || 'W';
            const recipeTransomQty = transomTemplate?.quantity || 1;

            // Cálculo de espesor de vidrio para selección dinámica
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            const gInner = mod.isDVH ? glasses.find(g => g.id === mod.glassInnerId) : null;
            const dvhCam = mod.isDVH ? dvhInputs.find(i => i.id === mod.dvhCameraId) : null;
            let camThick = 12;
            if (dvhCam) { const m = dvhCam.detail.match(/(\d+)\s*mm/i); if (m) camThick = parseInt(m[1]); }
            const getThick = (g: any) => {
                if (!g) return 0;
                const m = g.detail.match(/(\d+)\s*mm/i); if (m) return parseInt(m[1]);
                const mc = g.code.match(/(\d+)\s*mm/i); if (mc) return parseInt(mc[1]);
                return 4;
            };
            const totalGlassThick = getThick(gOuter) + (mod.isDVH ? (getThick(gInner) + camThick) : 0);
            const beadStyle = item.glazingBeadStyle || 'Recto';

            recipe.profiles.forEach(rp => {
                const role = rp.role?.toLowerCase() || ''; if (role.includes('trave')) return;
                let p = aluminum.find(a => a.id === rp.profileId);
                
                // Lógica de Contravidrio Dinámico
                if (rp.glazingBeadOptions && Array.isArray(rp.glazingBeadOptions) && rp.glazingBeadOptions.length > 0) {
                    const candidates = aluminum.filter(pf => (rp.glazingBeadOptions || []).includes(pf.id));
                    let styleMatches = candidates.filter(pf => pf.glazingBeadStyle === beadStyle);
                    if (styleMatches.length === 0) styleMatches = candidates;
                    
                    let bestMatch = styleMatches.find(pf => {
                        const min = pf.minGlassThickness || 0; 
                        const max = pf.maxGlassThickness || 100;
                        return totalGlassThick >= min && totalGlassThick <= max;
                    });

                    if (!bestMatch) {
                        bestMatch = candidates.find(pf => {
                            const min = pf.minGlassThickness || 0; 
                            const max = pf.maxGlassThickness || 100;
                            return totalGlassThick >= min && totalGlassThick <= max;
                        });
                    }

                    if (bestMatch) p = bestMatch;
                }
                
                // Exclusión centralizada de Tapajuntas en hoja de taller
                const isTJ = role.includes('tapa') || String(p?.code || '').toUpperCase().includes('TJ') || p?.id === recipe.defaultTapajuntasProfileId;
                if (isTJ) return;

                const isMosq = role.includes('mosquitero') || p?.id === recipe.mosquiteroProfileId;
                if (isMosq && !item.extras.mosquitero) return;
                const cutLen = evaluateFormula(rp.formula, modW, modH);
                profileCuts.push([p?.code || 'S/D', p?.detail || '-', Math.round(cutLen), rp.quantity, `${rp.cutStart}° / ${rp.cutEnd}°`]);
            });
            if (mod.transoms && mod.transoms.length > 0) {
              mod.transoms.forEach(t => {
                const trProf = aluminum.find(p => p.id === t.profileId);
                if (trProf) {
                  const f = t.formula || recipeTransomFormula;
                  const cutLen = evaluateFormula(f, modW, modH);
                  profileCuts.push([trProf.code, trProf.detail, Math.round(cutLen), recipeTransomQty, '90° / 90°']);
                }
              });
            }
            
            const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
            const numLeaves = (recipe.visualType?.includes('sliding_3')) ? 3 : (recipe.visualType?.includes('sliding_4')) ? 4 : (recipe.visualType?.includes('sliding') ? 2 : 1);
            panes.forEach((p, pIdx) => {
                if (p.isBlind) {
                    const slatId = mod.slatProfileIds?.[pIdx];
                    if (slatId) {
                        const slatProf = aluminum.find(a => a.id === slatId);
                        if (slatProf && slatProf.thickness > 0) {
                            const numSlats = Math.ceil(p.h / slatProf.thickness);
                            profileCuts.push([slatProf.code, `Tablilla (${pIdx+1})`, Math.round(p.w), numSlats * numLeaves, '90° / 90°']);
                        }
                    }
                }
            });
        });
        if (item.couplingProfileId && isSet) {
            const trProf = aluminum.find(p => p.id === item.couplingProfileId);
            if (trProf) {
                if (item.composition.colRatios.length > 1) {
                    for (let x = minX; x < maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            const mL = validModules.find(m => m.x === x && m.y === y);
                            const mR = validModules.find(m => m.x === x + 1 && m.y === y);
                            if (mL && mR) {
                                const hL = (isManualDim && mL.height) ? mL.height : Number(rowRatios[y - minY] || 0);
                                const hR = (isManualDim && mR.height) ? mR.height : Number(rowRatios[y - minY] || 0);
                                profileCuts.push([trProf.code, 'Acople Conjunto V', Math.round(Math.min(hL, hR)), 1, '90° / 90°']);
                            }
                        }
                    }
                }
                if (item.composition.rowRatios.length > 1) {
                    for (let y = minY; y < maxY; y++) {
                        for (let x = minX; x <= maxX; x++) {
                            const mT = validModules.find(m => m.x === x && m.y === y);
                            const mB = validModules.find(m => m.x === x && m.y === y + 1);
                            if (mT && mB) {
                                const wT = (isManualDim && mT.width) ? mT.width : Number(colRatios[x - minX] || 0);
                                const wB = (isManualDim && mB.width) ? mB.width : Number(colRatios[x - minX] || 0);
                                profileCuts.push([trProf.code, 'Acople Conjunto H', Math.round(Math.min(wT, wB)), 1, '90° / 90°']);
                            }
                        }
                    }
                }
            }
        }
        
        // Sumatoria Unificada de Tapajuntas en la Hoja de Taller
        if (item.extras.tapajuntas) {
            const firstRecipe = recipes.find(r => r.id === item.composition.modules[0].recipeId);
            let tjProfile = aluminum.find(p => p.id === firstRecipe?.defaultTapajuntasProfileId);
            
            // Fallback
            if (!tjProfile && firstRecipe) {
                const tjRef = firstRecipe.profiles.find(p => p.role === 'Tapajuntas');
                if (tjRef) tjProfile = aluminum.find(p => p.id === tjRef.profileId);
            }

            if (tjProfile) {
                const tjThick = Number(tjProfile.thickness || 30); const { top, bottom, left, right } = item.extras.tapajuntasSides;
                if (top) profileCuts.push([tjProfile.code, 'Tapajunta Superior', Math.round(item.width + (left ? tjThick : 0) + (right ? tjThick : 0)), 1, '45° / 45°']);
                if (bottom) profileCuts.push([tjProfile.code, 'Tapajunta Inferior', Math.round(item.width + (left ? tjThick : 0) + (right ? tjThick : 0)), 1, '45° / 45°']);
                if (left) profileCuts.push([tjProfile.code, 'Tapajunta Lateral L', Math.round(item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0)), 1, '45° / 45°']);
                if (right) profileCuts.push([tjProfile.code, 'Tapajunta Lateral R', Math.round(item.height + (top ? tjThick : 0) + (bottom ? tjThick : 0)), 1, '45° / 45°']);

                if (isSet) {
                    for (let x = minX; x < maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            const mL_m = validModules.find(m => m.x === x && m.y === y);
                            const mR_m = validModules.find(m => m.x === x + 1 && m.y === y);
                            if (mL_m && mR_m) {
                                let hL = (isManualDim && mL_m.height) ? mL_m.height : Number(rowRatios[y - minY] || 0);
                                let hR = (isManualDim && mR_m.height) ? mR_m.height : Number(rowRatios[y - minY] || 0);
                                const diff = Math.abs(hL - hR);
                                if (diff > 5) {
                                    profileCuts.push([tjProfile.code, `TJ Sobrante Desnivel`, Math.round(diff), 1, '90° / 90°']);
                                }
                            }
                        }
                    }
                }
            }
        }
        autoTable(doc, { startY: currentY, margin: { left: 80 }, head: [['CÓD.', 'PERFIL', 'LONG', 'CANT', 'CORTES']], body: profileCuts, theme: 'grid', styles: { fontSize: 7 }, headStyles: { fillColor: [71, 85, 105] }, columnStyles: { 2: { halign: 'center', fontStyle: 'bold' } } });
        currentY = (doc as any).lastAutoTable.finalY + 5; const glassPieces: any[] = [];
        validModules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId); if (!recipe) return;
            const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
            let spec = 'S/D';
            if (recipe.visualType === 'mosquitero') { spec = 'TELA MOSQUITERA (ALUMINIO)'; } else {
                const gOuter = glasses.find(g => g.id === mod.glassOuterId);
                if (mod.isDVH) {
                    const gInner = glasses.find(g => g.id === mod.glassInnerId); const camera = dvhInputs.find(i => i.id === mod.dvhCameraId);
                    spec = `${gOuter?.detail || '?'} / ${camera?.detail || '?'} / ${gInner?.detail || '?'}`;
                } else { spec = gOuter?.detail || 'Vidrio Simple'; }
            }
            const numLeaves = (recipe.visualType?.includes('sliding_3')) ? 3 : (recipe.visualType?.includes('sliding_4')) ? 4 : (recipe.visualType?.includes('sliding') ? 2 : 1);
            panes.forEach((p, pIdx) => {
                if (!p.isBlind) { glassPieces.push([`Paño ${pIdx + 1}`, spec, `${Math.round(p.w)} x ${Math.round(p.h)}`, numLeaves]); }
                else { 
                    const slatId = mod.slatProfileIds?.[pIdx];
                    const slatProf = aluminum.find(a => a.id === slatId);
                    const blindText = slatProf ? `CIEGO (TABLILLAS ${slatProf.code})` : 'PANEL CIEGO';
                    glassPieces.push([`Paño ${pIdx + 1}`, blindText, `${Math.round(p.w)} x ${Math.round(p.h)}`, numLeaves]); 
                }
            });
        });
        autoTable(doc, { startY: currentY, head: [['UBICACIÓN', 'ESPECIFICACIÓN DE LLENADO', 'MEDIDAS (mm)', 'CANT POR UNID.']], body: glassPieces, theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [51, 65, 85] } });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    });
    doc.save(`Taller_${quote.clientName}.pdf`);
};

export const generateCostsPDF = (quote: Quote, config: GlobalConfig, recipes: ProductRecipe[], aluminum: AluminumProfile[]) => {
    const doc = new jsPDF(); const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255); doc.setFontSize(14); doc.text('AUDITORÍA DE COSTOS INTERNOS', 15, 15);
    const tableData = quote.items.map((item, idx) => {
        const b = item.breakdown;
        const moduleNames = item.composition.modules.map(m => recipes.find(r => r.id === m.recipeId)?.name).filter(Boolean);
        const compositeName = moduleNames.length > 1 ? `CONJUNTO: ${moduleNames.join(' + ')}` : (moduleNames[0] || '-');
        return [ item.itemCode || `POS#${idx+1}`, compositeName, item.quantity, `$${((b?.aluCost || 0) * item.quantity).toLocaleString()}`, `$${((b?.glassCost || 0) * item.quantity).toLocaleString()}`, `$${((b?.accCost || 0) * item.quantity).toLocaleString()}`, `$${((b?.laborCost || 0) * item.quantity).toLocaleString()}`, `$${(item.calculatedCost * item.quantity).toLocaleString()}` ];
    });
    autoTable(doc, { startY: 35, head: [['CÓD.', 'SISTEMA', 'CANT.', 'ALUMINIO', 'VIDRIO', 'HERRAJES', 'M. OBRA', 'TOTAL']], body: tableData, theme: 'striped', headStyles: { fillColor: [51, 65, 85], fontSize: 8 }, styles: { fontSize: 7 } });
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalAlu = quote.items.reduce((sum, i) => sum + (i.breakdown?.aluCost || 0) * i.quantity, 0);
    const totalGlass = quote.items.reduce((sum, i) => sum + (i.breakdown?.glassCost || 0) * i.quantity, 0);
    const totalAcc = quote.items.reduce((sum, i) => sum + (i.breakdown?.accCost || 0) * i.quantity, 0);
    const totalLabor = quote.items.reduce((sum, i) => sum + (i.breakdown?.laborCost || 0) * i.quantity, 0);
    const finalTotal = totalAlu + totalGlass + totalAcc + totalLabor;
    doc.setFillColor(248, 250, 252); doc.rect(15, finalY, pageWidth - 30, 45, 'F'); doc.setDrawColor(226, 232, 240); doc.rect(15, finalY, pageWidth - 30, 45, 'D');
    doc.setTextColor(100); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('RESUMEN DE COSTOS CONSOLIDADO DE OBRA', 20, finalY + 10);
    doc.setFont('helvetica', 'normal'); doc.text(`TOTAL COSTO ALUMINIO:`, 20, finalY + 20); doc.text(`$${totalAlu.toLocaleString()}`, pageWidth - 20, finalY + 20, { align: 'right' });
    doc.text(`TOTAL COSTO VIDRIOS/PANELES:`, 20, finalY + 25); doc.text(`$${totalGlass.toLocaleString()}`, pageWidth - 20, finalY + 25, { align: 'right' });
    doc.text(`TOTAL COSTO ACCESORIOS/GOMAS:`, 20, finalY + 30); doc.text(`$${totalAcc.toLocaleString()}`, pageWidth - 20, finalY + 30, { align: 'right' });
    doc.text(`MANO DE OBRA Y CARGA OPERATIVA (${config.laborPercentage}%):`, 20, finalY + 35); doc.text(`$${totalLabor.toLocaleString()}`, pageWidth - 20, finalY + 35, { align: 'right' });
    doc.setLineWidth(0.5); doc.line(20, finalY + 38, pageWidth - 20, finalY + 38);
    doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(`VALOR TOTAL FINAL DE OBRA:`, 20, finalY + 43); doc.text(`$${finalTotal.toLocaleString()}`, pageWidth - 20, finalY + 43, { align: 'right' });
    doc.save(`Auditoria_Costos_${quote.clientName}.pdf`);
};

export const generateGlassOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], glasses: Glass[], aluminum: AluminumProfile[], dvhInputs: DVHInput[], blindPanels: BlindPanel[]) => {
    const doc = new jsPDF({ orientation: 'landscape' }); const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight();
    const allPieces: GlassPiece[] = []; const listTableData: any[] = [];
    quote.items.forEach((item, itemIdx) => {
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId); if (!recipe || recipe.visualType === 'mosquitero') return;
            const numLeaves = (recipe.visualType?.includes('sliding_3')) ? 3 : (recipe.visualType?.includes('sliding_4')) ? 4 : (recipe.visualType?.includes('sliding') ? 2 : 1);
            const glassPanes = getModuleGlassPanes(item, mod, recipe, aluminum);
            const gOuter = glasses.find(g => g.id === mod.glassOuterId); const gInner = mod.isDVH ? glasses.find(g => g.id === mod.glassInnerId) : null;
            glassPanes.forEach((pane, paneIdx) => {
                if (!pane.isBlind) {
                    const qtyPerSheet = item.quantity * numLeaves; const outerSpec = gOuter?.detail || 'Vidrio Ext';
                    listTableData.push([item.itemCode || `POS#${itemIdx + 1}`, outerSpec, `${Math.round(pane.w)} x ${Math.round(pane.h)}`, qtyPerSheet]);
                    for (let i = 0; i < qtyPerSheet; i++) {
                        allPieces.push({ id: `${item.id}-ext-${i}-${Math.random()}`, itemCode: item.itemCode || `POS#${itemIdx+1}`, spec: outerSpec, w: Math.round(pane.w), h: Math.round(pane.h), glassId: mod.glassOuterId });
                    }
                    if (mod.isDVH && gInner) {
                        const innerSpec = gInner.detail || 'Vidrio Int';
                        listTableData.push([item.itemCode || `POS#${itemIdx + 1}`, innerSpec, `${Math.round(pane.w)} x ${Math.round(pane.h)}`, qtyPerSheet]);
                        for (let i = 0; i < qtyPerSheet; i++) {
                            allPieces.push({ id: `${item.id}-int-${i}-${Math.random()}`, itemCode: item.itemCode || `POS#${itemIdx+1}`, spec: innerSpec, w: Math.round(pane.w), h: Math.round(pane.h), glassId: mod.glassInnerId! });
                        }
                    }
                } else {
                    const bpId = mod.blindPaneIds?.[paneIdx];
                    const bp = blindPanels.find(x => x.id === bpId);
                    if (bp && bp.unit === 'm2') {
                        const qtyPerSheet = item.quantity * numLeaves;
                        const panelSpec = `PANEL CIEGO: ${bp.detail}`;
                        listTableData.push([item.itemCode || `POS#${itemIdx + 1}`, panelSpec, `${Math.round(pane.w)} x ${Math.round(pane.h)}`, qtyPerSheet]);
                        for (let i = 0; i < qtyPerSheet; i++) {
                            allPieces.push({ id: `${item.id}-blind-${i}-${Math.random()}`, itemCode: item.itemCode || `POS#${itemIdx+1}`, spec: panelSpec, w: Math.round(pane.w), h: Math.round(pane.h), glassId: bp.id });
                        }
                    }
                }
            });
        });
    });
    if (allPieces.length === 0) return;
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 30, 'F'); doc.setTextColor(255); doc.setFontSize(18); doc.text('OPTIMIZADOR DE CORTE DE VIDRIOS / PANELES', 15, 20);
    autoTable(doc, { startY: 40, head: [['ABERTURA', 'ESPECIFICACIÓN', 'MEDIDA (mm)', 'CANT.']], body: listTableData, theme: 'striped' });
    const groupedBySpec = new Map<string, GlassPiece[]>();
    allPieces.forEach(p => { const list = groupedBySpec.get(p.spec) || []; list.push(p); groupedBySpec.set(p.spec, list); });
    groupedBySpec.forEach((pieces, specName) => {
        let sheetW = 2400, sheetH = 1800;
        const refGlass = glasses.find(g => g.id === pieces[0].glassId);
        if (refGlass) {
            sheetW = refGlass.width || 2400;
            sheetH = refGlass.height || 1800;
        }
        
        const margin = 12; 
        pieces.sort((a, b) => (b.w * b.h) - (a.w * a.h)); 
        let sheets: { p: GlassPiece, x: number, y: number, rw: number, rh: number }[][] = [[]];
        let curSheetIdx = 0, curY = 0, curShelfH = 0, curX = 0;
        pieces.forEach(p => {
            let fitsNormal = (curX + p.w + margin <= sheetW) && (curY + p.h + margin <= sheetH);
            if (fitsNormal) { p.rotated = false; } else {
                curX = 0; curY += curShelfH + margin; curShelfH = 0; fitsNormal = (curX + p.w + margin <= sheetW) && (curY + p.h + margin <= sheetH);
                if (fitsNormal) { p.rotated = false; } else { curX = 0; curY = 0; curShelfH = 0; curSheetIdx++; sheets[curSheetIdx] = []; p.rotated = false; }
            }
            sheets[curSheetIdx].push({ p, x: curX, y: curY, rw: p.w, rh: p.h }); curX += p.w + margin; if (p.h > curShelfH) curShelfH = p.h;
        });
        sheets.forEach((sheetPieces, sIdx) => {
            doc.addPage(); doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 25, 'F'); doc.setTextColor(255); doc.setFontSize(10);
            doc.text(`CROQUIS DE CORTE: ${specName} - PLANCHA #${sIdx+1} (${sheetW} x ${sheetH} mm)`, 15, 12); doc.setFontSize(7); doc.text(`RENDIMIENTO DE PLANCHA: ${sheetPieces.length} PIEZAS`, 15, 18);
            const scale = Math.min((pageWidth - 40) / sheetW, (pageHeight - 60) / sheetH); const startX = 20, startY = 35;
            doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.5); doc.rect(startX, startY, sheetW * scale, sheetH * scale);
            sheetPieces.forEach(sp => {
                const px = startX + (sp.x * scale), py = startY + (sp.y * scale), pw = sp.rw * scale, ph = sp.rh * scale;
                doc.setDrawColor(79, 70, 229); doc.setFillColor(243, 244, 246); doc.rect(px, py, pw, ph, 'FD');
                const fontSize = Math.max(10, 24 * scale); doc.setFontSize(fontSize); doc.setTextColor(30, 41, 59); 
                if (pw > 15 && ph > 15) { const yCenter = py + ph/2; doc.setFont('helvetica', 'bold'); doc.text(sp.p.itemCode, px + pw/2, yCenter - (fontSize * 0.1), { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.text(`${Math.round(sp.p.w)}x${Math.round(sp.p.h)}`, px + pw/2, yCenter + (fontSize * 0.5), { align: 'center' }); }
            });
        });
    });
    doc.save(`Corte_Vidrios_${quote.clientName}.pdf`);
};
