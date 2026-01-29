
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, ProductRecipe, GlobalConfig, AluminumProfile, Glass, Accessory, DVHInput, QuoteItem, Treatment } from '../types';
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
}

const getModuleGlassPanes = (
  item: QuoteItem, 
  mod: any, 
  recipe: ProductRecipe, 
  aluminum: AluminumProfile[]
): { w: number, h: number, isBlind: boolean }[] => {
    const sumCols = (item.composition.colRatios || []).reduce((a, b) => a + b, 0) || 1;
    const sumRows = (item.composition.rowRatios || []).reduce((a, b) => a + b, 0) || 1;
    const colRatio = item.composition.colRatios[mod.x] || 0;
    const rowRatio = item.composition.rowRatios[mod.y] || 0;
    const modW = (item.width * colRatio) / sumCols;
    const modH = (item.height * rowRatio) / sumRows;

    const adjustedW = modW - (recipe.glassDeductionW || 0); 
    const adjustedH = modH - (recipe.glassDeductionH || 0);
    
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
    
    const panes: { w: number, h: number, isBlind: boolean }[] = [];
    const tProfile = aluminum.find(p => p.id === recipe.defaultTransomProfileId);
    const transomThickness = tProfile?.thickness || recipe.transomThickness || (recipe.visualType?.startsWith('door_') ? 68 : 38); 
    const transomGlassDeduction = recipe.transomGlassDeduction || 0; 

    if (!mod.transoms || mod.transoms.length === 0) {
        panes.push({ w: gW, h: gH, isBlind: mod.blindPanes?.includes(0) || false });
    } else {
        const sorted = [...mod.transoms].sort((a, b) => a.height - b.height);
        let lastY = 0;
        sorted.forEach((t, idx) => {
            const currentTProf = aluminum.find(p => p.id === t.profileId);
            const currentTThickness = currentTProf?.thickness || transomThickness;
            const paneH = (idx === 0) ? (t.height - (currentTThickness / 2) - transomGlassDeduction) : (t.height - lastY - currentTThickness - transomGlassDeduction);
            if (paneH > 0) panes.push({ w: gW, h: paneH, isBlind: mod.blindPanes?.includes(idx) || false });
            lastY = t.height;
        });
        const lastPaneH = (gH - lastY - (transomThickness / 2) - transomGlassDeduction);
        if (lastPaneH > 0) panes.push({ w: gW, h: lastPaneH, isBlind: mod.blindPanes?.includes(sorted.length) || false });
    }
    return panes;
};

export const generateBarOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], config: GlobalConfig) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('OPTIMIZACIÓN TÉCNICA DE CORTE DE BARRAS', 15, 12);
    doc.setFontSize(8);
    doc.text(`OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 18);

    const cutsByProfile = new Map<string, {len:number, type:string, cutStart:string, cutEnd:string, label:string}[]>();
    
    quote.items.forEach((item, posIdx) => {
        const itemCode = item.itemCode || `POS#${posIdx+1}`;
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;
            
            const sumCols = (item.composition.colRatios || []).reduce((a,b)=>a+b,0) || 1;
            const sumRows = (item.composition.rowRatios || []).reduce((a,b)=>a+b,0) || 1;
            const colRatio = item.composition.colRatios[mod.x] || 0;
            const rowRatio = item.composition.rowRatios[mod.y] || 0;
            const modW = (item.width * colRatio) / sumCols;
            const modH = (item.height * rowRatio) / sumRows;

            recipe.profiles.forEach(rp => {
                const pDef = aluminum.find(a => a.id === rp.profileId);
                if (!pDef) return;
                const isTJ = String(pDef.code || '').toUpperCase().includes('TJ') || pDef.id === recipe.defaultTapajuntasProfileId;
                if (isTJ && !item.extras.tapajuntas) return;
                
                const cutLen = evaluateFormula(rp.formula, modW, modH);
                if (cutLen <= 0) return;
                
                const list = cutsByProfile.get(rp.profileId) || [];
                for(let k=0; k < rp.quantity * item.quantity; k++) {
                    list.push({ len: cutLen, type: recipe.type, cutStart: rp.cutStart || '90', cutEnd: rp.cutEnd || '90', label: itemCode });
                }
                cutsByProfile.set(rp.profileId, list);
            });
        });
    });

    let y = 40;
    cutsByProfile.forEach((cuts, profileId) => {
        const profile = aluminum.find(p => p.id === profileId);
        if (!profile || cuts.length === 0) return;
        const barLenMm = profile.barLength > 100 ? profile.barLength : profile.barLength * 1000;
        
        cuts.sort((a, b) => b.len - a.len);
        const bins: typeof cuts[] = [[]];
        cuts.forEach(cut => {
            let placed = false;
            for(let i=0; i < bins.length; i++) {
                const used = bins[i].reduce((acc, c) => acc + c.len + config.discWidth, 0);
                if (used + cut.len + config.discWidth <= barLenMm) {
                    bins[i].push(cut);
                    placed = true;
                    break;
                }
            }
            if (!placed) bins.push([cut]);
        });

        if (y > 165) { doc.addPage(); y = 30; }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 5, pageWidth - 20, 8, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`PERFIL: ${profile.code} - ${profile.detail} | BARRAS REQUERIDAS: ${bins.length}`, 15, y + 1);
        y += 18;

        bins.forEach((bin, bIdx) => {
            if (y > 185) { doc.addPage(); y = 30; }
            const barW = pageWidth - 70; 
            const barH = 12;
            
            doc.setDrawColor(200);
            doc.setFillColor(248, 250, 252);
            doc.rect(15, y, barW, barH, 'FD');
            
            let curX = 15;
            bin.forEach((cut) => {
                const pieceW = (cut.len / barLenMm) * barW;
                doc.setFillColor(100, 149, 237); 
                doc.setDrawColor(255);
                doc.setLineWidth(0.3);
                
                drawGeometricPiece(doc, curX, y, pieceW, barH, cut.cutStart, cut.cutEnd);
                
                doc.setTextColor(0);
                if (pieceW > 12) {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${Math.round(cut.len)}`, curX + pieceW/2, y - 3, { align: 'center' });
                    
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.text(cut.label, curX + pieceW/2, y + barH + 6, { align: 'center' });
                }
                curX += pieceW + (config.discWidth / barLenMm) * barW;
            });
            
            const totalUsed = bin.reduce((a,b)=>a+b.len+config.discWidth, 0);
            const scrap = barLenMm - totalUsed;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100);
            doc.text(`B#${bIdx+1}`, 8, y + 7.5);
            doc.text(`SCRAP: ${Math.round(scrap)} mm`, 15 + barW + 5, y + 7.5);
            y += 32;
        });
        y += 10;
    });
    doc.save(`Cortes_Barras_${quote.clientName}.pdf`);
};

function drawGeometricPiece(doc: jsPDF, x: number, y: number, w: number, h: number, start: string, end: string) {
    const slant = h * 0.75; 
    const x1 = x;
    const x2 = x + w;
    const yTop = y;
    const yBottom = y + h;

    let p1 = {x: x1, y: yTop}, p2 = {x: x2, y: yTop}, p3 = {x: x2, y: yBottom}, p4 = {x: x1, y: yBottom};

    if (start === '45') p1.x += slant;
    if (end === '45') p2.x -= slant;

    doc.triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, 'FD');
    doc.triangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y, 'FD');
}

export const generateClientDetailedPDF = (quote: Quote, config: GlobalConfig, recipes: ProductRecipe[], glasses: Glass[], dvhInputs: DVHInput[], treatments: Treatment[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    if (config.companyLogo) { 
        try { 
            const imgProps = doc.getImageProperties(config.companyLogo);
            const maxH = 18;
            const drawW = (imgProps.width * maxH) / imgProps.height;
            doc.addImage(config.companyLogo, 'PNG', (pageWidth / 2) - (drawW / 2), 10, drawW, maxH); 
        } catch(e){} 
    }
    
    doc.setFontSize(16); 
    doc.setFont('helvetica', 'bold'); 
    doc.text(config.companyName || 'PRESUPUESTO COMERCIAL', pageWidth / 2, 35, { align: 'center' });
    
    doc.setFontSize(8); 
    doc.setFont('helvetica', 'normal'); 
    doc.text(`${config.companyAddress || ''} | Tel: ${config.companyPhone || ''}`, pageWidth / 2, 40, { align: 'center' });
    
    doc.setDrawColor(230);
    doc.line(20, 45, pageWidth - 20, 45);

    doc.setFontSize(10);
    doc.text(`CLIENTE: ${quote.clientName.toUpperCase()}`, 20, 55);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 20, 55, { align: 'right' });

    const tableData = quote.items.map((item, idx) => {
        const firstMod = item.composition.modules?.[0];
        const recipe = recipes.find(r => r.id === firstMod?.recipeId);
        const treatment = treatments.find(t => t.id === item.colorId);
        
        let glassDetailStr = 'No definido';
        if (firstMod) {
            const gOuter = glasses.find(g => g.id === firstMod.glassOuterId);
            if (firstMod.isDVH) {
                const gInner = glasses.find(g => g.id === firstMod.glassInnerId);
                const camera = dvhInputs.find(i => i.id === firstMod.dvhCameraId);
                glassDetailStr = `${gOuter?.detail || '?'} / ${camera?.detail || '?'} / ${gInner?.detail || '?'}`;
            } else {
                glassDetailStr = gOuter?.detail || 'Simple';
            }
        }

        const desc = `${item.itemCode || `POS#${idx+1}`}: ${recipe?.name || 'Abertura'}\nLínea: ${recipe?.line || '-'}\nAcabado: ${treatment?.name || '-'}\nVidriado: ${glassDetailStr}`;
        return [
            idx + 1,
            '', 
            desc,
            `${item.width} x ${item.height}`,
            item.quantity,
            `$${item.calculatedCost.toLocaleString()}`,
            `$${(item.calculatedCost * item.quantity).toLocaleString()}`
        ];
    });

    autoTable(doc, {
        startY: 65,
        head: [['#', 'DIBUJO', 'DETALLE TÉCNICO', 'MEDIDAS', 'CANT.', 'UNIT.', 'SUBTOTAL']],
        body: tableData,
        theme: 'plain',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, valign: 'middle' },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                const item = quote.items[data.row.index];
                if (item && item.previewImage) {
                    try {
                        const imgProps = doc.getImageProperties(item.previewImage);
                        const cellW = data.cell.width - 4;
                        const cellH = 30; 
                        const ratio = Math.min(cellW / imgProps.width, cellH / imgProps.height);
                        const drawW = imgProps.width * ratio;
                        const drawH = imgProps.height * ratio;
                        const offsetX = (cellW - drawW) / 2;
                        const offsetY = (cellH - drawH) / 2;
                        doc.addImage(item.previewImage, 'JPEG', data.cell.x + 2 + offsetX, data.cell.y + 2 + offsetY, drawW, drawH);
                    } catch(e){}
                }
            }
        },
        columnStyles: {
            1: { cellWidth: 45, minCellHeight: 35 },
            2: { cellWidth: 'auto' },
            6: { halign: 'right', fontStyle: 'bold' }
        }
    });

    const lastTable = (doc as any).lastAutoTable;
    const finalY = lastTable ? lastTable.finalY + 15 : 200;
    
    doc.setFontSize(14); 
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL FINAL: $${quote.totalPrice.toLocaleString()}`, pageWidth - 20, finalY, { align: 'right' });
    
    doc.save(`Presupuesto_${quote.clientName}.pdf`);
};

export const generateRecipeTechnicalPDF = (recipe: ProductRecipe, aluminum: AluminumProfile[], accessories: Accessory[], config: GlobalConfig) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255); doc.setFontSize(18); doc.text('FICHA TÉCNICA DE INGENIERÍA', 15, 20);
    doc.setFontSize(10); doc.text(`SISTEMA: ${recipe.name} | LÍNEA: ${recipe.line}`, 15, 28);

    const profileData = recipe.profiles.map(rp => {
        const pDef = aluminum.find(a => a.id === rp.profileId);
        return [pDef?.code || 'S/D', pDef?.detail || 'Sin Detalle', rp.quantity, rp.formula, `${rp.cutStart}° / ${rp.cutEnd}°`];
    });

    autoTable(doc, {
        startY: 50,
        head: [['CÓDIGO', 'DETALLE TÉCNICO', 'CANT', 'FÓRMULA', 'CORTES']],
        body: profileData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Ficha_${recipe.name}.pdf`);
};

export const generateAssemblyOrderPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], glasses: Glass[], dvhInputs: DVHInput[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HOJA DE RUTA Y ARMADO DE TALLER', 15, 12);
    doc.setFontSize(9);
    doc.text(`OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 18);

    let currentY = 35;

    quote.items.forEach((item, idx) => {
        if (currentY > 220) { doc.addPage(); currentY = 20; }

        // Encabezado de la Carpintería
        doc.setFillColor(241, 245, 249);
        doc.rect(10, currentY, pageWidth - 20, 10, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const mainMod = item.composition.modules[0];
        const mainRecipe = recipes.find(r => r.id === mainMod.recipeId);
        doc.text(`${item.itemCode || `POS#${idx+1}`} - ${mainRecipe?.name || 'Abertura'} - CANT: ${item.quantity} [${item.width} x ${item.height} mm]`, 15, currentY + 6.5);
        currentY += 15;

        // Imagen a la izquierda
        if (item.previewImage) {
            try { 
                const imgProps = doc.getImageProperties(item.previewImage);
                const drawH = 35;
                const drawW = (imgProps.width * drawH) / imgProps.height;
                doc.addImage(item.previewImage, 'JPEG', 15, currentY, drawW, drawH); 
                // La tabla irá a la derecha de la imagen o debajo si es muy ancha
            } catch(e){}
        }

        // --- TABLA DE PERFILES (DESPIECE) ---
        const profileCuts: any[] = [];
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;
            
            const sumCols = (item.composition.colRatios || []).reduce((a,b)=>a+b,0) || 1;
            const sumRows = (item.composition.rowRatios || []).reduce((a,b)=>a+b,0) || 1;
            const colRatio = item.composition.colRatios[mod.x] || 0;
            const rowRatio = item.composition.rowRatios[mod.y] || 0;
            const modW = (item.width * colRatio) / sumCols;
            const modH = (item.height * rowRatio) / sumRows;

            recipe.profiles.forEach(rp => {
                const p = aluminum.find(a => a.id === rp.profileId);
                const isTJ = String(p?.code || '').toUpperCase().includes('TJ') || p?.id === recipe.defaultTapajuntasProfileId;
                if (isTJ && !item.extras.tapajuntas) return;
                
                const cutLen = evaluateFormula(rp.formula, modW, modH);
                profileCuts.push([
                    p?.code || 'S/D',
                    p?.detail || '-',
                    Math.round(cutLen),
                    rp.quantity,
                    `${rp.cutStart}° / ${rp.cutEnd}°`
                ]);
            });
        });

        autoTable(doc, {
            startY: currentY,
            margin: { left: 80 },
            head: [['CÓD.', 'PERFIL', 'LONG', 'CANT', 'CORTES']],
            body: profileCuts,
            theme: 'grid',
            styles: { fontSize: 7 },
            headStyles: { fillColor: [71, 85, 105] },
            columnStyles: { 2: { halign: 'center', fontStyle: 'bold' } }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;

        // --- TABLA DE VIDRIOS ---
        const glassPieces: any[] = [];
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;

            const visualType = recipe.visualType || '';
            let numLeaves = 1;
            if (visualType.includes('sliding_3')) numLeaves = 3;
            else if (visualType.includes('sliding_4')) numLeaves = 4;
            else if (visualType.includes('sliding')) numLeaves = 2;

            const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
            let spec = 'S/D';
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            if (mod.isDVH) {
                const gInner = glasses.find(g => g.id === mod.glassInnerId);
                const camera = dvhInputs.find(i => i.id === mod.dvhCameraId);
                spec = `${gOuter?.detail || '?'} / ${camera?.detail || '?'} / ${gInner?.detail || '?'}`;
            } else {
                spec = gOuter?.detail || 'Vidrio Simple';
            }

            panes.forEach((p, pIdx) => {
                if (!p.isBlind) {
                    glassPieces.push([
                        `Paño ${pIdx + 1}`,
                        spec,
                        `${Math.round(p.w)} x ${Math.round(p.h)}`,
                        numLeaves
                    ]);
                } else {
                    glassPieces.push([`Paño ${pIdx + 1}`, 'PANEL CIEGO / PANELING', `${Math.round(p.w)} x ${Math.round(p.h)}`, numLeaves]);
                }
            });
        });

        autoTable(doc, {
            startY: currentY,
            head: [['UBICACIÓN', 'ESPECIFICACIÓN DE VIDRIO / LLENADO', 'MEDIDAS (mm)', 'CANT POR UNID.']],
            body: glassPieces,
            theme: 'striped',
            styles: { fontSize: 7 },
            headStyles: { fillColor: [51, 65, 85] }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    doc.save(`Taller_${quote.clientName}.pdf`);
};

export const generateMaterialsOrderPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], accessories: Accessory[], glasses: Glass[], dvhInputs: DVHInput[], config: GlobalConfig) => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('PEDIDO DE MATERIALES CONSOLIDADO', 15, 20);
    const summary = new Map<string, { code: string, total: number }>();
    quote.items.forEach(item => {
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            recipe?.profiles.forEach(rp => {
                const p = aluminum.find(a => a.id === rp.profileId);
                if (!p) return;
                const len = evaluateFormula(rp.formula, item.width, item.height) * rp.quantity * item.quantity;
                const existing = summary.get(p.id) || { code: p.code, total: 0 };
                existing.total += (len / 1000);
                summary.set(p.id, existing);
            });
        });
    });
    const body = Array.from(summary.values()).map(s => [s.code, s.total.toFixed(2), 'm']);
    autoTable(doc, { startY: 35, head: [['CÓDIGO', 'CANTIDAD', 'UNIDAD']], body });
    doc.save(`Pedido_${quote.clientName}.pdf`);
};

export const generateGlassOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], glasses: Glass[], aluminum: AluminumProfile[], dvhInputs: DVHInput[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const allPieces: GlassPiece[] = [];
    const listTableData: any[] = [];

    quote.items.forEach((item, itemIdx) => {
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;

            const visualType = recipe.visualType || '';
            let numLeaves = 1;
            if (visualType.includes('sliding_3')) numLeaves = 3;
            else if (visualType.includes('sliding_4')) numLeaves = 4;
            else if (visualType.includes('sliding')) numLeaves = 2;

            const glassPanes = getModuleGlassPanes(item, mod, recipe, aluminum);
            
            // Lógica de despiece individual para DVH
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            const gInner = mod.isDVH ? glasses.find(g => g.id === mod.glassInnerId) : null;

            glassPanes.forEach(pane => {
                if (!pane.isBlind) {
                    const qtyPerSheet = item.quantity * numLeaves;
                    
                    // Pieza Exterior
                    const outerSpec = gOuter?.detail || 'Vidrio Exterior';
                    listTableData.push([item.itemCode || `POS#${itemIdx + 1}`, outerSpec, `${Math.round(pane.w)} x ${Math.round(pane.h)}`, qtyPerSheet]);
                    for (let i = 0; i < qtyPerSheet; i++) {
                        allPieces.push({
                            id: `${item.id}-ext-${i}`,
                            itemCode: item.itemCode || `POS#${itemIdx + 1}`,
                            spec: outerSpec,
                            w: Math.round(pane.w),
                            h: Math.round(pane.h),
                            glassId: mod.glassOuterId
                        });
                    }

                    // Pieza Interior (Solo si es DVH)
                    if (mod.isDVH && gInner) {
                        const innerSpec = gInner.detail || 'Vidrio Interior';
                        listTableData.push([item.itemCode || `POS#${itemIdx + 1}`, innerSpec, `${Math.round(pane.w)} x ${Math.round(pane.h)}`, qtyPerSheet]);
                        for (let i = 0; i < qtyPerSheet; i++) {
                            allPieces.push({
                                id: `${item.id}-int-${i}`,
                                itemCode: item.itemCode || `POS#${itemIdx + 1}`,
                                spec: innerSpec,
                                w: Math.round(pane.w),
                                h: Math.round(pane.h),
                                glassId: mod.glassInnerId!
                            });
                        }
                    }
                }
            });
        });
    });

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANILLA DE CORTE DE VIDRIOS - DESPIECE INDIVIDUAL', 15, 20);

    autoTable(doc, {
        startY: 40,
        head: [['ABERTURA', 'ESPECIFICACIÓN CRISTAL', 'MEDIDA (mm)', 'CANT. TOTAL PIEZAS']],
        body: listTableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] }
    });

    const groupedBySpec = new Map<string, GlassPiece[]>();
    allPieces.forEach(p => {
        const list = groupedBySpec.get(p.spec) || [];
        list.push(p);
        groupedBySpec.set(p.spec, list);
    });

    groupedBySpec.forEach((pieces, specName) => {
        const refGlass = glasses.find(g => g.id === pieces[0].glassId);
        const sheetW = refGlass?.width && refGlass.width > 100 ? refGlass.width : 2400;
        const sheetH = refGlass?.height && refGlass.height > 100 ? refGlass.height : 1800;
        const margin = 10; 

        pieces.sort((a, b) => b.h - a.h); 

        let sheets: { p: GlassPiece, x: number, y: number }[][] = [[]];
        let curSheetIdx = 0;
        let curY = 0;
        let curShelfH = 0;
        let curX = 0;

        pieces.forEach(p => {
            if (p.w > sheetW || p.h > sheetH) return;

            if (curX + p.w + margin > sheetW) {
                curX = 0;
                curY += curShelfH + margin;
                curShelfH = 0;
            }

            if (curY + p.h + margin > sheetH) {
                curX = 0; curY = 0; curShelfH = 0; curSheetIdx++;
                sheets[curSheetIdx] = [];
            }

            sheets[curSheetIdx].push({ p, x: curX, y: curY });
            curX += p.w + margin;
            if (p.h > curShelfH) curShelfH = p.h;
        });

        sheets.forEach((sheetPieces, sIdx) => {
            doc.addPage();
            doc.setFillColor(71, 85, 105);
            doc.rect(0, 0, pageWidth, 20, 'F');
            doc.setTextColor(255);
            doc.setFontSize(10);
            doc.text(`CROQUIS DE CORTE: ${specName.toUpperCase()}`, 15, 10);
            doc.setFontSize(8);
            doc.text(`PLANCHA #${sIdx + 1} | DIMENSIÓN: ${sheetW} x ${sheetH} mm`, 15, 15);

            const drawMargin = 25;
            const availableW = pageWidth - (drawMargin * 2);
            const availableH = pageHeight - (drawMargin * 2) - 30;
            const scale = Math.min(availableW / sheetW, availableH / sheetH);
            
            const startX = (pageWidth - (sheetW * scale)) / 2;
            const startY = 35;

            doc.setDrawColor(100);
            doc.setLineWidth(0.5);
            doc.rect(startX, startY, sheetW * scale, sheetH * scale);

            sheetPieces.forEach(sp => {
                const px = startX + (sp.x * scale);
                const py = startY + (sp.y * scale);
                const pw = sp.p.w * scale;
                const ph = sp.p.h * scale;

                doc.setFillColor(240, 249, 255);
                doc.rect(px, py, pw, ph, 'FD');
                doc.setDrawColor(186, 230, 253);
                doc.rect(px, py, pw, ph, 'D');

                if (pw > 15 && ph > 10) {
                    doc.setTextColor(30, 58, 138);
                    doc.setFontSize(Math.min(7, pw / 5));
                    doc.setFont('helvetica', 'bold');
                    doc.text(sp.p.itemCode, px + (pw / 2), py + (ph / 2) - 1, { align: 'center' });
                    doc.setFontSize(Math.min(6, pw / 6));
                    doc.setFont('helvetica', 'normal');
                    doc.text(`${sp.p.w}x${sp.p.h}`, px + (pw / 2), py + (ph / 2) + 3, { align: 'center' });
                }
            });

            const usedArea = sheetPieces.reduce((acc, sp) => acc + (sp.p.w * sp.p.h), 0);
            const totalArea = sheetW * sheetH;
            const efficiency = (usedArea / totalArea) * 100;

            doc.setTextColor(100);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`EFICIENCIA: ${efficiency.toFixed(1)}% | ÁREA UTILIZADA: ${(usedArea / 1000000).toFixed(2)} m2`, startX, startY + (sheetH * scale) + 8);
        });
    });

    doc.save(`Corte_Vidrios_${quote.clientName}.pdf`);
};

export const generateCostsPDF = (quote: Quote, config: GlobalConfig, recipes: ProductRecipe[], aluminum: AluminumProfile[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANILLA DE AUDITORÍA DE COSTOS INTERNOS', 15, 12);
    doc.setFontSize(8);
    doc.text(`OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 18);

    let totalAluWeight = 0;
    let totalAluCost = 0;
    let totalGlassCost = 0;
    let totalGlassArea = 0;
    let totalAccCost = 0;
    let totalLaborCost = 0;

    const tableData = quote.items.map((item, idx) => {
        const b = item.breakdown;
        const mainMod = item.composition.modules[0];
        const recipe = recipes.find(r => r.id === mainMod.recipeId);
        
        if (b) {
            totalAluWeight += b.totalWeight * item.quantity;
            totalAluCost += b.aluCost * item.quantity;
            totalGlassCost += b.glassCost * item.quantity;
            totalAccCost += b.accCost * item.quantity;
            totalLaborCost += b.laborCost * item.quantity;

            item.composition.modules.forEach(mod => {
                const r = recipes.find(rec => rec.id === mod.recipeId);
                if (r) {
                    const panes = getModuleGlassPanes(item, mod, r, aluminum);
                    panes.forEach(p => {
                        if (!p.isBlind) {
                            // Cálculo exacto de m2 contando cada cara para DVH
                            const glassMultiplier = mod.isDVH ? 2 : 1;
                            totalGlassArea += (p.w * p.h / 1000000) * item.quantity * glassMultiplier;
                        }
                    });
                }
            });
        }

        const unitCost = item.calculatedCost;
        const totalLineCost = unitCost * item.quantity;

        return [
            item.itemCode || `POS#${idx+1}`,
            recipe?.name || '-',
            item.quantity,
            `$${(b?.materialCost || 0).toLocaleString()}`,
            `$${(b?.laborCost || 0).toLocaleString()}`,
            `$${unitCost.toLocaleString()}`,
            `$${totalLineCost.toLocaleString()}`
        ];
    });

    autoTable(doc, {
        startY: 35,
        head: [['CÓD.', 'SISTEMA', 'CANT.', 'COSTO MAT.', 'MANO OBRA', 'COSTO UNIT.', 'SUBTOTAL']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8 },
        columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, finalY, pageWidth - 30, 45, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, finalY, pageWidth - 30, 45, 'D');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE INVERSIONES DE OBRA', 20, finalY + 10);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`TOTAL ALUMINIO: ${totalAluWeight.toFixed(2)} KG`, 20, finalY + 18);
    doc.text(`TOTAL VIDRIOS (AMBAS CARAS): ${totalGlassArea.toFixed(2)} M2`, 20, finalY + 24);
    doc.text(`COSTO HERRAJES: $${totalAccCost.toLocaleString()}`, 20, finalY + 30);

    doc.text(`VALOR METAL+PINT: $${totalAluCost.toLocaleString()}`, 90, finalY + 18);
    doc.text(`VALOR CRISTALES: $${totalGlassCost.toLocaleString()}`, 90, finalY + 24);
    doc.text(`VALOR MANO OBRA: $${totalLaborCost.toLocaleString()}`, 90, finalY + 30);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    const totalNeto = totalAluCost + totalGlassCost + totalAccCost + totalLaborCost;
    doc.text(`INVERSIÓN TOTAL ESTIMADA: $${totalNeto.toLocaleString()}`, 20, finalY + 40);

    doc.save(`Costos_Internos_${quote.clientName}.pdf`);
};
