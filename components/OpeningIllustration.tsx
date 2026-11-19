import React, { useEffect, useRef } from "react";
import { ProductRecipe, BlindPanel, AluminumProfile } from "../types";
import { drawDetailedOpening, renderAdaptiveTJ, Segment } from "./QuotingModule";

export interface OpeningIllustrationProps {
  recipe?: Partial<ProductRecipe>;
  visualType?: string;
  name?: string;
  width?: number;
  height?: number;
  color?: string; // Color hex o nombre (ej: "#1e293b", "#ffffff")
  infillType?: "vs" | "dvh" | "tablilla";
  tablillaMode?: "completa" | "mitad" | "vidrio";
  blindPanelId?: string;
  withMosquitero?: boolean;
  withTJ?: boolean;
  tjSides?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  transoms?: { height: number; profileId: string }[];
  blindPanes?: number[];
  showDimensions?: boolean;
  className?: string;
  isThumbnail?: boolean;
  allBlindPanels?: BlindPanel[];
  allProfiles?: AluminumProfile[];
  customImageUrl?: string;
}

export const OpeningIllustration: React.FC<OpeningIllustrationProps> = ({
  recipe,
  visualType,
  name,
  width = 1500,
  height = 1100,
  color = "#1e293b",
  infillType = "vs",
  tablillaMode = "vidrio",
  blindPanelId,
  withMosquitero = false,
  withTJ = false,
  tjSides = { top: true, bottom: true, left: true, right: true },
  transoms,
  blindPanes,
  showDimensions = false,
  className = "",
  isThumbnail = false,
  allBlindPanels = [],
  allProfiles = [],
  customImageUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const imgUrl = customImageUrl || recipe?.image;
  const hasCustomPhoto =
    imgUrl &&
    typeof imgUrl === "string" &&
    imgUrl.trim() !== "" &&
    (imgUrl.startsWith("data:image") || imgUrl.startsWith("http"));

  // Resolución interna del canvas
  const canvasW = isThumbnail ? 360 : 640;
  const canvasH = isThumbnail ? 270 : 480;

  useEffect(() => {
    if (hasCustomPhoto) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    const w = Math.max(200, Number(width) || 1500);
    const h = Math.max(200, Number(height) || 1100);

    // Margen para dar espacio al dibujo y al tapajuntas exterior si está activo
    const pad = (isThumbnail ? 20 : 36) + (withTJ ? 12 : 0);
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;

    const pxPerMm = Math.min(availW / w, availH / h);
    const drawW = w * pxPerMm;
    const drawH = h * pxPerMm;
    const startX = (canvasW - drawW) / 2;
    const startY = (canvasH - drawH) / 2;

    let resolvedVt = (visualType || recipe?.visualType || "").trim();

    if (!resolvedVt) {
      const text = `${recipe?.name || name || ""} ${recipe?.type || ""}`.toLowerCase();
      if (text.includes("4 hojas") || text.includes("4h")) {
        resolvedVt = "sliding_4_45";
      } else if (text.includes("3 hojas") || text.includes("3h")) {
        resolvedVt = "sliding_3_45";
      } else if (text.includes("corrediza") || text.includes("sliding")) {
        resolvedVt = "sliding_2_45";
      } else if (text.includes("fijo") || text.includes("fixed") || text.includes("paño")) {
        resolvedVt = "fixed";
      } else if (text.includes("ventiluz")) {
        resolvedVt = "ventiluz";
      } else if (text.includes("banderola")) {
        resolvedVt = "banderola";
      } else if (text.includes("proyectante") || text.includes("desplazable")) {
        resolvedVt = "projecting";
      } else if (text.includes("oscilo")) {
        resolvedVt = "tilt_turn";
      } else if (text.includes("puerta") && (text.includes("doble") || text.includes("2h"))) {
        resolvedVt = "double_swing_door";
      } else if (text.includes("puerta") || text.includes("door")) {
        resolvedVt = "swing_door";
      } else if (text.includes("abrir") || text.includes("batiente") || text.includes("rebatir")) {
        resolvedVt = "swing_v";
      } else {
        resolvedVt = "sliding_2_45";
      }
    }

    const fullRecipe: ProductRecipe = {
      id: recipe?.id || "preview-rec",
      name: recipe?.name || name || "Abertura",
      line: recipe?.line || "Línea Estándar",
      type: recipe?.type || "Ventana",
      visualType: resolvedVt,
      profiles: recipe?.profiles || [],
      accessories: recipe?.accessories || [],
      glassFormulaW: recipe?.glassFormulaW || "",
      glassFormulaH: recipe?.glassFormulaH || "",
      leaves: recipe?.leaves || (resolvedVt.includes("4") ? 4 : resolvedVt.includes("3") ? 3 : 2),
      defaultTransoms: recipe?.defaultTransoms || [],
      transomThickness: recipe?.transomThickness,
    };

    const activeColor = color && color.trim() ? color.trim() : "#1e293b";

    // Calcular configuración de transoms y tablillas (Completa vs Mitad y Mitad vs Vidrio)
    let effectiveTransoms = transoms ? [...transoms] : [...(fullRecipe.defaultTransoms || [])];
    let effectiveBlindPanes: number[] = [];

    if (tablillaMode === "completa" || infillType === "tablilla") {
      // 100% ciega
      effectiveBlindPanes = [0, 1, 2, 3, 4, 5];
    } else if (tablillaMode === "mitad") {
      // Mitad inferior tablilla ciega, mitad superior vidrio
      effectiveBlindPanes = [0];
      // Si no tiene travesaño, agregar uno a mitad de altura
      if (effectiveTransoms.length === 0) {
        const midH = Math.round(h * 0.45); // aprox mitad o altura estándar de antepecho
        effectiveTransoms = [{ height: midH, profileId: fullRecipe.defaultTransomProfileId || "transom_std" }];
      }
    } else if (blindPanes && blindPanes.length > 0) {
      effectiveBlindPanes = blindPanes;
    }

    const blindPaneIds: Record<number, string> = {};
    if (blindPanelId && effectiveBlindPanes.length > 0) {
      effectiveBlindPanes.forEach((idx) => {
        blindPaneIds[idx] = blindPanelId;
      });
    }

    try {
      drawDetailedOpening(
        ctx,
        startX,
        startY,
        drawW,
        drawH,
        fullRecipe,
        infillType === "dvh",
        activeColor,
        {
          mosquitero: withMosquitero,
          tapajuntas: withTJ,
          tapajuntasSides: tjSides,
        },
        pxPerMm,
        effectiveTransoms,
        effectiveBlindPanes,
        blindPaneIds,
        allBlindPanels,
        allProfiles,
        false
      );

      // Dibujar Tapajuntas adaptativo perimetral si está activo
      if (withTJ) {
        const tjSegments: Segment[] = [];
        if (tjSides.top) {
          tjSegments.push({ x1: startX, y1: startY, x2: startX + drawW, y2: startY, side: "top" });
        }
        if (tjSides.bottom) {
          tjSegments.push({ x1: startX, y1: startY + drawH, x2: startX + drawW, y2: startY + drawH, side: "bottom" });
        }
        if (tjSides.left) {
          tjSegments.push({ x1: startX, y1: startY, x2: startX, y2: startY + drawH, side: "left" });
        }
        if (tjSides.right) {
          tjSegments.push({ x1: startX + drawW, y1: startY, x2: startX + drawW, y2: startY + drawH, side: "right" });
        }
        const tjSizePx = Math.max(6, 42 * pxPerMm);
        renderAdaptiveTJ(ctx, tjSegments, tjSizePx, activeColor);
      }
    } catch (err) {
      console.warn("Error drawing detailed opening on canvas:", err);
    }
  }, [
    recipe,
    visualType,
    name,
    width,
    height,
    color,
    infillType,
    tablillaMode,
    blindPanelId,
    withMosquitero,
    withTJ,
    tjSides,
    transoms,
    blindPanes,
    isThumbnail,
    canvasW,
    canvasH,
    hasCustomPhoto,
    allBlindPanels,
    allProfiles,
  ]);

  if (hasCustomPhoto) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
        <img
          src={imgUrl}
          alt={recipe?.name || name || "Abertura"}
          className="w-full h-full object-contain p-2"
        />
        {showDimensions && (
          <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-md font-bold">
            {width} × {height} mm
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="w-full h-full object-contain drop-shadow-md select-none transition-transform duration-200"
      />
      {showDimensions && (
        <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-2.5 py-1 rounded-md font-bold shadow-md">
          {width} × {height} mm
        </div>
      )}
    </div>
  );
};

export function renderOpeningToDataUrl(options: {
  recipe?: Partial<ProductRecipe>;
  visualType?: string;
  name?: string;
  width?: number;
  height?: number;
  color?: string;
  infillType?: "vs" | "dvh" | "tablilla";
  tablillaMode?: "completa" | "mitad" | "vidrio";
  blindPanelId?: string;
  withMosquitero?: boolean;
  withTJ?: boolean;
  tjSides?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  transoms?: { height: number; profileId: string }[];
  blindPanes?: number[];
  allBlindPanels?: BlindPanel[];
  allProfiles?: AluminumProfile[];
  customImageUrl?: string;
  widthPx?: number;
  heightPx?: number;
}): string | undefined {
  const {
    recipe,
    visualType,
    name,
    width = 1500,
    height = 1100,
    color = "#1e293b",
    infillType = "vs",
    tablillaMode = "vidrio",
    blindPanelId,
    withMosquitero = false,
    withTJ = false,
    tjSides = { top: true, bottom: true, left: true, right: true },
    transoms,
    blindPanes,
    allBlindPanels = [],
    allProfiles = [],
    customImageUrl,
    widthPx = 500,
    heightPx = 380,
  } = options;

  const imgUrl = customImageUrl || recipe?.image;
  if (
    imgUrl &&
    typeof imgUrl === "string" &&
    imgUrl.trim() !== "" &&
    (imgUrl.startsWith("data:image") || imgUrl.startsWith("http"))
  ) {
    return imgUrl;
  }

  if (typeof document === "undefined") return undefined;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    // Fondo blanco nítido para documento impreso / PDF
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);

    const w = Math.max(200, Number(width) || 1500);
    const h = Math.max(200, Number(height) || 1100);

    const pad = 24 + (withTJ ? 12 : 0);
    const availW = widthPx - pad * 2;
    const availH = heightPx - pad * 2;

    const pxPerMm = Math.min(availW / w, availH / h);
    const drawW = w * pxPerMm;
    const drawH = h * pxPerMm;
    const startX = (widthPx - drawW) / 2;
    const startY = (heightPx - drawH) / 2;

    let resolvedVt = (visualType || recipe?.visualType || "").trim();
    if (!resolvedVt) {
      const text = `${recipe?.name || name || ""} ${recipe?.type || ""}`.toLowerCase();
      if (text.includes("4 hojas") || text.includes("4h")) {
        resolvedVt = "sliding_4_45";
      } else if (text.includes("3 hojas") || text.includes("3h")) {
        resolvedVt = "sliding_3_45";
      } else if (text.includes("corrediza") || text.includes("sliding")) {
        resolvedVt = "sliding_2_45";
      } else if (text.includes("fijo") || text.includes("fixed") || text.includes("paño")) {
        resolvedVt = "fixed";
      } else if (text.includes("ventiluz")) {
        resolvedVt = "ventiluz";
      } else if (text.includes("banderola")) {
        resolvedVt = "banderola";
      } else if (text.includes("proyectante") || text.includes("desplazable")) {
        resolvedVt = "projecting";
      } else if (text.includes("oscilo")) {
        resolvedVt = "tilt_turn";
      } else if (text.includes("puerta") && (text.includes("doble") || text.includes("2h"))) {
        resolvedVt = "double_swing_door";
      } else if (text.includes("puerta") || text.includes("door")) {
        resolvedVt = "swing_door";
      } else if (text.includes("abrir") || text.includes("batiente") || text.includes("rebatir")) {
        resolvedVt = "swing_v";
      } else {
        resolvedVt = "sliding_2_45";
      }
    }

    const fullRecipe: ProductRecipe = {
      id: recipe?.id || "preview-rec",
      name: recipe?.name || name || "Abertura",
      line: recipe?.line || "Línea Estándar",
      type: recipe?.type || "Ventana",
      visualType: resolvedVt,
      profiles: recipe?.profiles || [],
      accessories: recipe?.accessories || [],
      glassFormulaW: recipe?.glassFormulaW || "",
      glassFormulaH: recipe?.glassFormulaH || "",
      leaves: recipe?.leaves || (resolvedVt.includes("4") ? 4 : resolvedVt.includes("3") ? 3 : 2),
      defaultTransoms: recipe?.defaultTransoms || [],
      transomThickness: recipe?.transomThickness,
    };

    const activeColor = color && color.trim() ? color.trim() : "#1e293b";

    let effectiveTransoms = transoms ? [...transoms] : [...(fullRecipe.defaultTransoms || [])];
    let effectiveBlindPanes: number[] = [];

    if (tablillaMode === "completa" || infillType === "tablilla") {
      effectiveBlindPanes = [0, 1, 2, 3, 4, 5];
    } else if (tablillaMode === "mitad") {
      effectiveBlindPanes = [0];
      if (effectiveTransoms.length === 0) {
        const midH = Math.round(h * 0.45);
        effectiveTransoms = [{ height: midH, profileId: fullRecipe.defaultTransomProfileId || "transom_std" }];
      }
    } else if (blindPanes && blindPanes.length > 0) {
      effectiveBlindPanes = blindPanes;
    }

    const blindPaneIds: Record<number, string> = {};
    if (blindPanelId && effectiveBlindPanes.length > 0) {
      effectiveBlindPanes.forEach((idx) => {
        blindPaneIds[idx] = blindPanelId;
      });
    }

    drawDetailedOpening(
      ctx,
      startX,
      startY,
      drawW,
      drawH,
      fullRecipe,
      infillType === "dvh",
      activeColor,
      {
        mosquitero: withMosquitero,
        tapajuntas: withTJ,
        tapajuntasSides: tjSides,
      },
      pxPerMm,
      effectiveTransoms,
      effectiveBlindPanes,
      blindPaneIds,
      allBlindPanels,
      allProfiles,
      false
    );

    if (withTJ) {
      const tjSegments: Segment[] = [];
      if (tjSides.top) {
        tjSegments.push({ x1: startX, y1: startY, x2: startX + drawW, y2: startY, side: "top" });
      }
      if (tjSides.bottom) {
        tjSegments.push({ x1: startX, y1: startY + drawH, x2: startX + drawW, y2: startY + drawH, side: "bottom" });
      }
      if (tjSides.left) {
        tjSegments.push({ x1: startX, y1: startY, x2: startX, y2: startY + drawH, side: "left" });
      }
      if (tjSides.right) {
        tjSegments.push({ x1: startX + drawW, y1: startY, x2: startX + drawW, y2: startY + drawH, side: "right" });
      }
      const tjSizePx = Math.max(6, 42 * pxPerMm);
      renderAdaptiveTJ(ctx, tjSegments, tjSizePx, activeColor);
    }

    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (err) {
    console.warn("Error rendering opening to Data URL:", err);
    return undefined;
  }
}

export default OpeningIllustration;
