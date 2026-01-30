
import React, { useState, useEffect, useRef, useMemo } from 'react';
// Corrected imports: removed redundant and incorrect icon imports from '../types'
import { 
    ProductRecipe, AluminumProfile, Glass, BlindPanel,
    Accessory,
    DVHInput, Treatment, GlobalConfig, Quote, QuoteItem,
    MeasurementModule,
    RecipeAccessory,
    QuoteItemBreakdown
} from '../types';
import { 
  Plus as PlusIcon, 
  Trash2 as TrashIcon, 
  Settings as SettingsIcon, 
  Maximize as MaximizeIcon, 
  CheckCircle as CheckCircleIcon, 
  X as XIcon, 
  LayoutGrid as LayoutGridIcon, 
  Thermometer as ThermometerIcon, 
  ArrowRightLeft as ArrowRightLeftIcon, 
  Link as LinkIcon, 
  Frame as FrameIcon,
  Columns as ColumnsIcon, 
  Rows as RowsIcon,
  Info as InfoIcon,
  Split as SplitIcon,
  Layers as LayersIcon,
  Square as SquareIcon, 
  Box as BoxIcon,
  Wind as WindIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  Zap as ZapIcon,
  Ruler as RulerIcon,
  Bug as BugIcon,
  MousePointer2 as MousePointer2Icon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Grid3X3 as Grid3X3Icon,
  Minus as MinusIcon,
  DollarSign as DollarSignIcon,
  Hash as HashIcon,
  AlignCenter as AlignCenterIcon,
  Tag as TagIcon
} from 'lucide-react';

const drawGlobalTapajuntas = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    tjSize: number,
    color: string,
    sides: QuoteItem['extras']['tapajuntasSides']
) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
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
    const isDoor = visualType.startsWith('door_') || recipe.type === 'Puerta';
    const is90 = visualType.includes('_90') || visualType.includes('zocalo');
    const hasZocalo = visualType.includes('zocalo');
    const isZocaloChico = visualType.includes('chico');
    
    const tjProf = allProfiles.find(p => p.id === recipe.defaultTapajuntasProfileId);
    const frameT = 45 * pxPerMm;
    const leafT = (isDoor ? 75 : 45) * pxPerMm;
    const zocaloT = (isZocaloChico ? 65 : 115) * pxPerMm;
    const tjSize = (tjProf?.thickness || 40) * pxPerMm; 

    const drawProfile = (points: {x:number, y:number}[], isVert: boolean) => {
        if (!points || points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => p && ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = color; 
        ctx.fill();
        const grad = isVert 
            ? ctx.createLinearGradient(points[0].x, points[0].y, points[1].x > points[0].x ? points[1].x : points[0].x + 10, points[0].y)
            : ctx.createLinearGradient(points[0].x, points[0].y, points[0].x, points[points.length-1].y > points[0].y ? points[points.length-1].y : points[0].y + 10);
        grad.addColorStop(0, 'rgba(0,0,0,0.15)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        grad.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    };

    const drawOpeningSymbol = (sx: number, sy: number, sw: number, sh: number, leafType: string, isMesh: boolean = false) => {
        ctx.save();
        if (isMesh) {
            ctx.fillStyle = 'rgba(30, 41, 59, 0.4)'; 
            ctx.fillRect(sx, sy, sw, sh);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 0.5;
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

        if (leafType.includes('swing') || leafType.includes('right') || leafType.includes('left')) {
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
        } else if (leafType.includes('projecting')) {
            ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw/2, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke();
        }
        ctx.restore();
    };

    const drawPane = (px: number, py: number, pw: number, ph: number, index: number) => {
        const isBlind = blindPanes.includes(index);
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
        } else {
            const glassGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
            glassGrad.addColorStop(0, '#bae6fd');
            glassGrad.addColorStop(0.35, '#e0f2fe');
            glassGrad.addColorStop(0.5, '#f0f9ff');
            glassGrad.addColorStop(1, '#bae6fd');
            ctx.fillStyle = glassGrad;
            ctx.fillRect(px, py, pw, ph);
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.moveTo(px + pw * 0.15, py + 12*pxPerMm);
            ctx.lineTo(px + pw * 0.85, py + ph - 12*pxPerMm);
            ctx.stroke();
        }
    };

    const drawGlassWithTransoms = (gx: number, gy: number, gw: number, gh: number, absoluteBottomY: number) => {
        if (transoms.length > 0) {
            const sorted = [...transoms].sort((a, b) => a.height - b.height);
            let currentTopY = gy;
            // Dibujamos de abajo hacia arriba para mayor claridad visual
            sorted.reverse().forEach((t, i) => {
                const trProf = allProfiles.find(p => p.id === t.profileId);
                const tHeight = (trProf?.thickness || 40) * pxPerMm;
                // La medida es desde la base exterior del módulo
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
                    ], false);
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

    if (is90) {
        drawProfile([{x:x, y:y}, {x:x+frameT, y:y}, {x:x+frameT, y:y+h}, {x:x, y:y+h}], true);
        drawProfile([{x:x+w-frameT, y:y}, {x:x+w, y:y}, {x:x+w, y:y+h}, {x:x+w-frameT, y:y+h}], true);
        drawProfile([{x:x+frameT, y:y}, {x:x+w-frameT, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+frameT, y:y+frameT}], false);
        if (!isDoor) drawProfile([{x:x, y:y+h-frameT}, {x:x+w, y:y+h-frameT}, {x:x+w, y:y+h}, {x:x, y:y+h}], false);
    } else {
        drawProfile([{x:x, y:y}, {x:x+w, y:y}, {x:x+w-frameT, y:y+frameT}, {x:x+frameT, y:y+frameT}], false);
        if (!isDoor) drawProfile([{x:x, y:y+h}, {x:x+w, y:y+h}, {x:x+w-frameT, y:y+h-frameT}, {x:x+frameT, y:y+h-frameT}], false);
        drawProfile([{x:x, y:y}, {x:x+frameT, y:y+frameT}, {x:x+frameT, y:y+h-(isDoor?0:frameT)}, {x:x, y:y+h}], true);
        drawProfile([{x:x+w, y:y}, {x:x+w, y:y+h}, {x:x+w-frameT, y:y+h-(isDoor?0:frameT)}, {x:x+w-frameT, y:y+frameT}], true);
    }

    const innerX = x + frameT; const innerY = y + frameT;
    const innerW = w - frameT * 2; const innerH = h - (isDoor ? frameT : frameT * 2);

    const drawLeaf = (lx:number, ly:number, lw:number, lh:number, force90:boolean, leafHasZocalo:boolean, mesh:boolean, leafType:string) => {
        const bT = leafHasZocalo ? zocaloT : leafT;
        drawGlassWithTransoms(lx + leafT, ly + leafT, lw - leafT * 2, lh - (leafT + bT), ly + lh);
        drawOpeningSymbol(lx + leafT, ly + leafT, lw - leafT * 2, lh - (leafT + bT), leafType, mesh);
        if (force90) {
            drawProfile([{x:lx, y:ly}, {x:lx+leafT, y:ly}, {x:lx+leafT, y:ly+lh}, {x:lx, y:ly+lh}], true);
            drawProfile([{x:lx+lw-leafT, y:ly}, {x:lx+lw, y:ly}, {x:lx+lw, y:ly+lh}, {x:lx+lw-leafT, y:ly+lh}], true);
            drawProfile([{x:lx+leafT, y:ly}, {x:lx+lw-leafT, y:ly}, {x:lx+lw-leafT, y:ly+leafT}, {x:lx+leafT, y:ly+leafT}], false);
            drawProfile([{x:lx+leafT, y:ly+lh-bT}, {x:lx+lw-leafT, y:ly+lh-bT}, {x:lx+lw-leafT, y:ly+lh}, {x:lx+leafT, y:ly+lh}], false);
        } else {
            drawProfile([{x:lx, y:ly}, {x:lx+lw, y:ly}, {x:lx+lw-leafT, y:ly+leafT}, {x:lx+leafT, y:ly+leafT}], false);
            drawProfile([{x:lx, y:ly+lh}, {x:lx+lw, y:ly+lh}, {x:lx+lw-leafT, y:ly+lh-bT}, {x:lx+leafT, y:ly+lh-bT}], false);
            drawProfile([{x:lx, y:ly}, {x:lx+leafT, y:ly+leafT}, {x:lx+leafT, y:ly+lh-bT}, {x:lx, y:ly+lh}], true);
            drawProfile([{x:lx+lw, y:ly}, {x:lx+lw-leafT, y:ly+leafT}, {x:lx+lw-leafT, y:ly+lh-bT}, {x:lx+lw, y:ly+lh}], true);
        }
    };

    if (visualType.includes('sliding')) {
        const numLeaves = visualType.includes('sliding_3') ? 3 : (visualType.includes('sliding_4') ? 4 : 2);
        const overlap = 40 * pxPerMm;
        if (numLeaves === 3) {
            const leafW = (innerW / 3) + overlap;
            for(let i=0; i<3; i++) {
                const lx = innerX + (i * (innerW - leafW) / 2);
                drawLeaf(lx, innerY, leafW, innerH, is90, hasZocalo, i === 0 && (extras?.mosquitero || false), 'sliding');
            }
        } else if (numLeaves === 4) {
            const leafW = (innerW / 4) + overlap;
            for(let i=0; i<4; i++) {
                const lx = innerX + (i * (innerW - leafW) / 3);
                drawLeaf(lx, innerY, leafW, innerH, is90, hasZocalo, i === 0 && (extras?.mosquitero || false), 'sliding');
            }
        } else {
            const leafW = (innerW / 2) + overlap;
            drawLeaf(innerX, innerY, leafW, innerH, is90, hasZocalo, extras?.mosquitero || false, 'sliding');
            drawLeaf(innerX + innerW - leafW, innerY, leafW, innerH, is90, hasZocalo, false, 'sliding');
        }
    } else if (visualType.includes('swing') || visualType.includes('right') || visualType.includes('left') || visualType.includes('projecting')) {
        drawLeaf(innerX, innerY, innerW, innerH, is90, hasZocalo, extras?.mosquitero || false, visualType);
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
  const [recipeFilter, setRecipeFilter] = useState<string>('TODOS');
  const [recipeSearch, setRecipeSearch] = useState<string>('');

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
  };

  const removeColumn = () => {
    if (colSizes.length <= 1) return;
    const lastX = bounds.maxX;
    const newColSizes = colSizes.slice(0, -1);
    setModules((modules || []).filter(m => m && m.x !== lastX));
    setColSizes(newColSizes);
    setTotalWidth(newColSizes.reduce((a, b) => a + b, 0));
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
  };

  const removeRow = () => {
    if (rowSizes.length <= 1) return;
    const lastY = bounds.maxY;
    const newRowSizes = rowSizes.slice(0, -1);
    setModules((modules || []).filter(m => m && m.y !== lastY));
    setRowSizes(newRowSizes);
    setTotalHeight(newRowSizes.reduce((a, b) => a + b, 0));
  };

  const handleBodySizeChange = (dim: 'width' | 'height', index: number, newValue: number) => {
    if (dim === 'width') {
        const currentSizes = [...colSizes];
        currentSizes[index] = newValue;
        setTotalWidth(currentSizes.reduce((a, b) => a + b, 0));
        setColSizes(currentSizes);
    } else {
        const currentSizes = [...rowSizes];
        currentSizes[index] = newValue;
        setTotalHeight(currentSizes.reduce((a, b) => a + b, 0));
        setRowSizes(currentSizes);
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
            if (mod.x > bounds.minX) modW -= (couplingDeduction / 2);
            if (mod.x < bounds.maxX) modW -= (couplingDeduction / 2);
        }
        if (rowSizes.length > 1) {
            if (mod.y > bounds.minY) modH -= (couplingDeduction / 2);
            if (mod.y < bounds.maxY) modH -= (couplingDeduction / 2);
        }
        
        let ox_mm = 0; for (let i = 0; i < modIdxX; i++) ox_mm += colSizes[i] || 0;
        let oy_mm = 0; for (let j = 0; j < modIdxY; j++) oy_mm += rowSizes[j] || 0;
        
        const xOffset = (mod.x > bounds.minX) ? (couplingDeduction / 2) : 0;
        const yOffset = (mod.y > bounds.minY) ? (couplingDeduction / 2) : 0;
        
        const edges = { top: mod.y === bounds.minY, bottom: mod.y === bounds.maxY, left: mod.x === bounds.minX, right: mod.x === bounds.maxX };
        drawDetailedOpening(ctx, startX + (ox_mm + xOffset) * pxPerMm, startY + (oy_mm + yOffset) * pxPerMm, modW * pxPerMm, modH * pxPerMm, recipe, mod.isDVH, aluColor, extras, edges, pxPerMm, mod.transoms, mod.blindPanes, mod.blindPaneIds || {}, blindPanels, aluminum, false);
    });
  }, [totalWidth, totalHeight, modules, colSizes, rowSizes, bounds, extras, colorId, treatments, recipes, couplingDeduction, blindPanels, aluminum]);

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

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-7 shadow-sm space-y-8 h-fit overflow-y-auto max-h-[88vh] custom-scrollbar transition-colors">
            <h3 className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-5 tracking-[0.2em]"><MaximizeIcon size={16} /> Parámetros de Conjunto</h3>
            
            <div className="space-y-3 pt-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><HashIcon size={12} className="text-indigo-500"/> Código de Abertura (V1, P1...)</label>
                <input type="text" className="w-full bg-indigo-50/50 dark:bg-indigo-900/10 h-12 px-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 font-black text-indigo-600 dark:text-indigo-400 text-sm focus:border-indigo-500 transition-all outline-none uppercase" placeholder="Ej: V1-ESTAR" value={itemCode} onChange={e => setItemCode(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><LockIcon size={10} className="text-indigo-400"/> Ancho Total</label>
                    <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono font-black text-slate-800 dark:text-white text-sm focus:border-indigo-500 transition-all outline-none shadow-inner" value={totalWidth} onChange={e => handleTotalChange('width', parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2"><LockIcon size={10} className="text-indigo-400"/> Alto Total</label>
                    <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono font-black text-slate-800 dark:text-white text-sm focus:border-indigo-500 transition-all outline-none shadow-inner" value={totalHeight} onChange={e => handleTotalChange('height', parseInt(e.target.value) || 0)} />
                </div>
            </div>
            
            {liveBreakdown && (
                <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 space-y-4 text-white shadow-2xl animate-in zoom-in-95 duration-300">
                    <h4 className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 mb-2"><DollarSignIcon size={12}/> Cotización Técnica Estimada</h4>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-black uppercase tracking-tighter">1. Aluminio + Pintura</span>
                            <span className="font-mono font-bold">${Math.round(liveBreakdown.aluCost).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-black uppercase tracking-tighter">2. Vidrio / Paneles</span>
                            <span className="font-mono font-bold">${Math.round(liveBreakdown.glassCost).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-black uppercase tracking-tighter">3. Accesorios</span>
                            <span className="font-mono font-bold">${Math.round(liveBreakdown.accCost).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] border-t border-white/10 pt-2 text-indigo-300">
                            <span className="font-black uppercase tracking-tighter">4. Mano de Obra ({config.laborPercentage}%)</span>
                            <span className="font-mono font-bold">${Math.round(liveBreakdown.laborCost).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col pt-3 mt-2 border-t-2 border-indigo-500/30 gap-2">
                            <span className="text-[11px] font-black uppercase tracking-widest text-white leading-none">Total Carpintería</span>
                            <div className="flex justify-between items-baseline gap-2">
                                 <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter italic">Incl. {quantity} Unid.</span>
                                 <span className="text-2xl font-mono font-black text-indigo-400 leading-none tracking-tighter overflow-hidden text-ellipsis whitespace-nowrap">
                                    ${Math.round((liveBreakdown.materialCost + liveBreakdown.laborCost) * quantity).toLocaleString()}
                                 </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-3 pt-5 border-t-2 border-slate-50 dark:border-slate-800">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">Terminación Superficial</label>
                <select className="w-full bg-slate-50 dark:bg-slate-800 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase dark:text-white outline-none focus:border-indigo-500 transition-all shadow-inner" value={colorId} onChange={e => setSelectedColorId(e.target.value)}>
                    <option value="">(SELECCIONE ACABADO)</option>
                    {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
            
            <div className="space-y-5 pt-5 border-t-2 border-indigo-100/50 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/20 p-5 -mx-7">
                <h4 className="text-[10px] font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2 px-1"><SettingsIcon size={14} /> Ingeniería de Extras</h4>
                <div className="px-1 space-y-5">
                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => setExtras({...extras, mosquitero: !extras.mosquitero})}>
                        <div className="flex items-center gap-3">
                            <BugIcon size={16} className={extras.mosquitero ? 'text-indigo-600' : 'text-slate-400'} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${extras.mosquitero ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Mosquitero Perimetral</span>
                        </div>
                        <button className={`w-11 h-6 rounded-full p-1 transition-all ${extras.mosquitero ? 'bg-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${extras.mosquitero ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between group cursor-pointer" onClick={() => setExtras({...extras, tapajuntas: !extras.tapajuntas})}>
                            <div className="flex items-center gap-3">
                                <FrameIcon size={16} className={extras.tapajuntas ? 'text-indigo-600' : 'text-slate-400'} />
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
                <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2 px-1"><Grid3X3Icon size={14} /> Estructura del Conjunto</h4>
                <div className="px-1 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ColumnsIcon size={16} className="text-indigo-600" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Columnas</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-full shadow-inner border border-slate-200 dark:border-slate-700">
                                <button onClick={removeColumn} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all active:scale-90"><MinusIcon size={12} /></button>
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 min-w-[20px] text-center">{colSizes.length}</span>
                                <button onClick={addColumn} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:scale-90"><PlusIcon size={12} /></button>
                            </div>
                        </div>
                        <div className="space-y-2 pl-7 border-l-2 border-indigo-100 dark:border-indigo-900">
                            {colSizes.map((size, idx) => (
                                <div key={idx} className="flex items-center justify-between group bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-xl border border-transparent hover:border-indigo-200 transition-all">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">Cuerpo C{idx+1}</span>
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
                                <RowsIcon size={16} className="text-indigo-600" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Filas</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-full shadow-inner border border-slate-200 dark:border-slate-700">
                                <button onClick={removeRow} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all active:scale-90"><MinusIcon size={12} /></button>
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 min-w-[20px] text-center">{rowSizes.length}</span>
                                <button onClick={addRow} className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-all active:scale-90"><PlusIcon size={12} /></button>
                            </div>
                        </div>
                        <div className="space-y-2 pl-7 border-l-2 border-indigo-100 dark:border-indigo-900">
                            {rowSizes.map((size, idx) => (
                                <div key={idx} className="flex items-center justify-between group bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-xl border border-transparent hover:border-indigo-200 transition-all">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">Cuerpo R{idx+1}</span>
                                    <div className="flex items-center gap-2">
                                        <input type="number" className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl font-mono font-black text-right text-[10px] text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 outline-none shadow-sm transition-all" value={size} onChange={e => handleBodySizeChange('height', idx, parseInt(e.target.value) || 0)} />
                                        <span className="text-[8px] font-black text-slate-300 dark:text-slate-600">mm</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {colSizes.length > 1 || rowSizes.length > 1 ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 pt-2">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Perfil de Acople</label>
                        <select className="w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 h-10 px-3 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 outline-none shadow-sm" value={couplingProfileId} onChange={e => setCouplingProfileId(e.target.value)}>
                            <option value="">(NINGUNO)</option>
                            {aluminum.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                    </div>
                ) : null}
            </div>
            <div className="pt-4">
                <button onClick={addItemToWork} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-[11px] tracking-[0.25em] flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-indigo-700 hover:shadow-indigo-200">
                    <PlusIcon size={18} /> Cargar a Obra
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
                            <button onClick={() => setEditingModuleId(mod.id)} className="p-4 bg-indigo-600 text-white rounded-[1.2rem] shadow-2xl hover:scale-110 active:scale-90 transition-all border-2 border-white/20 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"><SettingsIcon size={18} /> Ingeniería</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {editingModuleId && currentModForEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-md animate-in fade-in transition-all">
            <div className="bg-white dark:bg-slate-900 w-full max-w-7xl rounded-[3rem] p-10 shadow-2xl space-y-8 overflow-hidden max-h-[94vh] border-4 border-white/40 dark:border-slate-800/40 flex flex-col ring-1 ring-slate-900/10 transition-colors">
                <div className="flex justify-between items-center border-b-2 border-slate-50 dark:border-slate-800 pb-7">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200 dark:shadow-none"><LayoutGridIcon size={28} /></div>
                        <div>
                            <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tighter text-2xl leading-none italic">Terminal de Ingeniería</h3>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase mt-2 tracking-[0.3em]">Módulo {currentModForEdit.id.substring(0,8)} - Configuración Maestra</p>
                        </div>
                    </div>
                    <button onClick={() => setEditingModuleId(null)} className="text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-3xl border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-700"><XIcon size={32} /></button>
                </div>

                <div className="grid grid-cols-12 gap-10 flex-1 overflow-hidden">
                    <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 overflow-hidden border-r-2 border-slate-50 dark:border-slate-800 pr-8">
                        <div className="flex flex-col gap-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                            <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><TagIcon size={14}/> Selección de Sistema de Ingeniería</h4>
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Elegir Línea de Perfilería</label>
                                    <select 
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 h-14 px-5 rounded-2xl text-[11px] font-black uppercase dark:text-white outline-none focus:border-indigo-500 transition-all shadow-sm"
                                        value={recipeFilter}
                                        onChange={e => setRecipeFilter(e.target.value)}
                                    >
                                        {uniqueLines.map(line => (
                                            <option key={line} value={line}>{line}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Seleccionar Tipología Específica</label>
                                    <select 
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 h-14 px-5 rounded-2xl text-[11px] font-black uppercase dark:text-white outline-none focus:border-indigo-500 transition-all shadow-sm"
                                        value={currentModForEdit.recipeId}
                                        onChange={e => {
                                            const r = recipes.find(x => x.id === e.target.value);
                                            if (r) updateModule(editingModuleId, { recipeId: r.id, transoms: r.defaultTransoms || [], overriddenAccessories: r.accessories || [] });
                                        }}
                                    >
                                        <option value="">(SELECCIONE TIPOLOGÍA)</option>
                                        {recipes.filter(r => {
                                            const matchesLine = recipeFilter === 'TODOS' || r.line.toUpperCase() === recipeFilter;
                                            return matchesLine;
                                        }).map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative pt-2">
                                    <SearchIcon size={14} className="absolute left-4 top-[65%] -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="BUSQUEDA RÁPIDA POR NOMBRE..." 
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-11 pr-4 py-3 rounded-2xl text-[9px] font-black uppercase outline-none focus:border-indigo-500 transition-all dark:text-white shadow-inner"
                                        value={recipeSearch}
                                        onChange={e => setRecipeSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex-1 bg-slate-50/30 dark:bg-slate-900/20 rounded-[2rem] p-6 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
                            {currentModForEdit.recipeId ? (
                                <>
                                    <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl animate-in zoom-in">
                                        <CheckIcon size={40} />
                                    </div>
                                    <div>
                                        <h5 className="text-[12px] font-black uppercase text-slate-800 dark:text-white tracking-widest">{recipes.find(r => r.id === currentModForEdit.recipeId)?.name}</h5>
                                        <p className="text-[9px] font-bold text-indigo-600 uppercase mt-1 tracking-widest">SISTEMA VALIDADO PARA MÓDULO</p>
                                    </div>
                                </>
                            ) : (
                                <div className="opacity-20 flex flex-col items-center">
                                    <SettingsIcon size={64} className="animate-spin-slow mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Esperando Selección...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-4">
                        <div className="space-y-6">
                            <div className="flex justify-between items-center px-1">
                                <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3"><SplitIcon size={18} className="rotate-90"/> Divisiones y Travesaños</h4>
                                <button onClick={addTransomToModule} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-700 transition-all shadow-lg"><PlusIcon size={14}/> Agregar División</button>
                            </div>
                            <div className="space-y-3">
                                {(currentModForEdit.transoms || []).map((t, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 animate-in slide-in-from-right-2">
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 w-12 italic">TR #{idx+1}</div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-center ml-1">
                                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Altura desde base (mm)</label>
                                                <button onClick={() => {
                                                    const modIdxY = currentModForEdit.y - bounds.minY;
                                                    const modH = rowSizes[modIdxY] || 0;
                                                    const newTransoms = [...(currentModForEdit.transoms || [])];
                                                    newTransoms[idx].height = Math.round(modH / 2);
                                                    updateModule(editingModuleId, { transoms: newTransoms });
                                                }} className="text-[7px] font-black text-indigo-500 uppercase flex items-center gap-1 hover:text-indigo-700 transition-colors"><AlignCenterIcon size={8}/> Centrar</button>
                                            </div>
                                            <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-[10px] font-black text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500" value={t.height} onChange={e => {
                                                const newTransoms = [...(currentModForEdit.transoms || [])];
                                                newTransoms[idx].height = parseInt(e.target.value) || 0;
                                                updateModule(editingModuleId, { transoms: newTransoms });
                                            }} />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter ml-1">Perfil Utilizado</label>
                                            <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase dark:text-slate-200 outline-none" value={t.profileId} onChange={e => {
                                                const newTransoms = [...(currentModForEdit.transoms || [])];
                                                newTransoms[idx].profileId = e.target.value;
                                                updateModule(editingModuleId, { transoms: newTransoms });
                                            }}>{aluminum.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
                                        </div>
                                        <button onClick={() => removeTransomFromModule(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors mt-4"><TrashIcon size={16}/></button>
                                    </div>
                                ))}
                                {(currentModForEdit.transoms || []).length === 0 && <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase text-slate-400 dark:text-slate-600 tracking-widest italic opacity-40">Módulo sin divisiones internas</div>}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3 px-1 border-l-4 border-indigo-600 pl-4"><WindIcon size={18} /> Herrajes del Módulo</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(() => {
                                    const modAccs = (currentModForEdit.overriddenAccessories && currentModForEdit.overriddenAccessories.length > 0)
                                        ? currentModForEdit.overriddenAccessories
                                        : (recipes.find(r => r.id === currentModForEdit.recipeId)?.accessories || []);
                                    
                                    return modAccs.map((ra, idx) => {
                                        const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId);
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase">{acc?.code || 'Cód: ' + ra.accessoryId}</span>
                                                    <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold truncate max-w-[150px]">{acc?.detail || 'Sin detalle técnico'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">x{ra.quantity}</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3 px-1 border-l-4 border-indigo-600 pl-4"><LayersIcon size={18} /> Configuración de Paños y Llenados</h4>
                            <div className="space-y-4">
                                {Array.from({ length: (currentModForEdit.transoms?.length || 0) + 1 }).map((_, paneIdx) => {
                                    const isBlind = (currentModForEdit.blindPanes || []).includes(paneIdx);
                                    const infillType = isBlind ? 'ciego' : (currentModForEdit.isDVH ? 'dvh' : 'vs');
                                    
                                    return (
                                        <div key={paneIdx} className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-6 rounded-[2.5rem] shadow-sm space-y-5 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all ring-1 ring-slate-900/5">
                                            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-700 pb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center font-black text-[10px]">P{paneIdx+1}</div>
                                                    <span className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-[0.2em]">{paneIdx === (currentModForEdit.transoms?.length || 0) ? "PAÑO PRINCIPAL / BASE" : `PAÑO SUPERIOR DIV. ${paneIdx + 1}`}</span>
                                                </div>
                                                <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                    <button onClick={() => {
                                                        const bps = (currentModForEdit.blindPanes || []).filter(i => i !== paneIdx);
                                                        updateModule(editingModuleId, { isDVH: false, blindPanes: bps });
                                                    }} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${infillType === 'vs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'}`}><SquareIcon size={12}/> VS</button>
                                                    <button onClick={() => {
                                                        const bps = (currentModForEdit.blindPanes || []).filter(i => i !== paneIdx);
                                                        updateModule(editingModuleId, { isDVH: true, blindPanes: bps });
                                                    }} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${infillType === 'dvh' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'}`}><ThermometerIcon size={12}/> DVH</button>
                                                    <button onClick={() => {
                                                        const bps = [...(currentModForEdit.blindPanes || [])];
                                                        if (!bps.includes(paneIdx)) updateModule(editingModuleId, { blindPanes: [...bps, paneIdx] });
                                                    }} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${infillType === 'ciego' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'}`}><BoxIcon size={12}/> CIEGO</button>
                                                </div>
                                            </div>

                                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                                {infillType === 'ciego' ? (
                                                    <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                        <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Seleccionar Panel Ciego</label>
                                                        <select className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 h-11 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none shadow-sm focus:border-indigo-500" value={currentModForEdit.blindPaneIds?.[paneIdx] || ''} onChange={e => updateModule(editingModuleId, { blindPaneIds: { ...currentModForEdit.blindPaneIds, [paneIdx]: e.target.value } })}>
                                                            <option value="">(NINGUNO)</option>
                                                            {blindPanels.map(p => <option key={p.id} value={p.id}>{p.code} - {p.detail}</option>)}
                                                        </select>
                                                    </div>
                                                ) : infillType === 'dvh' ? (
                                                    <div className="grid grid-cols-2 gap-4 bg-indigo-50/30 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/50">
                                                        <div className="col-span-2 space-y-2">
                                                            <label className="text-[8px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest px-1">Cámara de Aire</label>
                                                            <select className="w-full bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 h-10 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none shadow-sm" value={currentModForEdit.dvhCameraId || ''} onChange={e => updateModule(editingModuleId, { dvhCameraId: e.target.value })}>
                                                                <option value="">(SELECCIONAR CÁMARA)</option>
                                                                {dvhInputs.filter(i => i.type === 'Cámara').map(c => <option key={c.id} value={c.id}>{c.detail}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[8px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest px-1">Vidrio Exterior</label>
                                                            <select className="w-full bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 h-10 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none shadow-sm" value={currentModForEdit.glassOuterId || ''} onChange={e => updateModule(editingModuleId, { glassOuterId: e.target.value })}>
                                                                {glasses.map(g => <option key={g.id} value={g.id}>{g.detail}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[8px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest px-1">Vidrio Interior</label>
                                                            <select className="w-full bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 h-10 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none shadow-sm" value={currentModForEdit.glassInnerId || ''} onChange={e => updateModule(editingModuleId, { glassInnerId: e.target.value })}>
                                                                {glasses.map(g => <option key={g.id} value={g.id}>{g.detail}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                        <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Vidrio Simple / Espejo</label>
                                                        <select className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 h-11 px-4 rounded-xl text-[10px] font-black uppercase dark:text-white outline-none shadow-sm focus:border-indigo-500" value={currentModForEdit.glassOuterId || ''} onChange={e => updateModule(editingModuleId, { glassOuterId: e.target.value })}>
                                                            {glasses.map(g => <option key={g.id} value={g.id}>{g.detail}</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t-2 border-slate-50 dark:border-slate-800 flex gap-6">
                    <button onClick={() => setEditingModuleId(null)} className="flex-1 bg-slate-900 dark:bg-slate-950 text-white font-black py-6 rounded-[2rem] uppercase text-[12px] tracking-[0.3em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 active:scale-95">
                        <CheckCircleIcon size={22} /> Validar Ingeniería de Módulo
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default QuotingModule;
