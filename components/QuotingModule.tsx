
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
  Link2
} from 'lucide-react';
import { calculateCompositePrice, evaluateFormula } from '../services/calculator';

const drawGlobalTapajuntas = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    tjSize: number,
    color: string,
    sides: QuoteItem['extras']['tapajuntasSides']
) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;

    if (sides.top) {
        ctx.beginPath();
        ctx.moveTo(x - (sides.left ? tjSize : 0), y - tjSize);
        ctx.lineTo(x + w + (sides.right ? tjSize : 0), y - tjSize);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    if (sides.bottom) {
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w + (sides.right ? tjSize : 0), y + h + tjSize);
        ctx.lineTo(x - (sides.left ? tjSize : 0), y + h + tjSize);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    if (sides.left) {
        ctx.beginPath();
        ctx.moveTo(x - tjSize, y - (sides.top ? tjSize : 0));
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x - tjSize, y + h + (sides.bottom ? tjSize : 0));
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    if (sides.right) {
        ctx.beginPath();
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + w + tjSize, y - (sides.top ? tjSize : 0));
        ctx.lineTo(x + w + tjSize, y + h + (sides.bottom ? tjSize : 0));
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
};

const drawDetailedOpening = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    recipe: ProductRecipe,
    isDVH: boolean,
    color: string,
    extras?: QuoteItem['extras'],
    edges?: { top: boolean, bottom: boolean, left: boolean, right: boolean },
    pxPerMm: number = 0.5,
    transoms: { height: number; profileId: string }[] = [],
    blindPanes: number[] = [],
    blindPaneIds: Record<number, string> = {},
    allBlindPanels: BlindPanel[] = [],
    allProfiles: AluminumProfile[] = [],
    isSinglePreview: boolean = false
) => {
    const visualType = recipe.visualType || 'fixed';
    const isDoor = visualType.includes('door') || recipe.type === 'Puerta';
    
    const hasBottomFrame = !isDoor;
    const isFrame90 = (visualType.includes('_90') || visualType.includes('zocalo')) && !visualType.includes('45_90');
    const hasZocalo = visualType.includes('zocalo') || visualType.includes('high') || isDoor;
    const isZocaloChico = visualType.includes('chico') || visualType.includes('low');
    
    const tjProf = allProfiles.find(p => p.id === recipe.defaultTapajuntasProfileId);
    const frameT = 45 * pxPerMm;
    const leafT = (isDoor ? 75 : 45) * pxPerMm;
    const zocaloT = (isDoor ? 120 : (isZocaloChico ? 65 : 115)) * pxPerMm;
    const tjSize = (tjProf?.thickness || 40) * pxPerMm; 

    const drawProfile = (points: {x:number, y:number}[]) => {
        if (!points || points.length < 3) return;
        
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const minY = Math.min(...points.map(p => p.y));
        const maxY = Math.max(...points.map(p => p.y));
        const isVert = (maxX - minX) < (maxY - minY);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => p && ctx.lineTo(p.x, p.y));
        ctx.closePath();
        
        ctx.fillStyle = color;
        ctx.fill();

        const grad = isVert 
            ? ctx.createLinearGradient(minX, minY, maxX, minY)
            : ctx.createLinearGradient(minX, minY, minX, maxY);
        
        grad.addColorStop(0, 'rgba(0,0,0,0.15)');       
        grad.addColorStop(0.2, 'rgba(255,255,255,0.2)'); 
        grad.addColorStop(0.5, 'rgba(255,255,255,0.05)'); 
        grad.addColorStop(0.8, 'rgba(255,255,255,0.15)'); 
        grad.addColorStop(1, 'rgba(0,0,0,0.18)');       
        
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        if (isVert) {
            const midX = minX + (maxX - minX) / 2;
            ctx.moveTo(midX, minY); ctx.lineTo(midX, maxY);
        } else {
            const midY = minY + (maxY - minY) / 2;
            ctx.moveTo(minX, midY); ctx.lineTo(maxX, midY);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        ctx.restore();
    };

    const drawOpeningSymbol = (sx: number, sy: number, sw: number, sh: number, leafType: string, isMesh: boolean = false) => {
        ctx.save();
        if (isMesh) {
            ctx.fillStyle = 'rgba(203, 213, 225, 0.5)';
            ctx.fillRect(sx, sy, sw, sh);
            ctx.strokeStyle = 'rgba(30, 41, 59, 0.25)';
            ctx.lineWidth = 0.4;
            const step = 4 * pxPerMm;
            for(let i = 0; i <= sw; i += step) {
                ctx.beginPath(); ctx.moveTo(sx + i, sy); ctx.lineTo(sx + i, sy + sh); ctx.stroke();
            }
            for(let j = 0; j <= sh; j += step) {
                ctx.beginPath(); ctx.moveTo(sx, sy + j); ctx.lineTo(sx + sw, sy + j); ctx.stroke();
            }
            ctx.restore();
            return;
        }

        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.6)';
        ctx.lineWidth = 1.2;

        if (leafType.includes('swing') || leafType.includes('door') || leafType.includes('right') || leafType.includes('left')) {
            const isRight = leafType.includes('right');
            ctx.beginPath();
            if (isRight) {
                ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy + sh/2); ctx.lineTo(sx, sy + sh);
            } else {
                ctx.moveTo(sx + sw, sy); ctx.lineTo(sx, sy + sh/2); ctx.lineTo(sx, sy + sh);
            }
            ctx.stroke();
        } else if (leafType.includes('sliding')) {
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(79, 70, 229, 0.5)';
            const midY = sy + sh/2;
            const midX = sx + sw/2;
            ctx.beginPath();
            ctx.moveTo(midX - 18*pxPerMm, midY); ctx.lineTo(midX + 18*pxPerMm, midY); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(midX + 10*pxPerMm, midY - 5*pxPerMm); ctx.lineTo(midX + 18*pxPerMm, midY); ctx.lineTo(midX + 10*pxPerMm, midY + 5*pxPerMm);
            ctx.fill();
        } else if (leafType.includes('projecting') || leafType.includes('ventiluz')) {
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw/2, sy + sh); ctx.lineTo(sx + sw, sy); ctx.stroke();
        } else if (leafType.includes('banderola')) {
            ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw/2, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke();
        } else if (leafType.includes('tilt_turn') || leafType.includes('oscilo')) {
            ctx.beginPath(); ctx.moveTo(sx + sw, sy); ctx.lineTo(sx, sy + sh/2); ctx.lineTo(sx + sw, sy + sh); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw/2, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke();
        }
        ctx.restore();
    };

    const drawPane = (px: number, py: number, pw: number, ph: number, index: number) => {
        const isBlind = blindPanes.includes(index);
        const isMosquiteroSystem = visualType === 'mosquitero';

        if (isBlind) {
            const specificBlindId = blindPaneIds[index];
            const specificBlind = allBlindPanels.find(bp => bp.id === specificBlindId);
            const isML = specificBlind?.unit === 'ml';
            ctx.fillStyle = isML ? color : '#334155';
            ctx.fillRect(px, py, pw, ph);
            ctx.strokeStyle = isML ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.05)';
            const step = 12 * pxPerMm;
            for (let i = 0; i < ph; i += step) { 
                ctx.beginPath(); ctx.moveTo(px, py + i); ctx.lineTo(px + pw, py + i); ctx.stroke(); 
            }
        } else if (isMosquiteroSystem) {
            ctx.fillStyle = '#94a3b8'; 
            ctx.fillRect(px, py, pw, ph);
            ctx.save();
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'; 
            ctx.lineWidth = 0.3;
            const meshStep = 2.5 * pxPerMm;
            for (let i = 0; i <= ph; i += meshStep) {
                ctx.beginPath(); ctx.moveTo(px, py + i); ctx.lineTo(px + pw, py + i); ctx.stroke();
            }
            for (let j = 0; j <= pw; j += meshStep) {
                ctx.beginPath(); ctx.moveTo(px + j, py); ctx.lineTo(px + j, py + ph); ctx.stroke();
            }
            const metalGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
            metalGrad.addColorStop(0, 'rgba(255,255,255,0)');
            metalGrad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
            metalGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = metalGrad;
            ctx.fillRect(px, py, pw, ph);
            ctx.restore();
        } else {
            const glassGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
            glassGrad.addColorStop(0, '#bae6fd');
            glassGrad.addColorStop(0.35, '#e0f2fe');
            glassGrad.addColorStop(0.5, '#f0f9ff');
            glassGrad.addColorStop(1, '#bae6fd');
            ctx.fillStyle = glassGrad;
            ctx.fillRect(px, py, pw, ph);
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.8;
            ctx.moveTo(px + pw * 0.15, py + 12*pxPerMm);
            ctx.lineTo(px + pw * 0.85, py + ph - 12*pxPerMm);
            ctx.stroke();
        }
    };

    const drawGlassWithTransoms = (gx: number, gy: number, gw: number, gh: number, absoluteBottomY: number) => {
        if (transoms.length > 0) {
            const sorted = [...transoms].sort((a, b) => a.height - b.height);
            let currentTopY = gy;
            sorted.reverse().forEach((t, i) => {
                const trProf = allProfiles.find(p => p.id === t.profileId);
                const tHeight = (trProf?.thickness || 40) * pxPerMm;
                const transomY = (y + h) - (t.height * pxPerMm);
                
                if (transomY > gy && transomY < (gy + gh)) {
                    const paneH = (transomY - (tHeight/2)) - currentTopY;
                    const paneIndex = transoms.length - i - 1;
                    if (paneH > 0) drawPane(gx, currentTopY, gw, paneH, paneIndex);
                    drawProfile([
                        {x: gx, y: transomY - (tHeight/2)}, 
                        {x: gx + gw, y: transomY - (tHeight/2)}, 
                        {x: gx + gw, y: transomY + (tHeight/2)}, 
                        {x: gx, y: transomY + (tHeight/2)}
                    ]);
                    currentTopY = transomY + (tHeight/2);
                }
            });
            const lastPaneH = (gy + gh) - currentTopY;
            if (lastPaneH > 0) drawPane(gx, currentTopY, gw, lastPaneH, transoms.length);
        } else {
            drawPane(gx, gy, gw, gh, 0);
        }
    };

    if (isSinglePreview && extras?.tapajuntas && edges) {
        drawGlobalTapajuntas(ctx, x, y, w, h, tjSize, color, extras.tapajuntasSides);
    }

    if (isFrame90) {
        drawProfile([{x:x, y:y}, {x:x+frameT, y:y}, {x:x+frameT, y:y+h}, {x:x, y:y+h}]);
        drawProfile([{x:x+w-frameT, y:y}, {x:x+w, y:y}, {x:x+w, y:y+h}, {x:x+w-frameT, y:y+h}]);
        drawProfile([{x:x+frameT, y:y}, {x:x+w-frameT, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+frameT, y:y+frameT}]);
        if (hasBottomFrame) {
            drawProfile([{x:x+frameT, y:y+h-frameT}, {x:x+w-frameT, y:y+h-frameT}, {x:x+w-frameT, y:y+h}, {x:x+frameT, y:y+h}]);
        }
    } else {
        drawProfile([{x:x, y:y}, {x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+frameT, y:y+frameT}]); 
        if (hasBottomFrame) drawProfile([{x:x, y:y+h}, {x:x+w, y:y+h}, {x:x+w-frameT, y:y+h-frameT}, {x:x+frameT, y:y+h-frameT}]); 
        drawProfile([{x:x, y:y}, {x:x+frameT, y:y+frameT}, {x:x+frameT, y:y+h-(hasBottomFrame?frameT:0)}, {x:x, y:y+h}]); 
        drawProfile([{x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+w-frameT, y:y+h-(hasBottomFrame?frameT:0)}, {x:x+w, y:y+h}]); 
    }

    const innerX = x + frameT; const innerY = y + frameT;
    const innerW = w - frameT * 2; const innerH = h - (hasBottomFrame ? frameT * 2 : frameT);

    const drawLeaf = (lx:number, ly:number, lh:number, lw:number, force90:boolean, leafHasZocalo:boolean, mesh:boolean, leafType:string) => {
        const bT = leafHasZocalo ? zocaloT : leafT;
        drawGlassWithTransoms(lx + leafT, ly + leafT, lw - leafT * 2, lh - (leafT + bT), ly + lh);
        drawOpeningSymbol(lx + leafT, ly + leafT, lw - leafT * 2, lh - (leafT + bT), leafType, mesh);
        
        if (force90) {
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

    if (visualType.includes('sliding')) {
        const numLeaves = visualType.includes('sliding_3') ? 3 : (visualType.includes('sliding_4') ? 4 : 2);
        const overlap = 40 * pxPerMm;
        if (numLeaves === 3) {
            const leafW = (innerW / 3) + overlap;
            for(let i=0; i<3; i++) {
                const lx = innerX + (i * (innerW - leafW) / 2);
                drawLeaf(lx, innerY, innerH, leafW, true, hasZocalo, i === 0 && (extras?.mosquitero || false), 'sliding');
            }
        } else if (numLeaves === 4) {
            const leafW = (innerW / 4) + overlap;
            for(let i=0; i<4; i++) {
                const lx = innerX + (i * (innerW - leafW) / 3);
                drawLeaf(lx, innerY, innerH, leafW, true, hasZocalo, i === 0 && (extras?.mosquitero || false), 'sliding');
            }
        } else {
            const leafW = (innerW / 2) + overlap;
            drawLeaf(innerX, innerY, innerH, leafW, true, hasZocalo, extras?.mosquitero || false, 'sliding');
            drawLeaf(innerX + innerW - leafW, innerY, innerH, leafW, true, hasZocalo, false, 'sliding');
        }
    } else if (visualType.includes('swing') || visualType.includes('door') || visualType.includes('right') || visualType.includes('left') || visualType.includes('projecting') || visualType.includes('ventiluz') || visualType.includes('banderola') || visualType.includes('oscilo')) {
        drawLeaf(innerX, innerY, innerH, innerW, false, hasZocalo, extras?.mosquitero || false, visualType);
    } else {
        drawGlassWithTransoms(innerX, innerY, innerW, innerH, innerY + innerH);
    }
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

  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const [breakdownModalPos, setBreakdownModalPos] = useState({ x: 0, y: 0 });
  const [isDraggingBreakdown, setIsDraggingBreakdown] = useState(false);
  const breakdownDragOffset = useRef({ x: 0, y: 0 });

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  
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
    return aluminum.filter(p => 
        p.code.toUpperCase().includes('ACOP') || 
        p.detail.toUpperCase().includes('ACOP') ||
        p.detail.toUpperCase().includes('INTERM')
    );
  }, [aluminum]);

  const uniqueLines = useMemo(() => {
    const lines = recipes.map(r => r.line.toUpperCase());
    return ['TODOS', ...Array.from(new Set(lines))];
  }, [recipes]);

  const liveBreakdown = useMemo(() => {
    const treatment = treatments.find(t => t.id === colorId);
    if (!treatment) return null;

    const tempItem: QuoteItem = {
      id: 'temp', itemCode: itemCode || 'POS#', width: totalWidth, height: totalHeight, colorId, quantity,
      composition: { modules: JSON.parse(JSON.stringify((modules || []).filter(Boolean))), colRatios: [...colSizes], rowRatios: [...rowSizes], couplingDeduction },
      couplingProfileId, extras: { ...extras }, calculatedCost: 0
    };
    const { breakdown } = calculateCompositePrice(tempItem, recipes, aluminum, config, treatment, glasses, accessories, dvhInputs, blindPanels);
    return breakdown;
  }, [totalWidth, totalHeight, itemCode, modules, colSizes, rowSizes, couplingDeduction, extras, colorId, couplingProfileId, recipes, aluminum, config, treatments, glasses, accessories, dvhInputs, blindPanels, quantity]);

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
    if (newColSizes.length <= 1 && rowSizes.length <= 1) setCouplingProfileId('');
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
    if (colSizes.length <= 1 && newRowSizes.length <= 1) setCouplingProfileId('');
  };

  const handleBodySizeChange = (dim: 'width' | 'height', index: number, newValue: number) => {
    const sizes = dim === 'width' ? [...colSizes] : [...rowSizes];
    const total = dim === 'width' ? totalWidth : totalHeight;
    const oldValue = sizes[index];
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
      composition: { modules: (modules || []).filter(Boolean), colRatios: [...colSizes], rowRatios: [...rowSizes], couplingDeduction },
      couplingProfileId, extras: { ...extras }, calculatedCost: 0
    }, recipes, aluminum, config, treatment, glasses, accessories, dvhInputs, blindPanels);

    const tempItem: QuoteItem = {
      id: Date.now().toString(), itemCode: itemCode || `POS#${currentWorkItems.length + 1}`, width: totalWidth, height: totalHeight, colorId, quantity,
      composition: { modules: JSON.parse(JSON.stringify((modules || []).filter(Boolean))), colRatios: [...colSizes], rowRatios: [...rowSizes], couplingDeduction },
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

    const padding = 120;
    const pxPerMm = Math.min((canvas.width - padding * 2) / (totalWidth || 1), (canvas.height - padding * 2) / (totalHeight || 1));
    const startX = (canvas.width - totalWidth * pxPerMm) / 2;
    const startY = (canvas.height - totalHeight * pxPerMm) / 2;
    const aluColor = treatments.find(t => t.id === colorId)?.hexColor || '#334155';
    const validModules = (modules || []).filter(m => m && typeof m.x === 'number' && typeof m.y === 'number');

    const cProfile = couplingProfileId ? aluminum.find(p => p.id === couplingProfileId) : null;
    const currentDeduction = cProfile ? cProfile.thickness : couplingDeduction;

    if (extras.tapajuntas) {
        const firstRecipe = recipes.find(r => r.id === validModules[0]?.recipeId);
        const tjProfile = aluminum.find(p => p.id === firstRecipe?.defaultTapajuntasProfileId);
        const tjSizeMm = tjProfile?.thickness || 40;
        drawGlobalTapajuntas(ctx, startX, startY, totalWidth * pxPerMm, totalHeight * pxPerMm, tjSizeMm * pxPerMm, aluColor, extras.tapajuntasSides);
    }

    validModules.forEach(mod => {
        const recipe = recipes.find(r => r.id === mod.recipeId);
        if (!recipe) return;
        
        const modIdxX = mod.x - bounds.minX;
        const modIdxY = mod.y - bounds.minY;
        
        let modW = colSizes[modIdxX] || 0; 
        let modH = rowSizes[modIdxY] || 0;
        
        if (colSizes.length > 1) {
            if (mod.x > bounds.minX) modW -= (currentDeduction / 2);
            if (mod.x < bounds.maxX) modW -= (currentDeduction / 2);
        }
        if (rowSizes.length > 1) {
            if (mod.y > bounds.minY) modH -= (currentDeduction / 2);
            if (mod.y < bounds.maxY) modH -= (currentDeduction / 2);
        }
        
        let ox_mm = 0; for (let i = 0; i < modIdxX; i++) ox_mm += colSizes[i] || 0;
        let oy_mm = 0; for (let j = 0; j < modIdxY; j++) oy_mm += rowSizes[j] || 0;
        
        const xOffset = (mod.x > bounds.minX) ? (currentDeduction / 2) : 0;
        const yOffset = (mod.y > bounds.minY) ? (currentDeduction / 2) : 0;
        
        const edges = { top: mod.y === bounds.minY, bottom: mod.y === bounds.maxY, left: mod.x === bounds.minX, right: mod.x === bounds.maxX };
        drawDetailedOpening(ctx, startX + (ox_mm + xOffset) * pxPerMm, startY + (oy_mm + yOffset) * pxPerMm, modW * pxPerMm, modH * pxPerMm, recipe, mod.isDVH, aluColor, extras, edges, pxPerMm, mod.transoms, mod.blindPanes, mod.blindPaneIds || {}, blindPanels, aluminum, false);
    });
  }, [totalWidth, totalHeight, modules, colSizes, rowSizes, bounds, extras, colorId, treatments, recipes, couplingDeduction, couplingProfileId, blindPanels, aluminum]);

  const currentModForEdit = (modules || []).find(m => m && m.id === editingModuleId);

  const toggleTJSide = (side: keyof QuoteItem['extras']['tapajuntasSides']) => {
    setExtras({
        ...extras,
        tapajuntasSides: { ...extras.tapajuntasSides, [side]: !extras.tapajuntasSides[side] }
    });
  };

  const addTransomToModule = () => {
    if (!currentModForEdit) return;
    const modIdxY = currentModForEdit.y - bounds.minY;
    const modH = rowSizes[modIdxY] || 0;
    const transomRecipe = recipes.find(r => r.id === currentModForEdit.recipeId);
    const newTransom = { height: Math.round(modH / 2), profileId: transomRecipe?.defaultTransomProfileId || aluminum[0]?.id || '' };
    updateModule(editingModuleId!, { transoms: [...(currentModForEdit.transoms || []), newTransom] });
  };

  const removeTransomFromModule = (idx: number) => {
    if (!currentModForEdit) return;
    updateModule(editingModuleId!, { transoms: currentModForEdit.transoms?.filter((_, i) => i !== idx) });
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
            setBreakdownModalPos({ x: e.clientX - breakdownDragOffset.current.x, y: e.clientY - breakdownDragOffset.current.y });
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

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-7 shadow-sm space-y-8 h-fit overflow-y-auto max-h-[88vh] custom-scrollbar transition-colors">
            <h3 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-5 tracking-[0.2em]"><Maximize size={16} /> Parámetros de Conjunto</h3>
            
            <div className="space-y-3 pt-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><Hash size={12} className="text-indigo-500"/> Código de Abertura (V1, P1...)</label>
                <input type="text" className="w-full bg-indigo-50/50 dark:bg-indigo-900/10 h-12 px-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 font-black text-indigo-600 dark:text-indigo-400 text-sm focus:border-indigo-500 transition-all outline-none uppercase" placeholder="Ej: V1-ESTAR" value={itemCode} onChange={e => setItemCode(e.target.value)} />
            </div>

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
                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => setExtras({...extras, mosquitero: !extras.mosquitero})}>
                        <div className="flex items-center gap-3">
                            <Bug size={16} className={extras.mosquitero ? 'text-indigo-600' : 'text-slate-400'} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${extras.mosquitero ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Mosquitero Perimetral</span>
                        </div>
                        <button className={`w-11 h-6 rounded-full p-1 transition-all ${extras.mosquitero ? 'bg-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${extras.mosquitero ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between group cursor-pointer" onClick={() => setExtras({...extras, tapajuntas: !extras.tapajuntas})}>
                            <div className="flex items-center gap-3">
                                <Frame size={16} className={extras.tapajuntas ? 'text-indigo-600' : 'text-slate-400'} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${extras.tapajuntas ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Sistema de Tapajuntas</span>
                            </div>
                            <button className={`w-11 h-6 rounded-full p-1 transition-all ${extras.tapajuntas ? 'bg-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' : 'bg-slate-300 dark:bg-slate-700'}`}>
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
                <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2 px-1"><Grid3X3 size={14} /> Estructura del Conjunto</h4>
                <div className="px-1 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Columns size={16} className="text-indigo-600" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Columnas</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-full shadow-inner border border-slate-200 dark:border-slate-800">
                                <button onClick={removeColumn} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all active:scale-90"><Minus size={12} /></button>
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 min-w-[20px] text-center">{colSizes.length}</span>
                                <button onClick={addColumn} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:scale-90"><Plus size={12} /></button>
                            </div>
                        </div>
                        <div className="space-y-2 pl-7 border-l-2 border-indigo-100 dark:border-indigo-900">
                            {colSizes.map((size, idx) => (
                                <div key={idx} className="flex items-center justify-between group bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-xl border border-transparent hover:border-indigo-200 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">Cuerpo C{idx+1}</span>
                                        <span className="text-[7px] text-indigo-500 font-bold uppercase">Dim. Dinámica</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl font-mono font-black text-right text-[10px] text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 outline-none shadow-sm transition-all" value={size} onChange={e => handleBodySizeChange('width', idx, parseInt(e.target.value) || 0)} />
                                        <span className="text-[8px] font-black text-slate-300 dark:text-slate-600">mm</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Rows size={16} className="text-indigo-600" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Filas</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-full shadow-inner border border-slate-200 dark:border-slate-800">
                                <button onClick={removeRow} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all active:scale-90"><Minus size={12} /></button>
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 min-w-[20px] text-center">{rowSizes.length}</span>
                                <button onClick={addRow} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:scale-90"><Plus size={12} /></button>
                            </div>
                        </div>
                        <div className="space-y-2 pl-7 border-l-2 border-indigo-100 dark:border-indigo-900">
                            {rowSizes.map((size, idx) => (
                                <div key={idx} className="flex items-center justify-between group bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-xl border border-transparent hover:border-indigo-200 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">Cuerpo R{idx+1}</span>
                                        <span className="text-[7px] text-indigo-500 font-bold uppercase">Dim. Dinámica</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl font-mono font-black text-right text-[10px] text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 outline-none shadow-sm transition-all" value={size} onChange={e => handleBodySizeChange('height', idx, parseInt(e.target.value) || 0)} />
                                        <span className="text-[8px] font-black text-slate-300 dark:text-slate-600">mm</span>
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
                    const prof = aluminum.find(p => p.id === e.target.value);
                    if (prof) {
                        setCouplingProfileId(prof.id);
                        setCouplingDeduction(prof.thickness);
                    }
                }}>
                    <option value="">(SIN ACOPLE / UNIÓN DIRECTA)</option>
                    {couplingProfiles.map(p => <option key={p.id} value={p.id}>{p.code} - {p.detail} ({p.thickness}mm)</option>)}
                </select>
            </div>
            <button 
              onClick={() => setShowCouplingModal(false)}
              className="w-full bg-slate-900 dark:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all"
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
                className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[2rem] p-6 shadow-2xl space-y-6 overflow-hidden max-h-[92vh] border-2 border-white dark:border-slate-800 flex flex-col transition-colors pointer-events-auto ring-1 ring-black/5"
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
                    <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-hidden border-r border-slate-50 dark:border-slate-800 pr-6">
                        <div className="flex flex-col gap-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
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
                                    <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-11 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none focus:border-indigo-500 shadow-sm" value={currentModForEdit.recipeId} onChange={e => { const r = recipes.find(x => x.id === e.target.value); if (r) updateModule(editingModuleId, { recipeId: r.id, transoms: r.defaultTransoms || [], overriddenAccessories: r.accessories || [] }); }}>
                                        <option value="">(SELECCIONE)</option>
                                        {recipes.filter(r => recipeFilter === 'TODOS' || r.line.toUpperCase() === recipeFilter).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
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
                                <button onClick={addTransomToModule} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow hover:bg-indigo-700 transition-all flex items-center gap-1.5"><Plus size={12}/> Nueva</button>
                            </div>
                            <div className="space-y-2">
                                {(currentModForEdit.transoms || []).map((t, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter ml-1">Altura (mm)</label>
                                                <button onClick={() => {
                                                    const modIdxY = currentModForEdit.y - bounds.minY;
                                                    const modH = rowSizes[modIdxY] || 0;
                                                    const newTransoms = [...(currentModForEdit.transoms || [])];
                                                    newTransoms[idx].height = Math.round(modH / 2);
                                                    updateModule(editingModuleId, { transoms: newTransoms });
                                                }} className="text-[7px] font-black text-indigo-500 uppercase hover:text-indigo-700">Centrar</button>
                                            </div>
                                            <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black text-indigo-600 outline-none" value={t.height} onChange={e => {
                                                const newTransoms = [...(currentModForEdit.transoms || [])];
                                                newTransoms[idx].height = parseInt(e.target.value) || 0;
                                                updateModule(editingModuleId, { transoms: newTransoms });
                                            }} />
                                        </div>
                                        <button onClick={() => removeTransomFromModule(idx)} className="p-2 text-slate-300 hover:text-red-500 mt-3"><Trash2 size={14}/></button>
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
                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Paño {paneIdx+1}</span>
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
                                                    <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 h-9 px-3 rounded-lg text-[9px] font-black uppercase outline-none" value={currentModForEdit.blindPaneIds?.[paneIdx] || ''} onChange={e => updateModule(editingModuleId, { blindPaneIds: { ...currentModForEdit.blindPaneIds, [paneIdx]: e.target.value } })}>
                                                        <option value="">(SELECCIONE PANEL)</option>
                                                        {blindPanels.map(p => <option key={p.id} value={p.id}>{p.code} - {p.detail}</option>)}
                                                    </select>
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
                            <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-l-4 border-indigo-600 pl-3"><Wind size={14} /> Herrajes del Módulo</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {(() => {
                                    const modAccs = (currentModForEdit.overriddenAccessories && currentModForEdit.overriddenAccessories.length > 0) ? currentModForEdit.overriddenAccessories : (recipes.find(r => r.id === currentModForEdit.recipeId)?.accessories || []);
                                    return modAccs.map((ra, idx) => {
                                        const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId);
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase">{acc?.code || ra.accessoryId}</span>
                                                    <span className="text-[7px] text-slate-400 uppercase font-bold truncate max-w-[100px]">{acc?.detail || 'General'}</span>
                                                </div>
                                                <span className="text-[9px] font-black text-indigo-500">x{ra.quantity}</span>
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
    </div>
  );
};

export default QuotingModule;
