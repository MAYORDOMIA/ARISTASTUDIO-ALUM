
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, ProductRecipe, GlobalConfig, AluminumProfile, Glass, Accessory, DVHInput, QuoteItem } from '../types';
import { evaluateFormula } from './calculator';

const TYPE_COLORS: Record<string, [number, number, number]> = {
    'Ventana': [79, 70, 229],   
    'Puerta': [220, 38, 38],    
    'Paño Fijo': [5, 150, 105], 
    'Default': [79, 70, 229]   
};

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
        const itemCode = `POS#${posIdx+1}`;
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
        
        // CORRECCIÓN DE UNIDADES: Si el valor es < 100 se asume metros y se pasa a mm
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

        if (y > 170) { doc.addPage(); y = 30; }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 5, pageWidth - 20, 8, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`PERFIL: ${profile.code} - ${profile.detail} | BARRAS REQUERIDAS: ${bins.length}`, 15, y + 1);
        y += 15;

        bins.forEach((bin, bIdx) => {
            if (y > 185) { doc.addPage(); y = 30; }
            const barW = pageWidth - 60; 
            const barH = 10;
            
            // Dibujar la Barra Base (Gris)
            doc.setDrawColor(200);
            doc.setFillColor(245, 245, 245);
            doc.rect(15, y, barW, barH, 'FD');
            
            let curX = 15;
            bin.forEach((cut) => {
                const pieceW = (cut.len / barLenMm) * barW;
                
                // Dibujar la Pieza con Ángulos Reales
                doc.setFillColor(79, 70, 229);
                doc.setDrawColor(255);
                doc.setLineWidth(0.2);
                
                drawGeometricPiece(doc, curX, y, pieceW, barH, cut.cutStart, cut.cutEnd);
                
                // Texto de Medida y POS
                doc.setTextColor(0);
                doc.setFontSize(7);
                if (pieceW > 15) {
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${Math.round(cut.len)}`, curX + pieceW/2, y - 2, { align: 'center' });
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(5);
                    doc.text(cut.label, curX + pieceW/2, y + barH + 5, { align: 'center' });
                }
                
                curX += pieceW + (config.discWidth / barLenMm) * barW;
            });
            
            const totalUsed = bin.reduce((a,b)=>a+b.len+config.discWidth, 0);
            const scrap = barLenMm - totalUsed;
            
            doc.setFontSize(7);
            doc.setTextColor(100);
            doc.text(`B#${bIdx+1}`, 8, y + 6);
            doc.text(`SCRAP: ${Math.round(scrap)} mm`, 15 + barW + 4, y + 6);
            y += 28;
        });
        y += 10;
    });
    doc.save(`Optimizado_Barras_${quote.clientName}.pdf`);
};

function drawGeometricPiece(doc: jsPDF, x: number, y: number, w: number, h: number, start: string, end: string) {
    const slant = h * 0.7; // Grado visual de la inclinación
    const x1 = x;
    const x2 = x + w;
    const yTop = y;
    const yBottom = y + h;

    let p1 = {x: x1, y: yTop}, p2 = {x: x2, y: yTop}, p3 = {x: x2, y: yBottom}, p4 = {x: x1, y: yBottom};

    if (start === '45') p1.x += slant;
    if (end === '45') p2.x -= slant;

    // Dibujar forma cerrada
    doc.triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, 'FD');
    doc.triangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y, 'FD');
}

export const generateClientDetailedPDF = (quote: Quote, config: GlobalConfig, recipes: ProductRecipe[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Encabezado Centrado y Logo Proporcional
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
    doc.text(config.companyName || 'PRESUPUESTO', pageWidth / 2, 35, { align: 'center' });
    
    doc.setFontSize(8); 
    doc.setFont('helvetica', 'normal'); 
    doc.text(`${config.companyAddress || ''} | Tel: ${config.companyPhone || ''}`, pageWidth / 2, 40, { align: 'center' });
    
    doc.setDrawColor(230);
    doc.line(20, 45, pageWidth - 20, 45);

    doc.setFontSize(10);
    doc.text(`CLIENTE: ${quote.clientName.toUpperCase()}`, 20, 55);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 20, 55, { align: 'right' });

    const tableData = quote.items.map((item, idx) => {
        const recipe = recipes.find(r => r.id === item.composition.modules?.[0]?.recipeId);
        const desc = `POS#${idx+1}: ${recipe?.name || 'Abertura'}\nLínea: ${recipe?.line || '-'}\nVidrio: ${item.composition.modules?.[0]?.isDVH ? 'DVH' : 'Simple'}`;
        return [
            idx + 1,
            '', // Imagen
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
                        const cellH = 30; // Altura fija de fila para imágenes
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

export const generateAssemblyOrderPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], glasses: Glass[]) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('HOJA DE TALLER: ARMADO', 15, 20);
    let y = 35;
    quote.items.forEach((item, idx) => {
        if (y > 220) { doc.addPage(); y = 20; }
        if (item.previewImage) {
            try { 
                const imgProps = doc.getImageProperties(item.previewImage);
                const drawH = 30;
                const drawW = (imgProps.width * drawH) / imgProps.height;
                doc.addImage(item.previewImage, 'JPEG', 15, y, drawW, drawH); 
            } catch(e){}
        }
        doc.setFontSize(11); doc.text(`POSICIÓN #${idx+1} - CANT: ${item.quantity}`, 65, y + 5);
        y += 100;
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

export const generateGlassOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], glasses: Glass[], aluminum: AluminumProfile[]) => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('PLANILLA DE CORTE DE VIDRIOS', 15, 20);
    const glassData: any[] = [];
    quote.items.forEach((item, idx) => {
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;
            const glassPanes = getModuleGlassPanes(item, mod, recipe, aluminum);
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            glassPanes.forEach(pane => {
                if (!pane.isBlind) glassData.push([`POS#${idx+1}`, gOuter?.detail || 'S/D', `${Math.round(pane.w)} x ${Math.round(pane.h)}`, item.quantity]);
            });
        });
    });
    autoTable(doc, { startY: 35, head: [['ABERTURA', 'ESPECIFICACIÓN', 'MEDIDA (mm)', 'CANT.']], body: glassData });
    doc.save(`Vidrios_${quote.clientName}.pdf`);
};
