
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, ProductRecipe, GlobalConfig, AluminumProfile, Glass, Accessory, DVHInput, QuoteItem } from '../types';
import { evaluateFormula } from './calculator';

const TYPE_COLORS: Record<string, [number, number, number]> = {
    'Ventana': [79, 70, 229],   // Indigo
    'Puerta': [220, 38, 38],    // Red
    'Paño Fijo': [5, 150, 105], // Green
    'Travesaño': [124, 58, 237], // Violet
    'Acople': [71, 85, 105],     // Slate
    'Tapajuntas': [2, 132, 199], // Sky
    'Mosquitero': [16, 185, 129], // Emerald
    'Default': [148, 163, 184]   // Slate 400
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

export const generateRecipeTechnicalPDF = (recipe: ProductRecipe, aluminum: AluminumProfile[], accessories: Accessory[], config: GlobalConfig) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHA TÉCNICA DE INGENIERÍA', 15, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`SISTEMA: ${recipe.name} | LÍNEA: ${recipe.line}`, 15, 28);
    doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleDateString()}`, pageWidth - 15, 28, { align: 'right' });

    let y = 50;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESPIECE DE PERFILERÍA', 15, y);
    y += 5;

    const profileData = recipe.profiles.map(rp => {
        const pDef = aluminum.find(a => a.id === rp.profileId);
        return [
            pDef?.code || 'S/D',
            pDef?.detail || 'Sin Detalle',
            rp.quantity,
            rp.formula,
            `${rp.cutStart}° / ${rp.cutEnd}°`
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['CÓDIGO', 'DETALLE TÉCNICO', 'CANT', 'FÓRMULA', 'CORTES']],
        body: profileData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
        styles: { fontSize: 8 },
        margin: { left: 15, right: 15 }
    });

    const lastTable = (doc as any).lastAutoTable;
    y = lastTable ? lastTable.finalY + 15 : y + 60;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTADO DE ACCESORIOS / HERRAJES', 15, y);
    y += 5;

    const accData = recipe.accessories.map(ra => {
        const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId);
        return [
            acc?.code || ra.accessoryId,
            acc?.detail || 'Sin Detalle',
            ra.quantity
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['CÓDIGO', 'DESCRIPCIÓN DEL HERRAJE', 'CANTIDAD']],
        body: accData,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], fontSize: 9 },
        styles: { fontSize: 8 },
        margin: { left: 15, right: 15 }
    });

    const lastTableAcc = (doc as any).lastAutoTable;
    y = lastTableAcc ? lastTableAcc.finalY + 15 : y + 40;

    if (y > 240) { doc.addPage(); y = 20; }
    
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'F');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PARÁMETROS DE VIDRIADO Y DESCUENTOS', 20, y + 8);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`FÓRMULA ANCHO (W): ${recipe.glassFormulaW}`, 20, y + 18);
    doc.text(`FÓRMULA ALTO (H): ${recipe.glassFormulaH}`, 20, y + 24);
    doc.text(`DESCUENTO BASE W: ${recipe.glassDeductionW || 0} mm`, pageWidth / 2, y + 18);
    doc.text(`DESCUENTO BASE H: ${recipe.glassDeductionH || 0} mm`, pageWidth / 2, y + 24);

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`${config.companyName || 'ARISTASTUDIO'} - DOCUMENTACIÓN TÉCNICA DE INGENIERÍA`, pageWidth / 2, 285, { align: 'center' });
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 15, 285, { align: 'right' });
    }

    doc.save(`Ficha_Tecnica_${recipe.line}_${recipe.name}.pdf`);
};

export const generateBarOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], config: GlobalConfig) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('OPTIMIZACIÓN TÉCNICA DE CORTE DE BARRAS', 15, 18);
    doc.setFontSize(8);
    doc.text(`OBRA: ${quote.clientName.toUpperCase()} | EMISIÓN: ${new Date().toLocaleDateString()}`, 15, 24);

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

            mod.transoms?.forEach((t) => {
                const list = cutsByProfile.get(t.profileId) || [];
                for(let k=0; k < item.quantity; k++) {
                    list.push({ len: modW, type: 'Travesaño', cutStart: '90', cutEnd: '90', label: `${itemCode}` });
                }
                cutsByProfile.set(t.profileId, list);
            });
        });
    });

    let y = 45;
    cutsByProfile.forEach((cuts, profileId) => {
        const profile = aluminum.find(p => p.id === profileId);
        if (!profile || cuts.length === 0) return;
        const barLenMm = (profile.barLength || 6) * 1000;
        cuts.sort((a, b) => b.len - a.len);
        
        const bins: typeof cuts[] = [[]];
        cuts.forEach(cut => {
            let placed = false;
            for(let i=0; i < bins.length; i++) {
                const used = bins[i].reduce((acc, c) => acc + c.len + config.discWidth, 0);
                if (used + cut.len + config.discWidth <= barLenMm) { bins[i].push(cut); placed = true; break; }
            }
            if (!placed) bins.push([cut]);
        });

        if (y > 160) { doc.addPage(); y = 40; }
        
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(10, y - 5, pageWidth - 20, 10, 2, 2, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`PERFIL: ${String(profile.code)} - ${profile.detail} | BARRAS: ${bins.length}`, 15, y + 1.5);
        y += 15;

        bins.forEach((bin, bIdx) => {
            if (y > 180) { doc.addPage(); y = 40; }
            const barW = pageWidth - 60; const barH = 12;
            
            // Dibujo de la Barra Maestra
            doc.setDrawColor(203, 213, 225); 
            doc.setFillColor(248, 250, 252); 
            doc.rect(15, y, barW, barH, 'FD');
            
            let curX = 15;
            bin.forEach((cut) => {
                const pieceW = (cut.len / barLenMm) * barW;
                
                // Color del corte (Indigo para destacar sobre la barra clara)
                doc.setFillColor(79, 70, 229);
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.3);
                
                ctxDrawDetailedPiece(doc, curX, y, pieceW, barH, cut.cutStart, cut.cutEnd);
                
                // Etiquetas de medida y código
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
            
            doc.setFontSize(7);
            doc.setTextColor(100);
            const totalUsed = bin.reduce((a,b)=>a+b.len+config.discWidth, 0);
            const waste = barLenMm - totalUsed;
            doc.text(`B#${bIdx+1}`, 8, y + 7.5);
            doc.text(`SCRAP: ${Math.round(waste)}mm`, 15 + barW + 5, y + 7.5);
            y += 28;
        });
        y += 10;
    });
    doc.save(`Optimizacion_Barras_${quote.clientName}.pdf`);
};

function ctxDrawDetailedPiece(doc: jsPDF, x: number, y: number, w: number, h: number, start: string, end: string) {
    const slant = h * 0.7; // Profundidad del ángulo visual
    const x1 = x; 
    const x2 = x + w;
    const y1 = y; 
    const y2 = y + h;
    
    // Puntos del polígono de la pieza
    let p1 = {x: x1, y: y1}, p2 = {x: x2, y: y1}, p3 = {x: x2, y: y2}, p4 = {x: x1, y: y2};
    
    // Aplicar ángulos geométricamente
    if (start === '45') p1.x += slant;
    if (end === '45') p2.x -= slant;
    
    doc.triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, 'FD');
    doc.triangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y, 'FD');
}

export const generateGlassOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], glasses: Glass[], aluminum: AluminumProfile[]) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('PLANILLA DE CORTE DE VIDRIOS', 15, 20);
    doc.setFontSize(8); doc.text(`CLIENTE: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 26);

    const glassData: any[] = [];
    quote.items.forEach((item, idx) => {
        const itemCode = `POS#${idx+1}`;
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;

            const visualType = recipe.visualType || '';
            let numLeaves = 1;
            if (visualType.includes('sliding_3')) numLeaves = 3;
            else if (visualType.includes('sliding_4')) numLeaves = 4;
            else if (visualType.includes('sliding')) numLeaves = 2;

            const glassPanes = getModuleGlassPanes(item, mod, recipe, aluminum);
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            const gInner = mod.isDVH ? glasses.find(g => g.id === mod.glassInnerId) : null;

            glassPanes.forEach(pane => {
                if (pane.isBlind) return;
                const totalGlassQty = numLeaves * item.quantity;
                
                glassData.push([
                  itemCode, 
                  gOuter?.detail || 'S/D', 
                  `${Math.round(pane.w)} x ${Math.round(pane.h)}`, 
                  totalGlassQty.toString()
                ]);
                
                if (mod.isDVH && gInner) {
                    glassData.push([
                      itemCode, 
                      gInner.detail, 
                      `${Math.round(pane.w)} x ${Math.round(pane.h)}`, 
                      totalGlassQty.toString()
                    ]);
                }
            });
        });
    });

    autoTable(doc, {
        startY: 35,
        head: [['ABERTURA', 'ESPECIFICACIÓN', 'MEDIDA (mm)', 'CANT.']],
        body: glassData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: { 2: { fontStyle: 'bold' }, 3: { halign: 'center', fontStyle: 'bold' } }
    });

    doc.save(`Vidrios_${quote.clientName}.pdf`);
};

export const generateClientDetailedPDF = (quote: Quote, config: GlobalConfig, recipes: ProductRecipe[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Gestión Proporcional del LOGO
    if (config.companyLogo) { 
        try { 
            const imgProps = doc.getImageProperties(config.companyLogo);
            const logoH = 20;
            const logoW = (imgProps.width * logoH) / imgProps.height;
            // Dibujar centrado o a la izquierda manteniendo ratio
            doc.addImage(config.companyLogo, 'PNG', 15, 8, logoW, logoH); 
        } catch(e){} 
    }
    
    doc.setFontSize(16); 
    doc.setFont('helvetica', 'bold'); 
    doc.text(config.companyName || 'PRESUPUESTO TÉCNICO', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(8); 
    doc.setFont('helvetica', 'normal'); 
    doc.text(`${config.companyAddress || ''} | Tel: ${config.companyPhone || ''}`, pageWidth / 2, 26, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240); 
    doc.line(15, 35, pageWidth - 15, 35);
    
    doc.setFontSize(10); 
    doc.text(`CLIENTE: ${quote.clientName.toUpperCase()}`, 15, 45);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 15, 45, { align: 'right' });

    const tableData = quote.items.map((item, idx) => {
        const firstMod = item.composition?.modules?.[0];
        const recipe = recipes.find(r => r.id === firstMod?.recipeId);
        const glassInfo = firstMod?.isDVH ? 'DVH' : 'Simple';
        const desc = `POS#${idx+1}: ${recipe?.type || 'Abertura'}\nLínea: ${recipe?.line || '-'}\nModelo: ${recipe?.name || 'S/D'}\nVidrio: ${glassInfo}`;
        return [
            { content: idx + 1, styles: { valign: 'middle', halign: 'center' } },
            { content: '', styles: { minCellHeight: 40 } },
            { content: desc, styles: { valign: 'middle', fontSize: 8 } },
            { content: `${item.width} x ${item.height}`, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' } },
            { content: item.quantity, styles: { valign: 'middle', halign: 'center' } },
            { content: `$${item.calculatedCost.toLocaleString()}`, styles: { valign: 'middle', halign: 'right' } },
            { content: `$${(item.calculatedCost * item.quantity).toLocaleString()}`, styles: { valign: 'middle', halign: 'right', fontStyle: 'bold' } }
        ];
    });

    autoTable(doc, {
        startY: 52,
        head: [['#', 'DIBUJO', 'DETALLE', 'MEDIDAS', 'CANT', 'UNIT.', 'TOTAL']],
        body: tableData,
        theme: 'plain',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                const item = quote.items[data.row.index];
                if (item && item.previewImage) {
                    try {
                        const imgProps = doc.getImageProperties(item.previewImage);
                        const cellW = data.cell.width - 4;
                        const cellH = data.cell.height - 4;
                        const ratio = Math.min(cellW / imgProps.width, cellH / imgProps.height);
                        const drawW = imgProps.width * ratio;
                        const drawH = imgProps.height * ratio;
                        const offsetX = (cellW - drawW) / 2;
                        const offsetY = (cellH - drawH) / 2;
                        doc.addImage(item.previewImage, 'JPEG', data.cell.x + 2 + offsetX, data.cell.y + 2 + offsetY, drawW, drawH);
                    } catch(e){}
                }
            }
        }
    });

    const lastTable = (doc as any).lastAutoTable;
    const finalY = lastTable ? lastTable.finalY + 15 : 200;
    
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 80, finalY - 5, pageWidth - 15, finalY - 5);
    
    doc.setFontSize(14); 
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL FINAL: $${quote.totalPrice.toLocaleString()}`, pageWidth - 15, finalY + 5, { align: 'right' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Documento generado mediante Terminal de Ingeniería AristaStudio v2.8', 15, finalY + 15);
    
    doc.save(`Presupuesto_${quote.clientName}.pdf`);
};

export const generateAssemblyOrderPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], glasses: Glass[]) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('HOJA DE TALLER: ARMADO', 15, 20);
    doc.setFontSize(9); doc.text(`CLIENTE: ${quote.clientName} | FECHA: ${new Date().toLocaleDateString()}`, 15, 26);

    let y = 35;
    quote.items.forEach((item, idx) => {
        if (y > 220) { doc.addPage(); y = 20; }
        
        if (item.previewImage) {
            try { 
                const imgProps = doc.getImageProperties(item.previewImage);
                const drawH = 35;
                const drawW = (imgProps.width * drawH) / imgProps.height;
                doc.addImage(item.previewImage, 'JPEG', 15, y, drawW, drawH); 
            } catch(e){}
        }
        
        doc.setFontSize(11); doc.setTextColor(79, 70, 229);
        doc.text(`POSICIÓN #${idx+1} - CANTIDAD: ${item.quantity}`, 62, y + 5);
        
        doc.setFontSize(8); doc.setTextColor(0);
        const mod = item.composition.modules?.[0];
        const recipe = recipes.find(r => r.id === mod?.recipeId);
        doc.text(`Sistema: ${recipe?.name || 'S/D'} | Medida: ${item.width} x ${item.height} mm`, 62, y + 12);
        
        const visualType = recipe?.visualType || '';
        let numLeaves = 1;
        if (visualType.includes('sliding_3')) numLeaves = 3;
        else if (visualType.includes('sliding_4')) numLeaves = 4;
        else if (visualType.includes('sliding')) numLeaves = 2;

        const panes = recipe && mod ? getModuleGlassPanes(item, mod, recipe, aluminum).filter(p => !p.isBlind) : [];
        doc.setFont('helvetica', 'bold');
        doc.text(`VIDRIADO:`, 62, y + 20);
        panes.forEach((pane, pIdx) => {
            doc.text(`- P${pIdx+1}: ${Math.round(pane.w)} x ${Math.round(pane.h)} mm (Cant: ${numLeaves})`, 65, y + 25 + (pIdx * 5));
        });

        const cutData = recipe?.profiles.map(rp => {
            const pDef = aluminum.find(p => p.id === rp.profileId);
            return [
                pDef ? `${pDef.code}` : 'S/D', 
                rp.quantity, 
                `${Math.round(evaluateFormula(rp.formula, item.width, item.height))} mm`, 
                `${rp.cutStart}° / ${rp.cutEnd}°`
            ];
        }) || [];

        autoTable(doc, {
            startY: y + 40 + (panes.length * 5),
            head: [['PERFIL', 'CANT', 'LARGO', 'ÁNGULOS']],
            body: cutData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], fontSize: 7 },
            styles: { fontSize: 7, cellPadding: 2 },
            margin: { left: 15 }
        });
        const lastTable = (doc as any).lastAutoTable;
        y = lastTable ? lastTable.finalY + 15 : y + 100;
    });
    doc.save(`Taller_${quote.clientName}.pdf`);
};

export const generateMaterialsOrderPDF = (quote: Quote, recipes: ProductRecipe[], aluminum: AluminumProfile[], accessories: Accessory[], glasses: Glass[], dvhInputs: DVHInput[], config: GlobalConfig) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('PEDIDO DE MATERIALES CONSOLIDADO', 15, 20);
    const summary = new Map<string, { code: string, total: number, unit: string }>();
    quote.items.forEach(item => {
        item.composition.modules.forEach(mod => {
          const recipe = recipes.find(r => r.id === mod?.recipeId);
          recipe?.profiles.forEach(rp => {
              const p = aluminum.find(a => a.id === rp.profileId);
              if (!p) return;
              const len = evaluateFormula(rp.formula, item.width, item.height) * rp.quantity * item.quantity;
              const existing = summary.get(p.id) || { code: p.code, total: 0, unit: 'm' };
              existing.total += (len / 1000);
              summary.set(p.id, existing);
          });
        });
    });
    const body = Array.from(summary.values()).map(s => [s.code, s.total.toFixed(2), s.unit]);
    autoTable(doc, { startY: 35, head: [['CÓDIGO', 'CANTIDAD', 'UNIDAD']], body, theme: 'grid' });
    doc.save(`Pedido_${quote.clientName}.pdf`);
};
