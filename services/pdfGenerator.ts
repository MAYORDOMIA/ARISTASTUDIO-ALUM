import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Quote,
  ProductRecipe,
  GlobalConfig,
  AluminumProfile,
  Glass,
  Accessory,
  DVHInput,
  QuoteItem,
  Treatment,
  BlindPanel,
} from "../types";
import { evaluateFormula, calculateModuleDimensions } from "./calculator";
import { filterDVHProfiles, calculateSalesGrams, getDVHExtras } from "./dvhHelper";

const TYPE_COLORS: Record<string, [number, number, number]> = {
  Ventana: [79, 70, 229],
  Puerta: [220, 38, 38],
  "Paño Fijo": [5, 150, 105],
  Default: [79, 70, 229],
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

const drawGeometricPiece = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  start: string,
  end: string,
) => {
  const sOffset = start === "45" ? h * 0.5 : 0;
  const eOffset = end === "45" ? h * 0.5 : 0;
  const ax = x + sOffset,
    ay = y;
  const bx = x + w - eOffset,
    by = y;
  const cx = x,
    cy = y + h;
  const dx = x + w,
    dy = y + h;
  doc.triangle(ax, ay, bx, by, cx, cy, "F");
  doc.triangle(bx, by, cx, cy, dx, dy, "F");
};

const getModuleGlassPanes = (
  item: QuoteItem,
  mod: any,
  recipe: ProductRecipe,
  aluminum: AluminumProfile[],
): { w: number; h: number; isBlind: boolean }[] => {
  const { isManualDim, colRatios, rowRatios, couplingDeduction } =
    item.composition;
  const validModules = (item.composition.modules || []).filter(
    (m) => m && typeof m.x === "number" && typeof m.y === "number",
  );
  if (validModules.length === 0) return [];
  const minX = Math.min(...validModules.map((m) => m.x));
  const minY = Math.min(...validModules.map((m) => m.y));
  const maxX = Math.max(...validModules.map((m) => m.x));
  const maxY = Math.max(...validModules.map((m) => m.y));
  const cProfile = item.couplingProfileId
    ? aluminum.find((p) => p.id === item.couplingProfileId)
    : null;
  const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);

  const { modW, modH } = calculateModuleDimensions(
    mod,
    colRatios,
    rowRatios,
    minX,
    maxX,
    minY,
    maxY,
    realDeduction,
    isManualDim,
  );

  const adjustedW = modW - (recipe.glassDeductionW || 0);
  const adjustedH = modH - (recipe.glassDeductionH || 0);
  const visualType = (recipe.visualType || "").toLowerCase();

  let numLeaves = recipe.leaves || 1;
  if (!recipe.leaves) {
    if (
      visualType.includes("sliding_3") ||
      visualType.includes("corrediza_3") ||
      visualType.includes("triple") ||
      visualType.includes("3h")
    )
      numLeaves = 3;
    else if (
      visualType.includes("sliding_4") ||
      visualType.includes("corrediza_4") ||
      visualType.includes("four") ||
      visualType.includes("4h")
    )
      numLeaves = 4;
    else if (visualType.includes("sliding") || visualType.includes("corrediza"))
      numLeaves = 2;
    else if (
      visualType.includes("double") ||
      visualType.includes("doble") ||
      visualType.includes("2h")
    )
      numLeaves = 2;
  }

  const getFormulaW = () =>
    mod.isDVH && recipe.dvhFormulaW
      ? recipe.dvhFormulaW
      : recipe.glassFormulaW || "W";
  const getFormulaH = () =>
    mod.isDVH && recipe.dvhFormulaH
      ? recipe.dvhFormulaH
      : recipe.glassFormulaH || "H";

  const getPanesForLeafWidth = (lw: number) => {
    const gW = evaluateFormula(getFormulaW(), lw, adjustedH);
    const gH = evaluateFormula(getFormulaH(), adjustedW, adjustedH);
    const leafPanes: { w: number; h: number; isBlind: boolean }[] = [];

    const transomGlassDeduction =
      mod.isDVH && recipe.dvhTransomGlassDeduction !== undefined
        ? Number(recipe.dvhTransomGlassDeduction)
        : Number(recipe.transomGlassDeduction || 0);

    if (!mod.transoms || mod.transoms.length === 0) {
      leafPanes.push({
        w: gW,
        h: gH,
        isBlind: mod.blindPanes?.includes(0) || false,
      });
    } else {
      const sorted = [...mod.transoms].sort((a, b) => a.height - b.height);
      let lastY = 0;
      sorted.forEach((t, idx) => {
        const trProf = aluminum.find((p) => p.id === t.profileId);
        const transomThickness = Number(
          trProf?.thickness || recipe.transomThickness || 40,
        );
        let ph =
          idx === 0
            ? Number(t.height) -
              transomThickness / 2 -
              Number(recipe.glassDeductionH || 0) / (mod.transoms!.length + 1) -
              transomGlassDeduction
            : Number(t.height) -
              lastY -
              transomThickness -
              transomGlassDeduction;
        leafPanes.push({
          w: gW,
          h: ph,
          isBlind: mod.blindPanes?.includes(idx) || false,
        });
        lastY = Number(t.height);
      });
      const lastTrProf = aluminum.find(
        (p) => p.id === sorted[sorted.length - 1].profileId,
      );
      const lastTransomThickness = Number(
        lastTrProf?.thickness || recipe.transomThickness || 40,
      );
      const lastPh =
        modH -
        lastY -
        (lastTrProf ? lastTransomThickness / 2 : 0) -
        Number(recipe.glassDeductionH || 0) / (mod.transoms.length + 1) -
        transomGlassDeduction;
      leafPanes.push({
        w: gW,
        h: lastPh,
        isBlind: mod.blindPanes?.includes(sorted.length) || false,
      });
    }
    return leafPanes;
  };

  let allPanes: { w: number; h: number; isBlind: boolean }[] = [];
  if (mod.leafWidths && mod.leafWidths.length === numLeaves) {
    // Asymmetric leaves
    mod.leafWidths.forEach((lw) => {
      allPanes = allPanes.concat(getPanesForLeafWidth(lw));
    });
  } else {
    // Symmetric leaves
    const leafBaseW =
      visualType.includes("sliding") || numLeaves > 1
        ? adjustedW / numLeaves
        : adjustedW;
    for (let i = 0; i < numLeaves; i++) {
      allPanes = allPanes.concat(getPanesForLeafWidth(leafBaseW));
    }
  }
  return allPanes;
};

export const generateBarOptimizationPDF = (
  quote: Quote,
  recipes: ProductRecipe[],
  aluminum: AluminumProfile[],
  config: GlobalConfig,
  blindPanels: BlindPanel[],
  glasses: Glass[],
  dvhInputs: DVHInput[],
) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OPTIMIZACIÓN TÉCNICA DE CORTE DE BARRAS", 15, 12);
  doc.setFontSize(8);
  doc.text(
    `OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`,
    15,
    18,
  );
  const cutsByProfile = new Map<
    string,
    {
      len: number;
      type: string;
      cutStart: string;
      cutEnd: string;
      label: string;
    }[]
  >();
  quote.items.forEach((item, posIdx) => {
    const { isManualDim, colRatios, rowRatios, couplingDeduction } =
      item.composition;
    const itemCode = item.itemCode || `POS#${posIdx + 1}`;
    const isSet = item.composition.modules.length > 1;
    const cProfile = item.couplingProfileId
      ? aluminum.find((p) => p.id === item.couplingProfileId)
      : null;
    const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
    const validModules = item.composition.modules.filter(
      (m) => m && typeof m.x === "number" && typeof m.y === "number",
    );
    if (validModules.length === 0) return;
    const minX = Math.min(...validModules.map((m) => m.x));
    const minY = Math.min(...validModules.map((m) => m.y));
    const maxX = Math.max(...validModules.map((m) => m.x));
    const maxY = Math.max(...validModules.map((m) => m.y));

    validModules.forEach((mod) => {
      const recipe = recipes.find((r) => r.id === mod.recipeId);
      if (!recipe) return;
      const { modW, modH } = calculateModuleDimensions(
        mod,
        colRatios,
        rowRatios,
        minX,
        maxX,
        minY,
        maxY,
        realDeduction,
        isManualDim,
      );

      const isTrapezoid =
        (recipe.type === "Paño Fijo" ||
         recipe.name.toLowerCase().includes("paño fijo") ||
         recipe.name.toLowerCase().includes("pf") ||
         recipe.id === "vidrio_solo" ||
         recipe.name.toLowerCase().includes("vidrio")) &&
        mod.leftHeight !== undefined &&
        mod.rightHeight !== undefined &&
        mod.leftHeight > 0 &&
        mod.rightHeight > 0 &&
        mod.leftHeight !== mod.rightHeight;

      const inclinedW = isTrapezoid
        ? Math.sqrt(Math.pow(modW, 2) + Math.pow(mod.rightHeight! - mod.leftHeight!, 2))
        : modW;

      const visualType = (recipe.visualType || "").toLowerCase();
      let numLeaves = recipe.leaves || 1;
      if (!recipe.leaves) {
        if (
          visualType.includes("sliding_3") ||
          visualType.includes("corrediza_3") ||
          visualType.includes("triple") ||
          visualType.includes("3h")
        )
          numLeaves = 3;
        else if (
          visualType.includes("sliding_4") ||
          visualType.includes("corrediza_4") ||
          visualType.includes("four") ||
          visualType.includes("4h")
        )
          numLeaves = 4;
        else if (
          visualType.includes("sliding") ||
          visualType.includes("corrediza")
        )
          numLeaves = 2;
        else if (
          visualType.includes("double") ||
          visualType.includes("doble") ||
          visualType.includes("2h")
        )
          numLeaves = 2;
      }

      const transomTemplate = (recipe.profiles || []).find(
        (rp) =>
          rp.role === "Travesaño" ||
          (rp.role && rp.role.toLowerCase().includes("trave")),
      );
      const recipeTransomFormula =
        transomTemplate?.formula || recipe.transomFormula || "W";
      const recipeTransomQty = transomTemplate?.quantity || 1;

      // Cálculo de espesor de vidrio para selección dinámica
      const gOuter = glasses.find((g) => g.id === mod.glassOuterId);
      const gInner = mod.isDVH
        ? glasses.find((g) => g.id === mod.glassInnerId)
        : null;
      const dvhCam = mod.isDVH
        ? dvhInputs.find((i) => i.id === mod.dvhCameraId)
        : null;
      let camThick = 12;
      if (dvhCam) {
        camThick = dvhCam.thickness || 12;
        if (!dvhCam.thickness) {
          const m = dvhCam.detail.match(/(\d+)\s*mm/i);
          if (m) camThick = parseInt(m[1]);
        }
      }
      const getThick = (g: any) => {
        if (!g) return 0;
        if (g.thickness) return g.thickness;
        const m = g.detail.match(/(\d+)\s*mm/i);
        if (m) return parseInt(m[1]);
        const mc = g.code.match(/(\d+)\s*mm/i);
        if (mc) return parseInt(mc[1]);
        return 4;
      };
      const totalGlassThick =
        getThick(gOuter) + (mod.isDVH ? getThick(gInner) + camThick : 0);
      const beadStyle = item.glazingBeadStyle || "Recto";

      const usedGlazingBeadIds = new Set<string>();
      const filteredProfiles1 = filterDVHProfiles(recipe.profiles || [], mod.isDVH, mod.dvhCameraId, dvhInputs, aluminum) as any[];

      let totalPlainHorizontalMarcoQty = 0;
      filteredProfiles1.forEach((rp) => {
        if (rp.alternative && rp.alternative !== (mod.leafAlternative || "A"))
          return;
        const rLower = (rp.role || "").toLowerCase();
        const fUpper = (rp.formula || "").toUpperCase();
        const isPlainHorizontalMarco =
          (rLower.includes("marco") || rLower.includes("marcos")) &&
          fUpper.includes("W") &&
          !fUpper.includes("H") &&
          !rLower.includes("cabe") &&
          !rLower.includes("dintel") &&
          !rLower.includes("superior") &&
          !rLower.includes("sup") &&
          !rLower.includes("umbra") &&
          !rLower.includes("inferior") &&
          !rLower.includes("inf") &&
          !rLower.includes("zoc") &&
          !rLower.includes("zócalo") &&
          !rLower.includes("zocalo");
        if (isPlainHorizontalMarco) {
          totalPlainHorizontalMarcoQty += Number(rp.quantity || 0);
        }
      });

      let processedPlainHorizontalMarcoQty = 0;

      filteredProfiles1.forEach((rp) => {
        if (rp.alternative && rp.alternative !== (mod.leafAlternative || "A"))
          return;
        let pDef = aluminum.find((a) => a.id === rp.profileId);

        // Lógica de Contravidrio Dinámico
        if (
          rp.glazingBeadOptions &&
          Array.isArray(rp.glazingBeadOptions) &&
          rp.glazingBeadOptions.length > 0
        ) {
          const candidates = aluminum.filter((p) =>
            (rp.glazingBeadOptions || []).includes(p.id),
          );
          let styleMatches = candidates.filter(
            (p) => p.glazingBeadStyle === beadStyle,
          );
          if (styleMatches.length === 0) styleMatches = candidates;

          let bestMatch = styleMatches.find((p) => {
            const min = p.minGlassThickness || 0;
            const max = p.maxGlassThickness || 100;
            return totalGlassThick >= min && totalGlassThick <= max;
          });

          if (!bestMatch) {
            bestMatch = candidates.find((p) => {
              const min = p.minGlassThickness || 0;
              const max = p.maxGlassThickness || 100;
              return totalGlassThick >= min && totalGlassThick <= max;
            });
          }

          if (bestMatch) pDef = bestMatch;
        }

        if (!pDef) return;
        const role = rp.role?.toLowerCase() || "";
        if (role === "contravidrio") usedGlazingBeadIds.add(pDef.id);
        if (role === "travesaño") return;

        // Exclusión centralizada de Tapajuntas en el despiece de receta
        const isTJ =
          role.includes("tapa") ||
          String(pDef.code || "")
            .toUpperCase()
            .includes("TJ") ||
          pDef.id === recipe.defaultTapajuntasProfileId;
        if (isTJ) return;

        const isMosq =
          role.includes("mosquitero") || pDef.id === recipe.mosquiteroProfileId;
        if (isMosq && !item.extras.mosquitero) return;

        if (item.quotingMode === "Solo Marcos") {
           if (role.includes("hoja") || role.includes("contravidrio") || isMosq) return;
        } else if (item.quotingMode === "Solo Hojas") {
           if (role.includes("marco") || role.includes("zócalo") || role.includes("zocalo") || role.includes("acople") || role.includes("columna") || role.includes("viga") || role.includes("encuentro") || role.includes("travesaño") || role.includes("travesano")) return;
        }

        const isLeafWidthDependent =
          role.includes("hoja") ||
          role.includes("zócalo") ||
          role.includes("encuentro") ||
          role.includes("contravidrio");

        if (isTrapezoid) {
          const isContravidrio = role === "contravidrio" || role.includes("contra");
          const isVertical =
            role.includes("jamba") ||
            role.includes("lateral") ||
            role.includes("parante") ||
            role.includes("mocheta") ||
            (!role.includes("cabe") && !role.includes("dintel") && !role.includes("umbra") && !role.includes("zoc") && rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W"));

          const isTopHorizontal =
            role.includes("dintel") ||
            role.includes("cabezal") ||
            role.includes("superior");

          if (isContravidrio) {
            if (rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W")) {
              const qtyLeft = Math.ceil(rp.quantity / 2);
              const qtyRight = Math.floor(rp.quantity / 2);
              const cutLeft = evaluateFormula(rp.formula, modW, mod.leftHeight!);
              const cutRight = evaluateFormula(rp.formula, modW, mod.rightHeight!);
              const list = cutsByProfile.get(pDef!.id) || [];
              if (cutLeft > 0) {
                for (let k = 0; k < qtyLeft * item.quantity; k++) {
                  list.push({
                    len: cutLeft,
                    type: recipe.type,
                    cutStart: rp.cutStart || "90",
                    cutEnd: rp.cutEnd || "90",
                    label: itemCode,
                  });
                }
              }
              if (cutRight > 0) {
                for (let k = 0; k < qtyRight * item.quantity; k++) {
                  list.push({
                    len: cutRight,
                    type: recipe.type,
                    cutStart: rp.cutStart || "90",
                    cutEnd: rp.cutEnd || "90",
                    label: itemCode,
                  });
                }
              }
              cutsByProfile.set(pDef!.id, list);
            } else {
              const qtyBottom = Math.ceil(rp.quantity / 2);
              const qtyTop = Math.floor(rp.quantity / 2);
              const cutBottom = evaluateFormula(rp.formula, modW, modH);
              const cutTop = evaluateFormula(rp.formula, inclinedW, modH);
              const list = cutsByProfile.get(pDef!.id) || [];
              if (cutBottom > 0) {
                for (let k = 0; k < qtyBottom * item.quantity; k++) {
                  list.push({
                    len: cutBottom,
                    type: recipe.type,
                    cutStart: rp.cutStart || "90",
                    cutEnd: rp.cutEnd || "90",
                    label: itemCode,
                  });
                }
              }
              if (cutTop > 0) {
                for (let k = 0; k < qtyTop * item.quantity; k++) {
                  list.push({
                    len: cutTop,
                    type: recipe.type,
                    cutStart: rp.cutStart || "45",
                    cutEnd: rp.cutEnd || "45",
                    label: itemCode,
                  });
                }
              }
              cutsByProfile.set(pDef!.id, list);
            }
          } else if (isVertical) {
            const qtyLeft = Math.ceil(rp.quantity / 2);
            const qtyRight = Math.floor(rp.quantity / 2);
            const cutLeft = evaluateFormula(rp.formula, modW, mod.leftHeight!);
            const cutRight = evaluateFormula(rp.formula, modW, mod.rightHeight!);
            const list = cutsByProfile.get(pDef!.id) || [];
            if (cutLeft > 0) {
              for (let k = 0; k < qtyLeft * item.quantity; k++) {
                list.push({
                  len: cutLeft,
                  type: recipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
            }
            if (cutRight > 0) {
              for (let k = 0; k < qtyRight * item.quantity; k++) {
                list.push({
                  len: cutRight,
                  type: recipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
            }
            cutsByProfile.set(pDef!.id, list);
          } else if (isTopHorizontal) {
            const cutLen = evaluateFormula(rp.formula, inclinedW, modH);
            if (cutLen > 0) {
              const list = cutsByProfile.get(pDef!.id) || [];
              for (let k = 0; k < rp.quantity * item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: recipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
              cutsByProfile.set(pDef!.id, list);
            }
          } else if (
            (role.includes("marco") || role.includes("marcos")) &&
            rp.formula.toUpperCase().includes("W") &&
            !rp.formula.toUpperCase().includes("H") &&
            !role.includes("cabe") &&
            !role.includes("dintel") &&
            !role.includes("superior") &&
            !role.includes("sup") &&
            !role.includes("umbra") &&
            !role.includes("inferior") &&
            !role.includes("inf") &&
            !role.includes("zoc") &&
            !role.includes("zócalo") &&
            !role.includes("zocalo")
          ) {
            const qty = Number(rp.quantity || 0);
            let qtyBottom = 0;
            let qtyTop = 0;
            for (let k = 0; k < qty; k++) {
              const globalIdx = processedPlainHorizontalMarcoQty + k;
              if (globalIdx < Math.ceil(totalPlainHorizontalMarcoQty / 2)) {
                qtyBottom++;
              } else {
                qtyTop++;
              }
            }
            processedPlainHorizontalMarcoQty += qty;

            const cutBottom = evaluateFormula(rp.formula, modW, modH);
            const cutTop = evaluateFormula(rp.formula, inclinedW, modH);
            const list = cutsByProfile.get(pDef!.id) || [];

            if (cutBottom > 0 && qtyBottom > 0) {
              for (let k = 0; k < qtyBottom * item.quantity; k++) {
                list.push({
                  len: cutBottom,
                  type: recipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
            }
            if (cutTop > 0 && qtyTop > 0) {
              for (let k = 0; k < qtyTop * item.quantity; k++) {
                list.push({
                  len: cutTop,
                  type: recipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
            }
            cutsByProfile.set(pDef!.id, list);
          } else {
            const cutLen = evaluateFormula(rp.formula, modW, modH);
            if (cutLen > 0) {
              const list = cutsByProfile.get(pDef!.id) || [];
              for (let k = 0; k < rp.quantity * item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: recipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
              cutsByProfile.set(pDef!.id, list);
            }
          }
        } else {
          if (
            isLeafWidthDependent &&
            mod.leafWidths &&
            mod.leafWidths.length === numLeaves &&
            rp.quantity % numLeaves === 0
          ) {
            const piecesPerLeaf = rp.quantity / numLeaves;
            mod.leafWidths.forEach((lw) => {
              const effectiveW = lw * numLeaves;
              const cutLen = evaluateFormula(rp.formula, effectiveW, modH);
              if (cutLen > 0) {
                const list = cutsByProfile.get(pDef!.id) || [];
                for (let k = 0; k < piecesPerLeaf * item.quantity; k++) {
                  list.push({
                    len: cutLen,
                    type: recipe.type,
                    cutStart: rp.cutStart || "90",
                    cutEnd: rp.cutEnd || "90",
                    label: itemCode,
                  });
                }
                cutsByProfile.set(pDef!.id, list);
              }
            });
          } else {
            const cutLen = evaluateFormula(rp.formula, modW, modH);
            if (cutLen > 0) {
              const list = cutsByProfile.get(pDef.id) || [];
              for (let k = 0; k < rp.quantity * item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: recipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
              cutsByProfile.set(pDef.id, list);
            }
          }
        }
      });
      
      // Calculate independent mosquito recipe profiles
      if (item.extras.mosquitero && item.extras.mosquiteroRecipeId) {
        const mosqRecipe = recipes.find(r => r.id === item.extras.mosquiteroRecipeId);
        if (mosqRecipe) {
          let mosqW = modW;
          if (visualType.includes("sliding") || numLeaves > 1) {
            mosqW = modW / Math.max(1, numLeaves);
          }
          mosqRecipe.profiles.forEach(rp => {
            const pDef = aluminum.find(a => a.id === rp.profileId);
            if (!pDef) return;
            const cutLen = evaluateFormula(rp.formula, mosqW, modH);
            if (cutLen > 0) {
              const list = cutsByProfile.get(pDef.id) || [];
              for (let k = 0; k < rp.quantity * item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: mosqRecipe.type,
                  cutStart: rp.cutStart || "90",
                  cutEnd: rp.cutEnd || "90",
                  label: itemCode,
                });
              }
              cutsByProfile.set(pDef.id, list);
            }
          });
        }
      }

      if (mod.transoms && mod.transoms.length > 0) {
        mod.transoms.forEach((t) => {
          const trProf = aluminum.find((p) => p.id === t.profileId);
          if (trProf) {
            const f = t.formula || recipeTransomFormula;
            const cutLen = evaluateFormula(f, modW, modH);
            if (cutLen > 0) {
              const list = cutsByProfile.get(trProf.id) || [];
              for (let k = 0; k < recipeTransomQty * item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: "Travesaño",
                  cutStart: "90",
                  cutEnd: "90",
                  label: itemCode,
                });
              }
              cutsByProfile.set(trProf.id, list);
            }

            // 2 Contravidrios extra del mismo largo que el travesaño por cada tipo de contravidrio en la receta
            usedGlazingBeadIds.forEach((gbId) => {
              const list = cutsByProfile.get(gbId) || [];
              for (let k = 0; k < 2 * item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: "Contravidrio Extra Travesaño",
                  cutStart: "45",
                  cutEnd: "45",
                  label: itemCode,
                });
              }
              cutsByProfile.set(gbId, list);
            });
          }
        });
      }

      if (mod.isDVH && mod.dvhCameraId) {
         const { profiles: rawDvhProfs } = getDVHExtras(recipes, mod.isDVH);
         const dvhProfs = filterDVHProfiles(rawDvhProfs, mod.isDVH, mod.dvhCameraId, dvhInputs, aluminum) as any[];
         const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
         panes.forEach(pane => {
             if (pane.isBlind) return;
             dvhProfs.forEach(rp => {
                 let pDef = aluminum.find((a) => a.id === rp.profileId);
                 if (!pDef) return;
                 let length = evaluateFormula(rp.formula, pane.w, pane.h);
                 const list = cutsByProfile.get(pDef.id) || [];
                 for (let k = 0; k < item.quantity * Number(rp.quantity || 1); k++) {
                     list.push({
                         len: length,
                         type: pDef.detail,
                         cutStart: rp.cutStart?.toString() || "90",
                         cutEnd: rp.cutEnd?.toString() || "90",
                         label: itemCode,
                     });
                 }
                 cutsByProfile.set(pDef.id, list);
             });
         });
      }

      const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
      panes.forEach((p, pIdx) => {
        if (p.isBlind) {
          const bpId = mod.blindPaneIds?.[pIdx];
          const bp = blindPanels.find((x) => x.id === bpId);
          const slatId = mod.slatProfileIds?.[pIdx];
          if (bp && bp.unit === "ml" && !slatId) {
            const list = cutsByProfile.get(bp.id) || [];
            for (let k = 0; k < item.quantity; k++) {
              list.push({
                len: p.w,
                type: "Panel Lineal",
                cutStart: "90",
                cutEnd: "90",
                label: itemCode,
              });
            }
            cutsByProfile.set(bp.id, list);
          }
          if (slatId) {
            const slatProf = aluminum.find((a) => a.id === slatId);
            if (slatProf && slatProf.thickness > 0) {
              const numSlats = Math.ceil(p.h / slatProf.thickness);
              const list = cutsByProfile.get(slatProf.id) || [];
              for (let k = 0; k < numSlats * item.quantity; k++) {
                list.push({
                  len: p.w,
                  type: "Tablilla",
                  cutStart: "90",
                  cutEnd: "90",
                  label: itemCode,
                });
              }
              cutsByProfile.set(slatProf.id, list);
            }
          }
        }
      });

      // Lógica de Pasamanos (Baranda)
      if (mod.handrailProfileId) {
        const hrProfile = aluminum.find((p) => p.id === mod.handrailProfileId);
        if (hrProfile) {
          const list = cutsByProfile.get(hrProfile.id) || [];
          // El largo del pasamano es el ancho del módulo
          for (let k = 0; k < item.quantity; k++) {
            list.push({
              len: modW,
              type: "Pasamano",
              cutStart: "90",
              cutEnd: "90",
              label: itemCode,
            });
          }
          cutsByProfile.set(hrProfile.id, list);
        }
      }
    });

    // Lógica Tapajuntas Unificada: Solo si está activado
    if (item.extras.tapajuntas) {
      const firstRecipe = recipes.find(
        (r) => r.id === validModules[0].recipeId,
      );
      let tjProfile = aluminum.find(
        (p) => p.id === firstRecipe?.defaultTapajuntasProfileId,
      );

      // Fallback: Si no hay default configurado, buscar el primer perfil con rol Tapajuntas en la receta
      if (!tjProfile && firstRecipe) {
        const tjRef = firstRecipe.profiles.find((p) => p.role === "Tapajuntas");
        if (tjRef) tjProfile = aluminum.find((p) => p.id === tjRef.profileId);
      }

      // Fallback global
      if (!tjProfile) {
        tjProfile = aluminum.find(
          (p) =>
            p.code.toUpperCase().includes("TJ") ||
            p.detail.toLowerCase().includes("tapajunta"),
        );
      }

      if (tjProfile) {
        const list = cutsByProfile.get(tjProfile.id) || [];
        const tjThick = Number(tjProfile.thickness || 30);
        const { top, bottom, left, right } = item.extras.tapajuntasSides;

        const firstTrapMod = validModules.find((m) => {
          const r = recipes.find((x) => x.id === m.recipeId);
          if (!r) return false;
          return (
            (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
            m.leftHeight !== undefined &&
            m.rightHeight !== undefined &&
            m.leftHeight > 0 &&
            m.rightHeight > 0 &&
            m.leftHeight !== m.rightHeight
          );
        });

        let lh = item.height;
        let rh = item.height;
        let isTrap = false;

        if (isSet) {
          const minX = Math.min(...validModules.map((m) => m.x));
          const minY = Math.min(...validModules.map((m) => m.y));
          const maxX = Math.max(...validModules.map((m) => m.x));
          const maxY = Math.max(...validModules.map((m) => m.y));
          const colRatios = item.composition.colRatios || [];
          const rowRatios = item.composition.rowRatios || [];
          const isManualDim = item.composition.isManualDim;

          // LHS total height
          let lhsSum = 0;
          let lhsCouplings = 0;
          for (let y = minY; y <= maxY; y++) {
            const mod = validModules.find((m) => m.x === minX && m.y === y);
            if (mod) {
              const r = recipes.find((x) => x.id === mod.recipeId);
              const { modH } = calculateModuleDimensions(
                mod,
                colRatios,
                rowRatios,
                minX,
                maxX,
                minY,
                maxY,
                realDeduction,
                isManualDim,
              );
              
              const isModTrap = r &&
                (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
                mod.leftHeight !== undefined &&
                mod.rightHeight !== undefined &&
                mod.leftHeight > 0 &&
                mod.rightHeight > 0 &&
                mod.leftHeight !== mod.rightHeight;

              const modLh = isModTrap ? mod.leftHeight! : modH;
              lhsSum += modLh;
              if (y < maxY) {
                const belowMod = validModules.find((m) => m.x === minX && m.y === y + 1);
                if (belowMod) {
                  lhsCouplings += realDeduction;
                }
              }
            }
          }
          lh = lhsSum + lhsCouplings;

          // RHS total height
          let rhsSum = 0;
          let rhsCouplings = 0;
          for (let y = minY; y <= maxY; y++) {
            const mod = validModules.find((m) => m.x === maxX && m.y === y);
            if (mod) {
              const r = recipes.find((x) => x.id === mod.recipeId);
              const { modH } = calculateModuleDimensions(
                mod,
                colRatios,
                rowRatios,
                minX,
                maxX,
                minY,
                maxY,
                realDeduction,
                isManualDim,
              );
              
              const isModTrap = r &&
                (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
                mod.leftHeight !== undefined &&
                mod.rightHeight !== undefined &&
                mod.leftHeight > 0 &&
                mod.rightHeight > 0 &&
                mod.leftHeight !== mod.rightHeight;

              const modRh = isModTrap ? mod.rightHeight! : modH;
              rhsSum += modRh;
              if (y < maxY) {
                const belowMod = validModules.find((m) => m.x === maxX && m.y === y + 1);
                if (belowMod) {
                  rhsCouplings += realDeduction;
                }
              }
            }
          }
          rh = rhsSum + rhsCouplings;
          isTrap = !!firstTrapMod;
        } else {
          isTrap = !!firstTrapMod;
          lh = isTrap ? firstTrapMod!.leftHeight! : item.height;
          rh = isTrap ? firstTrapMod!.rightHeight! : item.height;
        }

        const inclinedTJTop = isTrap
          ? Math.sqrt(Math.pow(item.width, 2) + Math.pow(rh - lh, 2))
          : item.width;

        if (top) {
          const baseLen = isTrap ? inclinedTJTop : item.width;
          for (let k = 0; k < item.quantity; k++)
            list.push({
              len: baseLen + (left ? tjThick : 0) + (right ? tjThick : 0),
              type: "TJ Perímetro",
              cutStart: "45",
              cutEnd: "45",
              label: itemCode,
            });
        }
        if (bottom) {
          for (let k = 0; k < item.quantity; k++)
            list.push({
              len: item.width + (left ? tjThick : 0) + (right ? tjThick : 0),
              type: "TJ Perímetro",
              cutStart: "45",
              cutEnd: "45",
              label: itemCode,
            });
        }
        if (left) {
          for (let k = 0; k < item.quantity; k++)
            list.push({
              len: lh + (top ? tjThick : 0) + (bottom ? tjThick : 0),
              type: "TJ Perímetro",
              cutStart: "45",
              cutEnd: "45",
              label: itemCode,
            });
        }
        if (right) {
          for (let k = 0; k < item.quantity; k++)
            list.push({
              len: rh + (top ? tjThick : 0) + (bottom ? tjThick : 0),
              type: "TJ Perímetro",
              cutStart: "45",
              cutEnd: "45",
              label: itemCode,
            });
        }

        // Sobrantes por desnivel solo en conjuntos activos
        if (isSet && item.composition.colRatios.length > 1) {
          for (let x = minX; x < maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const mL = validModules.find((m) => m.x === x && m.y === y);
              const mR = validModules.find((m) => m.x === x + 1 && m.y === y);
              if (mL && mR) {
                let diff = 0;
                if (isManualDim && mL.manualOffsetY !== undefined && mR.manualOffsetY !== undefined && mL.height !== undefined && mR.height !== undefined) {
                  const y1 = mL.manualOffsetY;
                  const h1 = mL.height;
                  const y2 = mR.manualOffsetY;
                  const h2 = mR.height;
                  diff = Math.abs(y1 - y2) + Math.abs((y1 + h1) - (y2 + h2));
                } else {
                  const hL = isManualDim && mL.height ? mL.height : Number(rowRatios[y - minY] || 0);
                  const hR = isManualDim && mR.height ? mR.height : Number(rowRatios[y - minY] || 0);
                  diff = Math.abs(hL - hR);
                }
                if (diff > 5) {
                  for (let k = 0; k < item.quantity; k++) {
                    list.push({
                      len: diff,
                      type: "TJ Sobrante Desnivel",
                      cutStart: "90",
                      cutEnd: "90",
                      label: itemCode,
                    });
                  }
                }
              }
            }
          }
        }
        if (isSet && item.composition.rowRatios.length > 1) {
          for (let y = minY; y < maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const mT = validModules.find((m) => m.x === x && m.y === y);
              const mB = validModules.find((m) => m.x === x && m.y === y + 1);
              if (mT && mB) {
                let diff = 0;
                if (isManualDim && mT.manualOffsetX !== undefined && mB.manualOffsetX !== undefined && mT.width !== undefined && mB.width !== undefined) {
                  const x1 = mT.manualOffsetX;
                  const w1 = mT.width;
                  const x2 = mB.manualOffsetX;
                  const w2 = mB.width;
                  diff = Math.abs(x1 - x2) + Math.abs((x1 + w1) - (x2 + w2));
                } else {
                  const wT = isManualDim && mT.width ? mT.width : Number(colRatios[x - minX] || 0);
                  const wB = isManualDim && mB.width ? mB.width : Number(colRatios[x - minX] || 0);
                  diff = Math.abs(wT - wB);
                }
                if (diff > 5) {
                  for (let k = 0; k < item.quantity; k++) {
                    list.push({
                      len: diff,
                      type: "TJ Sobrante Ancho",
                      cutStart: "90",
                      cutEnd: "90",
                      label: itemCode,
                    });
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
            const mL = validModules.find((m) => m.x === x && m.y === y);
            const mR = validModules.find((m) => m.x === x + 1 && m.y === y);
            if (mL && mR) {
              const hL =
                isManualDim && mL.height
                  ? mL.height
                  : Number(rowRatios[y - minY] || 0);
              const hR =
                isManualDim && mR.height
                  ? mR.height
                  : Number(rowRatios[y - minY] || 0);
              const cutLen = Math.min(hL, hR);
              for (let k = 0; k < item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: "Acople V",
                  cutStart: "90",
                  cutEnd: "90",
                  label: itemCode,
                });
              }
            }
          }
        }
      }
      if (item.composition.rowRatios.length > 1) {
        for (let y = minY; y < maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const mT = validModules.find((m) => m.x === x && m.y === y);
            const mB = validModules.find((m) => m.x === x && m.y === y + 1);
            if (mT && mB) {
              const wT =
                isManualDim && mT.width
                  ? mT.width
                  : Number(colRatios[x - minX] || 0);
              const wB =
                isManualDim && mB.width
                  ? mB.width
                  : Number(colRatios[x - minX] || 0);
              const cutLen = Math.min(wT, wB);
              for (let k = 0; k < item.quantity; k++) {
                list.push({
                  len: cutLen,
                  type: "Acople H",
                  cutStart: "90",
                  cutEnd: "90",
                  label: itemCode,
                });
              }
            }
          }
        }
      }
      cutsByProfile.set(item.couplingProfileId, list);
    }
  });
  // Convert cutsByProfile Map to an array of profiles with their cuts, and separate cameras
  const profilesWithCuts: {
    profileId: string;
    profile: any;
    cuts: any[];
  }[] = [];

  cutsByProfile.forEach((cuts, profileId) => {
    let profile = aluminum.find((p) => p.id === profileId) as any;
    if (!profile) {
      const bp = blindPanels.find((x) => x.id === profileId);
      if (bp) {
        profile = { id: bp.id, code: bp.code, detail: bp.detail, barLength: 6 };
      }
    }
    if (profile && cuts.length > 0) {
      profilesWithCuts.push({ profileId, profile, cuts });
    }
  });

  const isCameraProfile = (prof: any) => {
    if (!prof) return false;
    const code = String(prof.code || "").toLowerCase();
    const detail = String(prof.detail || "").toLowerCase();
    return code.includes("cmra") || code.includes("camara") || code.includes("cámara");
  };

  const normalProfiles = profilesWithCuts.filter((item) => !isCameraProfile(item.profile));
  const cameraProfiles = profilesWithCuts.filter((item) => isCameraProfile(item.profile));
  const orderedProfilesWithCuts = [...normalProfiles, ...cameraProfiles];

  let y = 40;
  orderedProfilesWithCuts.forEach(({ profile, cuts }) => {
    const isCam = isCameraProfile(profile);
    const barLenMm =
      profile.barLength > 100 ? profile.barLength : profile.barLength * 1000;
    cuts.sort((a, b) => b.len - a.len);
    const bins: (typeof cuts)[] = [[]];
    cuts.forEach((cut) => {
      let placed = false;
      for (let i = 0; i < bins.length; i++) {
        const used = bins[i].reduce(
          (acc, c) => acc + c.len + config.discWidth,
          0,
        );
        if (used + cut.len + config.discWidth <= barLenMm) {
          bins[i].push(cut);
          placed = true;
          break;
        }
      }
      if (!placed) bins.push([cut]);
    });
    if (y > 165) {
      doc.addPage();
      y = 30;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(10, y - 5, pageWidth - 20, 8, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(
      `PERFIL: ${profile.code} - ${profile.detail} | BARRAS REQUERIDAS: ${bins.length}`,
      15,
      y + 1,
    );
    y += 18;
    bins.forEach((bin, bIdx) => {
      if (y > 185) {
        doc.addPage();
        y = 30;
      }
      const barW = pageWidth - 70;
      const barH = 8;
      doc.setDrawColor(200);
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, barW, barH, "FD");
      let curX = 15;
      bin.forEach((cut) => {
        const pieceW = (cut.len / barLenMm) * barW;
        if (isCam) {
          // Color amarillonaranja (Yellow-Orange, e.g., RGB 245, 158, 11)
          doc.setFillColor(245, 158, 11);
        } else {
          doc.setFillColor(100, 149, 237);
        }
        doc.setDrawColor(255);
        doc.setLineWidth(0.3);
        drawGeometricPiece(
          doc,
          curX,
          y,
          pieceW,
          barH,
          cut.cutStart,
          cut.cutEnd,
        );
        doc.setTextColor(0);
        if (pieceW > 2) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`${Math.round(cut.len)}`, curX + pieceW / 2, y - 1, {
            align: "center",
          });
          doc.setFontSize(7);
          doc.text(cut.label, curX + pieceW / 2, y + barH + 4, {
            align: "center",
          });
        }
        curX += pieceW + (config.discWidth / barLenMm) * barW;
      });
      const totalUsed = bin.reduce((a, b) => a + b.len + config.discWidth, 0);
      const scrap = barLenMm - totalUsed;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100);
      doc.text(`B#${bIdx + 1}`, 8, y + 5);
      doc.text(`SCRAP: ${Math.round(scrap)} mm`, 15 + barW + 5, y + 5);
      y += 24;
    });
    y += 10;
  });
  doc.save(`Cortes_Barras_${quote.clientName}.pdf`);
};

export const generateMaterialsOrderPDF = (
  quote: Quote,
  recipes: ProductRecipe[],
  aluminum: AluminumProfile[],
  accessories: Accessory[],
  glasses: Glass[],
  dvhInputs: DVHInput[],
  config: GlobalConfig,
  blindPanels: BlindPanel[],
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PEDIDO DE MATERIALES CONSOLIDADO", 15, 12);
  doc.setFontSize(8);
  doc.text(
    `OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`,
    15,
    18,
  );
  let currentY = 35;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text("1. PERFILERÍA DE ALUMINIO (BARRAS COMPLETAS)", 15, currentY);
  currentY += 5;
  const aluSummary = new Map<
    string,
    { code: string; detail: string; totalMm: number; barLength: number; weightPerMeter?: number }
  >();
  quote.items.forEach((item) => {
    const { isManualDim, colRatios, rowRatios, couplingDeduction } =
      item.composition;
    const isSet = item.composition.modules.length > 1;
    const cProfile = item.couplingProfileId
      ? aluminum.find((p) => p.id === item.couplingProfileId)
      : null;
    const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
    const validModules = item.composition.modules.filter(
      (m) => m && typeof m.x === "number" && typeof m.y === "number",
    );
    if (validModules.length === 0) return;
    const minX = Math.min(...validModules.map((m) => m.x));
    const minY = Math.min(...validModules.map((m) => m.y));
    const maxX = Math.max(...validModules.map((m) => m.x));
    const maxY = Math.max(...validModules.map((m) => m.y));
    validModules.forEach((mod) => {
      const recipe = recipes.find((r) => r.id === mod.recipeId);
      if (!recipe) return;
      const { modW, modH } = calculateModuleDimensions(
        mod,
        colRatios,
        rowRatios,
        minX,
        maxX,
        minY,
        maxY,
        realDeduction,
        isManualDim,
      );

      const isTrapezoid =
        (recipe.type === "Paño Fijo" ||
         recipe.name.toLowerCase().includes("paño fijo") ||
         recipe.name.toLowerCase().includes("pf") ||
         recipe.id === "vidrio_solo" ||
         recipe.name.toLowerCase().includes("vidrio")) &&
        mod.leftHeight !== undefined &&
        mod.rightHeight !== undefined &&
        mod.leftHeight > 0 &&
        mod.rightHeight > 0 &&
        mod.leftHeight !== mod.rightHeight;

      const inclinedW = isTrapezoid
        ? Math.sqrt(Math.pow(modW, 2) + Math.pow(mod.rightHeight! - mod.leftHeight!, 2))
        : modW;

      const transomTemplate = (recipe.profiles || []).find(
        (rp) =>
          rp.role === "Travesaño" ||
          (rp.role && rp.role.toLowerCase().includes("trave")),
      );
      const recipeTransomFormula =
        transomTemplate?.formula || recipe.transomFormula || "W";
      const recipeTransomQty = transomTemplate?.quantity || 1;

      // Cálculo de espesor de vidrio para selección dinámica
      const gOuter = glasses.find((g) => g.id === mod.glassOuterId);
      const gInner = mod.isDVH
        ? glasses.find((g) => g.id === mod.glassInnerId)
        : null;
      const dvhCam = mod.isDVH
        ? dvhInputs.find((i) => i.id === mod.dvhCameraId)
        : null;
      let camThick = 12;
      if (dvhCam) {
        camThick = dvhCam.thickness || 12;
        if (!dvhCam.thickness) {
          const m = dvhCam.detail.match(/(\d+)\s*mm/i);
          if (m) camThick = parseInt(m[1]);
        }
      }
      const getThick = (g: any) => {
        if (!g) return 0;
        if (g.thickness) return g.thickness;
        const m = g.detail.match(/(\d+)\s*mm/i);
        if (m) return parseInt(m[1]);
        const mc = g.code.match(/(\d+)\s*mm/i);
        if (mc) return parseInt(mc[1]);
        return 4;
      };
      const totalGlassThick =
        getThick(gOuter) + (mod.isDVH ? getThick(gInner) + camThick : 0);
      const beadStyle = (item as any).glazingBeadStyle || "Recto";

      const usedGlazingBeadIds = new Set<string>();
      const filteredProfiles2 = filterDVHProfiles(recipe.profiles || [], mod.isDVH, mod.dvhCameraId, dvhInputs, aluminum) as any[];

      let totalPlainHorizontalMarcoQty = 0;
      filteredProfiles2.forEach((rp) => {
        if (rp.alternative && rp.alternative !== (mod.leafAlternative || "A"))
          return;
        const rLower = (rp.role || "").toLowerCase();
        const fUpper = (rp.formula || "").toUpperCase();
        const isPlainHorizontalMarco =
          (rLower.includes("marco") || rLower.includes("marcos")) &&
          fUpper.includes("W") &&
          !fUpper.includes("H") &&
          !rLower.includes("cabe") &&
          !rLower.includes("dintel") &&
          !rLower.includes("superior") &&
          !rLower.includes("sup") &&
          !rLower.includes("umbra") &&
          !rLower.includes("inferior") &&
          !rLower.includes("inf") &&
          !rLower.includes("zoc") &&
          !rLower.includes("zócalo") &&
          !rLower.includes("zocalo");
        if (isPlainHorizontalMarco) {
          totalPlainHorizontalMarcoQty += Number(rp.quantity || 0);
        }
      });

      let processedPlainHorizontalMarcoQty = 0;

      filteredProfiles2.forEach((rp) => {
        if (rp.alternative && rp.alternative !== (mod.leafAlternative || "A"))
          return;
        const role = rp.role?.toLowerCase() || "";
        let p = aluminum.find((a) => a.id === rp.profileId);

        // Lógica de Contravidrio Dinámico
        if (
          rp.glazingBeadOptions &&
          Array.isArray(rp.glazingBeadOptions) &&
          rp.glazingBeadOptions.length > 0
        ) {
          const candidates = aluminum.filter((pf) =>
            (rp.glazingBeadOptions || []).includes(pf.id),
          );
          let styleMatches = candidates.filter(
            (pf) => pf.glazingBeadStyle === beadStyle,
          );
          if (styleMatches.length === 0) styleMatches = candidates;

          let bestMatch = styleMatches.find((pf) => {
            const min = pf.minGlassThickness || 0;
            const max = pf.maxGlassThickness || 100;
            return totalGlassThick >= min && totalGlassThick <= max;
          });

          if (!bestMatch) {
            bestMatch = candidates.find((pf) => {
              const min = pf.minGlassThickness || 0;
              const max = pf.maxGlassThickness || 100;
              return totalGlassThick >= min && totalGlassThick <= max;
            });
          }

          if (bestMatch) p = bestMatch;
        }

        if (!p) return;
        if (role === "contravidrio") usedGlazingBeadIds.add(p.id);
        if (role === "travesaño") return;

        // Exclusión centralizada de Tapajuntas en materiales individuales
        const isTJ =
          role.includes("tapa") ||
          String(p.code || "")
            .toUpperCase()
            .includes("TJ") ||
          p.id === recipe.defaultTapajuntasProfileId;
        if (isTJ) return;

        const isMosq =
          role.includes("mosquitero") || p.id === recipe.mosquiteroProfileId;
        if (isMosq && !item.extras.mosquitero) return;

        if (item.quotingMode === "Solo Marcos") {
           if (role.includes("hoja") || role.includes("contravidrio") || isMosq) return;
        } else if (item.quotingMode === "Solo Hojas") {
           if (role.includes("marco") || role.includes("zócalo") || role.includes("zocalo") || role.includes("acople") || role.includes("columna") || role.includes("viga") || role.includes("encuentro") || role.includes("travesaño") || role.includes("travesano")) return;
        }

        let totalMm = 0;
        if (isTrapezoid) {
          const isContravidrio = role === "contravidrio" || role.includes("contra");
          const isVertical =
            role.includes("jamba") ||
            role.includes("lateral") ||
            role.includes("parante") ||
            role.includes("mocheta") ||
            (!role.includes("cabe") && !role.includes("dintel") && !role.includes("umbra") && !role.includes("zoc") && rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W"));

          const isTopHorizontal =
            role.includes("dintel") ||
            role.includes("cabezal") ||
            role.includes("superior");

          if (isContravidrio) {
            if (rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W")) {
              const qtyLeft = Math.ceil(rp.quantity / 2);
              const qtyRight = Math.floor(rp.quantity / 2);
              const cutLeft = evaluateFormula(rp.formula, modW, mod.leftHeight!);
              const cutRight = evaluateFormula(rp.formula, modW, mod.rightHeight!);
              if (cutLeft > 0) totalMm += (cutLeft + config.discWidth) * qtyLeft * item.quantity;
              if (cutRight > 0) totalMm += (cutRight + config.discWidth) * qtyRight * item.quantity;
            } else {
              const qtyBottom = Math.ceil(rp.quantity / 2);
              const qtyTop = Math.floor(rp.quantity / 2);
              const cutBottom = evaluateFormula(rp.formula, modW, modH);
              const cutTop = evaluateFormula(rp.formula, inclinedW, modH);
              if (cutBottom > 0) totalMm += (cutBottom + config.discWidth) * qtyBottom * item.quantity;
              if (cutTop > 0) totalMm += (cutTop + config.discWidth) * qtyTop * item.quantity;
            }
          } else if (isVertical) {
            const qtyLeft = Math.ceil(rp.quantity / 2);
            const qtyRight = Math.floor(rp.quantity / 2);
            const cutLeft = evaluateFormula(rp.formula, modW, mod.leftHeight!);
            const cutRight = evaluateFormula(rp.formula, modW, mod.rightHeight!);
            if (cutLeft > 0) totalMm += (cutLeft + config.discWidth) * qtyLeft * item.quantity;
            if (cutRight > 0) totalMm += (cutRight + config.discWidth) * qtyRight * item.quantity;
          } else if (isTopHorizontal) {
            const cutLen = evaluateFormula(rp.formula, inclinedW, modH);
            if (cutLen > 0) totalMm += (cutLen + config.discWidth) * rp.quantity * item.quantity;
          } else if (
            (role.includes("marco") || role.includes("marcos")) &&
            rp.formula.toUpperCase().includes("W") &&
            !rp.formula.toUpperCase().includes("H") &&
            !role.includes("cabe") &&
            !role.includes("dintel") &&
            !role.includes("superior") &&
            !role.includes("sup") &&
            !role.includes("umbra") &&
            !role.includes("inferior") &&
            !role.includes("inf") &&
            !role.includes("zoc") &&
            !role.includes("zócalo") &&
            !role.includes("zocalo")
          ) {
            const qty = Number(rp.quantity || 0);
            let qtyBottom = 0;
            let qtyTop = 0;
            for (let k = 0; k < qty; k++) {
              const globalIdx = processedPlainHorizontalMarcoQty + k;
              if (globalIdx < Math.ceil(totalPlainHorizontalMarcoQty / 2)) {
                qtyBottom++;
              } else {
                qtyTop++;
              }
            }
            processedPlainHorizontalMarcoQty += qty;

            const cutBottom = evaluateFormula(rp.formula, modW, modH);
            const cutTop = evaluateFormula(rp.formula, inclinedW, modH);

            if (cutBottom > 0 && qtyBottom > 0) {
              totalMm += (cutBottom + config.discWidth) * qtyBottom * item.quantity;
            }
            if (cutTop > 0 && qtyTop > 0) {
              totalMm += (cutTop + config.discWidth) * qtyTop * item.quantity;
            }
          } else {
            const cutLen = evaluateFormula(rp.formula, modW, modH);
            if (cutLen > 0) totalMm += (cutLen + config.discWidth) * rp.quantity * item.quantity;
          }
        } else {
          const len = evaluateFormula(rp.formula, modW, modH);
          totalMm = (len + config.discWidth) * rp.quantity * item.quantity;
        }

        if (totalMm > 0) {
          const existing = aluSummary.get(p.id) || {
            code: p.code,
            detail: p.detail,
            totalMm: 0,
            barLength: p.barLength || 6,
            weightPerMeter: p.weightPerMeter || 0,
          };
          existing.totalMm += totalMm;
          aluSummary.set(p.id, existing);
        }
      });
      if (mod.transoms && mod.transoms.length > 0) {
        mod.transoms.forEach((t) => {
          const trProf = aluminum.find((p) => p.id === t.profileId);
          if (trProf) {
            const f = t.formula || recipeTransomFormula;
            const cutLen = evaluateFormula(f, modW, modH);
            const totalMm =
              (cutLen + config.discWidth) * recipeTransomQty * item.quantity;
            const existing = aluSummary.get(trProf.id) || {
              code: trProf.code,
              detail: trProf.detail,
              totalMm: 0,
              barLength: trProf.barLength || 6,
              weightPerMeter: trProf.weightPerMeter || 0,
            };
            existing.totalMm += totalMm;
            aluSummary.set(trProf.id, existing);

            // 2 Contravidrios extra del mismo largo que el travesaño por cada tipo de contravidrio en la receta
            usedGlazingBeadIds.forEach((gbId) => {
              const gbProf = aluminum.find((p) => p.id === gbId);
              if (gbProf) {
                const gbTotalMm =
                  (cutLen + config.discWidth) * 2 * item.quantity;
                const gbExist = aluSummary.get(gbProf.id) || {
                  code: gbProf.code,
                  detail: gbProf.detail,
                  totalMm: 0,
                  barLength: gbProf.barLength || 6,
                  weightPerMeter: gbProf.weightPerMeter || 0,
                };
                gbExist.totalMm += gbTotalMm;
                aluSummary.set(gbProf.id, gbExist);
              }
            });
          }
        });
      }

      if (mod.isDVH && mod.dvhCameraId) {
         const { profiles: rawDvhProfs } = getDVHExtras(recipes, mod.isDVH);
         const dvhProfs = filterDVHProfiles(rawDvhProfs, mod.isDVH, mod.dvhCameraId, dvhInputs, aluminum) as any[];
         const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
         panes.forEach(pane => {
             if (pane.isBlind) return;
             dvhProfs.forEach(rp => {
                 let pDef = aluminum.find((a) => a.id === rp.profileId);
                 if (!pDef) return;
                 let length = evaluateFormula(rp.formula, pane.w, pane.h);
                 const totalMm = (length + config.discWidth) * Number(rp.quantity || 1) * item.quantity;
                 const existing = aluSummary.get(pDef.id) || {
                     code: pDef.code,
                     detail: pDef.detail,
                     totalMm: 0,
                     barLength: pDef.barLength || 6,
                     weightPerMeter: pDef.weightPerMeter || 0,
                 };
                 existing.totalMm += totalMm;
                 aluSummary.set(pDef.id, existing);
             });
         });
      }

      const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
      const visualType = (recipe.visualType || "").toLowerCase();
      let numLeaves = recipe.leaves || 1;
      if (!recipe.leaves) {
        if (
          visualType.includes("sliding_3") ||
          visualType.includes("corrediza_3") ||
          visualType.includes("triple") ||
          visualType.includes("3h")
        )
          numLeaves = 3;
        else if (
          visualType.includes("sliding_4") ||
          visualType.includes("corrediza_4") ||
          visualType.includes("four") ||
          visualType.includes("4h")
        )
          numLeaves = 4;
        else if (
          visualType.includes("sliding") ||
          visualType.includes("corrediza")
        )
          numLeaves = 2;
        else if (
          visualType.includes("double") ||
          visualType.includes("doble") ||
          visualType.includes("2h")
        )
          numLeaves = 2;
      }
      panes.forEach((p, paneIdx) => {
        if (p.isBlind) {
          const bpId = mod.blindPaneIds?.[paneIdx];
          const bp = blindPanels.find((x) => x.id === bpId);
          const slatId = mod.slatProfileIds?.[paneIdx];
          if (bp && bp.unit === "ml" && !slatId) {
            const existing = aluSummary.get(bp.id) || {
              code: bp.code,
              detail: bp.detail,
              totalMm: 0,
              barLength: bp.barLength || 6,
              weightPerMeter: bp.weightPerMeter || 0,
            };
            existing.totalMm += p.w * numLeaves * item.quantity;
            aluSummary.set(bp.id, existing);
          }
          if (slatId) {
            const slatProf = aluminum.find((a) => a.id === slatId);
            if (slatProf && slatProf.thickness > 0) {
              const numSlats = Math.ceil(p.h / slatProf.thickness);
              const totalMm =
                (p.w + config.discWidth) * numSlats * item.quantity;
              const existing = aluSummary.get(slatProf.id) || {
                code: slatProf.code,
                detail: slatProf.detail,
                totalMm: 0,
                barLength: slatProf.barLength || 6,
                weightPerMeter: slatProf.weightPerMeter || 0,
              };
              existing.totalMm += totalMm;
              aluSummary.set(slatId, existing);
            }
          }
        }
      });

      // Lógica de Pasamanos (Baranda)
      if (mod.handrailProfileId) {
        const hrProfile = aluminum.find((p) => p.id === mod.handrailProfileId);
        if (hrProfile) {
          const existing = aluSummary.get(hrProfile.id) || {
            code: hrProfile.code,
            detail: hrProfile.detail,
            totalMm: 0,
            barLength: hrProfile.barLength || 6,
            weightPerMeter: hrProfile.weightPerMeter || 0,
          };
          existing.totalMm += (modW + config.discWidth) * item.quantity;
          aluSummary.set(hrProfile.id, existing);
        }
      }

      // Lógica de Mosquitero Independiente (Aluminio)
      if (item.extras.mosquitero && item.extras.mosquiteroRecipeId) {
        const mosqRecipe = recipes.find(r => r.id === item.extras.mosquiteroRecipeId);
        if (mosqRecipe) {
          let mosqW = modW;
          if (visualType.includes("sliding") || numLeaves > 1) {
             mosqW = modW / Math.max(1, numLeaves);
          }
          mosqRecipe.profiles.forEach(rp => {
            const mp = aluminum.find(a => a.id === rp.profileId);
            if (!mp) return;
            const len = evaluateFormula(rp.formula, mosqW, modH);
            const totalMm = (len + config.discWidth) * rp.quantity * item.quantity;
            const existing = aluSummary.get(mp.id) || {
              code: mp.code, detail: mp.detail, totalMm: 0,
              barLength: mp.barLength || 6, weightPerMeter: mp.weightPerMeter || 0
            };
            existing.totalMm += totalMm;
            aluSummary.set(mp.id, existing);
          });
        }
      }
    });

    // Sumatoria Unificada de Tapajuntas en el pedido de materiales
    if (item.extras.tapajuntas && validModules.length > 0) {
      const firstRecipe = recipes.find(
        (r) => r.id === validModules[0].recipeId,
      );
      let tjProfile = aluminum.find(
        (p) => p.id === firstRecipe?.defaultTapajuntasProfileId,
      );

      // Fallback: Si no hay default configurado, buscar el primer perfil con rol Tapajuntas en la receta
      if (!tjProfile && firstRecipe) {
        const tjRef = firstRecipe.profiles.find((p) => p.role === "Tapajuntas");
        if (tjRef) tjProfile = aluminum.find((p) => p.id === tjRef.profileId);
      }

      // Fallback global
      if (!tjProfile) {
        tjProfile = aluminum.find(
          (p) =>
            p.code.toUpperCase().includes("TJ") ||
            p.detail.toLowerCase().includes("tapajunta"),
        );
      }

      if (tjProfile) {
        const tjThick = Number(tjProfile.thickness || 30);
        const { top, bottom, left, right } = item.extras.tapajuntasSides;

        const firstTrapMod = validModules.find((m) => {
          const r = recipes.find((x) => x.id === m.recipeId);
          if (!r) return false;
          return (
            (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
            m.leftHeight !== undefined &&
            m.rightHeight !== undefined &&
            m.leftHeight > 0 &&
            m.rightHeight > 0 &&
            m.leftHeight !== m.rightHeight
          );
        });

        let lh = item.height;
        let rh = item.height;
        let isTrap = false;

        if (isSet) {
          const minX = Math.min(...validModules.map((m) => m.x));
          const minY = Math.min(...validModules.map((m) => m.y));
          const maxX = Math.max(...validModules.map((m) => m.x));
          const maxY = Math.max(...validModules.map((m) => m.y));
          const colRatios = item.composition.colRatios || [];
          const rowRatios = item.composition.rowRatios || [];
          const isManualDim = item.composition.isManualDim;

          // LHS total height
          let lhsSum = 0;
          let lhsCouplings = 0;
          for (let y = minY; y <= maxY; y++) {
            const mod = validModules.find((m) => m.x === minX && m.y === y);
            if (mod) {
              const r = recipes.find((x) => x.id === mod.recipeId);
              const { modH } = calculateModuleDimensions(
                mod,
                colRatios,
                rowRatios,
                minX,
                maxX,
                minY,
                maxY,
                realDeduction,
                isManualDim,
              );
              
              const isModTrap = r &&
                (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
                mod.leftHeight !== undefined &&
                mod.rightHeight !== undefined &&
                mod.leftHeight > 0 &&
                mod.rightHeight > 0 &&
                mod.leftHeight !== mod.rightHeight;

              const modLh = isModTrap ? mod.leftHeight! : modH;
              lhsSum += modLh;
              if (y < maxY) {
                const belowMod = validModules.find((m) => m.x === minX && m.y === y + 1);
                if (belowMod) {
                  lhsCouplings += realDeduction;
                }
              }
            }
          }
          lh = lhsSum + lhsCouplings;

          // RHS total height
          let rhsSum = 0;
          let rhsCouplings = 0;
          for (let y = minY; y <= maxY; y++) {
            const mod = validModules.find((m) => m.x === maxX && m.y === y);
            if (mod) {
              const r = recipes.find((x) => x.id === mod.recipeId);
              const { modH } = calculateModuleDimensions(
                mod,
                colRatios,
                rowRatios,
                minX,
                maxX,
                minY,
                maxY,
                realDeduction,
                isManualDim,
              );
              
              const isModTrap = r &&
                (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
                mod.leftHeight !== undefined &&
                mod.rightHeight !== undefined &&
                mod.leftHeight > 0 &&
                mod.rightHeight > 0 &&
                mod.leftHeight !== mod.rightHeight;

              const modRh = isModTrap ? mod.rightHeight! : modH;
              rhsSum += modRh;
              if (y < maxY) {
                const belowMod = validModules.find((m) => m.x === maxX && m.y === y + 1);
                if (belowMod) {
                  rhsCouplings += realDeduction;
                }
              }
            }
          }
          rh = rhsSum + rhsCouplings;
          isTrap = !!firstTrapMod;
        } else {
          isTrap = !!firstTrapMod;
          lh = isTrap ? firstTrapMod!.leftHeight! : item.height;
          rh = isTrap ? firstTrapMod!.rightHeight! : item.height;
        }

        const inclinedTJTop = isTrap
          ? Math.sqrt(Math.pow(item.width, 2) + Math.pow(rh - lh, 2))
          : item.width;

        let tjLenTotal = 0;
        if (top) {
          const baseLen = isTrap ? inclinedTJTop : item.width;
          tjLenTotal += baseLen + (left ? tjThick : 0) + (right ? tjThick : 0);
        }
        if (bottom)
          tjLenTotal +=
            item.width + (left ? tjThick : 0) + (right ? tjThick : 0);
        if (left)
          tjLenTotal +=
            lh + (top ? tjThick : 0) + (bottom ? tjThick : 0);
        if (right)
          tjLenTotal +=
            rh + (top ? tjThick : 0) + (bottom ? tjThick : 0);

        if (isSet && item.composition.colRatios.length > 1) {
          for (let x = minX; x < maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const mL = validModules.find((m) => m.x === x && m.y === y);
              const mR = validModules.find((m) => m.x === x + 1 && m.y === y);
              if (mL && mR) {
                if (isManualDim && mL.manualOffsetY !== undefined && mR.manualOffsetY !== undefined && mL.height !== undefined && mR.height !== undefined) {
                  const y1 = mL.manualOffsetY;
                  const h1 = mL.height;
                  const y2 = mR.manualOffsetY;
                  const h2 = mR.height;
                  tjLenTotal += Math.abs(y1 - y2) + Math.abs((y1 + h1) - (y2 + h2));
                } else {
                  const hL = isManualDim && mL.height ? mL.height : Number(rowRatios[y - minY] || 0);
                  const hR = isManualDim && mR.height ? mR.height : Number(rowRatios[y - minY] || 0);
                  tjLenTotal += Math.abs(hL - hR);
                }
              }
            }
          }
        }
        if (isSet && item.composition.rowRatios.length > 1) {
          for (let y = minY; y < maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const mT = validModules.find((m) => m.x === x && m.y === y);
              const mB = validModules.find((m) => m.x === x && m.y === y + 1);
              if (mT && mB) {
                if (isManualDim && mT.manualOffsetX !== undefined && mB.manualOffsetX !== undefined && mT.width !== undefined && mB.width !== undefined) {
                  const x1 = mT.manualOffsetX;
                  const w1 = mT.width;
                  const x2 = mB.manualOffsetX;
                  const w2 = mB.width;
                  tjLenTotal += Math.abs(x1 - x2) + Math.abs((x1 + w1) - (x2 + w2));
                } else {
                  const wT = isManualDim && mT.width ? mT.width : Number(colRatios[x - minX] || 0);
                  const wB = isManualDim && mB.width ? mB.width : Number(colRatios[x - minX] || 0);
                  tjLenTotal += Math.abs(wT - wB);
                }
              }
            }
          }
        }
        const existing = aluSummary.get(tjProfile.id) || {
          code: tjProfile.code,
          detail: tjProfile.detail,
          totalMm: 0,
          barLength: tjProfile.barLength || 6,
          weightPerMeter: tjProfile.weightPerMeter || 0,
        };
        existing.totalMm += (tjLenTotal + config.discWidth) * item.quantity;
        aluSummary.set(tjProfile.id, existing);
      }
    }

    if (item.couplingProfileId && isSet) {
      const p = aluminum.find((a) => a.id === item.couplingProfileId);
      if (p) {
        let totalC = 0;
        if (item.composition.colRatios.length > 1) {
          for (let x = minX; x < maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const mL = validModules.find((m) => m.x === x && m.y === y);
              const mR = validModules.find((m) => m.x === x + 1 && m.y === y);
              if (mL && mR) {
                let overlap = 0;
                if (isManualDim && mL.manualOffsetY !== undefined && mR.manualOffsetY !== undefined && mL.height !== undefined && mR.height !== undefined) {
                  const y1 = mL.manualOffsetY;
                  const h1 = mL.height;
                  const y2 = mR.manualOffsetY;
                  const h2 = mR.height;
                  overlap = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
                } else {
                  const hL = isManualDim && mL.height ? mL.height : Number(rowRatios[y - minY] || 0);
                  const hR = isManualDim && mR.height ? mR.height : Number(rowRatios[y - minY] || 0);
                  overlap = Math.min(hL, hR);
                }
                totalC += overlap;
              }
            }
          }
        }
        if (item.composition.rowRatios.length > 1) {
          for (let y = minY; y < maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const mT = validModules.find((m) => m.x === x && m.y === y);
              const mB = validModules.find((m) => m.x === x && m.y === y + 1);
              if (mT && mB) {
                let overlap = 0;
                if (isManualDim && mT.manualOffsetX !== undefined && mB.manualOffsetX !== undefined && mT.width !== undefined && mB.width !== undefined) {
                  const x1 = mT.manualOffsetX;
                  const w1 = mT.width;
                  const x2 = mB.manualOffsetX;
                  const w2 = mB.width;
                  overlap = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
                } else {
                  const wT = isManualDim && mT.width ? mT.width : Number(colRatios[x - minX] || 0);
                  const wB = isManualDim && mB.width ? mB.width : Number(colRatios[x - minX] || 0);
                  overlap = Math.min(wT, wB);
                }
                totalC += overlap;
              }
            }
          }
        }
        const bl = p.barLength || 6;
        const existing = aluSummary.get(p.id) || {
          code: p.code,
          detail: p.detail,
          totalMm: 0,
          barLength: bl,
          weightPerMeter: p.weightPerMeter || 0,
        };
        existing.totalMm += (totalC + config.discWidth) * item.quantity;
        aluSummary.set(p.id, existing);
      }
    }
  });
  let totalAluWeight = 0;
  const aluBody = Array.from(aluSummary.values()).map((s) => {
    const barLenMm = s.barLength > 100 ? s.barLength : s.barLength * 1000;
    const totalBars = Math.ceil(s.totalMm / barLenMm);
    const weight = (s.totalMm / 1000) * (s.weightPerMeter || 0);
    totalAluWeight += weight;
    return [
      s.code,
      s.detail,
      `${(s.totalMm / 1000).toFixed(2)} m`,
      `${s.barLength} m`,
      totalBars,
      `${weight.toFixed(2)} Kg`,
    ];
  });
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "CÓDIGO",
        "DESCRIPCIÓN",
        "METROS TOTALES",
        "LARGO BARRA",
        "BARRAS",
        "PESO (Kg)",
      ],
    ],
    body: aluBody,
    theme: "grid",
    headStyles: { fillColor: [51, 65, 85] },
    styles: { fontSize: 8 },
    columnStyles: { 
      4: { halign: "center", fontStyle: "bold" },
      5: { halign: "right" }
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`PESO TOTAL ESTRUCTURAL: ${totalAluWeight.toFixed(2)} Kg`, 15, currentY + 5);
  currentY += 15;
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }
  doc.setFontSize(11);
  doc.text("2. LISTADO DE CRISTALES, PANELES Y TELAS", 15, currentY);
  currentY += 5;
  const fillSummary = new Map<
    string,
    { spec: string; w: number; h: number; qty: number }
  >();
  quote.items.forEach((item) => {
    if (item.quotingMode === "Solo Marcos") return;
    
    item.composition.modules.forEach((mod) => {
      const recipe = recipes.find((r) => r.id === mod.recipeId);
      if (!recipe) return;
      const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
      const visualType = (recipe.visualType || "").toLowerCase();
      let numLeaves = recipe.leaves || 1;
      if (!recipe.leaves) {
        if (
          visualType.includes("sliding_3") ||
          visualType.includes("corrediza_3") ||
          visualType.includes("triple") ||
          visualType.includes("3h")
        )
          numLeaves = 3;
        else if (
          visualType.includes("sliding_4") ||
          visualType.includes("corrediza_4") ||
          visualType.includes("four") ||
          visualType.includes("4h")
        )
          numLeaves = 4;
        else if (
          visualType.includes("sliding") ||
          visualType.includes("corrediza")
        )
          numLeaves = 2;
        else if (
          visualType.includes("double") ||
          visualType.includes("doble") ||
          visualType.includes("2h")
        )
          numLeaves = 2;
      }
      panes.forEach((pane, paneIdx) => {
        if (pane.isBlind) {
          const bpId = mod.blindPaneIds?.[paneIdx];
          const bp = blindPanels.find((x) => x.id === bpId);
          const slatId = mod.slatProfileIds?.[paneIdx];
          if (slatId) return;
          if (bp && bp.unit === "m2") {
            const key = `CIEGO-${bp.code}-${Math.round(pane.w)}-${Math.round(pane.h)}`;
            const existing = fillSummary.get(key) || {
              spec: `PANEL CIEGO: ${bp.detail}`,
              w: Math.round(pane.w),
              h: Math.round(pane.h),
              qty: 0,
            };
            existing.qty += item.quantity;
            fillSummary.set(key, existing);
          }
          return;
        }
        if (
          recipe.type === "Mosquitero" || 
          visualType.includes("mosquitero")
        ) {
          const spec = "TELA MOSQUITERA";
          const key = `${spec}-${Math.round(pane.w)}-${Math.round(pane.h)}`;
          const existing = fillSummary.get(key) || {
            spec,
            w: Math.round(pane.w),
            h: Math.round(pane.h),
            qty: 0,
          };
          existing.qty += item.quantity;
          fillSummary.set(key, existing);
        } else {
          const gOuter = glasses.find((g) => g.id === mod.glassOuterId);

          if (mod.isDVH) {
            // Outer Glass
            const specOuter = gOuter?.detail || "Vidrio (Ext)";
            const keyOuter = `${specOuter}-${Math.round(pane.w)}-${Math.round(pane.h)}`;
            const existingOuter = fillSummary.get(keyOuter) || {
              spec: specOuter,
              w: Math.round(pane.w),
              h: Math.round(pane.h),
              qty: 0,
            };
            existingOuter.qty += item.quantity;
            fillSummary.set(keyOuter, existingOuter);

            // Inner Glass
            const gInner = glasses.find((g) => g.id === mod.glassInnerId);
            const specInner = gInner?.detail || "Vidrio (Int)";
            const keyInner = `${specInner}-${Math.round(pane.w)}-${Math.round(pane.h)}`;
            const existingInner = fillSummary.get(keyInner) || {
              spec: specInner,
              w: Math.round(pane.w),
              h: Math.round(pane.h),
              qty: 0,
            };
            existingInner.qty += item.quantity;
            fillSummary.set(keyInner, existingInner);
          } else {
            // Single Glass
            const spec = gOuter?.detail || "VS";
            const key = `${spec}-${Math.round(pane.w)}-${Math.round(pane.h)}`;
            const existing = fillSummary.get(key) || {
              spec,
              w: Math.round(pane.w),
              h: Math.round(pane.h),
              qty: 0,
            };
            existing.qty += item.quantity;
            fillSummary.set(key, existing);
          }
        }
      });
      
      if (item.extras?.mosquitero) {
        const baseRecipe = recipes.find(r => r.id === item.composition.modules[0]?.recipeId);
        let telaW = item.width;
        if (baseRecipe?.visualType && (baseRecipe.visualType.toLowerCase().includes("sliding") || (baseRecipe.leaves || 1) > 1)) {
          telaW = Math.round(item.width / Math.max(1, (baseRecipe.leaves || 2)));
        }
        let specName = "TELA MOSQUITERA";
        if (item.extras.mosquiteroRecipeId) {
           const mosqRecipe = recipes.find(r => r.id === item.extras!.mosquiteroRecipeId);
           specName = "TELA MOSQUITERA (" + (mosqRecipe?.name || "ADICIONAL") + ")";
        }
        const key = `${specName}-${telaW}-${item.height}`;
        const existing = fillSummary.get(key) || { spec: specName, w: telaW, h: item.height, qty: 0 };
        existing.qty += item.quantity;
        fillSummary.set(key, existing);
      }
    });
  });
  const glassBody = Array.from(fillSummary.values()).map((g) => [
    g.spec,
    `${g.w} x ${g.h}`,
    g.qty,
    `${(((g.w * g.h) / 1000000) * g.qty).toFixed(2)} m2`,
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [["ESPECIFICACIÓN", "MEDIDA (mm)", "CANTIDAD", "TOTAL M2"]],
    body: glassBody,
    theme: "striped",
    headStyles: { fillColor: [71, 85, 105] },
  });
  currentY = (doc as any).lastAutoTable.finalY + 15;
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }
  doc.setFontSize(11);
  doc.text("3. LISTADO DE HERRAJES, GOMAS Y FELPAS", 15, currentY);
  currentY += 5;
  const accSummary = new Map<
    string,
    { code: string; detail: string; qty: number; isLinear: boolean }
  >();
  quote.items.forEach((item) => {
    item.composition.modules.forEach((mod) => {
      const recipe = recipes.find((r) => r.id === mod.recipeId);
      if (!recipe) return;
      const { accessories: dvhAccs } = getDVHExtras(recipes, mod.isDVH || false);
      let activeAccs =
        mod.overriddenAccessories && mod.overriddenAccessories.length > 0
          ? mod.overriddenAccessories
          : recipe.accessories || [];
          
      activeAccs = [...activeAccs, ...dvhAccs.map((a: any) => ({ ...a, isAlternative: false }))];
      activeAccs = filterDVHProfiles(activeAccs, mod.isDVH, mod.dvhCameraId, dvhInputs, accessories) as any[];
      const uniqueAccs: any[] = [];
      activeAccs.forEach(a => {
         if (!uniqueAccs.some(u => u.accessoryId === a.accessoryId)) uniqueAccs.push(a);
      });
      activeAccs = uniqueAccs;

      activeAccs.forEach((ra) => {
        if (ra.isAlternative) return;
        const acc = accessories.find(
          (a) => a.id === ra.accessoryId || a.code === ra.accessoryId,
        );
        if (!acc) return;
        
        // Calculate sales quantity if it's SALES
        let calculatedQty = Number(ra.quantity || 0);
        if (mod.isDVH && mod.dvhCameraId) {
           if (acc.detail.toUpperCase().includes('SAL') || acc.code.toUpperCase().includes('SAL')) {
              let camInput = dvhInputs.find(c => c.id === mod.dvhCameraId);
              let camThick = camInput?.thickness || 12;
              if (!camInput?.thickness && typeof camInput?.detail === 'string') {
                const m = camInput.detail.match(/(\d+)\s*mm/i);
                if (m) camThick = parseInt(m[1], 10);
              }
              const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
              const totalPerimeterMeters = panes.reduce((acc, pane) => {
                 if (pane.isBlind) return acc;
                 return acc + ((Math.max(pane.w || 0, 0) + Math.max(pane.h || 0, 0)) * 2) / 1000;
              }, 0);
              calculatedQty = calculateSalesGrams(totalPerimeterMeters, camThick);
           } else if (acc.detail.toUpperCase().includes('ESCUADRA') || acc.code.toUpperCase().includes('ESCUADRA')) {
              const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
              const panesCount = panes.filter((p) => !p.isBlind).length;
              calculatedQty = Number(ra.quantity || 4) * panesCount;
           }
        }
        
        if (calculatedQty <= 0 && ra.quantity > 0) return; // Ignore if calculated to 0

        const isSal = mod.isDVH && mod.dvhCameraId && (acc.detail.toUpperCase().includes('SAL') || acc.code.toUpperCase().includes('SAL'));

        const existing = accSummary.get(acc.id) || {
          code: acc.code,
          detail: acc.detail,
          qty: 0,
          isLinear: ra.isLinear || false,
          isSal: isSal,
        };
        if (ra.isLinear && ra.formula) {
           const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
           panes.forEach((pane) => {
             const lengthMm = evaluateFormula(
               ra.formula,
               pane.w || 1000,
               pane.h || 1000,
             );
             existing.qty += (lengthMm / 1000) * calculatedQty * item.quantity;
           });
        } else if (ra.isSpaced && ra.spacingMm && ra.formula) {
           const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
           panes.forEach((pane) => {
             const lengthMm = evaluateFormula(
               ra.formula,
               pane.w || 1000,
               pane.h || 1000,
             );
             const count = Math.ceil(lengthMm / ra.spacingMm);
             existing.qty += count * (calculatedQty === 0 ? 1 : calculatedQty) * item.quantity;
           });
        } else {
           existing.qty += calculatedQty * item.quantity;
        }
        accSummary.set(acc.id, existing);
      });
    });

    if (item.extras.mosquitero && item.extras.mosquiteroRecipeId) {
       const mosqRecipe = recipes.find(r => r.id === item.extras.mosquiteroRecipeId);
       if (mosqRecipe) {
           let mosqW = item.width;
           const baseRecipe = recipes.find(r => r.id === item.composition.modules[0]?.recipeId);
           if (baseRecipe?.visualType && (baseRecipe.visualType.toLowerCase().includes("sliding") || (baseRecipe.leaves || 1) > 1)) {
             mosqW = Math.round(item.width / Math.max(1, (baseRecipe.leaves || 2)));
           }
           
           (mosqRecipe.accessories || []).forEach(ra => {
             if (ra.isAlternative) return;
             if ((ra.quantity || 0) <= 0) return;
             const acc = accessories.find(a => a.id === ra.accessoryId || a.code === ra.accessoryId);
             if (!acc) return;
             const existing = accSummary.get(acc.id) || { code: acc.code, detail: acc.detail, qty: 0, isLinear: ra.isLinear || false };
             
             if (ra.isLinear && ra.formula) {
                 const lengthMm = evaluateFormula(ra.formula, mosqW, item.height);
                 existing.qty += (lengthMm / 1000) * ra.quantity * item.quantity;
             } else if (ra.isSpaced && ra.spacingMm && ra.formula) {
                 const lengthMm = evaluateFormula(ra.formula, mosqW, item.height);
                 const count = Math.ceil(lengthMm / ra.spacingMm);
                 existing.qty += count * (ra.quantity || 1) * item.quantity;
             } else {
                 existing.qty += ra.quantity * item.quantity;
             }
             accSummary.set(acc.id, existing);
           });
       }
    }
  });
  const accBody = Array.from(accSummary.values()).map((a: any) => [
    a.code,
    a.detail,
    a.isSal ? `${a.qty.toFixed(0)} g` : (a.isLinear ? `${a.qty.toFixed(2)} m` : a.qty),
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [["CÓDIGO", "DESCRIPCIÓN", "CANTIDAD TOTAL"]],
    body: accBody,
    theme: "grid",
    headStyles: { fillColor: [100, 116, 139] },
    styles: { fontSize: 8 },
  });
  doc.save(`Pedido_Consolidado_${quote.clientName}.pdf`);
};

export const generateClientDetailedPDF = (
  quote: Quote,
  config: GlobalConfig,
  recipes: ProductRecipe[],
  glasses: Glass[],
  dvhInputs: DVHInput[],
  treatments: Treatment[],
  accessories: Accessory[],
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  if (config.companyLogo) {
    try {
      const imgProps = doc.getImageProperties(config.companyLogo);
      const maxH = 18;
      const drawW = (imgProps.width * maxH) / imgProps.height;
      doc.addImage(
        config.companyLogo,
        "PNG",
        pageWidth / 2 - drawW / 2,
        10,
        drawW,
        maxH,
      );
    } catch (e) {}
  }
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(config.companyName || "PRESUPUESTO COMERCIAL", pageWidth / 2, 35, {
    align: "center",
  });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${config.companyAddress || ""} | Tel: ${config.companyPhone || ""}`,
    pageWidth / 2,
    40,
    { align: "center" },
  );
  doc.setDrawColor(230);
  doc.line(20, 45, pageWidth - 20, 45);
  doc.setFontSize(10);
  doc.text(`CLIENTE: ${quote.clientName.toUpperCase()}`, 20, 55);
  doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - 20, 55, {
    align: "right",
  });

  const tableData = quote.items.map((item, idx) => {
    const treatment = treatments.find((t) => t.id === item.colorId);
    const moduleRecipes = item.composition.modules
      .map((m) => recipes.find((r) => r.id === m.recipeId))
      .filter(Boolean);
    const moduleNames = moduleRecipes.map((r) => r?.name);
    const recipeLine = moduleRecipes[0]?.line || "No especificada";
    const isFrenteIntegral = recipeLine.toLowerCase() === "frente integral";
    const compositeName =
      moduleNames.length > 1
        ? (isFrenteIntegral ? `CONJUNTO: FRENTE INTEGRAL` : `CONJUNTO: ${moduleNames.join(" + ")}`)
        : moduleNames[0] || "Abertura";
    let glassDetailStr = "No definido";
    let topAccessories = "";
    const firstMod = item.composition.modules?.[0];
    if (firstMod) {
      const recipe = recipes.find((r) => r.id === firstMod.recipeId);
      const activeRecipeAccs = firstMod.overriddenAccessories && firstMod.overriddenAccessories.length > 0 
        ? firstMod.overriddenAccessories 
        : (recipe?.accessories || []);

      if (activeRecipeAccs && activeRecipeAccs.length > 0) {
        const accs = activeRecipeAccs
          .filter((ra) => !ra.isAlternative)
          .map((ra) => accessories.find((a) => a.id === ra.accessoryId))
          .filter(Boolean)
          .filter((acc) => acc && !acc.detail.toLowerCase().includes("escuadra"))
          .slice(0, 2)
          .map((acc) => acc?.detail || "")
          .filter(Boolean);
        if (accs.length > 0) {
          topAccessories = `\nAccesorios: ${accs.join(", ")}`;
        }
      }
      if (recipe?.visualType === "mosquitero") {
        glassDetailStr = "TELA MOSQUITERA (ALUMINIO)";
      } else {
        const gOuter = glasses.find((g) => g.id === firstMod.glassOuterId);
        if (firstMod.isDVH) {
          const gInner = glasses.find((g) => g.id === firstMod.glassInnerId);
          const camera = dvhInputs.find((i) => i.id === firstMod.dvhCameraId);
          glassDetailStr = `${gOuter?.detail || "?"} / ${camera?.detail || "?"} / ${gInner?.detail || "?"}`;
        } else {
          glassDetailStr = gOuter?.detail || "Simple";
        }
      }
    }
    let desc = `${item.itemCode || `POS#${idx + 1}`}: ${compositeName}\nLínea: ${recipeLine}\nAcabado: ${treatment?.name || "-"}\nLlenado: ${glassDetailStr}${topAccessories}`;
    if (item.extras?.mosquitero) desc += `\nAdicional: CON MOSQUITERO`;
    return [
      idx + 1,
      "",
      desc,
      `${item.width} x ${item.height}`,
      item.quantity,
      `$${item.calculatedCost.toLocaleString()}`,
      `$${(item.calculatedCost * item.quantity).toLocaleString()}`,
    ];
  });

  autoTable(doc, {
    startY: 65,
    head: [
      [
        "#",
        "DIBUJO",
        "DETALLE TÉCNICO",
        "MEDIDAS",
        "CANT.",
        "UNIT.",
        "SUBTOTAL",
      ],
    ],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, valign: "middle" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const item = quote.items[data.row.index];
        if (item && item.previewImage) {
          try {
            const imgProps = doc.getImageProperties(item.previewImage);
            const cellW = data.cell.width - 4;
            const cellH = 30;
            const ratio = Math.min(
              cellW / imgProps.width,
              cellH / imgProps.height,
            );
            const drawW = imgProps.width * ratio;
            const drawH = imgProps.height * ratio;
            const offsetX = (cellW - drawW) / 2;
            const offsetY = (cellH - drawH) / 2;
            doc.setDrawColor(200);
            doc.rect(
              data.cell.x + 2 + offsetX,
              data.cell.y + 2 + offsetY,
              drawW,
              drawH,
              "D",
            );
            doc.addImage(
              item.previewImage,
              "JPEG",
              data.cell.x + 2 + offsetX,
              data.cell.y + 2 + offsetY,
              drawW,
              drawH,
            );
          } catch (e) {}
        }
      }
    },
    columnStyles: {
      1: { cellWidth: 45, minCellHeight: 35 },
      2: { cellWidth: "auto" },
      3: { minCellWidth: 25 },
      6: { halign: "right", fontStyle: "bold" },
    },
  });
  const lastTable = (doc as any).lastAutoTable;
  let finalY = lastTable ? lastTable.finalY + 10 : 200;
  
  const subtotal = quote.items.reduce(
    (acc, i) => acc + i.calculatedCost * i.quantity,
    0,
  );
  const tax = Math.round(subtotal * (config.taxRate / 100));
  const totalBeforeDiscount = subtotal + tax;
  const discountAmount = quote.discount ? Math.round(totalBeforeDiscount * (quote.discount / 100)) : 0;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal Neto: $${subtotal.toLocaleString()}`, pageWidth - 20, finalY, { align: "right" });
  finalY += 6;
  
  if (tax > 0) {
    doc.text(`IVA (${config.taxRate}%): $${tax.toLocaleString()}`, pageWidth - 20, finalY, { align: "right" });
    finalY += 6;
  }
  
  if (quote.discount && quote.discount > 0) {
    doc.setTextColor(220, 38, 38); // red
    doc.text(`Descuento (${quote.discount}%): -$${discountAmount.toLocaleString()}`, pageWidth - 20, finalY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    finalY += 6;
  }
  
  finalY += 4;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(
    `TOTAL FINAL: $${quote.totalPrice.toLocaleString()}`,
    pageWidth - 20,
    finalY,
    { align: "right" },
  );

  if (config.quoteFooterNotes && config.quoteFooterNotes.trim() !== "") {
    finalY += 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    
    // Split text to fit within page bounds (20 margin on each side)
    const splitNotes = doc.splitTextToSize(config.quoteFooterNotes, pageWidth - 40);
    
    // Automatically add a new page if the notes are too long for the current page
    if (finalY + (splitNotes.length * 4) > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      finalY = 20;
    }
    
    doc.text(splitNotes, 20, finalY);
  }

  doc.save(`Presupuesto_${quote.clientName}.pdf`);
};

export const generateRecipeTechnicalPDF = (
  recipe: ProductRecipe,
  aluminum: AluminumProfile[],
  accessories: Accessory[],
  config: GlobalConfig,
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text("FICHA TÉCNICA DE INGENIERÍA", 15, 20);
  doc.setFontSize(10);
  doc.text(`SISTEMA: ${recipe.name} | LÍNEA: ${recipe.line}`, 15, 28);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1. PERFILES ESTRUCTURALES", 15, 50);

  const profileData = recipe.profiles.map((rp) => {
    const pDef = aluminum.find((a) => a.id === rp.profileId);
    return [
      pDef?.code || "S/D",
      pDef?.detail || "Sin Detalle",
      rp.quantity,
      rp.formula,
      `${rp.cutStart}° / ${rp.cutEnd}°`,
    ];
  });
  autoTable(doc, {
    startY: 55,
    head: [["CÓDIGO", "DETALLE TÉCNICO", "CANT", "FÓRMULA", "CORTES"]],
    body: profileData,
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229] },
  });

  let y = (doc as any).lastAutoTable.finalY + 15;

  doc.setFontSize(12);
  doc.text("2. DEDUCCIONES DE VIDRIO", 15, y);
  autoTable(doc, {
    startY: y + 5,
    head: [["TIPO", "ANCHO (Deducción)", "ALTO (Deducción)"]],
    body: [
      [
        "Vidrio Simple (VS)",
        recipe.glassFormulaW || 0,
        recipe.glassFormulaH || 0,
      ],
      ["Travesaño (VS)", recipe.transomGlassDeduction || 0, "-"],
      [
        "DVH (Fórmula)",
        recipe.dvhFormulaW || "N/A",
        recipe.dvhFormulaH || "N/A",
      ],
      ["DVH Travesaño", recipe.dvhTransomGlassDeduction || 0, "-"],
    ],
    theme: "grid",
    headStyles: { fillColor: [5, 150, 105] },
  });

  if (recipe.mosquiteroFormulaW || recipe.mosquiteroFormulaH) {
    y = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text("4. DEDUCCIONES DE MOSQUITERO", 15, y);
    autoTable(doc, {
      startY: y + 5,
      head: [["ANCHO (Fórmula)", "ALTO (Fórmula)"]],
      body: [
        [
          recipe.mosquiteroFormulaW || "N/A",
          recipe.mosquiteroFormulaH || "N/A",
        ],
      ],
      theme: "grid",
      headStyles: { fillColor: [245, 158, 11] },
    });
  }

  y = (doc as any).lastAutoTable.finalY + 15;

  doc.setFontSize(12);
  doc.text("5. ACCESORIOS", 15, y);
  const accData = recipe.accessories.map((ra) => {
    const acc = accessories.find((a) => a.id === ra.accessoryId);
    return [
      acc?.code || "S/D",
      acc?.detail || "Sin Detalle",
      ra.quantity,
      ra.isLinear ? "ML" : "UNID",
    ];
  });
  autoTable(doc, {
    startY: y + 5,
    head: [["CÓDIGO", "DETALLE", "CANT", "TIPO"]],
    body: accData,
    theme: "grid",
    headStyles: { fillColor: [220, 38, 38] },
  });

  doc.save(`Ficha_${recipe.name}.pdf`);
};

export const generateAssemblyOrderPDF = (
  quote: Quote,
  recipes: ProductRecipe[],
  aluminum: AluminumProfile[],
  glasses: Glass[],
  dvhInputs: DVHInput[],
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("HOJA DE RUTA Y ARMADO DE TALLER", 15, 12);
  doc.setFontSize(9);
  doc.text(
    `OBRA: ${quote.clientName.toUpperCase()} | FECHA: ${new Date().toLocaleDateString()}`,
    15,
    18,
  );
  let currentY = 35;
  quote.items.forEach((item, idx) => {
    const { isManualDim, colRatios, rowRatios, couplingDeduction } =
      item.composition;
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(10, currentY, pageWidth - 20, 10, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const moduleRecipes = item.composition.modules
      .map((m) => recipes.find((r) => r.id === m.recipeId))
      .filter(Boolean);
    const moduleNames = moduleRecipes.map((r) => r?.name);
    const recipeLine = moduleRecipes[0]?.line || "-";
    const isFrenteIntegral = recipeLine.toLowerCase() === "frente integral";
    const compositeName =
      moduleNames.length > 1
        ? (isFrenteIntegral ? `CONJUNTO: FRENTE INTEGRAL` : `CONJUNTO: ${moduleNames.join(" + ")}`)
        : moduleNames[0] || "Abertura";
    const isSet = item.composition.modules.length > 1;
    const cProfile = item.couplingProfileId
      ? aluminum.find((p) => p.id === item.couplingProfileId)
      : null;
    const realDeduction = Number(cProfile?.thickness ?? couplingDeduction ?? 0);
    const validModules = item.composition.modules.filter(
      (m) => m && typeof m.x === "number" && typeof m.y === "number",
    );
    if (validModules.length === 0) return;
    const minX = Math.min(...validModules.map((m) => m.x));
    const minY = Math.min(...validModules.map((m) => m.y));
    const maxX = Math.max(...validModules.map((m) => m.x));
    const maxY = Math.max(...validModules.map((m) => m.y));
    doc.text(
      `${item.itemCode || `POS#${idx + 1}`} - ${compositeName} (Línea: ${recipeLine}) - CANT: ${item.quantity}`,
      15,
      currentY + 6.5,
    );
    currentY += 15;
    if (item.previewImage) {
      try {
        const imgProps = doc.getImageProperties(item.previewImage);
        const drawH = 35;
        const drawW = (imgProps.width * drawH) / imgProps.height;
        doc.addImage(item.previewImage, "JPEG", 15, currentY, drawW, drawH);
      } catch (e) {}
    }
    const profileCuts: any[] = [];
    validModules.forEach((mod) => {
      const recipe = recipes.find((r) => r.id === mod.recipeId);
      if (!recipe) return;
      const { modW, modH } = calculateModuleDimensions(
        mod,
        colRatios,
        rowRatios,
        minX,
        maxX,
        minY,
        maxY,
        realDeduction,
        isManualDim,
      );

      const isTrapezoid =
        (recipe.type === "Paño Fijo" ||
         recipe.name.toLowerCase().includes("paño fijo") ||
         recipe.name.toLowerCase().includes("pf") ||
         recipe.id === "vidrio_solo" ||
         recipe.name.toLowerCase().includes("vidrio")) &&
        mod.leftHeight !== undefined &&
        mod.rightHeight !== undefined &&
        mod.leftHeight > 0 &&
        mod.rightHeight > 0 &&
        mod.leftHeight !== mod.rightHeight;

      const inclinedW = isTrapezoid
        ? Math.sqrt(Math.pow(modW, 2) + Math.pow(mod.rightHeight! - mod.leftHeight!, 2))
        : modW;

      const transomTemplate = (recipe.profiles || []).find(
        (rp) =>
          rp.role === "Travesaño" ||
          (rp.role && rp.role.toLowerCase().includes("trave")),
      );
      const recipeTransomFormula =
        transomTemplate?.formula || recipe.transomFormula || "W";
      const recipeTransomQty = transomTemplate?.quantity || 1;

      // Cálculo de espesor de vidrio para selección dinámica
      const gOuter = glasses.find((g) => g.id === mod.glassOuterId);
      const gInner = mod.isDVH
        ? glasses.find((g) => g.id === mod.glassInnerId)
        : null;
      const dvhCam = mod.isDVH
        ? dvhInputs.find((i) => i.id === mod.dvhCameraId)
        : null;
      let camThick = 12;
      if (dvhCam) {
        camThick = dvhCam.thickness || 12;
        if (!dvhCam.thickness) {
          const m = dvhCam.detail.match(/(\d+)\s*mm/i);
          if (m) camThick = parseInt(m[1]);
        }
      }
      const getThick = (g: any) => {
        if (!g) return 0;
        if (g.thickness) return g.thickness;
        const m = g.detail.match(/(\d+)\s*mm/i);
        if (m) return parseInt(m[1]);
        const mc = g.code.match(/(\d+)\s*mm/i);
        if (mc) return parseInt(mc[1]);
        return 4;
      };
      const totalGlassThick =
        getThick(gOuter) + (mod.isDVH ? getThick(gInner) + camThick : 0);
      const beadStyle = item.glazingBeadStyle || "Recto";

      const filteredProfiles3 = filterDVHProfiles(recipe.profiles || [], mod.isDVH, mod.dvhCameraId, dvhInputs, aluminum) as any[];

      let totalPlainHorizontalMarcoQty = 0;
      filteredProfiles3.forEach((rp) => {
        if (rp.alternative && rp.alternative !== (mod.leafAlternative || "A"))
          return;
        const rLower = (rp.role || "").toLowerCase();
        const fUpper = (rp.formula || "").toUpperCase();
        const isPlainHorizontalMarco =
          (rLower.includes("marco") || rLower.includes("marcos")) &&
          fUpper.includes("W") &&
          !fUpper.includes("H") &&
          !rLower.includes("cabe") &&
          !rLower.includes("dintel") &&
          !rLower.includes("superior") &&
          !rLower.includes("sup") &&
          !rLower.includes("umbra") &&
          !rLower.includes("inferior") &&
          !rLower.includes("inf") &&
          !rLower.includes("zoc") &&
          !rLower.includes("zócalo") &&
          !rLower.includes("zocalo");
        if (isPlainHorizontalMarco) {
          totalPlainHorizontalMarcoQty += Number(rp.quantity || 0);
        }
      });

      let processedPlainHorizontalMarcoQty = 0;

      filteredProfiles3.forEach((rp) => {
        if (rp.alternative && rp.alternative !== (mod.leafAlternative || "A"))
          return;
        const role = rp.role?.toLowerCase() || "";
        if (role === "travesaño") return;
        let p = aluminum.find((a) => a.id === rp.profileId);

        // Lógica de Contravidrio Dinámico
        if (
          rp.glazingBeadOptions &&
          Array.isArray(rp.glazingBeadOptions) &&
          rp.glazingBeadOptions.length > 0
        ) {
          const candidates = aluminum.filter((pf) =>
            (rp.glazingBeadOptions || []).includes(pf.id),
          );
          let styleMatches = candidates.filter(
            (pf) => pf.glazingBeadStyle === beadStyle,
          );
          if (styleMatches.length === 0) styleMatches = candidates;

          let bestMatch = styleMatches.find((pf) => {
            const min = pf.minGlassThickness || 0;
            const max = pf.maxGlassThickness || 100;
            return totalGlassThick >= min && totalGlassThick <= max;
          });

          if (!bestMatch) {
            bestMatch = candidates.find((pf) => {
              const min = pf.minGlassThickness || 0;
              const max = pf.maxGlassThickness || 100;
              return totalGlassThick >= min && totalGlassThick <= max;
            });
          }

          if (bestMatch) p = bestMatch;
        }

        // Exclusión centralizada de Tapajuntas en hoja de taller
        const isTJ =
          role.includes("tapa") ||
          String(p?.code || "")
            .toUpperCase()
            .includes("TJ") ||
          p?.id === recipe.defaultTapajuntasProfileId;
        if (isTJ) return;

        const isMosq =
          role.includes("mosquitero") || p?.id === recipe.mosquiteroProfileId;
        if (isMosq && !item.extras.mosquitero) return;

        if (item.quotingMode === "Solo Marcos") {
           if (role.includes("hoja") || role.includes("contravidrio") || isMosq) return;
        } else if (item.quotingMode === "Solo Hojas") {
           if (role.includes("marco") || role.includes("zócalo") || role.includes("zocalo") || role.includes("acople") || role.includes("columna") || role.includes("viga") || role.includes("encuentro") || role.includes("travesaño") || role.includes("travesano")) return;
        }

        if (isTrapezoid) {
          const isContravidrio = role === "contravidrio" || role.includes("contra");
          const isVertical =
            role.includes("jamba") ||
            role.includes("lateral") ||
            role.includes("parante") ||
            role.includes("mocheta") ||
            (!role.includes("cabe") && !role.includes("dintel") && !role.includes("umbra") && !role.includes("zoc") && rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W"));

          const isTopHorizontal =
            role.includes("dintel") ||
            role.includes("cabezal") ||
            role.includes("superior");

          if (isContravidrio) {
            if (rp.formula.toUpperCase().includes("H") && !rp.formula.toUpperCase().includes("W")) {
              const qtyLeft = Math.ceil(rp.quantity / 2);
              const qtyRight = Math.floor(rp.quantity / 2);
              const cutLeft = evaluateFormula(rp.formula, modW, mod.leftHeight!);
              const cutRight = evaluateFormula(rp.formula, modW, mod.rightHeight!);
              if (cutLeft > 0) {
                profileCuts.push([
                  p?.code || "S/D",
                  (p?.detail || "-") + " Izq",
                  Math.round(cutLeft),
                  qtyLeft,
                  `${rp.cutStart}° / ${rp.cutEnd}°`,
                ]);
              }
              if (cutRight > 0) {
                profileCuts.push([
                  p?.code || "S/D",
                  (p?.detail || "-") + " Der",
                  Math.round(cutRight),
                  qtyRight,
                  `${rp.cutStart}° / ${rp.cutEnd}°`,
                ]);
              }
            } else {
              const qtyBottom = Math.ceil(rp.quantity / 2);
              const qtyTop = Math.floor(rp.quantity / 2);
              const cutBottom = evaluateFormula(rp.formula, modW, modH);
              const cutTop = evaluateFormula(rp.formula, inclinedW, modH);
              if (cutBottom > 0) {
                profileCuts.push([
                  p?.code || "S/D",
                  (p?.detail || "-") + " Inf",
                  Math.round(cutBottom),
                  qtyBottom,
                  `${rp.cutStart}° / ${rp.cutEnd}°`,
                ]);
              }
              if (cutTop > 0) {
                profileCuts.push([
                  p?.code || "S/D",
                  (p?.detail || "-") + " Sup",
                  Math.round(cutTop),
                  qtyTop,
                  `${rp.cutStart || "45"}° / ${rp.cutEnd || "45"}°`,
                ]);
              }
            }
          } else if (isVertical) {
            const qtyLeft = Math.ceil(rp.quantity / 2);
            const qtyRight = Math.floor(rp.quantity / 2);
            const cutLeft = evaluateFormula(rp.formula, modW, mod.leftHeight!);
            const cutRight = evaluateFormula(rp.formula, modW, mod.rightHeight!);
            if (cutLeft > 0) {
              profileCuts.push([
                p?.code || "S/D",
                (p?.detail || "-") + " Izq",
                Math.round(cutLeft),
                qtyLeft,
                `${rp.cutStart}° / ${rp.cutEnd}°`,
              ]);
            }
            if (cutRight > 0) {
              profileCuts.push([
                p?.code || "S/D",
                (p?.detail || "-") + " Der",
                Math.round(cutRight),
                qtyRight,
                `${rp.cutStart}° / ${rp.cutEnd}°`,
              ]);
            }
          } else if (isTopHorizontal) {
            const cutLen = evaluateFormula(rp.formula, inclinedW, modH);
            if (cutLen > 0) {
              profileCuts.push([
                p?.code || "S/D",
                (p?.detail || "-") + " Sup (Inclinado)",
                Math.round(cutLen),
                rp.quantity,
                `${rp.cutStart}° / ${rp.cutEnd}°`,
              ]);
            }
          } else if (
            (role.includes("marco") || role.includes("marcos")) &&
            rp.formula.toUpperCase().includes("W") &&
            !rp.formula.toUpperCase().includes("H") &&
            !role.includes("cabe") &&
            !role.includes("dintel") &&
            !role.includes("superior") &&
            !role.includes("sup") &&
            !role.includes("umbra") &&
            !role.includes("inferior") &&
            !role.includes("inf") &&
            !role.includes("zoc") &&
            !role.includes("zócalo") &&
            !role.includes("zocalo")
          ) {
            const qty = Number(rp.quantity || 0);
            let qtyBottom = 0;
            let qtyTop = 0;
            for (let k = 0; k < qty; k++) {
              const globalIdx = processedPlainHorizontalMarcoQty + k;
              if (globalIdx < Math.ceil(totalPlainHorizontalMarcoQty / 2)) {
                qtyBottom++;
              } else {
                qtyTop++;
              }
            }
            processedPlainHorizontalMarcoQty += qty;

            const cutBottom = evaluateFormula(rp.formula, modW, modH);
            const cutTop = evaluateFormula(rp.formula, inclinedW, modH);

            if (cutBottom > 0 && qtyBottom > 0) {
              profileCuts.push([
                p?.code || "S/D",
                (p?.detail || "-") + " Inf",
                Math.round(cutBottom),
                qtyBottom,
                `${rp.cutStart}° / ${rp.cutEnd}°`,
              ]);
            }
            if (cutTop > 0 && qtyTop > 0) {
              profileCuts.push([
                p?.code || "S/D",
                (p?.detail || "-") + " Sup (Inclinado)",
                Math.round(cutTop),
                qtyTop,
                `${rp.cutStart || "45"}° / ${rp.cutEnd || "45"}°`,
              ]);
            }
          } else {
            const cutLen = evaluateFormula(rp.formula, modW, modH);
            if (cutLen > 0) {
              profileCuts.push([
                p?.code || "S/D",
                (p?.detail || "-") + " Inf/Cab",
                Math.round(cutLen),
                rp.quantity,
                `${rp.cutStart}° / ${rp.cutEnd}°`,
              ]);
            }
          }
        } else {
          const cutLen = evaluateFormula(rp.formula, modW, modH);
          profileCuts.push([
            p?.code || "S/D",
            p?.detail || "-",
            Math.round(cutLen),
            rp.quantity,
            `${rp.cutStart}° / ${rp.cutEnd}°`,
          ]);
        }
      });
      if (mod.transoms && mod.transoms.length > 0) {
        mod.transoms.forEach((t) => {
          const trProf = aluminum.find((p) => p.id === t.profileId);
          if (trProf) {
            const f = t.formula || recipeTransomFormula;
            const cutLen = evaluateFormula(f, modW, modH);
            profileCuts.push([
              trProf.code,
              trProf.detail,
              Math.round(cutLen),
              recipeTransomQty,
              "90° / 90°",
            ]);
          }
        });
      }

      if (mod.isDVH && mod.dvhCameraId) {
         const { profiles: rawDvhProfs } = getDVHExtras(recipes, mod.isDVH);
         const dvhProfs = filterDVHProfiles(rawDvhProfs, mod.isDVH, mod.dvhCameraId, dvhInputs, aluminum) as any[];
         const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
         panes.forEach(pane => {
             if (pane.isBlind) return;
             dvhProfs.forEach(rp => {
                 let pDef = aluminum.find((a) => a.id === rp.profileId);
                 if (!pDef) return;
                 let length = evaluateFormula(rp.formula, pane.w, pane.h);
                 profileCuts.push([
                     pDef.code || "S/D",
                     pDef.detail || "-",
                     Math.round(length),
                     rp.quantity,
                     `${rp.cutStart || 90}° / ${rp.cutEnd || 90}°`,
                 ]);
             });
         });
      }

      const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
      const visualType = (recipe.visualType || "").toLowerCase();
      let numLeaves = recipe.leaves || 1;
      if (!recipe.leaves) {
        if (
          visualType.includes("sliding_3") ||
          visualType.includes("corrediza_3") ||
          visualType.includes("triple") ||
          visualType.includes("3h")
        )
          numLeaves = 3;
        else if (
          visualType.includes("sliding_4") ||
          visualType.includes("corrediza_4") ||
          visualType.includes("four") ||
          visualType.includes("4h")
        )
          numLeaves = 4;
        else if (
          visualType.includes("sliding") ||
          visualType.includes("corrediza")
        )
          numLeaves = 2;
        else if (
          visualType.includes("double") ||
          visualType.includes("doble") ||
          visualType.includes("2h")
        )
          numLeaves = 2;
      }
      
      if (item.quotingMode === "Solo Marcos") {
         // Do not show glasses if Solo Marcos
      } else {
        panes.forEach((p, pIdx) => {
          if (p.isBlind) {
            const slatId = mod.slatProfileIds?.[pIdx];
            if (slatId) {
              const slatProf = aluminum.find((a) => a.id === slatId);
              const slatCoverage = slatProf && slatProf.thickness > 0 ? slatProf.thickness : 120;
              if (slatProf && slatCoverage > 0) {
                const numSlats = Math.ceil(p.h / slatCoverage);
                profileCuts.push([
                  slatProf.code,
                  `Tablilla (${pIdx + 1})`,
                  Math.round(p.w),
                  numSlats,
                  "90° / 90°",
                ]);
              }
            }
          }
        });
      }
    });
    if (item.couplingProfileId && isSet) {
      const trProf = aluminum.find((p) => p.id === item.couplingProfileId);
      if (trProf) {
        if (item.composition.colRatios.length > 1) {
          for (let x = minX; x < maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const mL = validModules.find((m) => m.x === x && m.y === y);
              const mR = validModules.find((m) => m.x === x + 1 && m.y === y);
              if (mL && mR) {
                const hL =
                  isManualDim && mL.height
                    ? mL.height
                    : Number(rowRatios[y - minY] || 0);
                const hR =
                  isManualDim && mR.height
                    ? mR.height
                    : Number(rowRatios[y - minY] || 0);
                profileCuts.push([
                  trProf.code,
                  "Acople Conjunto V",
                  Math.round(Math.min(hL, hR)),
                  1,
                  "90° / 90°",
                ]);
              }
            }
          }
        }
        if (item.composition.rowRatios.length > 1) {
          for (let y = minY; y < maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const mT = validModules.find((m) => m.x === x && m.y === y);
              const mB = validModules.find((m) => m.x === x && m.y === y + 1);
              if (mT && mB) {
                const wT =
                  isManualDim && mT.width
                    ? mT.width
                    : Number(colRatios[x - minX] || 0);
                const wB =
                  isManualDim && mB.width
                    ? mB.width
                    : Number(colRatios[x - minX] || 0);
                profileCuts.push([
                  trProf.code,
                  "Acople Conjunto H",
                  Math.round(Math.min(wT, wB)),
                  1,
                  "90° / 90°",
                ]);
              }
            }
          }
        }
      }
    }

    // Sumatoria Unificada de Tapajuntas en la Hoja de Taller
    if (item.extras.tapajuntas) {
      const firstRecipe = recipes.find(
        (r) => r.id === item.composition.modules[0].recipeId,
      );
      let tjProfile = aluminum.find(
        (p) => p.id === firstRecipe?.defaultTapajuntasProfileId,
      );

      // Fallback
      if (!tjProfile && firstRecipe) {
        const tjRef = firstRecipe.profiles.find((p) => p.role === "Tapajuntas");
        if (tjRef) tjProfile = aluminum.find((p) => p.id === tjRef.profileId);
      }

      // Fallback global
      if (!tjProfile) {
        tjProfile = aluminum.find(
          (p) =>
            p.code.toUpperCase().includes("TJ") ||
            p.detail.toLowerCase().includes("tapajunta"),
        );
      }

      if (tjProfile) {
        const tjThick = Number(tjProfile.thickness || 30);
        const { top, bottom, left, right } = item.extras.tapajuntasSides;

        const firstTrapMod = validModules.find((m) => {
          const r = recipes.find((x) => x.id === m.recipeId);
          if (!r) return false;
          return (
            (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
            m.leftHeight !== undefined &&
            m.rightHeight !== undefined &&
            m.leftHeight > 0 &&
            m.rightHeight > 0 &&
            m.leftHeight !== m.rightHeight
          );
        });

        let lh = item.height;
        let rh = item.height;
        let isTrap = false;

        if (isSet) {
          const minX = Math.min(...validModules.map((m) => m.x));
          const minY = Math.min(...validModules.map((m) => m.y));
          const maxX = Math.max(...validModules.map((m) => m.x));
          const maxY = Math.max(...validModules.map((m) => m.y));
          const colRatios = item.composition.colRatios || [];
          const rowRatios = item.composition.rowRatios || [];
          const isManualDim = item.composition.isManualDim;

          // LHS total height
          let lhsSum = 0;
          let lhsCouplings = 0;
          for (let y = minY; y <= maxY; y++) {
            const mod = validModules.find((m) => m.x === minX && m.y === y);
            if (mod) {
              const r = recipes.find((x) => x.id === mod.recipeId);
              const { modH } = calculateModuleDimensions(
                mod,
                colRatios,
                rowRatios,
                minX,
                maxX,
                minY,
                maxY,
                realDeduction,
                isManualDim,
              );
              
              const isModTrap = r &&
                (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
                mod.leftHeight !== undefined &&
                mod.rightHeight !== undefined &&
                mod.leftHeight > 0 &&
                mod.rightHeight > 0 &&
                mod.leftHeight !== mod.rightHeight;

              const modLh = isModTrap ? mod.leftHeight! : modH;
              lhsSum += modLh;
              if (y < maxY) {
                const belowMod = validModules.find((m) => m.x === minX && m.y === y + 1);
                if (belowMod) {
                  lhsCouplings += realDeduction;
                }
              }
            }
          }
          lh = lhsSum + lhsCouplings;

          // RHS total height
          let rhsSum = 0;
          let rhsCouplings = 0;
          for (let y = minY; y <= maxY; y++) {
            const mod = validModules.find((m) => m.x === maxX && m.y === y);
            if (mod) {
              const r = recipes.find((x) => x.id === mod.recipeId);
              const { modH } = calculateModuleDimensions(
                mod,
                colRatios,
                rowRatios,
                minX,
                maxX,
                minY,
                maxY,
                realDeduction,
                isManualDim,
              );
              
              const isModTrap = r &&
                (r.type === "Paño Fijo" || r.name.toLowerCase().includes("paño fijo") || r.name.toLowerCase().includes("pf")) &&
                mod.leftHeight !== undefined &&
                mod.rightHeight !== undefined &&
                mod.leftHeight > 0 &&
                mod.rightHeight > 0 &&
                mod.leftHeight !== mod.rightHeight;

              const modRh = isModTrap ? mod.rightHeight! : modH;
              rhsSum += modRh;
              if (y < maxY) {
                const belowMod = validModules.find((m) => m.x === maxX && m.y === y + 1);
                if (belowMod) {
                  rhsCouplings += realDeduction;
                }
              }
            }
          }
          rh = rhsSum + rhsCouplings;
          isTrap = !!firstTrapMod;
        } else {
          isTrap = !!firstTrapMod;
          lh = isTrap ? firstTrapMod!.leftHeight! : item.height;
          rh = isTrap ? firstTrapMod!.rightHeight! : item.height;
        }

        const inclinedTJTop = isTrap
          ? Math.sqrt(Math.pow(item.width, 2) + Math.pow(rh - lh, 2))
          : item.width;

        if (top) {
          const baseLen = isTrap ? inclinedTJTop : item.width;
          profileCuts.push([
            tjProfile.code,
            "Tapajunta Superior",
            Math.round(baseLen + (left ? tjThick : 0) + (right ? tjThick : 0)),
            1,
            "45° / 45°",
          ]);
        }
        if (bottom)
          profileCuts.push([
            tjProfile.code,
            "Tapajunta Inferior",
            Math.round(item.width + (left ? tjThick : 0) + (right ? tjThick : 0)),
            1,
            "45° / 45°",
          ]);
        if (left)
          profileCuts.push([
            tjProfile.code,
            "Tapajunta Lateral L",
            Math.round(lh + (top ? tjThick : 0) + (bottom ? tjThick : 0)),
            1,
            "45° / 45°",
          ]);
        if (right)
          profileCuts.push([
            tjProfile.code,
            "Tapajunta Lateral R",
            Math.round(rh + (top ? tjThick : 0) + (bottom ? tjThick : 0)),
            1,
            "45° / 45°",
          ]);

        if (isSet) {
          for (let x = minX; x < maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const mL_m = validModules.find((m) => m.x === x && m.y === y);
              const mR_m = validModules.find((m) => m.x === x + 1 && m.y === y);
              if (mL_m && mR_m) {
                let hL =
                  isManualDim && mL_m.height
                    ? mL_m.height
                    : Number(rowRatios[y - minY] || 0);
                let hR =
                  isManualDim && mR_m.height
                    ? mR_m.height
                    : Number(rowRatios[y - minY] || 0);
                const diff = Math.abs(hL - hR);
                if (diff > 5) {
                  profileCuts.push([
                    tjProfile.code,
                    `TJ Sobrante Desnivel`,
                    Math.round(diff),
                    1,
                    "90° / 90°",
                  ]);
                }
              }
            }
          }
        }
      }
    }

    if (item.extras.mosquitero && item.extras.mosquiteroRecipeId) {
      const mosqRecipe = recipes.find((r) => r.id === item.extras.mosquiteroRecipeId);
      if (mosqRecipe) {
        let mosqW = item.width;
        const baseRecipe = recipes.find(r => r.id === item.composition.modules[0]?.recipeId);
        if (baseRecipe?.visualType && (baseRecipe.visualType.toLowerCase().includes("sliding") || (baseRecipe.leaves || 1) > 1)) {
          mosqW = Math.round(item.width / Math.max(1, (baseRecipe.leaves || 2)));
        }
        mosqRecipe.profiles.forEach(rp => {
          const p = aluminum.find(a => a.id === rp.profileId);
          if (!p) return;
          const cutLen = evaluateFormula(rp.formula, mosqW, item.height);
          profileCuts.push([
             p.code,
             "MOSQ: " + p.detail,
             Math.round(cutLen),
             rp.quantity,
             `${rp.cutStart}° / ${rp.cutEnd}°`
          ]);
        });
      }
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: 80 },
      head: [["CÓD.", "PERFIL", "LONG", "CANT", "CORTES"]],
      body: profileCuts,
      theme: "grid",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [71, 85, 105] },
      columnStyles: { 2: { halign: "center", fontStyle: "bold" } },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
    const glassPieces: any[] = [];
    if (item.quotingMode !== "Solo Marcos") {
      validModules.forEach((mod) => {
        const recipe = recipes.find((r) => r.id === mod.recipeId);
        if (!recipe) return;
        const panes = getModuleGlassPanes(item, mod, recipe, aluminum);
      let spec = "S/D";
      if (recipe.type === "Mosquitero" || (recipe.visualType || "").toLowerCase().includes("mosquitero")) {
        spec = "TELA MOSQUITERA";
      } else {
        const gOuter = glasses.find((g) => g.id === mod.glassOuterId);
        if (mod.isDVH) {
          const gInner = glasses.find((g) => g.id === mod.glassInnerId);
          const camera = dvhInputs.find((i) => i.id === mod.dvhCameraId);
          spec = `${gOuter?.detail || "?"} / ${camera?.detail || "?"} / ${gInner?.detail || "?"}`;
        } else {
          spec = gOuter?.detail || "Vidrio Simple";
        }
      }
      const visualType = (recipe.visualType || "").toLowerCase();
      let numLeaves = recipe.leaves || 1;
      if (!recipe.leaves) {
        if (
          visualType.includes("sliding_3") ||
          visualType.includes("corrediza_3") ||
          visualType.includes("triple") ||
          visualType.includes("3h")
        )
          numLeaves = 3;
        else if (
          visualType.includes("sliding_4") ||
          visualType.includes("corrediza_4") ||
          visualType.includes("four") ||
          visualType.includes("4h")
        )
          numLeaves = 4;
        else if (
          visualType.includes("sliding") ||
          visualType.includes("corrediza")
        )
          numLeaves = 2;
        else if (
          visualType.includes("double") ||
          visualType.includes("doble") ||
          visualType.includes("2h")
        )
          numLeaves = 2;
      }
      panes.forEach((p, pIdx) => {
        if (!p.isBlind) {
          glassPieces.push([
            `Paño ${pIdx + 1}`,
            spec,
            `${Math.round(p.w)} x ${Math.round(p.h)}`,
            1,
          ]);
        } else {
          const slatId = mod.slatProfileIds?.[pIdx];
          const slatProf = aluminum.find((a) => a.id === slatId);
          const blindText = slatProf
            ? `CIEGO (TABLILLAS ${slatProf.code})`
            : "PANEL CIEGO";
          glassPieces.push([
            `Paño ${pIdx + 1}`,
            blindText,
            `${Math.round(p.w)} x ${Math.round(p.h)}`,
            1,
          ]);
        }
      });
    });
    }
    
    if (item.extras.mosquitero) {
      let telaW = item.width;
      const baseRecipe = recipes.find(r => r.id === item.composition.modules[0]?.recipeId);
      if (baseRecipe?.visualType && (baseRecipe.visualType.toLowerCase().includes("sliding") || (baseRecipe.leaves || 1) > 1)) {
        telaW = Math.round(item.width / Math.max(1, (baseRecipe.leaves || 2)));
      }
      let specName = "TELA MOSQUITERA";
      if (item.extras.mosquiteroRecipeId) {
         const mosqRecipe = recipes.find(r => r.id === item.extras.mosquiteroRecipeId);
         specName = "TELA MOSQUITERA (" + (mosqRecipe?.name || "ADICIONAL") + ")";
      }
      glassPieces.push([
         "Mosquitero",
         specName,
         `${telaW} x ${item.height}`,
         1
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          "UBICACIÓN",
          "ESPECIFICACIÓN DE LLENADO",
          "MEDIDAS (mm)",
          "CANT POR UNID.",
        ],
      ],
      body: glassPieces,
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [51, 65, 85] },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  });
  doc.save(`Taller_${quote.clientName}.pdf`);
};

export const generateCostsPDF = (
  quote: Quote,
  config: GlobalConfig,
  recipes: ProductRecipe[],
  aluminum: AluminumProfile[],
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.text("AUDITORÍA DE COSTOS INTERNOS", 15, 15);
  const tableData = quote.items.map((item, idx) => {
    const b = item.breakdown;
    const firstRecipe = recipes.find((r) => r.id === item.composition.modules?.[0]?.recipeId);
    const isFrenteIntegral = firstRecipe?.line?.toLowerCase() === "frente integral";
    const moduleNames = item.composition.modules
      .map((m) => recipes.find((r) => r.id === m.recipeId)?.name)
      .filter(Boolean);
    const compositeName =
      moduleNames.length > 1
        ? (isFrenteIntegral ? `CONJUNTO: FRENTE INTEGRAL` : `CONJUNTO: ${moduleNames.join(" + ")}`)
        : moduleNames[0] || "-";
    return [
      item.itemCode || `POS#${idx + 1}`,
      compositeName,
      item.quantity,
      `$${((b?.aluCost || 0) * item.quantity).toLocaleString()}`,
      `$${((b?.glassCost || 0) * item.quantity).toLocaleString()}`,
      `$${((b?.accCost || 0) * item.quantity).toLocaleString()}`,
      `$${((b?.laborCost || 0) * item.quantity).toLocaleString()}`,
      `$${(item.calculatedCost * item.quantity).toLocaleString()}`,
    ];
  });
  autoTable(doc, {
    startY: 35,
    head: [
      [
        "CÓD.",
        "SISTEMA",
        "CANT.",
        "ALUMINIO",
        "VIDRIO",
        "HERRAJES",
        "M. OBRA",
        "TOTAL",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
    styles: { fontSize: 7 },
  });
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalAlu = quote.items.reduce(
    (sum, i) => sum + (i.breakdown?.aluCost || 0) * i.quantity,
    0,
  );
  const totalGlass = quote.items.reduce(
    (sum, i) => sum + (i.breakdown?.glassCost || 0) * i.quantity,
    0,
  );
  const totalAcc = quote.items.reduce(
    (sum, i) => sum + (i.breakdown?.accCost || 0) * i.quantity,
    0,
  );
  const totalLabor = quote.items.reduce(
    (sum, i) => sum + (i.breakdown?.laborCost || 0) * i.quantity,
    0,
  );
  const finalTotal = totalAlu + totalGlass + totalAcc + totalLabor;
  doc.setFillColor(248, 250, 252);
  doc.rect(15, finalY, pageWidth - 30, 45, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, finalY, pageWidth - 30, 45, "D");
  doc.setTextColor(100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN DE COSTOS CONSOLIDADO DE OBRA", 20, finalY + 10);
  doc.setFont("helvetica", "normal");
  doc.text(`TOTAL COSTO ALUMINIO:`, 20, finalY + 20);
  doc.text(`$${totalAlu.toLocaleString()}`, pageWidth - 20, finalY + 20, {
    align: "right",
  });
  doc.text(`TOTAL COSTO VIDRIOS/PANELES:`, 20, finalY + 25);
  doc.text(`$${totalGlass.toLocaleString()}`, pageWidth - 20, finalY + 25, {
    align: "right",
  });
  doc.text(`TOTAL COSTO ACCESORIOS/GOMAS:`, 20, finalY + 30);
  doc.text(`$${totalAcc.toLocaleString()}`, pageWidth - 20, finalY + 30, {
    align: "right",
  });
  doc.text(
    `MANO DE OBRA Y CARGA OPERATIVA (${config.laborPercentage}%):`,
    20,
    finalY + 35,
  );
  doc.text(`$${totalLabor.toLocaleString()}`, pageWidth - 20, finalY + 35, {
    align: "right",
  });
  doc.setLineWidth(0.5);
  doc.line(20, finalY + 38, pageWidth - 20, finalY + 38);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`VALOR TOTAL FINAL DE OBRA:`, 20, finalY + 43);
  doc.text(`$${finalTotal.toLocaleString()}`, pageWidth - 20, finalY + 43, {
    align: "right",
  });
  doc.save(`Auditoria_Costos_${quote.clientName}.pdf`);
};

export const generateGlassOptimizationPDF = (
  quote: Quote,
  recipes: ProductRecipe[],
  glasses: Glass[],
  aluminum: AluminumProfile[],
  dvhInputs: DVHInput[],
  blindPanels: BlindPanel[],
) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const allPieces: GlassPiece[] = [];
  const listTableData: any[] = [];
  quote.items.forEach((item, itemIdx) => {
    if (item.quotingMode === "Solo Marcos") return;
    
    item.composition.modules.forEach((mod) => {
      const recipe = recipes.find((r) => r.id === mod.recipeId);
      if (!recipe || recipe.visualType === "mosquitero") return;
      const visualType = (recipe.visualType || "").toLowerCase();
      let numLeaves = recipe.leaves || 1;
      if (!recipe.leaves) {
        if (
          visualType.includes("sliding_3") ||
          visualType.includes("corrediza_3") ||
          visualType.includes("triple") ||
          visualType.includes("3h")
        )
          numLeaves = 3;
        else if (
          visualType.includes("sliding_4") ||
          visualType.includes("corrediza_4") ||
          visualType.includes("four") ||
          visualType.includes("4h")
        )
          numLeaves = 4;
        else if (
          visualType.includes("sliding") ||
          visualType.includes("corrediza")
        )
          numLeaves = 2;
        else if (
          visualType.includes("double") ||
          visualType.includes("doble") ||
          visualType.includes("2h")
        )
          numLeaves = 2;
      }
      const glassPanes = getModuleGlassPanes(item, mod, recipe, aluminum);
      const gOuter = glasses.find((g) => g.id === mod.glassOuterId);
      const gInner = mod.isDVH
        ? glasses.find((g) => g.id === mod.glassInnerId)
        : null;
      glassPanes.forEach((pane, paneIdx) => {
        if (!pane.isBlind) {
          const qtyPerSheet = item.quantity;
          const outerSpec = gOuter?.detail || "Vidrio Ext";
          listTableData.push([
            item.itemCode || `POS#${itemIdx + 1}`,
            outerSpec,
            `${Math.round(pane.w)} x ${Math.round(pane.h)}`,
            qtyPerSheet,
          ]);
          for (let i = 0; i < qtyPerSheet; i++) {
            allPieces.push({
              id: `${item.id}-ext-${i}-${Math.random()}`,
              itemCode: item.itemCode || `POS#${itemIdx + 1}`,
              spec: outerSpec,
              w: Math.round(pane.w),
              h: Math.round(pane.h),
              glassId: mod.glassOuterId,
            });
          }
          if (mod.isDVH && gInner) {
            const innerSpec = gInner.detail || "Vidrio Int";
            listTableData.push([
              item.itemCode || `POS#${itemIdx + 1}`,
              innerSpec,
              `${Math.round(pane.w)} x ${Math.round(pane.h)}`,
              qtyPerSheet,
            ]);
            for (let i = 0; i < qtyPerSheet; i++) {
              allPieces.push({
                id: `${item.id}-int-${i}-${Math.random()}`,
                itemCode: item.itemCode || `POS#${itemIdx + 1}`,
                spec: innerSpec,
                w: Math.round(pane.w),
                h: Math.round(pane.h),
                glassId: mod.glassInnerId!,
              });
            }
          }
        } else {
          const bpId = mod.blindPaneIds?.[paneIdx];
          const bp = blindPanels.find((x) => x.id === bpId);
          if (bp && bp.unit === "m2") {
            const qtyPerSheet = item.quantity;
            const panelSpec = `PANEL CIEGO: ${bp.detail}`;
            listTableData.push([
              item.itemCode || `POS#${itemIdx + 1}`,
              panelSpec,
              `${Math.round(pane.w)} x ${Math.round(pane.h)}`,
              qtyPerSheet,
            ]);
            for (let i = 0; i < qtyPerSheet; i++) {
              allPieces.push({
                id: `${item.id}-blind-${i}-${Math.random()}`,
                itemCode: item.itemCode || `POS#${itemIdx + 1}`,
                spec: panelSpec,
                w: Math.round(pane.w),
                h: Math.round(pane.h),
                glassId: bp.id,
              });
            }
          }
        }
      });
    });
    
    if (item.extras?.mosquitero) {
      let telaW = item.width;
      const baseRecipe = recipes.find(r => r.id === item.composition.modules[0]?.recipeId);
      if (baseRecipe?.visualType && (baseRecipe.visualType.toLowerCase().includes("sliding") || (baseRecipe.leaves || 1) > 1)) {
        telaW = Math.round(item.width / Math.max(1, (baseRecipe.leaves || 2)));
      }
      let specName = "TELA MOSQUITERA";
      if (item.extras.mosquiteroRecipeId) {
         const mosqRecipe = recipes.find(r => r.id === item.extras.mosquiteroRecipeId);
         if (mosqRecipe) {
           specName = "TELA MOSQUITERA (" + mosqRecipe.name + ")";
         }
      }
      listTableData.push([
         item.itemCode || `POS#${itemIdx + 1}`,
         specName,
         `${telaW} x ${Math.round(item.height)}`,
         item.quantity,
      ]);
      for (let i = 0; i < item.quantity; i++) {
        allPieces.push({
          id: `${item.id}-mosq-${i}-${Math.random()}`,
          itemCode: item.itemCode || `POS#${itemIdx + 1}`,
          spec: specName,
          w: telaW,
          h: Math.round(item.height),
          glassId: item.extras.mosquiteroRecipeId || "mosquitero-generico",
        });
      }
    }
  });
  if (allPieces.length === 0) return;
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text("OPTIMIZADOR DE CORTE DE VIDRIOS / PANELES", 15, 20);
  autoTable(doc, {
    startY: 40,
    head: [["ABERTURA", "ESPECIFICACIÓN", "MEDIDA (mm)", "CANT."]],
    body: listTableData,
    theme: "striped",
  });
  const groupedBySpec = new Map<string, GlassPiece[]>();
  allPieces.forEach((p) => {
    const list = groupedBySpec.get(p.spec) || [];
    list.push(p);
    groupedBySpec.set(p.spec, list);
  });
  groupedBySpec.forEach((pieces, specName) => {
    let sheetW = 2400,
      sheetH = 1800;
    const refGlass = glasses.find((g) => g.id === pieces[0].glassId);
    if (refGlass) {
      sheetW = refGlass.width || 2400;
      sheetH = refGlass.height || 1800;
    }

    const margin = 12;
    pieces.sort((a, b) => b.w * b.h - a.w * a.h);
    let sheets: {
      p: GlassPiece;
      x: number;
      y: number;
      rw: number;
      rh: number;
    }[][] = [[]];
    let curSheetIdx = 0,
      curY = 0,
      curShelfH = 0,
      curX = 0;

    pieces.forEach((p) => {
      let rotated = false;
      let w = p.w;
      let h = p.h;

      // Intentar encajar en orientación normal
      let fitsNormal =
        curX + w + margin <= sheetW && curY + h + margin <= sheetH;

      // Intentar encajar rotado
      let fitsRotated =
        curX + h + margin <= sheetW && curY + w + margin <= sheetH;

      if (!fitsNormal && !fitsRotated) {
        // No encaja en la estantería actual, intentar nueva estantería
        curX = 0;
        curY += curShelfH + margin;
        curShelfH = 0;

        fitsNormal = curX + w + margin <= sheetW && curY + h + margin <= sheetH;
        fitsRotated =
          curX + h + margin <= sheetW && curY + w + margin <= sheetH;

        if (!fitsNormal && !fitsRotated) {
          // No encaja en la plancha actual, nueva plancha
          curX = 0;
          curY = 0;
          curShelfH = 0;
          curSheetIdx++;
          sheets[curSheetIdx] = [];

          // Re-evaluar tras nueva plancha
          fitsNormal =
            curX + w + margin <= sheetW && curY + h + margin <= sheetH;
          fitsRotated =
            curX + h + margin <= sheetW && curY + w + margin <= sheetH;
        }
      }

      if (fitsNormal || fitsRotated) {
        // Elegir la mejor orientación si ambas caben (aquí elegimos simple: si normal cabe, usar normal)
        if (fitsNormal) {
          rotated = false;
        } else {
          rotated = true;
          [w, h] = [h, w];
        }
        p.rotated = rotated;
        sheets[curSheetIdx].push({ p, x: curX, y: curY, rw: w, rh: h });
        curX += w + margin;
        if (h > curShelfH) curShelfH = h;
      } else {
        // Si después de todo no cabe, esto no debería pasar con una plancha suficientemente grande
        console.error("Pieza no cabe en la plancha (info):", JSON.stringify(p));
      }
    });
    sheets.forEach((sheetPieces, sIdx) => {
      doc.addPage();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 25, "F");
      doc.setTextColor(255);
      doc.setFontSize(10);
      doc.text(
        `CROQUIS DE CORTE: ${specName} - PLANCHA #${sIdx + 1} (${sheetW} x ${sheetH} mm)`,
        15,
        12,
      );
      doc.setFontSize(7);
      doc.text(`RENDIMIENTO DE PLANCHA: ${sheetPieces.length} PIEZAS`, 15, 18);
      const scale = Math.min(
        (pageWidth - 40) / sheetW,
        (pageHeight - 60) / sheetH,
      );
      const startX = 20,
        startY = 35;
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.5);
      doc.rect(startX, startY, sheetW * scale, sheetH * scale);
      sheetPieces.forEach((sp) => {
        const px = startX + sp.x * scale,
          py = startY + sp.y * scale,
          pw = sp.rw * scale,
          ph = sp.rh * scale;
        doc.setDrawColor(79, 70, 229);
        doc.setFillColor(243, 244, 246);
        doc.rect(px, py, pw, ph, "FD");
        const fontSize = Math.max(10, 24 * scale);
        doc.setFontSize(fontSize);
        doc.setTextColor(30, 41, 59);
        if (pw > 15 && ph > 15) {
          const yCenter = py + ph / 2;
          doc.setFont("helvetica", "bold");
          doc.text(sp.p.itemCode, px + pw / 2, yCenter - fontSize * 0.1, {
            align: "center",
          });
          doc.setFont("helvetica", "normal");
          const dimText = sp.p.rotated
            ? `${Math.round(sp.p.h)}x${Math.round(sp.p.w)}`
            : `${Math.round(sp.p.w)}x${Math.round(sp.p.h)}`;
          doc.text(dimText, px + pw / 2, yCenter + fontSize * 0.5, {
            align: "center",
          });
        }
      });
    });
  });
  doc.save(`Corte_Vidrios_${quote.clientName}.pdf`);
};
