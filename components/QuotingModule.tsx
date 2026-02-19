
import { 
    ProductRecipe, AluminumProfile, Glass, BlindPanel,
    Accessory,
    DVHInput, Treatment, GlobalConfig, Quote, QuoteItem,
    MeasurementModule,
    RecipeAccessory,
    QuoteItemBreakdown
} from '../types';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Maximize, 
  CheckCircle, 
  X, 
  LayoutGrid, 
  Frame,
  Columns, 
  Rows,
  Split,
  Layers,
  Wind,
  Check,
  Search,
  Zap,
  Ruler,
  Bug,
  Lock,
  Grid3X3,
  Minus,
  DollarSign,
  Hash,
  Tag,
  GripHorizontal,
  TrendingUp,
  Receipt,
  Hammer,
  Package,
  ChevronDown,
  Link2,
  Box,
  ToggleLeft,
  ToggleRight,
  Unlock,
  Link as LinkIcon,
  Maximize2
} from 'lucide-react';
import { calculateCompositePrice, evaluateFormula } from '../services/calculator';

// CONSTANTES TÉCNICAS PARA RENDERIZADO
const TJ_LINE_COLOR = 'rgba(15, 23, 42, 0.6)';

interface Segment {
    x1: number; y1: number; x2: number; y2: number;
    side: 'top' | 'bottom' | 'left' | 'right';
}

const drawDetailedOpening = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    recipe: ProductRecipe,
    isDVH: boolean,
    color: string,
    extras?: QuoteItem['extras'],
    pxPerMm: number = 0.5,
    transoms: { height: number; profileId: string }[] = [],
    blindPanes: number[] = [],
    blindPaneIds: Record<number, string> = {},
    allBlindPanels: BlindPanel[] = [],
    allProfiles: AluminumProfile[] = [],
    isSinglePreview: boolean = false
) => {
    if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) return;

    const visualType = recipe.visualType || 'fixed';

    const applyPaintEffect = (px: number, py: number, pw: number, ph: number, isVertical: boolean) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(px, py, pw, ph);

        try {
            const grad = isVertical 
                ? ctx.createLinearGradient(px, py, px + pw, py)
                : ctx.createLinearGradient(px, py, px, py + ph);
            
            grad.addColorStop(0, 'rgba(0,0,0,0.15)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
            grad.addColorStop(1, 'rgba(0,0,0,0.15)');
            ctx.fillStyle = grad;
            ctx.fillRect(px, py, pw, ph);
        } catch(e) {}

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)'; 
        ctx.strokeRect(px, py, pw, ph);
        ctx.restore();
    };

    // NUEVAS TIPOLOGÍAS INDUSTRIALES CON EFECTO DE PINTURA
    if (visualType === 'tubo_h') {
        const tubeThickness = (recipe.transomThickness || 100) * pxPerMm;
        const tubeY = y + (h / 2) - (tubeThickness / 2);
        applyPaintEffect(x, tubeY, w, tubeThickness, false);
        return;
    }

    if (visualType === 'tubo_v') {
        const tubeThickness = (recipe.transomThickness || 100) * pxPerMm;
        const tubeX = x + (w / 2) - (tubeThickness / 2);
        applyPaintEffect(tubeX, y, tubeThickness, h, true);
        return;
    }

    if (visualType === 'mampara_vidrio_corrediza') {
        const rielH = 60 * pxPerMm;
        // Dibujar riel superior con efecto de pintura
        applyPaintEffect(x, y, w, rielH, false);
        
        // Dibujar vidrios solapados
        const overlap = 40 * pxPerMm;
        const leafW = (w / 2) + overlap;
        
        const drawLeafGlass = (lx: number, ly: number, lw: number, lh: number, alpha: number) => {
            ctx.save();
            ctx.globalAlpha = alpha;
            const glassGrad = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
            glassGrad.addColorStop(0, '#bae6fd');
            glassGrad.addColorStop(0.5, '#f0f9ff');
            glassGrad.addColorStop(1, '#bae6fd');
            ctx.fillStyle = glassGrad;
            ctx.fillRect(lx, ly, lw, lh);
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(lx, ly, lw, lh);
            ctx.restore();
        };

        drawLeafGlass(x, y + rielH, leafW, h - rielH, 1.0);
        drawLeafGlass(x + w - leafW, y + rielH, leafW, h - rielH, 0.8);
        return;
    }

    const isDoor = visualType.includes('door') || recipe.type === 'Puerta';
    const isNoDintel = visualType.includes('no_dintel');
    const isNoUmbral = visualType.includes('no_umbral');
    
    const isMamparaFija = visualType === 'mampara_fija';
    const isMamparaRebatir = visualType === 'mampara_rebatir';
    const isVidrioSolo = visualType === 'vidrio_solo';
    const isPuertaZocalon = visualType === 'puerta_zocalon';
    const isPFZocalon = visualType === 'pf_zocalon';

    const hasBottomFrame = !isDoor && !isMamparaRebatir && !isVidrioSolo && !isPFZocalon && !isPuertaZocalon && !isNoUmbral;
    const isFrame90 = (visualType.includes('_90') || visualType.includes('zocalo')) && !visualType.includes('45_90');
    const leafForce90 = visualType.includes('_90') || visualType.includes('zocalo');
    
    const frameT = 45 * pxPerMm;
    const leafT = (isDoor ? 75 : 45) * pxPerMm;
    const zocaloT = (isDoor || isPuertaZocalon || isPFZocalon || isNoDintel || isNoUmbral ? 120 : 65) * pxPerMm;

    const drawProfile = (points: {x:number, y:number}[]) => {
        if (!points || points.length < 3) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        try {
            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));
            const isVert = (maxX - minX) < (maxY - minY);
            
            const grad = isVert 
                ? ctx.createLinearGradient(minX, minY, maxX, minY)
                : ctx.createLinearGradient(minX, minY, minX, maxY);
            
            grad.addColorStop(0, 'rgba(0,0,0,0.15)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
            grad.addColorStop(1, 'rgba(0,0,0,0.15)');
            ctx.fillStyle = grad;
            ctx.fill();
        } catch(e) {}

        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)'; 
        ctx.stroke();
        ctx.restore();
    };

    const drawPane = (px: number, py: number, pw: number, ph: number, index: number) => {
        if (!isFinite(px) || !isFinite(py) || !isFinite(pw) || !isFinite(ph)) return;
        const isBlind = blindPanes.includes(index);
        const isMosquiteroSystem = visualType === 'mosquitero';
        
        if (isBlind) {
            const specificBlindId = blindPaneIds[index];
            const specificBlind = allBlindPanels.find(bp => bp.id === specificBlindId);
            const isML = specificBlind?.unit === 'ml';
            ctx.fillStyle = isML ? color : '#334155';
            ctx.fillRect(px, py, pw, ph);
            ctx.strokeStyle = isML ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255,255,255,0.05)';
            const step = 12 * pxPerMm;
            for (let i = 0; i < ph; i += step) { 
                ctx.beginPath(); ctx.moveTo(px, py + i); ctx.lineTo(px + pw, py + i); ctx.stroke(); 
            }
        } else if (isMosquiteroSystem) {
            ctx.fillStyle = '#94a3b8'; 
            ctx.fillRect(px, py, pw, ph);
            ctx.save();
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)'; 
            ctx.lineWidth = 0.4;
            const meshStep = 3.5 * pxPerMm;
            for (let i = 0; i <= ph; i += meshStep) {
                ctx.beginPath(); ctx.moveTo(px, py + i); ctx.lineTo(px + pw, py + i); ctx.stroke();
            }
            for (let j = 0; j <= pw; j += meshStep) {
                ctx.beginPath(); ctx.moveTo(px + j, py); ctx.lineTo(px + j, py + ph); ctx.stroke();
            }
            ctx.restore();
        } else {
            try {
                const glassGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
                glassGrad.addColorStop(0, '#bae6fd');
                glassGrad.addColorStop(0.5, '#f0f9ff');
                glassGrad.addColorStop(1, '#bae6fd');
                ctx.fillStyle = glassGrad;
                ctx.fillRect(px, py, pw, ph);
            } catch(e) {
                ctx.fillStyle = '#bae6fd';
                ctx.fillRect(px, py, pw, ph);
            }
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, pw, ph);

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.8;
            ctx.moveTo(px + pw * 0.2, py + 12*pxPerMm);
            ctx.lineTo(px + pw * 0.8, py + ph - 12*pxPerMm);
            ctx.stroke();
        }
    };

    const drawGlassWithTransoms = (gx: number, gy: number, gw: number, gh: number, absoluteBottomY: number) => {
        if (!isFinite(gx) || !isFinite(gy) || !isFinite(gw) || !isFinite(gh)) return;
        if (transoms.length > 0) {
            const sorted = [...transoms].sort((a, b) => b.height - a.height);
            let currentTopY = gy;
            const totalTransoms = transoms.length;

            sorted.forEach((t, i) => {
                const trProf = allProfiles.find(p => p.id === t.profileId);
                const tThickness = (Number(trProf?.thickness || 40)) * pxPerMm;
                const transomY = absoluteBottomY - (Number(t.height || 0) * pxPerMm);
                const paneH = (transomY - (tThickness/2)) - currentTopY;
                const paneIndex = totalTransoms - i;

                if (paneH > 0) drawPane(gx, currentTopY, gw, paneH, paneIndex);
                
                drawProfile([
                    {x: gx, y: transomY - (tThickness/2)}, 
                    {x: gx + gw, y: transomY - (tThickness/2)}, 
                    {x: gx + gw, y: transomY + (tThickness/2)}, 
                    {x: gx, y: transomY + (tThickness/2)}
                ]);
                currentTopY = transomY + (tThickness/2);
            });
            const lastPaneH = (gy + gh) - currentTopY;
            if (lastPaneH > 0) drawPane(gx, currentTopY, gw, lastPaneH, 0);
        } else {
            drawPane(gx, gy, gw, gh, 0);
        }
    };

    const drawLeaf = (lx:number, ly:number, lh:number, lw:number, force90:boolean, leafHasZocalo:boolean, hasMesh:boolean, leafType:string, absoluteBottomY: number) => {
        if (!isFinite(lx) || !isFinite(ly) || !isFinite(lw) || !isFinite(lh)) return;
        const bT = leafHasZocalo ? zocaloT : leafT;
        const isHybrid45_90 = leafType.includes('no_dintel') || leafType.includes('no_umbral');
        
        drawGlassWithTransoms(lx + leafT, ly + leafT, lw - leafT * 2, lh - (leafT + bT), absoluteBottomY);
        
        if (hasMesh) {
            ctx.save();
            const mx = lx + leafT; const my = ly + leafT;
            const mw = lw - leafT * 2; const mh = lh - (leafT + bT);
            ctx.fillStyle = 'rgba(71, 85, 105, 0.2)';
            ctx.fillRect(mx, my, mw, mh);
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)';
            ctx.lineWidth = 0.3;
            const step = 4 * pxPerMm;
            for(let i = 0; i <= mw; i += step) {
                ctx.beginPath(); ctx.moveTo(mx + i, my); ctx.lineTo(mx + i, my + mh); ctx.stroke();
            }
            for(let j = 0; j <= mh; j += step) {
                ctx.beginPath(); ctx.moveTo(mx, my + j); ctx.lineTo(mx + mw, my + j); ctx.stroke();
            }
            ctx.restore();
        }

        if (isHybrid45_90) {
            drawProfile([{x:lx, y:ly}, {x:lx+leafT, y:ly+leafT}, {x:lx+leafT, y:ly+lh}, {x:lx, y:ly+lh}]);
            drawProfile([{x:lx+lw-leafT, y:ly+leafT}, {x:lx+lw, y:ly}, {x:lx+lw, y:ly+lh}, {x:lx+lw-leafT, y:ly+lh}]);
            drawProfile([{x:lx, y:ly}, {x:lx+lw, y:ly}, {x:lx+lw-leafT, y:ly+leafT}, {x:lx+leafT, y:ly+leafT}]);
            drawProfile([{x:lx+leafT, y:ly+lh-bT}, {x:lx+lw-leafT, y:ly+lh-bT}, {x:lx+lw-leafT, y:ly+lh}, {x:lx+leafT, y:ly+lh}]);
        } else if (force90) {
            drawProfile([{x:lx, y:ly}, {x:lx+leafT, y:ly}, {x:lx+leafT, y:ly+lh}, {x:lx, y:ly+lh}]);
            drawProfile([{x:lx+lw-leafT, y:ly}, {x:lx+lw, y:ly}, {x:lx+lw, y:ly+lh}, {x:lx+lw-leafT, y:ly+lh}]);
            drawProfile([{x:lx+leafT, y:ly}, {x:lx+lw-leafT, y:ly}, {x:lx+lw-leafT, y:ly+leafT}, {x:lx+leafT, y:ly+leafT}]);
            drawProfile([{x:lx+leafT, y:ly+lh-bT}, {x:lx+lw-leafT, y:ly+lh-bT}, {x:lx+lw-leafT, y:ly+lh}, {x:lx+leafT, y:ly+lh}]);
        } else {
            drawProfile([{x:lx, y:ly}, {x:lx+lw, y:ly}, {x:lx+lw-leafT, y:ly+leafT}, {x:lx+leafT, y:ly+leafT}]);
            drawProfile([{x:lx, y:ly+lh}, {x:lx+lw, y:ly+lh}, {x:lx+lw-leafT, y:ly+lh-bT}, {x:lx+leafT, y:ly+lh-bT}]);
            drawProfile([{x:lx, y:ly}, {x:lx+leafT, y:ly+leafT}, {x:lx+leafT, y:ly+lh-bT}, {x:lx, y:ly+lh}]);
            drawProfile([{x:lx+lw, y:ly}, {x:lx+lw-leafT, y:ly+leafT}, {x:lx+lw-leafT, y:ly+lh-bT}, {x:lx+lw, y:ly+lh}]);
        }
    };

    if (isVidrioSolo) {
        drawGlassWithTransoms(x, y, w, h, y + h);
    } else if (isMamparaRebatir) {
        drawProfile([{x: x, y: y}, {x: x + frameT, y: y}, {x: x + frameT, y: y + h}, {x: x, y: y + h}]);
        drawGlassWithTransoms(x + frameT, y, w - frameT, h, y + h);
    } else if (isMamparaFija) {
        drawProfile([{x: x, y: y}, {x: x + frameT, y: y}, {x: x + frameT, y: y + h - frameT}, {x: x, y: y + h - frameT}]); 
        drawProfile([{x: x + frameT, y: y + h - frameT}, {x: x + w, y: y + h - frameT}, {x: x + w, y: y + h}, {x: x, y: y + h}]); 
        drawGlassWithTransoms(x + frameT, y, w - frameT, h - frameT, y + h);
    } else if (isPFZocalon) {
        drawProfile([{x: x, y: y}, {x: x + w, y: y}, {x: x + w, y: y + zocaloT}, {x: x, y: y + zocaloT}]); 
        drawProfile([{x: x, y: y + h - zocaloT}, {x: x + w, y: y + h - zocaloT}, {x: x + w, y: y + h}, {x: x, y: y + h}]); 
        drawGlassWithTransoms(x, y + zocaloT, w, h - 2*zocaloT, y + h);
    } else if (isPuertaZocalon) {
        drawProfile([{x: x, y: y}, {x: x + frameT, y: y}, {x: x + frameT, y: y + h}, {x: x, y: y + h}]); 
        drawProfile([{x: x + frameT, y: y}, {x: x + w, y: y}, {x: x + w, y: y + zocaloT}, {x: x + frameT, y: y + zocaloT}]); 
        drawProfile([{x: x + frameT, y: y + h - zocaloT}, {x: x + w, y: y + h - zocaloT}, {x: x + w, y: y + h}, {x: x + frameT, y: y + h}]); 
        drawGlassWithTransoms(x + frameT, y + zocaloT, w - frameT, h - 2*zocaloT, y + h);
    } else {
        if (isFrame90) {
            drawProfile([{x:x, y:y}, {x:x+frameT, y:y}, {x:x+frameT, y:y+h}, {x:x, y:y+h}]);
            drawProfile([{x:x+w-frameT, y:y}, {x:x+w, y:y}, {x:x+w, y:y+h}, {x:x+w-frameT, y:y+h}]);
            drawProfile([{x:x+frameT, y:y}, {x:x+w-frameT, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+frameT, y:y+frameT}]);
            if (hasBottomFrame) {
                drawProfile([{x:x+frameT, y:y+h-frameT}, {x:x+w-frameT, y:y+h-frameT}, {x:x+w-frameT, y:y+h}, {x:x+frameT, y:y+h}]);
            }
        } else if (isNoDintel) {
            drawProfile([{x:x, y:y}, {x:x+frameT, y:y+frameT}, {x:x+frameT, y:y+h}, {x:x, y:y+h}]); 
            drawProfile([{x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+w-frameT, y:y+h}, {x:x+w, y:y+h}]);
        } else if (isNoUmbral) {
            drawProfile([{x:x, y:y}, {x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+frameT, y:y+frameT}]); 
            drawProfile([{x:x, y:y}, {x:x+frameT, y:y+frameT}, {x:x+frameT, y:y+h}, {x:x, y:y+h}]); 
            drawProfile([{x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+w-frameT, y:y+h}, {x:x+w, y:y+h}]); 
        } else {
            drawProfile([{x:x, y:y}, {x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+frameT, y:y+frameT}]); 
            if (hasBottomFrame) drawProfile([{x:x, y:y+h}, {x:x+w, y:y+h}, {x:x+w-frameT, y:y+h-frameT}, {x:x+frameT, y:y+h-frameT}]); 
            drawProfile([{x:x, y:y}, {x:x+frameT, y:y+frameT}, {x:x+frameT, y:y+h-(hasBottomFrame?frameT:0)}, {x:x, y:y+h}]); 
            drawProfile([{x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+w-frameT, y:y+h-(hasBottomFrame?frameT:0)}, {x:x+w, y:y+h}]); 
        }

        const innerX = x + frameT; 
        const innerY = y + (isNoDintel ? 0 : frameT);
        const innerW = w - frameT * 2; 
        const innerH = h - (isNoDintel ? 0 : (hasBottomFrame ? frameT * 2 : frameT));

        if (visualType.includes('sliding')) {
            const numLeaves = visualType.includes('sliding_3') ? 3 : (visualType.includes('sliding_4') ? 4 : 2);
            const overlap = 40 * pxPerMm;
            if (numLeaves === 3) {
                const leafW = (innerW / 3) + overlap;
                for(let i=0; i<3; i++) {
                    const lx = innerX + (i * (innerW - leafW) / 2);
                    drawLeaf(lx, innerY, innerH, leafW, leafForce90, leafForce90, i === 0 && (extras?.mosquitero || false), 'sliding', y + h);
                }
            } else if (numLeaves === 4) {
                const leafW = (innerW / 4) + overlap;
                for(let i=0; i<4; i++) {
                    const lx = innerX + (i * (innerW - leafW) / 3);
                    drawLeaf(lx, innerY, innerH, leafW, leafForce90, leafForce90, i === 0 && (extras?.mosquitero || false), 'sliding', y + h);
                }
            } else {
                const leafW = (innerW / 2) + overlap;
                drawLeaf(innerX, innerY, innerH, leafW, leafForce90, leafForce90, extras?.mosquitero || false, 'sliding', y + h);
                drawLeaf(innerX + innerW - leafW, innerY, innerH, leafW, leafForce90, leafForce90, false, 'sliding', y + h);
            }
        } else if (visualType.includes('swing') || visualType.includes('door') || visualType.includes('right') || visualType.includes('left') || visualType.includes('projecting') || visualType.includes('ventiluz') || visualType.includes('banderola') || visualType.includes('oscilo')) {
            if (visualType.includes('double')) {
                const leafW = innerW / 2;
                drawLeaf(innerX, innerY, innerH, leafW, false, isFrame90 || isNoDintel || isNoUmbral, extras?.mosquitero || false, visualType, y + h);
                drawLeaf(innerX + leafW, innerY, innerH, leafW, false, isFrame90 || isNoDintel || isNoUmbral, false, visualType, y + h);
            } else {
                drawLeaf(innerX, innerY, innerH, innerW, false, isFrame90 || isNoDintel || isNoUmbral, extras?.mosquitero || false, visualType, y + h);
            }
        } else {
            drawGlassWithTransoms(innerX, innerY, innerW, innerH, y + h);
        }
    }
};

const renderAdaptiveTJ = (
    ctx: CanvasRenderingContext2D,
    segments: Segment[],
    tjSize: number,
    color: string
) => {
    if (segments.length === 0) return;

    const mergeSegments = (list: Segment[]) => {
        const result: Segment[] = [];
        const sorted = [...list];
        
        ['top', 'bottom', 'left', 'right'].forEach(side => {
            const sideSegments = sorted.filter(s => s.side === side);
            if (sideSegments.length === 0) return;

            if (side === 'top' || side === 'bottom') {
                sideSegments.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
                let current = sideSegments[0];
                for(let i=1; i < sideSegments.length; i++) {
                    const next = sideSegments[i];
                    if (Math.abs(next.y1 - current.y1) < 2 && Math.abs(next.x1 - current.x2) < 2) {
                        current.x2 = Math.max(current.x2, next.x2);
                    } else {
                        result.push(current);
                        current = next;
                    }
                }
                result.push(current);
            } else {
                sideSegments.sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
                let current = sideSegments[0];
                for(let i=1; i < sideSegments.length; i++) {
                    const next = sideSegments[i];
                    if (Math.abs(next.x1 - current.x1) < 2 && Math.abs(next.y1 - current.y2) < 2) {
                        current.y2 = Math.max(current.y2, next.y2);
                    } else {
                        result.push(current);
                        current = next;
                    }
                }
                result.push(current);
            }
        });
        return result;
    };

    const finalSegments = mergeSegments(segments);

    finalSegments.forEach(seg => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        
        const hasStartCorner = finalSegments.some(other => 
            other !== seg && 
            ((Math.abs(other.x1 - seg.x1) < 5 && Math.abs(other.y1 - seg.y1) < 5) || 
             (Math.abs(other.x2 - seg.x1) < 5 && Math.abs(other.y2 - seg.y1) < 5))
        );
        const hasEndCorner = finalSegments.some(other => 
            other !== seg && 
            ((Math.abs(other.x1 - seg.x2) < 5 && Math.abs(other.y1 - seg.y2) < 5) || 
             (Math.abs(other.x2 - seg.x2) < 5 && Math.abs(other.y2 - seg.y2) < 5))
        );

        let p1, p2, p3, p4;

        if (seg.side === 'top') {
            p1 = { x: seg.x1 - (hasStartCorner ? tjSize : 0), y: seg.y1 - tjSize };
            p2 = { x: seg.x2 + (hasEndCorner ? tjSize : 0), y: seg.y2 - tjSize };
            p3 = { x: seg.x2, y: seg.y2 };
            p4 = { x: seg.x1, y: seg.y1 };
        } else if (seg.side === 'bottom') {
            p1 = { x: seg.x1, y: seg.y1 };
            p2 = { x: seg.x2, y: seg.y2 };
            p3 = { x: seg.x2 + (hasEndCorner ? tjSize : 0), y: seg.y2 + tjSize };
            p4 = { x: seg.x1 - (hasStartCorner ? tjSize : 0), y: seg.y1 + tjSize };
        } else if (seg.side === 'left') {
            p1 = { x: seg.x1 - tjSize, y: seg.y1 - (hasStartCorner ? tjSize : 0) };
            p2 = { x: seg.x1, y: seg.y1 };
            p3 = { x: seg.x2, y: seg.y2 };
            p4 = { x: seg.x2 - tjSize, y: seg.y2 + (hasEndCorner ? tjSize : 0) };
        } else { // right
            p1 = { x: seg.x1, y: seg.y1 };
            p2 = { x: seg.x1 + tjSize, y: seg.y1 - (hasStartCorner ? tjSize : 0) };
            p3 = { x: seg.x2 + tjSize, y: seg.y2 + (hasEndCorner ? tjSize : 0) };
            p4 = { x: seg.x2, y: seg.y2 };
        }

        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();

        try {
            const grad = (seg.side === 'left' || seg.side === 'right')
                ? ctx.createLinearGradient(Math.min(p1.x, p2.x, p3.x, p4.x), 0, Math.max(p1.x, p2.x, p3.x, p4.x), 0)
                : ctx.createLinearGradient(0, Math.min(p1.y, p2.y, p3.y, p4.y), 0, Math.max(p1.y, p2.y, p3.y, p4.y));
            grad.addColorStop(0, 'rgba(0,0,0,0.15)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
            grad.addColorStop(1, 'rgba(0,0,0,0.15)');
            ctx.fillStyle = grad;
            ctx.fill();
        } catch(e){}

        ctx.strokeStyle = TJ_LINE_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    });
};

interface Props {
  recipes: ProductRecipe[];
  aluminum: AluminumProfile[];
  glasses: Glass[];
  blindPanels: BlindPanel[];
  accessories: Accessory[];
  dvhInputs: DVHInput[];
  treatments: Treatment[];
  config: GlobalConfig;
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  onUpdateActiveItem?: (item: QuoteItem | null) => void;
  currentWorkItems: QuoteItem[];
  setCurrentWorkItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
}

const QuotingModule: React.FC<Props> = ({ 
    recipes, aluminum, glasses, blindPanels, accessories, 
    dvhInputs, treatments, config, quotes, setQuotes, onUpdateActiveItem,
    currentWorkItems, setCurrentWorkItems
}) => {
  const [totalWidth, setTotalWidth] = useState(1500);
  const [totalHeight, setTotalHeight] = useState(1100);
  const [itemCode, setItemCode] = useState(''); 
  const [couplingProfileId, setCouplingProfileId] = useState('');
  const [couplingDeduction, setCouplingDeduction] = useState(10);
  const [colorId, setSelectedColorId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [extras, setExtras] = useState<QuoteItem['extras']>({ mosquitero: false, tapajuntas: false, tapajuntasSides: { top: true, bottom: true, left: true, right: true } });
  
  const [modules, setModules] = useState<MeasurementModule[]>([{ 
    id: 'm1', recipeId: recipes[0]?.id || '', x: 0, y: 0, isDVH: false, glassOuterId: glasses[0]?.id || '', transoms: [], blindPanes: [] 
  }]);
  const [colSizes, setColSizes] = useState<number[]>([1500]);
  const [rowSizes, setRowSizes] = useState<number[]>([1100]);
  
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [showCouplingModal, setShowCouplingModal] = useState(false);
  const [recipeFilter, setRecipeFilter] = useState<string>('TODOS');
  const [isManualDim, setIsManualDim] = useState(false);

  const [showSlatSelector, setShowSlatSelector] = useState(false);
  const [slatPaneIdx, setSlatPaneIdx] = useState<number | null>(null);
  const [slatSearch, setSlatSearch] = useState('');
  const [glazingBeadStyle, setGlazingBeadStyle] = useState<'Recto' | 'Curvo'>('Recto');

  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const [breakdownModalPos, setBreakdownModalPos] = useState({ x: 0, y: 0 });
  const [isDraggingBreakdown, setIsDraggingBreakdown] = useState(false);
  const breakdownDragOffset = useRef({ x: 0, y: 0 });

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);

  const ensureOneActivePerLabel = (accs: RecipeAccessory[]) => {
    if (!accs) return [];
    const result = accs.map(a => ({ ...a }));
    const processedLabels = new Set<string>();
    
    result.forEach((acc, idx) => {
      if (acc.label && !processedLabels.has(acc.label)) {
        const groupIndices = result.map((a, i) => a.label === acc.label ? i : -1).filter(i => i !== -1);
        const hasActive = groupIndices.some(i => !result[i].isAlternative);
        if (!hasActive && groupIndices.length > 0) {
          result[groupIndices[0]].isAlternative = false;
        }
        processedLabels.add(acc.label);
      }
    });
    return result;
  };
  
  const bounds = useMemo(() => {
    const validMods = (modules || []).filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
    if (validMods.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, cols: 0, rows: 0 };
    const xs = validMods.map(m => m.x); 
    const ys = validMods.map(m => m.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
  }, [modules]);

  const couplingProfiles = useMemo(() => {
    return aluminum.filter(p => {
        const code = (p.code || '').toUpperCase();
        const detail = (p.detail || '').toUpperCase();
        return code.includes('ACOP') || detail.includes('ACOP') || detail.includes('INTERM');
    });
  }, [aluminum]);

  const uniqueLines = useMemo(() => {
    const lines = recipes.map(r => (r.line || '').toUpperCase());
    return ['TODOS', ...Array.from(new Set(lines))];
  }, [recipes]);

  const liveBreakdown = useMemo(() => {
    const treatment = treatments.find(t => t.id === colorId);
    if (!treatment) return null;
    try {
        const tempItem: QuoteItem = {
          id: 'temp', itemCode: itemCode || 'POS#', width: totalWidth, height: totalHeight, colorId, quantity,
          composition: { 
              modules: JSON.parse(JSON.stringify((modules || []).filter(Boolean))), 
              colRatios: [...colSizes], 
              rowRatios: [...rowSizes], 
              couplingDeduction: Number(couplingDeduction || 0),
              isManualDim: isManualDim
          },
          couplingProfileId, extras: { ...extras }, calculatedCost: 0
        };
        const { breakdown } = calculateCompositePrice(tempItem, recipes, aluminum, config, treatment, glasses, accessories, dvhInputs, blindPanels, glazingBeadStyle);
        return breakdown;
    } catch(e) {
        return null;
    }
  }, [totalWidth, totalHeight, itemCode, modules, colSizes, rowSizes, couplingDeduction, extras, colorId, couplingProfileId, recipes, aluminum, config, treatments, glasses, accessories, dvhInputs, blindPanels, quantity, isManualDim, glazingBeadStyle]);

  const updateModule = (id: string, data: Partial<MeasurementModule>) => {
    setModules(prev => (prev || []).map(m => (m && m.id === id ? { ...m, ...data } : m)));
  };

  const addColumn = () => {
    const nextX = bounds.maxX + 1;
    const newModules: MeasurementModule[] = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        newModules.push({ id: `m-${nextX}-${y}-${Date.now()}`, recipeId: recipes[0]?.id || '', x: nextX, y, isDVH: false, glassOuterId: glasses[0]?.id || '', transoms: [], blindPanes: [] });
    }
    const newColSizes = [...colSizes, 1000];
    setModules([...(modules || []), ...newModules]);
    setColSizes(newColSizes);
    setTotalWidth(newColSizes.reduce((a, b) => a + b, 0));
    setShowCouplingModal(true);
  };

  const removeColumn = () => {
    if (colSizes.length <= 1) return;
    const lastX = bounds.maxX;
    const newColSizes = colSizes.slice(0, -1);
    setModules((modules || []).filter(m => m && m.x !== lastX));
    setColSizes(newColSizes);
    setTotalWidth(newColSizes.reduce((a, b) => a + b, 0));
    if (newColSizes.length <= 1 && rowSizes.length <= 1) {
        setCouplingProfileId('');
        setCouplingDeduction(0);
    }
  };

  const addRow = () => {
    const nextY = bounds.maxY + 1;
    const newModules: MeasurementModule[] = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        newModules.push({ id: `m-${x}-${nextY}-${Date.now()}`, recipeId: recipes[0]?.id || '', x, y: nextY, isDVH: false, glassOuterId: glasses[0]?.id || '', transoms: [], blindPanes: [] });
    }
    const newRowSizes = [...rowSizes, 1000];
    setModules([...(modules || []), ...newModules]);
    setRowSizes(newRowSizes);
    setTotalHeight(newRowSizes.reduce((a, b) => a + b, 0));
    setShowCouplingModal(true);
  };

  const removeRow = () => {
    if (rowSizes.length <= 1) return;
    const lastY = bounds.maxY;
    const newRowSizes = rowSizes.slice(0, -1);
    setModules((modules || []).filter(m => m && m.y !== lastY));
    setRowSizes(newRowSizes);
    setTotalHeight(newRowSizes.reduce((a, b) => a + b, 0));
    if (colSizes.length <= 1 && newRowSizes.length <= 1) {
        setCouplingProfileId('');
        setCouplingDeduction(0);
    }
  };

  const handleBodySizeChange = (dim: 'width' | 'height', index: number, newValue: number) => {
    const sizes = dim === 'width' ? [...colSizes] : [...rowSizes];
    const total = dim === 'width' ? totalWidth : totalHeight;
    const oldValue = sizes[index];
    
    if (isManualDim) {
      sizes[index] = newValue;
      const newTotal = sizes.reduce((a, b) => a + b, 0);
      if (dim === 'width') {
        setColSizes(sizes);
        setTotalWidth(newTotal);
      } else {
        setRowSizes(sizes);
        setTotalHeight(newTotal);
      }
    } else {
      const diff = newValue - oldValue;
      sizes[index] = newValue;
      const otherIndices = sizes.map((_, i) => i).filter(i => i !== index);
      if (otherIndices.length > 0) {
          const othersSum = otherIndices.reduce((acc, i) => acc + sizes[i], 0);
          if (othersSum > 0) {
              otherIndices.forEach(i => {
                  const proportion = sizes[i] / othersSum;
                  sizes[i] = Math.max(100, sizes[i] - (diff * proportion));
              });
          } else {
              const sharedDiff = diff / otherIndices.length;
              otherIndices.forEach(i => {
                  sizes[i] = Math.max(100, sizes[i] - sharedDiff);
              });
          }
      }
      const currentSum = sizes.reduce((a, b) => a + b, 0);
      const scale = total / currentSum;
      const finalSizes = sizes.map(s => Math.round(s * scale));
      if (dim === 'width') setColSizes(finalSizes);
      else setRowSizes(finalSizes);
    }
  };

  const handleTotalChange = (dim: 'width' | 'height', newValue: number) => {
    if (dim === 'width') {
      const currentSum = colSizes.reduce((a, b) => a + b, 0);
      if (currentSum > 0) {
        const ratio = newValue / currentSum;
        setColSizes(colSizes.map(s => Math.round(s * ratio)));
      }
      setTotalWidth(newValue);
    } else {
      const currentSum = rowSizes.reduce((a, b) => a + b, 0);
      if (currentSum > 0) {
        const ratio = newValue / currentSum;
        setRowSizes(rowSizes.map(s => Math.round(s * ratio)));
      }
      setTotalHeight(newValue);
    }
  };

  const addItemToWork = () => {
    const treatment = treatments.find(t => t.id === colorId);
    if (!treatment) return alert("Seleccione un acabado para cotizar.");
    const canvas = mainCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(currentData, 0, 0);
    }
    const previewImage = canvas ? canvas.toDataURL('image/jpeg', 0.8) : undefined;
    const { finalPrice, breakdown } = calculateCompositePrice({
      id: 'temp', itemCode: itemCode || 'S/C', width: totalWidth, height: totalHeight, colorId, quantity,
      composition: { 
          modules: (modules || []).filter(Boolean), 
          colRatios: [...colSizes], 
          rowRatios: [...rowSizes], 
          couplingDeduction: Number(couplingDeduction || 0),
          isManualDim: isManualDim
      },
      couplingProfileId, extras: { ...extras }, calculatedCost: 0
    }, recipes, aluminum, config, treatment, glasses, accessories, dvhInputs, blindPanels, glazingBeadStyle);
    const tempItem: QuoteItem = {
      id: Date.now().toString(), itemCode: itemCode || `POS#${currentWorkItems.length + 1}`, width: totalWidth, height: totalHeight, colorId, quantity,
      composition: { 
          modules: JSON.parse(JSON.stringify((modules || []).filter(Boolean))), 
          colRatios: [...colSizes], 
          rowRatios: [...rowSizes], 
          couplingDeduction: Number(couplingDeduction || 0),
          isManualDim: isManualDim
      },
      couplingProfileId, extras: { ...extras }, calculatedCost: Math.round(finalPrice), previewImage, breakdown
    };
    setCurrentWorkItems([...currentWorkItems, tempItem]);
    if (onUpdateActiveItem) onUpdateActiveItem(tempItem);
    setItemCode(''); 
  };

  useEffect(() => {
    const canvas = mainCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const padding = 140;
    const pxPerMm = Math.min((canvas.width - padding * 2) / (totalWidth || 1), (canvas.height - padding * 2) / (totalHeight || 1));
    const startX = (canvas.width - totalWidth * pxPerMm) / 2;
    const startY = (canvas.height - totalHeight * pxPerMm) / 2;
    const aluColor = treatments.find(t => t.id === colorId)?.hexColor || '#334155';
    const validModules = (modules || []).filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');
    const cProfile = couplingProfileId ? aluminum.find(p => p.id === couplingProfileId) : null;
    const currentDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
    
    const firstRecipe = recipes.find(r => r.id === validModules[0]?.recipeId);
    const tjProfile = aluminum.find(p => p.id === firstRecipe?.defaultTapajuntasProfileId);
    const tjSizePx = (Number(tjProfile?.thickness || 40)) * pxPerMm;

    // 1. Recolección de segmentos de contorno real
    const perimeterSegments: Segment[] = [];
    
    validModules.forEach(mod => {
        const recipe = recipes.find(r => r.id === mod.recipeId);
        if (!recipe) return;
        const modIdxX = mod.x - bounds.minX;
        const modIdxY = mod.y - bounds.minY;
        
        let modW = (isManualDim && mod.width && mod.width > 0) ? mod.width : Number(colSizes[modIdxX] || 0); 
        let modH = (isManualDim && mod.height && mod.height > 0) ? mod.height : Number(rowSizes[modIdxY] || 0);
        
        if (colSizes.length > 1) {
            if (mod.x > bounds.minX) modW -= (currentDeduction / 2);
            if (mod.x < bounds.maxX) modW -= (currentDeduction / 2);
        }
        if (rowSizes.length > 1) {
            if (mod.y > bounds.minY) modH -= (currentDeduction / 2);
            if (mod.y < bounds.maxY) modH -= (currentDeduction / 2);
        }

        let ox_mm = 0; for (let i = 0; i < modIdxX; i++) ox_mm += Number(colSizes[i] || 0);
        let oy_mm = 0; for (let j = 0; j < modIdxY; j++) oy_mm += Number(rowSizes[j] || 0);
        const xOffset = (mod.x > bounds.minX) ? (currentDeduction / 2) : 0;
        const yOffset = (mod.y > bounds.minY) ? (currentDeduction / 2) : 0;
        
        const mX = startX + (ox_mm + xOffset) * pxPerMm;
        const mY = startY + (oy_mm + yOffset) * pxPerMm;
        const mW = modW * pxPerMm;
        const mH = modH * pxPerMm;

        const hasNeighbor = (dx: number, dy: number) => validModules.some(other => {
            if (other === mod) return false;
            const otherIdxX = other.x - bounds.minX;
            const otherIdxY = other.y - bounds.minY;
            const otherXOffset = (other.x > bounds.minX) ? (currentDeduction / 2) : 0;
            const otherYOffset = (other.y > bounds.minY) ? (currentDeduction / 2) : 0;
            let otherOx = 0; for (let i = 0; i < otherIdxX; i++) otherOx += Number(colSizes[i] || 0);
            let otherOy = 0; for (let j = 0; j < otherIdxY; j++) otherOy += Number(rowSizes[j] || 0);
            
            const oX = startX + (otherOx + otherXOffset) * pxPerMm;
            const oY = startY + (otherOy + otherXOffset) * pxPerMm; 
            const oW = ((isManualDim && other.width) ? other.width : colSizes[otherIdxX]) * pxPerMm;
            const oH = ((isManualDim && other.height) ? other.height : rowSizes[otherIdxY]) * pxPerMm;

            const tol = 5;
            if (dx === 0 && dy === -1) return Math.abs(oY + oH - mY) < tol && oX < mX + mW - tol && oX + oW > mX + tol; 
            if (dx === 0 && dy === 1) return Math.abs(oY - (mY + mH)) < tol && oX < mX + mW - tol && oX + oW > mX + tol; 
            if (dx === -1 && dy === 0) return Math.abs(oX + oW - mX) < tol && oY < mY + mH - tol && oY + oH > mY + tol; 
            if (dx === 1 && dy === 0) return Math.abs(oX - (mX + mW)) < tol && oY < mY + mH - tol && oY + oH > mY + tol; 
            return false;
        });

        if (!hasNeighbor(0, -1) && extras.tapajuntasSides.top) perimeterSegments.push({ x1: mX, y1: mY, x2: mX + mW, y2: mY, side: 'top' });
        if (!hasNeighbor(0, 1) && extras.tapajuntasSides.bottom) perimeterSegments.push({ x1: mX, y1: mY + mH, x2: mX + mW, y2: mY + mH, side: 'bottom' });
        if (!hasNeighbor(-1, 0) && extras.tapajuntasSides.left) perimeterSegments.push({ x1: mX, y1: mY, x2: mX, y2: mY + mH, side: 'left' });
        if (!hasNeighbor(1, 0) && extras.tapajuntasSides.right) perimeterSegments.push({ x1: mX + mW, y1: mY, x2: mX + mW, y2: mY + mH, side: 'right' });

        drawDetailedOpening(ctx, mX, mY, mW, mH, recipe, mod.isDVH, aluColor, extras, pxPerMm, mod.transoms, mod.blindPanes, mod.blindPaneIds || {}, blindPanels, aluminum, false);
    });

    if (extras.tapajuntas) {
        renderAdaptiveTJ(ctx, perimeterSegments, tjSizePx, aluColor);
    }

  }, [totalWidth, totalHeight, modules, colSizes, rowSizes, bounds, extras, colorId, treatments, recipes, couplingDeduction, couplingProfileId, blindPanels, aluminum, isManualDim]);

  const currentModForEdit = (modules || []).find(m => m && m.id === editingModuleId);

  const toggleTJSide = (side: keyof QuoteItem['extras']['tapajuntasSides']) => {
    setExtras({
        ...extras,
        tapajuntasSides: { ...extras.tapajuntasSides, [side]: !extras.tapajuntasSides[side] }
    });
  };

  const centerTransomsForModule = (modId: string) => {
    setModules(prev => prev.map(m => {
        if (m.id !== modId || !m.transoms || m.transoms.length === 0) return m;
        const modIdxY = m.y - bounds.minY;
        const modH = (isManualDim && m.height) ? m.height : Number(rowSizes[modIdxY] || 0);
        const parts = m.transoms.length + 1;
        const step = modH / parts;
        const newTransoms = m.transoms.map((t, idx) => ({
            ...t,
            height: Math.round(step * (idx + 1))
        }));
        return { ...m, transoms: newTransoms };
    }));
  };

  const addTransomToModule = () => {
    if (!currentModForEdit) return;
    const modIdxY = currentModForEdit.y - bounds.minY; 
    const modH = (isManualDim && currentModForEdit.height) ? currentModForEdit.height : Number(rowSizes[modIdxY] || 0);
    const transomRecipe = recipes.find(r => r.id === currentModForEdit.recipeId);
    const updatedTransoms = [...(currentModForEdit.transoms || []), { height: 0, profileId: transomRecipe?.defaultTransomProfileId || aluminum[0]?.id || '' }];
    const parts = updatedTransoms.length + 1;
    const step = modH / parts;
    const redistributed = updatedTransoms.map((t, idx) => ({
        ...t,
        height: Math.round(step * (idx + 1))
    }));
    updateModule(editingModuleId!, { transoms: redistributed });
  };

  const removeTransomFromModule = (idx: number) => {
    if (!currentModForEdit) return;
    const filtered = currentModForEdit.transoms?.filter((_, i) => i !== idx) || [];
    const modIdxY = currentModForEdit.y - bounds.minY;
    const modH = (isManualDim && currentModForEdit.height) ? currentModForEdit.height : Number(rowSizes[modIdxY] || 0);
    const parts = filtered.length + 1;
    const step = modH / parts;
    const redistributed = filtered.map((t, tidx) => ({
        ...t,
        height: Math.round(step * (tidx + 1))
    }));
    updateModule(editingModuleId, { transoms: redistributed });
  };

  const handleAccessorySubstitute = (index: number, newAccessoryId: string) => {
    if (!currentModForEdit) return;
    const modRecipe = recipes.find(r => r.id === currentModForEdit.recipeId);
    if (!modRecipe) return;
    const activeAccs = (currentModForEdit.overriddenAccessories && currentModForEdit.overriddenAccessories.length > 0) 
        ? [...currentModForEdit.overriddenAccessories] 
        : [...modRecipe.accessories];
    activeAccs[index] = { ...activeAccs[index], accessoryId: newAccessoryId };
    updateModule(currentModForEdit.id, { overriddenAccessories: activeAccs });
  };

  const toggleAccessoryActive = (index: number) => {
    if (!currentModForEdit) return;
    const modRecipe = recipes.find(r => r.id === currentModForEdit.recipeId);
    if (!modRecipe) return;
    const activeAccs = (currentModForEdit.overriddenAccessories && currentModForEdit.overriddenAccessories.length > 0) 
        ? [...currentModForEdit.overriddenAccessories] 
        : [...modRecipe.accessories];
    
    const target = activeAccs[index];
    const willBeActive = target.isAlternative; 

    if (willBeActive && target.label) {
      activeAccs.forEach((acc, i) => {
        if (acc.label === target.label && i !== index) {
          activeAccs[i] = { ...acc, isAlternative: true };
        }
      });
    }

    activeAccs[index] = { 
      ...target, 
      isAlternative: !target.isAlternative 
    };
    updateModule(currentModForEdit.id, { overriddenAccessories: activeAccs });
  };

  const startDragging = useCallback((e: React.MouseEvent, type: 'inge' | 'breakdown') => {
    if (type === 'inge') {
        setIsDragging(true);
        dragOffset.current = { x: e.clientX - modalPos.x, y: e.clientY - modalPos.y };
    } else {
        setIsDraggingBreakdown(true);
        breakdownDragOffset.current = { x: e.clientX - breakdownModalPos.x, y: e.clientY - breakdownModalPos.y };
    }
  }, [modalPos, breakdownModalPos]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setModalPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
        }
        if (isDraggingBreakdown) {
            setBreakdownModalPos({ x: e.clientX - breakdownDragOffset.current.x, y: e.clientY - breakdownModalPos.y });
        }
    };
    const handleMouseUp = () => { setIsDragging(false); setIsDraggingBreakdown(false); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isDraggingBreakdown]);

  const hasDynamicBeads = useMemo(() => {
      const rId = modules[0]?.recipeId;
      if (!rId) return false;
      const r = recipes.find(x => x.id === rId);
      return r?.profiles.some(p => p.glazingBeadOptions && p.glazingBeadOptions.length > 0);
  }, [modules, recipes]);

  const filteredSlats = useMemo(() => {
    return aluminum.filter(a => 
      a.code.toLowerCase().includes(slatSearch.toLowerCase()) || 
      a.detail.toLowerCase().includes(slatSearch.toLowerCase())
    );
  }, [aluminum, slatSearch]);

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-7 shadow-sm space-y-8 h-fit overflow-y-auto max-h-[88vh] custom-scrollbar transition-colors">
            <h3 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-5 tracking-[0.2em]"><Maximize size={16} /> Parámetros de Conjunto</h3>
            <div className="space-y-3 pt-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><Hash size={12} className="text-indigo-500"/> Código de Abertura (V1, P1...)</label>
                <input type="text" className="w-full bg-indigo-50/50 dark:bg-indigo-900/10 h-12 px-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 font-black text-indigo-600 dark:text-indigo-400 text-sm focus:border-indigo-500 transition-all outline-none uppercase" placeholder="Ej: V1-ESTAR" value={itemCode} onChange={e => setItemCode(e.target.value)} />
            </div>

            {/* Selector de Estilo de Contravidrio (Solo si aplica) */}
            {hasDynamicBeads && (
                <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 animate-in slide-in-from-top-2 space-y-2">
                    <label className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-2"><Settings size={12}/> Estilo de Contravidrio</label>
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button 
                            onClick={() => setGlazingBeadStyle('Recto')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${glazingBeadStyle === 'Recto' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            Recto
                        </button>
                        <button 
                            onClick={() => setGlazingBeadStyle('Curvo')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${glazingBeadStyle === 'Curvo' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            Curvo
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><Lock size={10} className="text-indigo-400"/> Ancho Total</label>
                    <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono font-black text-slate-800 dark:text-white text-sm focus:border-indigo-500 transition-all outline-none shadow-inner" value={totalWidth} onChange={e => handleTotalChange('width', parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><Lock size={10} className="text-indigo-400"/> Alto Total</label>
                    <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono font-black text-slate-800 dark:text-white text-sm focus:border-indigo-500 transition-all outline-none shadow-inner" value={totalHeight} onChange={e => handleTotalChange('height', parseInt(e.target.value) || 0)} />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><Layers size={10} className="text-indigo-400"/> Cantidad de Unidades</label>
                <input type="number" min="1" className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono font-black text-slate-800 dark:text-white text-sm focus:border-indigo-500 transition-all outline-none shadow-inner" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            {liveBreakdown && (
                <button 
                    onClick={() => {
                        setShowBreakdownModal(true);
                        setBreakdownModalPos({ x: 0, y: 0 });
                    }}
                    className="w-full bg-slate-900 dark:bg-slate-950 rounded-3xl p-5 group hover:bg-indigo-600 transition-all text-left shadow-xl border border-slate-800/50 flex flex-col gap-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 group-hover:text-white flex items-center gap-2"><DollarSign size={12}/> Cotización Técnica</span>
                        <TrendingUp size={14} className="text-indigo-500 group-hover:text-white" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-black text-white leading-none tracking-tighter">
                            ${Math.round((liveBreakdown.materialCost + liveBreakdown.laborCost) * quantity).toLocaleString()}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 group-hover:text-indigo-200 uppercase tracking-tighter italic">Ver Análisis</span>
                    </div>
                </button>
            )}
            <div className="space-y-3 pt-5 border-t-2 border-slate-50 dark:border-slate-800">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">Terminación Superficial</label>
                <select className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase dark:text-white outline-none focus:border-indigo-500 transition-all shadow-inner" value={colorId} onChange={e => setSelectedColorId(e.target.value)}>
                    <option value="">(SELECCIONE ACABADO)</option>
                    {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
            <div className="space-y-5 pt-5 border-t-2 border-indigo-100/50 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/20 p-5 -mx-7">
                <h4 className="text-[10px] font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2 px-1"><Settings size={14} /> Ingeniería de Extras</h4>
                <div className="px-1 space-y-5">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setExtras({...extras, mosquitero: !extras.mosquitero})}>
                        <Bug size={16} className={extras.mosquitero ? 'text-indigo-600' : 'text-slate-400'} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${extras.mosquitero ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Mosquitero Perimetral</span>
                        <button className={`w-11 h-6 ml-auto rounded-full p-1 transition-all ${extras.mosquitero ? 'bg-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${extras.mosquitero ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setExtras({...extras, tapajuntas: !extras.tapajuntas})}>
                            <Frame size={16} className={extras.tapajuntas ? 'text-indigo-600' : 'text-slate-400'} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${extras.tapajuntas ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Sistema de Tapajuntas</span>
                            <button className={`w-11 h-6 ml-auto rounded-full p-1 transition-all ${extras.tapajuntas ? 'bg-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${extras.tapajuntas ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        {extras.tapajuntas && (
                          <div className="grid grid-cols-4 gap-2 mt-3 animate-in fade-in slide-in-from-top-1">
                            {['top', 'bottom', 'left', 'right'].map((side) => (
                                <button key={side} onClick={() => toggleTJSide(side as any)}
                                    className={`py-2 rounded-xl text-[8px] font-black uppercase border-2 transition-all ${
                                        extras.tapajuntasSides[side as keyof typeof extras.tapajuntasSides] 
                                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' 
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-indigo-200'
                                    }`}>{side.substring(0,3)}</button>
                            ))}
                          </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="space-y-6 pt-5 border-t-2 border-slate-50 dark:border-slate-800">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><Grid3X3 size={14} /> Estructura del Conjunto</h4>
                    <button 
                      onClick={() => setIsManualDim(!isManualDim)}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border-2 transition-all ${isManualDim ? 'bg-amber-600 border-amber-700 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                      title={isManualDim ? "Modo Manual: Las partes definen el total" : "Modo Proporcional: El total define las partes"}
                    >
                      {isManualDim ? <Unlock size={12} /> : <LinkIcon size={12} />}
                      <span className="text-[8px] font-black uppercase">{isManualDim ? 'Manual' : 'Propor.'}</span>
                    </button>
                </div>
                <div className="px-1 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Columns size={16} className="text-indigo-600" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Medidas de Ancho</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-full shadow-inner border border-slate-200 dark:border-slate-800">
                                <button onClick={removeColumn} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all active:scale-90"><Minus size={12} /></button>
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 min-w-[20px] text-center">{colSizes.length}</span>
                                <button onClick={addColumn} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:scale-90"><Plus size={12} /></button>
                            </div>
                        </div>
                        <div className="space-y-2 pl-7 border-l-2 border-indigo-100 dark:border-indigo-900">
                            {colSizes.map((size, idx) => (
                                <div key={idx} className={`flex items-center justify-between group p-3 rounded-2xl border transition-all ${isManualDim ? 'bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-800/50 border-transparent hover:border-indigo-200'}`}>
                                    <div className="flex flex-col">
                                        <span className={`text-[8px] font-black uppercase tracking-tighter italic ${isManualDim ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>Ancho C{idx+1}</span>
                                        <span className={`text-[7px] font-bold uppercase ${isManualDim ? 'text-amber-600' : 'text-indigo-500'}`}>{isManualDim ? 'Manual' : 'Ajustable'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" className={`w-24 bg-white dark:bg-slate-900 border px-3 py-2 rounded-xl font-mono font-black text-right text-[11px] outline-none shadow-sm transition-all ${isManualDim ? 'border-amber-400 text-amber-600 focus:ring-2 ring-amber-100' : 'border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:border-indigo-500'}`} value={size} onChange={e => handleBodySizeChange('width', idx, parseInt(e.target.value) || 0)} />
                                        <span className={`text-[8px] font-black ${isManualDim ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}>mm</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Rows size={16} className="text-indigo-600" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Medidas de Alto</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-full shadow-inner border border-slate-200 dark:border-slate-800">
                                <button onClick={removeRow} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all active:scale-90"><Minus size={12} /></button>
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 min-w-[20px] text-center">{rowSizes.length}</span>
                                <button onClick={addRow} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:scale-90"><Plus size={12} /></button>
                            </div>
                        </div>
                        <div className="space-y-2 pl-7 border-l-2 border-indigo-100 dark:border-indigo-900">
                            {rowSizes.map((size, idx) => (
                                <div key={idx} className={`flex items-center justify-between group p-3 rounded-2xl border transition-all ${isManualDim ? 'bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-800/50 border-transparent hover:border-indigo-200'}`}>
                                    <div className="flex flex-col">
                                        <span className={`text-[8px] font-black uppercase tracking-tighter italic ${isManualDim ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>Alto R{idx+1}</span>
                                        <span className={`text-[7px] font-bold uppercase ${isManualDim ? 'text-amber-600' : 'text-indigo-500'}`}>{isManualDim ? 'Manual' : 'Ajustable'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" className={`w-24 bg-white dark:bg-slate-900 border px-3 py-2 rounded-xl font-mono font-black text-right text-[11px] outline-none shadow-sm transition-all ${isManualDim ? 'border-amber-400 text-amber-600 focus:ring-2 ring-amber-100' : 'border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:border-indigo-500'}`} value={size} onChange={e => handleBodySizeChange('height', idx, parseInt(e.target.value) || 0)} />
                                        <span className={`text-[8px] font-black ${isManualDim ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}>mm</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="pt-4">
                <button onClick={addItemToWork} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-indigo-700 hover:shadow-indigo-200">
                    <Plus size={18} /> Cargar a Obra
                </button>
            </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 xl:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm relative overflow-hidden flex items-center justify-center min-h-[600px] transition-colors">
        <canvas ref={mainCanvasRef} width={2400} height={1800} className="w-full h-full max-h-[88vh] object-contain p-12" />
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div style={{ display: 'grid', gridTemplateColumns: (colSizes || []).map(s => `${s}fr`).join(' '), gridTemplateRows: (rowSizes || []).map(s => `${s}fr`).join(' '), aspectRatio: `${totalWidth || 1} / ${totalHeight || 1}`, width: '100%', height: '100%' }}>
                {(modules || []).filter(mod => mod && typeof mod.x === 'number' && typeof mod.y === 'number').map(mod => (
                    <div key={mod.id} className="relative pointer-events-auto group border-2 border-transparent hover:border-indigo-600/20 hover:bg-indigo-600/5 transition-all flex items-center justify-center">
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-indigo-900/10 dark:bg-indigo-400/10 backdrop-blur-[2px]">
                            <button onClick={() => {
                                setEditingModuleId(mod.id);
                                setModalPos({ x: 0, y: 0 });
                            }} className="p-4 bg-indigo-600 text-white rounded-[1.2rem] shadow-2xl hover:scale-110 active:scale-90 transition-all border-2 border-white/20 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"><Settings size={18} /> Ingeniería</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {showCouplingModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border-2 border-indigo-100 dark:border-indigo-900/30 text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-lg">
              <Link2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tighter">Ingeniería de Acople</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Seleccione el perfil de unión para el conjunto</p>
            </div>
            <div className="space-y-4">
                <select className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase dark:text-white outline-none focus:border-indigo-500" value={couplingProfileId} onChange={e => {
                    const val = e.target.value;
                    if (!val) {
                        setCouplingProfileId('');
                        setCouplingDeduction(0);
                        return;
                    }
                    const prof = aluminum.find(p => p.id === val);
                    if (prof) {
                        setCouplingProfileId(prof.id);
                        setCouplingDeduction(Number(prof.thickness || 0));
                    }
                }}>
                    <option value="">(SIN ACOPLE / UNIÓN DIRECTA)</option>
                    {couplingProfiles.map(p => <option key={p.id} value={p.id}>{p.code} - {p.detail} ({p.thickness}mm)</option>)}
                </select>
            </div>
            <button 
              onClick={() => setShowCouplingModal(false)}
              className="w-full bg-slate-900 dark:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all"
            >
              Aplicar y Continuar
            </button>
          </div>
        </div>
      )}

      {showBreakdownModal && liveBreakdown && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
             <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
             <div 
                style={{ transform: `translate(${breakdownModalPos.x}px, ${breakdownModalPos.y}px)`, transition: isDraggingBreakdown ? 'none' : 'transform 0.1s ease-out' }}
                className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl space-y-6 border-2 border-white dark:border-slate-800 flex flex-col pointer-events-auto relative ring-1 ring-black/5"
             >
                <div 
                    onMouseDown={(e) => startDragging(e, 'breakdown')}
                    className={`flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-5 select-none ${isDraggingBreakdown ? 'cursor-grabbing' : 'cursor-grab'} group`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><Receipt size={24} /></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tighter text-xl leading-none italic">Análisis Técnico</h3>
                                <GripHorizontal size={16} className="text-slate-300 dark:text-slate-700 animate-pulse" />
                            </div>
                            <p className="text-[10px] text-slate-400 font-black uppercase mt-1.5 tracking-widest">Desglose de Costos de Ingeniería</p>
                        </div>
                    </div>
                    <button onClick={() => setShowBreakdownModal(false)} className="text-slate-300 hover:text-red-500 transition-all p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"><X size={24} /></button>
                </div>
                <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 space-y-4">
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600"><Package size={14}/></div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter">1. Aluminio + Acabado</span>
                            </div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">${Math.round(liveBreakdown.aluCost).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600"><Layers size={14}/></div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter">2. Vidrio / Rellenos</span>
                            </div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">${Math.round(liveBreakdown.glassCost).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600"><Wind size={14}/></div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter">3. Herrajes y Gomas</span>
                            </div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">${Math.round(liveBreakdown.accCost).toLocaleString()}</span>
                        </div>
                        <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white"><Hammer size={14}/></div>
                                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-tighter">4. Mano de Obra ({config.laborPercentage}%)</span>
                            </div>
                            <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">${Math.round(liveBreakdown.laborCost).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="bg-slate-900 dark:bg-indigo-900/80 rounded-[2rem] p-8 text-center space-y-2 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-[10px] font-black text-indigo-400 dark:text-indigo-200 uppercase tracking-[0.4em] relative z-10">Total Final de Ingeniería</span>
                        <div className="text-4xl font-mono font-black text-white tracking-tighter relative z-10">
                            ${Math.round((liveBreakdown.materialCost + liveBreakdown.laborCost) * quantity).toLocaleString()}
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-indigo-300 uppercase font-bold italic pt-2 relative z-10">Incluye {quantity} unidad(es) • {totalWidth}x{totalHeight} mm</p>
                    </div>
                </div>
                <div className="pt-4 flex justify-center">
                    <button onClick={() => setShowBreakdownModal(false)} className="px-10 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200 dark:border-slate-700">
                        Cerrar Análisis de Costos
                    </button>
                </div>
             </div>
        </div>
      )}

      {editingModuleId && currentModForEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/20 backdrop-blur-[1px]" />
            <div 
                ref={modalContainerRef}
                style={{ 
                    transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[2rem] p-6 shadow-2xl space-y-6 overflow-hidden max-h-[92vh] border-2 border-white dark:border-slate-800 flex flex-col transition-colors pointer-events-auto relative ring-1 ring-black/5"
            >
                <div 
                    onMouseDown={(e) => startDragging(e, 'inge')}
                    className={`flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} group`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform"><LayoutGrid size={22} /></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tighter text-lg leading-none italic">Terminal de Ingeniería</h3>
                                <GripHorizontal size={16} className="text-slate-300 dark:text-slate-700 animate-pulse" />
                            </div>
                            <p className="text-[9px] text-slate-400 font-black uppercase mt-1.5 tracking-widest">Módulo {currentModForEdit.id.substring(0,8)} • Arrastre para mover</p>
                        </div>
                    </div>
                    <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setEditingModuleId(null)} 
                        className="text-slate-300 hover:text-red-500 transition-all p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
                    {/* PANEL IZQUIERDO CON SCROLL MEJORADO PARA MODO MANUAL */}
                    <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar border-r border-slate-50 dark:border-slate-800 pr-6 pb-4">
                        {isManualDim && (
                            <div className="flex flex-col gap-4 p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800 shrink-0 animate-in slide-in-from-top-2">
                                <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2"><Maximize2 size={12}/> Medidas Individuales (Manual)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Ancho Módulo (mm)</label>
                                        <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-11 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none focus:border-amber-500 shadow-sm" value={currentModForEdit.width || colSizes[currentModForEdit.x - bounds.minX]} onChange={e => updateModule(editingModuleId, { width: parseInt(e.target.value) || 0 })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Alto Módulo (mm)</label>
                                        <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-11 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none focus:border-amber-500 shadow-sm" value={currentModForEdit.height || rowSizes[currentModForEdit.y - bounds.minY]} onChange={e => updateModule(editingModuleId, { height: parseInt(e.target.value) || 0 })} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700 shrink-0">
                            <h4 className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Tag size={12}/> Sistema y Tipología</h4>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Línea Técnica</label>
                                    <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-11 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none focus:border-indigo-500 shadow-sm" value={recipeFilter} onChange={e => setRecipeFilter(e.target.value)}>
                                        {uniqueLines.map(line => <option key={line} value={line}>{line}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Tipología</label>
                                    <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-11 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none focus:border-indigo-500 shadow-sm" value={currentModForEdit.recipeId} onChange={e => { 
                                        const r = recipes.find(x => x.id === e.target.value); 
                                        if (r) {
                                          const processedAccs = ensureOneActivePerLabel(r.accessories || []);
                                          updateModule(editingModuleId, { 
                                            recipeId: r.id, 
                                            transoms: [], 
                                            overriddenAccessories: processedAccs 
                                          }); 
                                        }
                                    }}>
                                        <option value="">(SELECCIONE)</option>
                                        {recipes.filter(r => recipeFilter === 'TODOS' || (r.line || '').toUpperCase() === recipeFilter).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="min-h-[160px] bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shrink-0">
                            {currentModForEdit.recipeId ? (
                                <>
                                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl animate-in zoom-in"><Check size={32} /></div>
                                    <div className="mt-4">
                                        <h5 className="text-[11px] font-black uppercase text-slate-800 dark:text-white tracking-widest">{recipes.find(r => r.id === currentModForEdit.recipeId)?.name}</h5>
                                        <p className="text-[8px] font-bold text-indigo-500 uppercase mt-1 tracking-widest">SISTEMA VALIDADO</p>
                                    </div>
                                </>
                            ) : (
                                <div className="opacity-20 flex flex-col items-center">
                                    <Settings size={50} className="animate-spin-slow mb-4 text-slate-400" />
                                    <p className="text-[8px] font-black uppercase tracking-widest">Esperando Selección...</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="col-span-12 lg:col-span-7 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-l-4 border-indigo-600 pl-3">
                                <h4 className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2"><Split size={14} className="rotate-90"/> Divisiones Técnicas</h4>
                                <div className="flex gap-2">
                                  <button onClick={() => centerTransomsForModule(editingModuleId!)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase shadow hover:bg-slate-200 transition-all flex items-center gap-1.5">Equidistar</button>
                                  <button onClick={addTransomToModule} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Plus size={12}/> Nueva División</button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {(currentModForEdit.transoms || []).map((t, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 group/item">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter ml-1">Altura desde Base (mm)</label>
                                                <span className="text-[7px] font-black text-indigo-500 uppercase">Travesaño {idx+1}</span>
                                            </div>
                                            <div className="relative">
                                                <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black text-indigo-600 outline-none pr-12" value={t.height} onChange={e => {
                                                    const newTransoms = [...(currentModForEdit.transoms || [])];
                                                    newTransoms[idx].height = parseInt(e.target.value) || 0;
                                                    updateModule(editingModuleId, { transoms: newTransoms });
                                                }} />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300">MM</div>
                                            </div>
                                        </div>
                                        <button onClick={() => removeTransomFromModule(idx)} className="p-2 text-slate-300 hover:text-red-500 mt-3 transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-l-4 border-indigo-600 pl-3 flex items-center gap-2"><Layers size={14} /> Paños y Llenado</h4>
                            <div className="space-y-3">
                                {Array.from({ length: (currentModForEdit.transoms?.length || 0) + 1 }).map((_, paneIdx) => {
                                    const isBlind = (currentModForEdit.blindPanes || []).includes(paneIdx);
                                    const infillType = isBlind ? 'ciego' : (currentModForEdit.isDVH ? 'dvh' : 'vs');
                                    return (
                                        <div key={paneIdx} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl shadow-sm space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-700 pb-3">
                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Paño {paneIdx === 0 ? 'Inferior' : (paneIdx === currentModForEdit.transoms?.length ? 'Superior' : `Medio ${paneIdx}`)}</span>
                                                <div className="flex gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl">
                                                    <button onClick={() => { const bps = (currentModForEdit.blindPanes || []).filter(i => i !== paneIdx); updateModule(editingModuleId, { isDVH: false, blindPanes: bps, glassOuterId: currentModForEdit.glassOuterId || glasses[0]?.id || '' }); }} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${infillType === 'vs' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>VS</button>
                                                    <button onClick={() => { 
                                                        const bps = (currentModForEdit.blindPanes || []).filter(i => i !== paneIdx); 
                                                        updateModule(editingModuleId, { 
                                                            isDVH: true, 
                                                            blindPanes: bps,
                                                            glassOuterId: currentModForEdit.glassOuterId || glasses[0]?.id || '',
                                                            glassInnerId: currentModForEdit.glassInnerId || glasses[0]?.id || '',
                                                            dvhCameraId: currentModForEdit.dvhCameraId || dvhInputs.find(i => i.type === 'Cámara')?.id || ''
                                                        }); 
                                                    }} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${infillType === 'dvh' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>DVH</button>
                                                    <button onClick={() => { const bps = [...(currentModForEdit.blindPanes || [])]; if (!bps.includes(paneIdx)) updateModule(editingModuleId, { blindPanes: [...bps, paneIdx] }); }} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${infillType === 'ciego' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>CIEGO</button>
                                                </div>
                                            </div>
                                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                {infillType === 'ciego' ? (
                                                    <div className="space-y-3">
                                                        <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 h-9 px-3 rounded-lg text-[9px] font-black uppercase outline-none" value={currentModForEdit.blindPaneIds?.[paneIdx] || ''} onChange={e => updateModule(editingModuleId, { blindPaneIds: { ...currentModForEdit.blindPaneIds, [paneIdx]: e.target.value } })}>
                                                            <option value="">(SELECCIONE PANEL)</option>
                                                            {blindPanels.map(p => <option key={p.id} value={p.id}>{p.code} - {p.detail}</option>)}
                                                        </select>
                                                        
                                                        <button 
                                                            onClick={() => {
                                                                setSlatPaneIdx(paneIdx);
                                                                setShowSlatSelector(true);
                                                            }}
                                                            className="w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"
                                                        >
                                                            <Box size={14} /> 
                                                            {currentModForEdit.slatProfileIds?.[paneIdx] 
                                                                ? `Tablilla: ${aluminum.find(a => a.id === currentModForEdit.slatProfileIds?.[paneIdx])?.code || 'S/D'}` 
                                                                : 'Configurar Tablillas'}
                                                        </button>
                                                    </div>
                                                ) : infillType === 'dvh' ? (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="col-span-2">
                                                            <select className="w-full bg-indigo-50/50 dark:bg-slate-900 border border-indigo-100 h-9 px-3 rounded-lg text-[9px] font-black uppercase outline-none" value={currentModForEdit.dvhCameraId || ''} onChange={e => updateModule(editingModuleId, { dvhCameraId: e.target.value })}>
                                                                <option value="">(CÁMARA)</option>
                                                                {dvhInputs.filter(i => i.type === 'Cámara').map(c => <option key={c.id} value={c.id}>{c.detail}</option>)}
                                                            </select>
                                                        </div>
                                                        <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 h-9 px-3 rounded-lg text-[9px] font-black uppercase outline-none" value={currentModForEdit.glassOuterId || ''} onChange={e => updateModule(editingModuleId, { glassOuterId: e.target.value })}>{glasses.map(g => <option key={g.id} value={g.id}>{g.detail}</option>)}</select>
                                                        <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 h-9 px-3 rounded-lg text-[9px] font-black uppercase outline-none" value={currentModForEdit.glassInnerId || ''} onChange={e => updateModule(editingModuleId, { glassInnerId: e.target.value })}>{glasses.map(g => <option key={g.id} value={g.id}>{g.detail}</option>)}</select>
                                                    </div>
                                                ) : (
                                                    <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 h-9 px-3 rounded-lg text-[9px] font-black uppercase outline-none" value={currentModForEdit.glassOuterId || ''} onChange={e => updateModule(editingModuleId, { glassOuterId: e.target.value })}>{glasses.map(g => <option key={g.id} value={g.id}>{g.detail}</option>)}</select>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                            <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-l-4 border-indigo-600 pl-3"><Wind size={14} /> Herrajes del Módulo</h4>
                            <p className="text-[8px] text-slate-400 font-bold uppercase px-3 italic">Active o desactive las opciones de herraje según el tamaño.</p>
                            <div className="grid grid-cols-1 gap-2">
                                {(() => {
                                    const modAccs = (currentModForEdit.overriddenAccessories && currentModForEdit.overriddenAccessories.length > 0) 
                                        ? currentModForEdit.overriddenAccessories 
                                        : (recipes.find(r => r.id === currentModForEdit.recipeId)?.accessories || []);
                                    return modAccs.map((ra, idx) => {
                                        const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId);
                                        return (
                                            <div key={idx} className={`flex flex-col gap-2 p-3 border-2 rounded-xl transition-all ${ra.isAlternative ? 'bg-slate-50/40 border-slate-100 opacity-60' : 'bg-white dark:bg-slate-800/60 border-indigo-600/20 shadow-sm'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {ra.label ? (
                                                          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[8px] font-black rounded-md uppercase">{ra.label}</span>
                                                        ) : (
                                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Posición #{idx+1}</span>
                                                        )}
                                                        <span className="text-[9px] font-black text-slate-500 uppercase">x{ra.quantity} {ra.isLinear ? 'ML' : 'UN'}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => toggleAccessoryActive(idx)}
                                                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black transition-all ${ra.isAlternative ? 'text-slate-400 hover:text-indigo-600' : 'bg-indigo-600 text-white shadow-md'}`}
                                                    >
                                                        {ra.isAlternative ? <><ToggleLeft size={14} /> DESACTIVADO</> : <><ToggleRight size={14} /> ACTIVO</>}
                                                    </button>
                                                </div>
                                                <select 
                                                    className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black outline-none focus:border-indigo-500 shadow-sm ${ra.isAlternative ? 'text-slate-400' : 'text-slate-800 dark:text-white'}`}
                                                    value={ra.accessoryId}
                                                    onChange={(e) => handleAccessorySubstitute(idx, e.target.value)}
                                                >
                                                    <option value="">(SIN ACCESORIO)</option>
                                                    {accessories.map(a => <option key={a.id} value={a.id}>{a.code} - {a.detail}</option>)}
                                                </select>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setEditingModuleId(null)} className="w-full bg-slate-900 dark:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
                        <CheckCircle size={18} /> Validar Ingeniería de Módulo
                    </button>
                </div>
            </div>
        </div>
      )}

      {showSlatSelector && slatPaneIdx !== null && currentModForEdit && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl border-2 border-indigo-100 dark:border-slate-800 flex flex-col max-h-[85vh] transition-colors relative">
                <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-5 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Box size={24} /></div>
                        <div>
                            <h3 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tighter leading-none italic">Selector de Tablillas</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase mt-1.5 tracking-widest">Paño #{slatPaneIdx + 1} • Cálculo Dinámico</p>
                        </div>
                    </div>
                    <button onClick={() => setShowSlatSelector(false)} className="text-slate-300 hover:text-red-500 transition-all p-2 bg-slate-50 bg-slate-800 rounded-xl"><X size={24} /></button>
                </div>

                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar perfil tablilla por código o detalle..." 
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 pl-12 pr-6 py-4 rounded-2xl text-[11px] font-black uppercase dark:text-white focus:outline-none focus:border-indigo-600 transition-all shadow-inner"
                        value={slatSearch}
                        onChange={(e) => setSlatSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {filteredSlats.length > 0 ? filteredSlats.map(p => (
                        <button 
                            key={p.id}
                            onClick={() => {
                                updateModule(editingModuleId!, { 
                                    slatProfileIds: { 
                                        ...(currentModForEdit.slatProfileIds || {}), 
                                        [slatPaneIdx]: p.id 
                                    } 
                                });
                                setShowSlatSelector(false);
                            }}
                            className={`w-full text-left p-5 rounded-[1.5rem] border-2 transition-all group flex items-center justify-between ${
                                currentModForEdit.slatProfileIds?.[slatPaneIdx] === p.id 
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-[1.01]' 
                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200'
                            }`}
                        >
                            <div className="flex flex-col gap-1">
                                <span className={`text-sm font-black uppercase ${currentModForEdit.slatProfileIds?.[slatPaneIdx] === p.id ? 'text-white' : 'text-slate-800 dark:text-white group-hover:text-indigo-600'}`}>{p.code}</span>
                                <span className={`text-[10px] font-bold uppercase ${currentModForEdit.slatProfileIds?.[slatPaneIdx] === p.id ? 'text-indigo-200' : 'text-slate-400'}`}>{p.detail}</span>
                            </div>
                            <div className="text-right">
                                <div className={`text-[9px] font-black uppercase ${currentModForEdit.slatProfileIds?.[slatPaneIdx] === p.id ? 'text-white' : 'text-slate-400'}`}>Espesor: {p.thickness}mm</div>
                                <div className={`text-[8px] font-bold uppercase mt-1 ${currentModForEdit.slatProfileIds?.[slatPaneIdx] === p.id ? 'text-indigo-200' : 'text-indigo-500'}`}>{p.weightPerMeter} kg/m</div>
                            </div>
                        </button>
                    )) : (
                        <div className="py-12 text-center text-slate-300 opacity-20 flex flex-col items-center">
                            <Box size={60} className="mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No hay perfiles disponibles</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={() => {
                            const newIds = { ...(currentModForEdit.slatProfileIds || {}) };
                            delete newIds[slatPaneIdx];
                            updateModule(editingModuleId!, { slatProfileIds: newIds });
                            setShowSlatSelector(false);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        Limpiar Selección
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default QuotingModule;
