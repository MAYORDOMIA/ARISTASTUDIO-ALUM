
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, ProductRecipe, GlobalConfig, AluminumProfile, Glass, Accessory, DVHInput, QuoteItem } from '../types';

const TYPE_COLORS: Record<string, [number, number, number]> = {
    'Ventana': [59, 130, 246],   
    'Puerta': [239, 68, 68],    
    'Paño Fijo': [16, 185, 129], 
    'Travesaño': [139, 92, 246], 
    'Acople': [71, 85, 105],     
    'Tapajuntas': [14, 165, 233], 
    'Mosquitero': [16, 185, 129], 
    'Default': [203, 213, 225]   
};

const evaluate = (formula: string, W: number, h: number): number => {
    try {
        const clean = (formula || '').toString().toUpperCase().replace(/W/g, W.toString()).replace(/H/g, h.toString());
        if (!clean) return 0;
        return new Function(`return ${clean}`)();
    } catch { return 0; }
};

export const generateRecipeTechnicalPDF = (recipe: ProductRecipe, aluminum: AluminumProfile[], accessories: Accessory[], config: GlobalConfig) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Encabezado Profesional
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

    // Sección: Perfilería
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

    // Sección: Accesorios
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

    // Sección: Vidriado y Deducciones
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

    // Pie de página
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
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('OPTIMIZACIÓN TÉCNICA DE CORTE DE BARRAS', 15, 20);
    doc.setFontSize(8); doc.text(`CLIENTE: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 26);

    const cutsByProfile = new Map<string, {len:number, type:string, cutStart:string, cutEnd:string, label:string}[]>();
    
    quote.items.forEach((item, posIdx) => {
        const itemCode = `POS#${posIdx+1}`;
        const validModules = (item.composition.modules || []).filter(Boolean);
        
        validModules.forEach(mod => {
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
                
                const cutLen = evaluate(rp.formula, modW, modH);
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

    let y = 35;
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

        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFillColor(30, 41, 59); doc.roundedRect(15, y, 180, 8, 1, 1, 'F');
        doc.setTextColor(255); doc.setFontSize(9); doc.text(`PERFIL: ${String(profile.code)} - ${profile.detail} | BARRAS: ${bins.length}`, 20, y + 5.5);
        y += 15;

        bins.forEach((bin, bIdx) => {
            if (y > 265) { doc.addPage(); y = 20; }
            const barW = 165; const barH = 5;
            doc.setDrawColor(200); doc.setFillColor(245); doc.rect(15, y, barW, barH, 'FD');
            
            let curX = 15;
            bin.forEach((cut) => {
                const drawW = (cut.len / barLenMm) * barW;
                const color = TYPE_COLORS[cut.type] || TYPE_COLORS['Default'];
                doc.setFillColor(color[0], color[1], color[2]);
                
                // Dibujo gráfico de la pieza con ángulos
                ctxDrawPiece(doc, curX, y, drawW, barH, cut.cutStart, cut.cutEnd, 2);
                
                doc.setTextColor(0); doc.setFontSize(6);
                if (drawW > 8) {
                    doc.text(`${Math.round(cut.len)}`, curX + drawW/2, y - 1, { align: 'center' });
                    doc.text(cut.label, curX + drawW/2, y + barH + 3, { align: 'center' });
                }
                curX += drawW + (config.discWidth / barLenMm) * barW;
            });
            doc.setFontSize(6); doc.setTextColor(150);
            const totalUsed = bin.reduce((a,b)=>a+b.len+config.discWidth, 0);
            doc.text(`BARRA ${bIdx+1} - SOBRANTE: ${Math.round(barLenMm - totalUsed)}mm`, 182, y + 3.5);
            y += 18;
        });
        y += 10;
    });
    doc.save(`Optimizacion_Barras_${quote.clientName}.pdf`);
};

function ctxDrawPiece(doc: jsPDF, x: number, y: number, w: number, h: number, start: string, end: string, slant: number) {
    const x1 = x; const x2 = x + w;
    const y1 = y; const y2 = y + h;
    let p1 = {x: x1, y: y1}, p2 = {x: x2, y: y1}, p3 = {x: x2, y: y2}, p4 = {x: x1, y: y2};
    if (start === '45') p1.x += slant;
    if (end === '45') p2.x -= slant;
    doc.triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, 'F');
    doc.triangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y, 'F');
}

export const generateGlassOptimizationPDF = (quote: Quote, recipes: ProductRecipe[], glasses: Glass[]) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('PLANILLA DE CORTE DE VIDRIOS', 15, 20);
    doc.setFontSize(8); doc.text(`CLIENTE: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`, 15, 26);

    const glassData: any[] = [];
    quote.items.forEach((item, idx) => {
        const itemCode = `POS#${idx+1}`;
        item.composition.modules.forEach(mod => {
            const recipe = recipes.find(r => r.id === mod.recipeId);
            if (!recipe) return;
            const gOuter = glasses.find(g => g.id === mod.glassOuterId);
            const gInner = glasses.find(g => g.id === mod.glassInnerId);
            const adjW = item.width - (recipe.glassDeductionW || 0);
            const adjH = item.height - (recipe.glassDeductionH || 0);
            const gw = evaluate(recipe.glassFormulaW || 'W', adjW, adjH);
            const gh = evaluate(recipe.glassFormulaH || 'H', adjW, adjH);
            for(let k=0; k<item.quantity; k++) {
                glassData.push([itemCode, gOuter?.detail || 'S/D', `${Math.round(gw)}x${Math.round(gh)}`, '1']);
                if (mod.isDVH && gInner) glassData.push([itemCode, gInner.detail, `${Math.round(gw)}x${Math.round(gh)}`, '1']);
            }
        });
    });

    autoTable(doc, {
        startY: 35,
        head: [['ABERTURA', 'ESPECIFICACIÓN DE VIDRIO', 'MEDIDA CORTE (mm)', 'CANT.']],
        body: glassData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold', fontSize: 11 } }
    });

    doc.save(`Vidrios_${quote.clientName}.pdf`);
};

export const generateClientDetailedPDF = (quote: Quote, config: GlobalConfig, recipes: ProductRecipe[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    if (config.companyLogo) { try { doc.addImage(config.companyLogo, 'PNG', 15, 10, 25, 25); } catch(e){} }
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(config.companyName || 'PRESUPUESTO', 45, 20);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(`${config.companyAddress || ''} | Tel: ${config.companyPhone || ''}`, 45, 25);
    doc.setDrawColor(200); doc.line(15, 40, pageWidth - 15, 40);
    doc.setFontSize(10); doc.text(`CLIENTE: ${quote.clientName.toUpperCase()}`, 15, 48);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 15, 48, { align: 'right' });

    const tableData = quote.items.map((item, idx) => {
        const firstMod = item.composition?.modules?.[0];
        const recipe = recipes.find(r => r.id === firstMod?.recipeId);
        const glassInfo = firstMod?.isDVH ? 'DVH' : 'Simple';
        const desc = `POS#${idx+1}: ${recipe?.type || 'Abertura'}\nLínea: ${recipe?.line || '-'}\nModelo: ${recipe?.name || 'S/D'}\nVidrio: ${glassInfo}`;
        return [
            { content: idx + 1, styles: { valign: 'middle', halign: 'center' } },
            { content: '', styles: { minCellHeight: 35 } },
            { content: desc, styles: { valign: 'middle' } },
            { content: `${item.width} x ${item.height}`, styles: { valign: 'middle', halign: 'center' } },
            { content: item.quantity, styles: { valign: 'middle', halign: 'center' } },
            { content: `$${item.calculatedCost.toLocaleString()}`, styles: { valign: 'middle', halign: 'right' } },
            { content: `$${(item.calculatedCost * item.quantity).toLocaleString()}`, styles: { valign: 'middle', halign: 'right' } }
        ];
    });

    autoTable(doc, {
        startY: 55,
        head: [['#', 'ILUSTRACIÓN', 'DESCRIPCIÓN TÉCNICA', 'MEDIDAS', 'CANT.', 'UNIT.', 'SUBTOTAL']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        styles: { fontSize: 8 },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                const item = quote.items[data.row.index];
                if (item && item.previewImage) {
                    try { doc.addImage(item.previewImage, 'JPEG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4); } catch(e){}
                }
            }
        }
    });

    const lastTable = (doc as any).lastAutoTable;
    const finalY = lastTable ? lastTable.finalY + 10 : 200;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL FINAL: $${quote.totalPrice.toLocaleString()}`, pageWidth - 15, finalY, { align: 'right' });
    doc.save(`Presupuesto_${quote.clientName}.pdf`);
};

export const generateAssemblyOrderPDF = (quote: Quote, recipes: ProductRecipe[]) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('HOJA DE TALLER: ARMADO Y CARPINTERÍA', 15, 20);
    doc.setFontSize(9); doc.text(`CLIENTE: ${quote.clientName} | FECHA: ${new Date().toLocaleDateString()}`, 15, 26);

    let y = 35;
    quote.items.forEach((item, idx) => {
        if (y > 200) { doc.addPage(); y = 20; }
        doc.setFillColor(245); doc.rect(15, y, 180, 48, 'F');
        if (item.previewImage) try { doc.addImage(item.previewImage, 'JPEG', 20, y + 5, 38, 38); } catch(e){}
        
        doc.setFontSize(12); doc.setTextColor(79, 70, 229);
        doc.text(`POSICIÓN #${idx+1} - CANTIDAD: ${item.quantity}`, 62, y + 10);
        
        doc.setFontSize(9); doc.setTextColor(0);
        const recipe = recipes.find(r => r.id === item.composition.modules?.[0]?.recipeId);
        doc.text(`Sistema: ${recipe?.name || 'S/D'} | Medida Exterior: ${item.width} x ${item.height} mm`, 62, y + 18);
        
        const adjW = item.width - (recipe?.glassDeductionW || 0);
        const adjH = item.height - (recipe?.glassDeductionH || 0);
        const gw = evaluate(recipe?.glassFormulaW || 'W', adjW, adjH);
        const gh = evaluate(recipe?.glassFormulaH || 'H', adjW, adjH);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`MEDIDA DE CORTE VIDRIO: ${Math.round(gw)} x ${Math.round(gh)} mm`, 62, y + 26);
        doc.text(`TIPO: ${item.composition.modules?.[0]?.isDVH ? 'DVH' : 'SIMPLE'}`, 62, y + 32);
        doc.setFont('helvetica', 'normal');

        const cutData = recipe?.profiles.map(rp => [
            rp.profileId, 
            rp.quantity, 
            `${Math.round(evaluate(rp.formula, item.width, item.height))} mm`, 
            `${rp.cutStart}° / ${rp.cutEnd}°`
        ]) || [];

        autoTable(doc, {
            startY: y + 50,
            head: [['PERFIL', 'CANT', 'LARGO CORTE', 'ÁNGULOS']],
            body: cutData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50] },
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
        const firstMod = item.composition?.modules?.[0];
        const recipe = recipes.find(r => r.id === firstMod?.recipeId);
        recipe?.profiles.forEach(rp => {
            const p = aluminum.find(a => a.id === rp.profileId);
            if (!p) return;
            const len = evaluate(rp.formula, item.width, item.height) * rp.quantity * item.quantity;
            const existing = summary.get(p.id) || { code: p.code, total: 0, unit: 'm' };
            existing.total += (len / 1000);
            summary.set(p.id, existing);
        });
    });
    const body = Array.from(summary.values()).map(s => [s.code, s.total.toFixed(2), s.unit]);
    autoTable(doc, { startY: 35, head: [['CÓDIGO', 'CANTIDAD TOTAL', 'UNIDAD']], body, theme: 'grid' });
    doc.save(`Pedido_${quote.clientName}.pdf`);
};
