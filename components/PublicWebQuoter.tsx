import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Layers,
  Palette,
  Maximize2,
  Plus,
  Minus,
  Trash2,
  Check,
  CheckCircle2,
  MessageCircle,
  Download,
  ArrowLeft,
  Building,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  X,
  FileText,
  Ruler,
  Phone,
  Info,
  Grid,
} from "lucide-react";
import {
  GlobalConfig,
  ProductRecipe,
  Treatment,
  Glass,
  DVHInput,
  BlindPanel,
  AluminumProfile,
  Accessory,
  QuoteItem,
  Quote,
} from "../types";
import { calculateCompositePrice } from "../services/calculator";
import { generateClientDetailedPDF } from "../services/pdfGenerator";
import { supabase, isSupabaseConfigured } from "../src/services/supabaseClient";
import { OpeningIllustration, renderOpeningToDataUrl } from "./OpeningIllustration";

interface Props {
  config: GlobalConfig;
  recipes: ProductRecipe[];
  treatments: Treatment[];
  glasses: Glass[];
  dvhInputs: DVHInput[];
  blindPanels: BlindPanel[];
  aluminum: AluminumProfile[];
  accessories: Accessory[];
  tenantId?: string;
  onClosePreview?: () => void;
  isStandalone?: boolean;
  onSaveQuote?: (quote: Quote) => void;
}

type CatalogCategory = "all" | "corredizas" | "fijos" | "abrir" | "puertas" | "proyectantes";

function getItemDescription(
  item: QuoteItem,
  recipes: ProductRecipe[],
  treatments: Treatment[],
  glasses: Glass[],
  dvhInputs: DVHInput[],
  blindPanels: BlindPanel[]
) {
  const mod = item.composition.modules[0];
  const recipe = recipes.find((r) => r.id === mod?.recipeId);
  const treatment = treatments.find((t) => t.id === item.colorId);

  // Tablilla detection
  const isMitad =
    mod?.blindPanes &&
    mod.blindPanes.length === 1 &&
    mod.blindPanes[0] === 0 &&
    mod.transoms &&
    mod.transoms.length > 0;
  const isCompleta = mod?.blindPanes && mod.blindPanes.length > 1;

  const blindPanelId = mod?.blindPaneIds?.[0] || blindPanels[0]?.id;
  const blindPanel = blindPanels.find((bp) => bp.id === blindPanelId);
  const blindName = blindPanel?.detail || blindPanel?.code || "Tablilla";

  let glassName = "";
  if (mod?.isDVH) {
    const gOut = glasses.find((g) => g.id === mod.glassOuterId);
    const cam = dvhInputs.find((d) => d.id === mod.dvhCameraId);
    const gIn = glasses.find((g) => g.id === mod.glassInnerId);
    glassName = `DVH (${gOut?.detail || gOut?.code || "4mm"} / ${cam?.detail || "Cámara"} / ${gIn?.detail || gIn?.code || "4mm"})`;
  } else {
    const g = glasses.find((g) => g.id === mod?.glassOuterId);
    glassName = g?.detail || g?.code || "Vidrio Simple";
  }

  let infillText = "";
  let tablillaMode: "vidrio" | "mitad" | "completa" = "vidrio";

  if (isCompleta) {
    tablillaMode = "completa";
    infillText = `Tablilla Completa (${blindName})`;
  } else if (isMitad) {
    tablillaMode = "mitad";
    infillText = `Mitad y Mitad (1/2 ${glassName} sup. + 1/2 Tablilla ${blindName} inf.)`;
  } else {
    tablillaMode = "vidrio";
    infillText = glassName;
  }

  // TJ sides description
  let tjText = "";
  if (item.extras?.tapajuntas) {
    const s = item.extras.tapajuntasSides || { top: true, bottom: true, left: true, right: true };
    if (s.top && s.bottom && s.left && s.right) {
      tjText = "Tapajuntas TJ (4 lados)";
    } else if (s.top && !s.bottom && s.left && s.right) {
      tjText = "Tapajuntas TJ (3 lados - s/umbral)";
    } else {
      const activeSides: string[] = [];
      if (s.top) activeSides.push("Sup");
      if (s.bottom) activeSides.push("Inf");
      if (s.left) activeSides.push("Izq");
      if (s.right) activeSides.push("Der");
      tjText = `Tapajuntas TJ (${activeSides.join("+") || "Personalizado"})`;
    }
  }

  return {
    recipe,
    recipeName: recipe?.name || item.itemCode || "Abertura",
    colorName: treatment?.name || "Estándar",
    hexColor: treatment?.hexColor || "#1e293b",
    infillText,
    tablillaMode,
    blindPanelId,
    tjText,
    hasMosquitero: Boolean(item.extras?.mosquitero),
    hasTJ: Boolean(item.extras?.tapajuntas),
    tjSides: item.extras?.tapajuntasSides || { top: true, bottom: true, left: true, right: true },
  };
}

export const PublicWebQuoter: React.FC<Props> = ({
  config,
  recipes,
  treatments,
  glasses,
  dvhInputs,
  blindPanels,
  aluminum,
  accessories,
  tenantId,
  onClosePreview,
  isStandalone = false,
  onSaveQuote,
}) => {
  const webConfig = config.webQuoterConfig || {
    enabled: true,
    publicTitle: "Catálogo & Cotizador Online",
    markupPercentage: 30,
    whatsappNumber: config.companyPhone || "+54 9 11 0000 0000",
    allowDVH: true,
    allowBlind: true,
    notes: "Presupuesto estimativo preliminar sujeto a confirmación de medidas en obra.",
  };

  // Filtrar tipologías disponibles para la tienda web
  const availableRecipes = useMemo(() => {
    let list = recipes.filter((r) => !r.isComplementary);
    if (webConfig.allowedRecipeIds && webConfig.allowedRecipeIds.length > 0) {
      list = list.filter((r) => webConfig.allowedRecipeIds!.includes(r.id));
    }
    return list;
  }, [recipes, webConfig.allowedRecipeIds]);

  // Líneas disponibles (Módena, Herrero, A30, etc.)
  const lines = useMemo(() => {
    const set = new Set<string>();
    availableRecipes.forEach((r) => {
      if (r.line) set.add(r.line);
    });
    return Array.from(set);
  }, [availableRecipes]);

  // Cámaras de aire para DVH
  const dvhCameras = useMemo(() => {
    return dvhInputs.filter((d) => d.type === "Cámara");
  }, [dvhInputs]);

  // Categorías de catálogo
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory>("all");
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal de Personalización de Producto (E-Commerce Customizer)
  const [customizingRecipe, setCustomizingRecipe] = useState<ProductRecipe | null>(null);

  // Estados del configurador activo
  const [width, setWidth] = useState<number>(1500);
  const [height, setHeight] = useState<number>(1100);
  const [quantity, setQuantity] = useState<number>(1);

  // 1. Color de Perfil (Vinculado a Treatments del programa)
  const [colorId, setColorId] = useState<string>(treatments[0]?.id || "");
  const [colorSearch, setColorSearch] = useState<string>("");

  // 2. Tipo de Llenado / Vidrio / DVH / Tablilla
  const [infillType, setInfillType] = useState<"vs" | "dvh" | "tablilla">("vs");
  const [selectedGlassId, setSelectedGlassId] = useState<string>(glasses[0]?.id || "");
  const [selectedGlassOuterId, setSelectedGlassOuterId] = useState<string>(glasses[0]?.id || "");
  const [selectedCameraId, setSelectedCameraId] = useState<string>(
    dvhInputs.find((d) => d.type === "Cámara")?.id || dvhInputs[0]?.id || ""
  );
  const [selectedGlassInnerId, setSelectedGlassInnerId] = useState<string>(
    glasses[1]?.id || glasses[0]?.id || ""
  );

  // 3. Tablillas de aluminio: Modo (Completa vs Mitad y Mitad vs Vidrio)
  const [tablillaMode, setTablillaMode] = useState<"vidrio" | "mitad" | "completa">("vidrio");
  const [selectedBlindPanelId, setSelectedBlindPanelId] = useState<string>(
    blindPanels[0]?.id || ""
  );

  // 4. Sistema de Tapajuntas (TJ)
  const [withTJ, setWithTJ] = useState<boolean>(false);
  const [tjSides, setTjSides] = useState<{
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  }>({ top: true, bottom: true, left: true, right: true });

  // 5. Mosquitero
  const [withMosquitero, setWithMosquitero] = useState<boolean>(false);

  // Carrito de compras / presupuesto
  const [cartItems, setCartItems] = useState<QuoteItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<"catalog" | "success">("catalog");
  const [addedItemNotification, setAddedItemNotification] = useState<string | null>(null);

  // Datos del cliente para recepción de presupuesto
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<Quote | null>(null);

  // Color seleccionado actual
  const activeTreatment = useMemo(() => {
    return treatments.find((t) => t.id === colorId) || treatments[0];
  }, [treatments, colorId]);

  // Filtrado de tratamientos / colores
  const filteredTreatments = useMemo(() => {
    if (!colorSearch.trim()) return treatments;
    const q = colorSearch.toLowerCase();
    return treatments.filter((t) => t.name.toLowerCase().includes(q));
  }, [treatments, colorSearch]);

  // Clasificación de receta en categorías
  const getRecipeCategory = (r: ProductRecipe): CatalogCategory => {
    const text = `${r.name || ""} ${r.type || ""} ${r.visualType || ""}`.toLowerCase();
    if (text.includes("puerta") || text.includes("porton") || text.includes("door")) {
      return "puertas";
    }
    if (text.includes("fijo") || text.includes("fixed") || text.includes("paño")) {
      return "fijos";
    }
    if (
      text.includes("proyectante") ||
      text.includes("ventiluz") ||
      text.includes("banderola") ||
      text.includes("desplazable")
    ) {
      return "proyectantes";
    }
    if (text.includes("corrediza") || text.includes("sliding")) {
      return "corredizas";
    }
    if (text.includes("abrir") || text.includes("batiente") || text.includes("oscilo")) {
      return "abrir";
    }
    return "corredizas";
  };

  // Filtrado de recetas en el catálogo
  const filteredRecipes = useMemo(() => {
    return availableRecipes.filter((r) => {
      // Filtro de categoría
      if (selectedCategory !== "all") {
        const cat = getRecipeCategory(r);
        if (cat !== selectedCategory) return false;
      }
      // Filtro de línea
      if (selectedLine !== "all" && r.line !== selectedLine) {
        return false;
      }
      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.name || "").toLowerCase().includes(q);
        const matchLine = (r.line || "").toLowerCase().includes(q);
        const matchType = (r.type || "").toLowerCase().includes(q);
        if (!matchName && !matchLine && !matchType) return false;
      }
      return true;
    });
  }, [availableRecipes, selectedCategory, selectedLine, searchQuery]);

  // Cálculo de precio dinámico para una receta con todas las opciones
  const calculatePriceFor = (
    recipe: ProductRecipe,
    w: number,
    h: number,
    cId: string,
    infill: "vs" | "dvh" | "tablilla",
    tMode: "vidrio" | "mitad" | "completa",
    glassId: string,
    glassOuterId: string,
    glassInnerId: string,
    cameraId: string,
    blindId: string,
    mosquitero: boolean,
    tj: boolean,
    sides: { top: boolean; bottom: boolean; left: boolean; right: boolean }
  ): number => {
    const isTablillaRecipe =
      recipe.visualType === "tablilla" ||
      recipe.visualType === "ciego" ||
      (recipe.name || "").toLowerCase().includes("tablilla") ||
      (recipe.name || "").toLowerCase().includes("machimbre") ||
      (recipe.name || "").toLowerCase().includes("6216");

    const effectiveTablillaMode =
      isTablillaRecipe && tMode === "vidrio" ? "completa" : tMode;

    let effectiveBlindPanes: number[] = [];
    let effectiveTransoms: { height: number; profileId: string }[] =
      recipe.defaultTransoms || [];
    const effectiveBlindPaneIds: Record<number, string> = {};

    if (effectiveTablillaMode === "completa" || infill === "tablilla") {
      effectiveBlindPanes = [0, 1, 2, 3, 4, 5];
      if (blindId) {
        [0, 1, 2, 3, 4, 5].forEach((idx) => {
          effectiveBlindPaneIds[idx] = blindId;
        });
      }
    } else if (effectiveTablillaMode === "mitad") {
      effectiveBlindPanes = [0]; // mitad inferior ciega
      if (blindId) {
        effectiveBlindPaneIds[0] = blindId;
      }
      const midH = Math.round(Number(h) * 0.45);
      const transomProfile =
        aluminum.find((p) => p.role === "Travesaño") || aluminum[0];
      effectiveTransoms = [
        {
          height: midH,
          profileId: recipe.defaultTransomProfileId || transomProfile?.id || "",
        },
      ];
    }

    const mockItem: QuoteItem = {
      id: "preview-temp",
      itemCode: "POS#1",
      width: Number(w) || 1000,
      height: Number(h) || 1000,
      quantity: 1,
      colorId: cId || treatments[0]?.id || "",
      calculatedCost: 0,
      composition: {
        couplingDeduction: 0,
        colRatios: [1],
        rowRatios: [1],
        modules: [
          {
            id: "mod-preview-1",
            x: 0,
            y: 0,
            recipeId: recipe.id,
            isDVH: infill === "dvh",
            glassOuterId:
              infill === "dvh"
                ? glassOuterId || glasses[0]?.id || ""
                : glassId || glasses[0]?.id || "",
            glassInnerId:
              infill === "dvh"
                ? glassInnerId || glasses[1]?.id || glasses[0]?.id || ""
                : glassId || glasses[0]?.id || "",
            dvhCameraId: cameraId || dvhInputs[0]?.id || "",
            blindPanes: effectiveBlindPanes,
            blindPaneIds: effectiveBlindPaneIds,
            transoms: effectiveTransoms,
          },
        ],
      },
      extras: {
        mosquitero,
        tapajuntas: tj,
        tapajuntasSides: sides,
      },
    };

    try {
      const activeTreatment =
        treatments.find((t) => t.id === cId) ||
        treatments[0] ||
        ({ id: "std", name: "Estándar", pricePerKg: 0 } as Treatment);
      const { finalPrice } = calculateCompositePrice(
        mockItem,
        recipes,
        aluminum,
        config,
        activeTreatment,
        glasses,
        accessories,
        dvhInputs,
        blindPanels
      );
      const baseCost = finalPrice || 0;
      const webMarkupFactor = 1 + (Number(webConfig.markupPercentage) || 0) / 100;
      return Math.round(baseCost * webMarkupFactor);
    } catch (e) {
      console.error("Error al calcular precio en web quoter:", e);
      return 0;
    }
  };

  // Precios "Desde" estimados para las tarjetas del catálogo
  const recipeStartingPrices = useMemo(() => {
    const map: Record<string, number> = {};
    availableRecipes.forEach((r) => {
      const isDoor =
        (r.type || "").toLowerCase().includes("puerta") ||
        (r.name || "").toLowerCase().includes("puerta");
      const defaultW = isDoor ? 800 : 1200;
      const defaultH = isDoor ? 2000 : 1000;
      map[r.id] = calculatePriceFor(
        r,
        defaultW,
        defaultH,
        treatments[0]?.id || "",
        "vs",
        "vidrio",
        glasses[0]?.id || "",
        glasses[0]?.id || "",
        glasses[1]?.id || glasses[0]?.id || "",
        dvhCameras[0]?.id || "",
        blindPanels[0]?.id || "",
        false,
        false,
        { top: false, bottom: false, left: false, right: false }
      );
    });
    return map;
  }, [
    availableRecipes,
    recipes,
    aluminum,
    glasses,
    accessories,
    dvhInputs,
    dvhCameras,
    treatments,
    config,
    blindPanels,
    webConfig.markupPercentage,
  ]);

  // Precio del producto actualmente en personalización
  const currentCustomizingPrice = useMemo(() => {
    if (!customizingRecipe) return 0;
    return calculatePriceFor(
      customizingRecipe,
      width,
      height,
      colorId,
      infillType,
      tablillaMode,
      selectedGlassId,
      selectedGlassOuterId,
      selectedGlassInnerId,
      selectedCameraId,
      selectedBlindPanelId,
      withMosquitero,
      withTJ,
      tjSides
    );
  }, [
    customizingRecipe,
    width,
    height,
    colorId,
    infillType,
    tablillaMode,
    selectedGlassId,
    selectedGlassOuterId,
    selectedGlassInnerId,
    selectedCameraId,
    selectedBlindPanelId,
    withMosquitero,
    withTJ,
    tjSides,
  ]);

  // Abrir configurador para una receta
  const handleOpenCustomizer = (recipe: ProductRecipe) => {
    const isDoor =
      (recipe.type || "").toLowerCase().includes("puerta") ||
      (recipe.name || "").toLowerCase().includes("puerta");
    const isTablillaRecipe =
      recipe.visualType === "tablilla" ||
      recipe.visualType === "ciego" ||
      (recipe.name || "").toLowerCase().includes("tablilla") ||
      (recipe.name || "").toLowerCase().includes("machimbre") ||
      (recipe.name || "").toLowerCase().includes("6216");

    setWidth(isDoor ? 800 : 1500);
    setHeight(isDoor ? 2000 : 1100);
    setQuantity(1);
    setInfillType(isTablillaRecipe ? "tablilla" : "vs");
    setTablillaMode(isTablillaRecipe ? "completa" : "vidrio");
    setWithMosquitero(false);
    setWithTJ(false);
    setTjSides({ top: true, bottom: true, left: true, right: true });
    setCustomizingRecipe(recipe);
  };

  // Agregar al carrito
  const handleAddToCart = () => {
    if (!customizingRecipe) return;

    const isTablillaRecipe =
      customizingRecipe.visualType === "tablilla" ||
      customizingRecipe.visualType === "ciego" ||
      (customizingRecipe.name || "").toLowerCase().includes("tablilla") ||
      (customizingRecipe.name || "").toLowerCase().includes("machimbre") ||
      (customizingRecipe.name || "").toLowerCase().includes("6216");

    const effectiveTablillaMode =
      isTablillaRecipe && tablillaMode === "vidrio" ? "completa" : tablillaMode;

    let effectiveBlindPanes: number[] = [];
    let effectiveTransoms: { height: number; profileId: string }[] =
      customizingRecipe.defaultTransoms || [];
    const effectiveBlindPaneIds: Record<number, string> = {};

    if (effectiveTablillaMode === "completa" || infillType === "tablilla") {
      effectiveBlindPanes = [0, 1, 2, 3, 4, 5];
      if (selectedBlindPanelId) {
        [0, 1, 2, 3, 4, 5].forEach((idx) => {
          effectiveBlindPaneIds[idx] = selectedBlindPanelId;
        });
      }
    } else if (effectiveTablillaMode === "mitad") {
      effectiveBlindPanes = [0];
      if (selectedBlindPanelId) {
        effectiveBlindPaneIds[0] = selectedBlindPanelId;
      }
      const midH = Math.round(Number(height) * 0.45);
      const transomProfile =
        aluminum.find((p) => p.role === "Travesaño") || aluminum[0];
      effectiveTransoms = [
        {
          height: midH,
          profileId:
            customizingRecipe.defaultTransomProfileId ||
            transomProfile?.id ||
            "",
        },
      ];
    }

    const selectedTreatment = treatments.find((t) => t.id === (colorId || treatments[0]?.id));
    const previewImg = renderOpeningToDataUrl({
      recipe: customizingRecipe,
      width: Number(width) || 1000,
      height: Number(height) || 1000,
      color: selectedTreatment?.hexColor || "#1e293b",
      infillType,
      tablillaMode: effectiveTablillaMode,
      blindPanelId: selectedBlindPanelId,
      withMosquitero,
      withTJ,
      tjSides,
      allBlindPanels: blindPanels,
      allProfiles: aluminum,
      widthPx: 500,
      heightPx: 380,
    });

    const newItem: QuoteItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      itemCode: `Abertura #${cartItems.length + 1}`,
      width: Number(width) || 1000,
      height: Number(height) || 1000,
      quantity: Number(quantity) || 1,
      colorId: colorId || treatments[0]?.id || "",
      calculatedCost: currentCustomizingPrice,
      previewImage: previewImg,
      composition: {
        couplingDeduction: 0,
        colRatios: [1],
        rowRatios: [1],
        modules: [
          {
            id: `mod-item-${Date.now()}-1`,
            x: 0,
            y: 0,
            recipeId: customizingRecipe.id,
            isDVH: infillType === "dvh",
            glassOuterId:
              infillType === "dvh"
                ? selectedGlassOuterId || glasses[0]?.id || ""
                : selectedGlassId || glasses[0]?.id || "",
            glassInnerId:
              infillType === "dvh"
                ? selectedGlassInnerId || glasses[1]?.id || glasses[0]?.id || ""
                : selectedGlassId || glasses[0]?.id || "",
            dvhCameraId: selectedCameraId || dvhInputs[0]?.id || "",
            blindPanes: effectiveBlindPanes,
            blindPaneIds: effectiveBlindPaneIds,
            transoms: effectiveTransoms,
          },
        ],
      },
      extras: {
        mosquitero: withMosquitero,
        tapajuntas: withTJ,
        tapajuntasSides: tjSides,
      },
    };

    setCartItems((prev) => [...prev, newItem]);
    setAddedItemNotification(customizingRecipe.name);
    setTimeout(() => setAddedItemNotification(null), 3000);
    setCustomizingRecipe(null);
  };

  const handleRemoveFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
  };

  const totalCartPrice = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => sum + item.calculatedCost * item.quantity,
      0
    );
  }, [cartItems]);

  const totalItemsCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Presupuesto objeto para persistencia y PDF
  const createQuoteObject = (): Quote => {
    return {
      id: `quote-web-${Date.now()}`,
      clientName: `[WEB] ${leadName || "Cliente Web"}`,
      date: new Date().toISOString(),
      items: cartItems,
      totalPrice: totalCartPrice,
      discount: 0,
    };
  };

  // Enviar a WhatsApp y guardar
  const handleFinalizeAndSendWhatsApp = async () => {
    if (!leadName.trim() || !leadPhone.trim()) {
      alert("Por favor ingresa tu Nombre y Teléfono / WhatsApp para recibir el presupuesto.");
      return;
    }

    setIsSubmitting(true);
    const newQuote = createQuoteObject();

    if (isSupabaseConfigured) {
      try {
        const targetUserId = tenantId || (await supabase.auth.getUser()).data.user?.id;
        if (targetUserId) {
          await supabase.from("presupuestos").insert([
            {
              id: newQuote.id,
              user_id: targetUserId,
              cliente_nombre: newQuote.clientName,
              total: newQuote.totalPrice,
              items: newQuote.items,
              created_at: newQuote.date,
              estado: "web",
            },
          ]);
        }
      } catch (err) {
        console.warn("Fallo al persistir presupuesto web en la nube:", err);
      }
    }

    if (onSaveQuote) {
      onSaveQuote(newQuote);
    }

    try {
      const storageKey = "maicol_engine_data_data_v2";
      const localStr = localStorage.getItem(storageKey);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        const existingQuotes = parsed.quotes || [];
        const updatedQuotes = [newQuote, ...existingQuotes.filter((q: Quote) => q.id !== newQuote.id)];
        parsed.quotes = updatedQuotes;
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
    } catch (err) {
      console.warn("Fallo al guardar presupuesto en localStorage local:", err);
    }

    setSubmittedQuote(newQuote);
    setIsSubmitting(false);
    setIsCartOpen(false);
    setActiveStep("success");

    // Construcción del mensaje para WhatsApp con detalle exhaustivo
    const linesText = cartItems
      .map((item, idx) => {
        const desc = getItemDescription(item, recipes, treatments, glasses, dvhInputs, blindPanels);
        const extrasList: string[] = [];
        if (desc.tjText) extrasList.push(`🔲 ${desc.tjText}`);
        if (desc.hasMosquitero) extrasList.push(`🦟 Con Mosquitero`);

        return (
          `*${idx + 1}. ${desc.recipeName}* (${item.quantity}u)\n` +
          `   📐 Medidas: ${item.width} × ${item.height} mm\n` +
          `   🎨 Color: ${desc.colorName}\n` +
          `   🪟 Configuración: ${desc.infillText}` +
          (extrasList.length > 0 ? `\n   ✨ Extras: ${extrasList.join(" | ")}` : "") +
          `\n   💰 Subtotal: $${(item.calculatedCost * item.quantity).toLocaleString()}`
        );
      })
      .join("\n\n");

    const message =
      `*🛒 SOLICITUD DE COTIZACIÓN - TIENDA ONLINE*\n` +
      `--------------------------------\n` +
      `👤 *Cliente:* ${leadName}\n` +
      `📱 *WhatsApp:* ${leadPhone}\n` +
      (leadCity ? `📍 *Ubicación / Obra:* ${leadCity}\n` : "") +
      (leadNotes ? `📝 *Observaciones:* ${leadNotes}\n` : "") +
      `--------------------------------\n` +
      `*DETALLE DE ABERTURAS:* (${totalItemsCount} unidades)\n\n` +
      linesText +
      `\n\n--------------------------------\n` +
      `*TOTAL ESTIMADO:* $${totalCartPrice.toLocaleString()}\n` +
      `--------------------------------\n` +
      `_Generado automáticamente a través del Catálogo Web de ${config.companyName || "Aberturas"}._`;

    const destPhone = (webConfig.whatsappNumber || "").replace(/[^0-9]/g, "");
    const waUrl = `https://wa.me/${destPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handleDownloadPDF = () => {
    const rawQuote = submittedQuote || createQuoteObject();
    const itemsWithImages = rawQuote.items.map((item) => {
      if (item.previewImage) return item;
      const mod = item.composition.modules[0];
      const recipe = recipes.find((r) => r.id === mod?.recipeId);
      const treatment = treatments.find((t) => t.id === item.colorId);

      const isBlind = mod?.blindPanes && mod.blindPanes.length > 0;
      const isMitad =
        mod?.blindPanes &&
        mod.blindPanes.length === 1 &&
        mod.blindPanes[0] === 0 &&
        mod.transoms &&
        mod.transoms.length > 0;
      const tablillaMode = isBlind ? (isMitad ? "mitad" : "completa") : "vidrio";

      const previewImg = renderOpeningToDataUrl({
        recipe,
        width: item.width,
        height: item.height,
        color: treatment?.hexColor || "#1e293b",
        infillType: isBlind ? "tablilla" : mod?.isDVH ? "dvh" : "vs",
        tablillaMode,
        blindPanelId: mod?.blindPaneIds?.[0],
        withMosquitero: Boolean(item.extras?.mosquitero),
        withTJ: Boolean(item.extras?.tapajuntas),
        tjSides: item.extras?.tapajuntasSides,
        transoms: mod?.transoms,
        blindPanes: mod?.blindPanes,
        allBlindPanels: blindPanels,
        allProfiles: aluminum,
        widthPx: 500,
        heightPx: 380,
      });
      return { ...item, previewImage: previewImg };
    });

    const quoteToPrint: Quote = {
      ...rawQuote,
      items: itemsWithImages,
    };

    try {
      generateClientDetailedPDF(
        quoteToPrint,
        config,
        recipes,
        glasses,
        dvhInputs,
        treatments,
        accessories,
        blindPanels,
        aluminum
      );
    } catch (e) {
      console.error("Error al generar PDF web:", e);
      alert("Hubo un problema al generar el PDF. Puedes enviar tu cotización por WhatsApp.");
    }
  };

  // Dimension presets comunes
  const dimensionPresets = useMemo(() => {
    const isDoor =
      (customizingRecipe?.type || "").toLowerCase().includes("puerta") ||
      (customizingRecipe?.name || "").toLowerCase().includes("puerta");

    if (isDoor) {
      return [
        { label: "800 × 2000 mm", w: 800, h: 2000 },
        { label: "900 × 2050 mm", w: 900, h: 2050 },
        { label: "1500 × 2050 mm (Doble)", w: 1500, h: 2050 },
        { label: "1800 × 2050 mm (Balcón)", w: 1800, h: 2050 },
      ];
    }

    return [
      { label: "1000 × 1000 mm", w: 1000, h: 1000 },
      { label: "1200 × 1100 mm", w: 1200, h: 1100 },
      { label: "1500 × 1100 mm", w: 1500, h: 1100 },
      { label: "1800 × 1200 mm", w: 1800, h: 1200 },
      { label: "2000 × 1500 mm", w: 2000, h: 1500 },
    ];
  }, [customizingRecipe]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Toast Notification when item added */}
      {addedItemNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <Check size={16} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide">¡Añadido a tu presupuesto!</p>
            <p className="text-[11px] text-slate-300 font-medium truncate max-w-xs">
              {addedItemNotification}
            </p>
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="ml-2 text-xs text-sky-400 hover:text-sky-300 font-bold underline"
          >
            Ver Carrito
          </button>
        </div>
      )}

      {/* TOP NAVBAR E-COMMERCE */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onClosePreview && (
              <button
                onClick={onClosePreview}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                title="Volver al panel interno"
              >
                <ArrowLeft size={20} />
              </button>
            )}

            {config.companyLogo ? (
              <img
                src={config.companyLogo}
                alt={config.companyName || "Logo"}
                className="h-10 sm:h-12 max-w-[180px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  <Building size={20} />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900">
                    {config.companyName || "ARISTASTUDIO ALUM"}
                  </h1>
                  <span className="text-[10px] text-sky-600 font-bold uppercase tracking-widest block">
                    {webConfig.publicTitle || "Tienda de Aberturas Online"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* WhatsApp Direct Help */}
            {webConfig.whatsappNumber && (
              <a
                href={`https://wa.me/${(webConfig.whatsappNumber || "").replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <MessageCircle size={16} className="text-emerald-500" />
                <span>Asistencia WhatsApp</span>
              </a>
            )}

            {/* Shopping Cart Pill Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative px-4 sm:px-5 py-2.5 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center gap-2.5 transition-all shadow-md active:scale-95 ${
                cartItems.length > 0
                  ? "bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/20"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              <ShoppingBag size={18} />
              <span className="hidden sm:inline">Presupuesto</span>
              <span className="w-5 h-5 bg-amber-400 text-slate-950 rounded-full text-[11px] flex items-center justify-center font-black">
                {totalItemsCount}
              </span>
              {totalCartPrice > 0 && (
                <span className="hidden md:inline pl-1 border-l border-white/20 font-mono text-emerald-200">
                  ${totalCartPrice.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* SUCCESS STEP */}
      {activeStep === "success" && (
        <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 lg:p-12 flex flex-col items-center justify-center">
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-xl text-center space-y-6 w-full">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 size={44} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tight">
                ¡Presupuesto Enviado con Éxito!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                Muchas gracias, <strong className="text-slate-800">{leadName}</strong>. Tu pedido de cotización ha sido recibido con un total estimado de{" "}
                <strong className="text-emerald-600 font-mono text-base sm:text-lg">
                  ${totalCartPrice.toLocaleString()}
                </strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left space-y-2.5">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Detalle de la Solicitud
              </div>
              <div className="text-xs font-bold text-slate-800">
                Aberturas cotizadas: {totalItemsCount} unidad(es) ({cartItems.length} posición/es)
              </div>
              <div className="text-xs text-slate-600">
                Contacto: {leadPhone} {leadCity ? `• ${leadCity}` : ""}
              </div>
              <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                Un asesor técnico del taller se pondrá en contacto para rectificar medidas exactas en obra y coordinar plazos de entrega.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleDownloadPDF}
                className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-xs tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Download size={16} /> Descargar Presupuesto PDF
              </button>
              <button
                onClick={() => {
                  setCartItems([]);
                  setActiveStep("catalog");
                }}
                className="flex-1 py-3.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-black uppercase text-xs tracking-wider rounded-2xl transition-all"
              >
                Seguir Explorando el Catálogo
              </button>
            </div>
          </div>
        </main>
      )}

      {/* CATALOG STEP */}
      {activeStep === "catalog" && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
          {/* Hero Store Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white p-6 sm:p-10 shadow-xl">
            <div className="relative z-10 max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-sky-500/20 text-sky-300 border border-sky-400/30">
                <Sparkles size={12} /> Fabricación a Medida & Alta Prestación
              </span>
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight leading-tight">
                Catálogo de Aberturas de Aluminio
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
                Elegí el modelo de tu abertura, personalizá las medidas, el color de aluminio y el tipo de vidrio (Simple o DVH). Obtené tu presupuesto estimado al instante.
              </p>
            </div>

            {/* Trust Badges */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-white/10 mt-6">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-sky-400">
                  <Ruler size={14} />
                </div>
                <span>Medidas 100% personalizables en milímetros</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-emerald-400">
                  <ShieldCheck size={14} />
                </div>
                <span>Perfiles de aluminio y cristales certificados</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-amber-400">
                  <MessageCircle size={14} />
                </div>
                <span>Envío directo a WhatsApp con PDF detallado</span>
              </div>
            </div>
          </div>

          {/* Catalog Controls: Categories, Search & Line Filter */}
          <div className="space-y-4">
            {/* Visual Category Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === "all"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>Todas</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/50">
                  {availableRecipes.length}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategory("corredizas")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === "corredizas"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>Ventanas Corredizas</span>
              </button>

              <button
                onClick={() => setSelectedCategory("fijos")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === "fijos"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>Paños Fijos</span>
              </button>

              <button
                onClick={() => setSelectedCategory("abrir")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === "abrir"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>De Abrir & Batientes</span>
              </button>

              <button
                onClick={() => setSelectedCategory("puertas")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === "puertas"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>Puertas & Portones</span>
              </button>

              <button
                onClick={() => setSelectedCategory("proyectantes")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === "proyectantes"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>Ventiluz & Proyectantes</span>
              </button>
            </div>

            {/* Search and Line Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-md">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Buscar modelo o tipología..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Line Filter */}
              {lines.length > 1 && (
                <div className="w-full sm:w-auto flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">
                    Línea:
                  </span>
                  <select
                    value={selectedLine}
                    onChange={(e) => setSelectedLine(e.target.value)}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
                  >
                    <option value="all">Todas las Líneas ({availableRecipes.length})</option>
                    {lines.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Product Cards Grid (E-Commerce Storefront) */}
          {filteredRecipes.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Search size={28} />
              </div>
              <h3 className="text-base font-black uppercase text-slate-800">
                No encontramos aberturas que coincidan
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Probá cambiando la categoría o limpiando los términos de búsqueda.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedLine("all");
                  setSearchQuery("");
                }}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Ver Todo el Catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRecipes.map((recipe) => {
                const startPrice = recipeStartingPrices[recipe.id] || 0;
                const isDoor =
                  (recipe.type || "").toLowerCase().includes("puerta") ||
                  (recipe.name || "").toLowerCase().includes("puerta");
                const defaultW = isDoor ? 800 : 1500;
                const defaultH = isDoor ? 2000 : 1100;

                return (
                  <div
                    key={recipe.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group hover:-translate-y-1"
                  >
                    {/* Visual Illustration Showcase Box */}
                    <div className="relative bg-gradient-to-b from-slate-50 to-slate-100/70 p-6 flex items-center justify-center min-h-[220px] border-b border-slate-100 overflow-hidden">
                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                        {recipe.line && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 text-slate-700 shadow-2xs border border-slate-200/60 backdrop-blur-xs">
                            {recipe.line}
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/60">
                          {recipe.type || "Abertura"}
                        </span>
                      </div>

                      {/* Illustrative Render */}
                      <div className="w-full max-w-[220px] h-[170px] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
                        <OpeningIllustration
                          recipe={recipe}
                          width={defaultW}
                          height={defaultH}
                          color={treatments[0]?.hexColor || "#1e293b"}
                          infillType="vs"
                          withMosquitero={false}
                          allBlindPanels={blindPanels}
                          allProfiles={aluminum}
                          className="w-full h-full"
                          isThumbnail
                        />
                      </div>
                    </div>

                    {/* Card Content & Pricing */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2">
                          {recipe.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {isDoor
                            ? "Puerta reforzada con cerradura y zócalo de alto tránsito."
                            : "Ventana con rodamientos reforzados y cierre hermético."}
                        </p>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Desde
                          </span>
                          <span className="text-lg font-black text-emerald-600 font-mono">
                            ${startPrice.toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenCustomizer(recipe)}
                          className="w-full py-3 bg-slate-900 group-hover:bg-sky-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
                        >
                          <SlidersHorizontal size={14} />
                          <span>Personalizar & Cotizar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* PRODUCT CUSTOMIZER MODAL (E-COMMERCE DETAIL PAGE) */}
      {customizingRecipe && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col my-auto animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-20">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100">
                    {customizingRecipe.line || "Aluminio"}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {customizingRecipe.type || "Abertura"}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 mt-1">
                  {customizingRecipe.name}
                </h3>
              </div>

              <button
                onClick={() => setCustomizingRecipe(null)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Split 50 / 50 */}
            <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Visual Interactive Canvas */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-inner flex flex-col items-center justify-center min-h-[320px] relative overflow-hidden">
                  <div className="w-full max-w-md h-[280px] flex items-center justify-center">
                    <OpeningIllustration
                      recipe={customizingRecipe}
                      width={width}
                      height={height}
                      color={activeTreatment?.hexColor || "#1e293b"}
                      infillType={infillType}
                      tablillaMode={tablillaMode}
                      blindPanelId={selectedBlindPanelId}
                      withMosquitero={withMosquitero}
                      withTJ={withTJ}
                      tjSides={tjSides}
                      allBlindPanels={blindPanels}
                      allProfiles={aluminum}
                      showDimensions
                      className="w-full h-full"
                    />
                  </div>
                </div>

                {/* Color Swatch Picker under visual preview - VINCULADO A LOS COLORES DEL PROGRAMA */}
                <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-3xl border border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Palette size={14} className="text-sky-600" />
                      <span>Terminación / Color de Aluminio</span>
                    </label>
                    <span className="text-[11px] font-bold text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-lg">
                      {activeTreatment?.name}
                    </span>
                  </div>

                  {treatments.length > 6 && (
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar color en el programa..."
                        value={colorSearch}
                        onChange={(e) => setColorSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-xl text-[11px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredTreatments.map((t) => {
                      const isColorSelected = t.id === colorId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setColorId(t.id)}
                          className={`p-2.5 rounded-2xl border text-xs font-bold uppercase transition-all flex items-center gap-2.5 truncate text-left ${
                            isColorSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-sky-500/30"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-black/20 shrink-0 shadow-inner"
                            style={{ backgroundColor: t.hexColor || "#ffffff" }}
                          />
                          <span className="truncate">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Measurements, Glazing & Pricing */}
              <div className="lg:col-span-6 space-y-6">
                {/* Real-time Price Box */}
                <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 rounded-3xl border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      Precio Estimado Unitario
                    </span>
                    <div className="text-3xl font-black text-emerald-600 font-mono mt-0.5">
                      ${currentCustomizingPrice.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Subtotal ({quantity} u.)
                    </span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      ${(currentCustomizingPrice * quantity).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Popular Dimension Presets */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                    Medidas Estándar Frecuentes
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {dimensionPresets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setWidth(p.w);
                          setHeight(p.h);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                          width === p.w && height === p.h
                            ? "bg-sky-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom MM Dimensions Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
                      <span>Ancho (mm)</span>
                      <span className="text-[10px] text-slate-400 font-mono">{(width / 1000).toFixed(2)} m</span>
                    </label>
                    <input
                      type="number"
                      min="300"
                      max="6000"
                      step="10"
                      value={width}
                      onChange={(e) => setWidth(Math.max(100, Number(e.target.value)))}
                      className="w-full h-12 px-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
                      <span>Alto (mm)</span>
                      <span className="text-[10px] text-slate-400 font-mono">{(height / 1000).toFixed(2)} m</span>
                    </label>
                    <input
                      type="number"
                      min="300"
                      max="4000"
                      step="10"
                      value={height}
                      onChange={(e) => setHeight(Math.max(100, Number(e.target.value)))}
                      className="w-full h-12 px-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                  </div>
                </div>

                {/* 2. CONFIGURACIÓN DE VIDRIO Y DVH VINCULADO AL PROGRAMA */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Layers size={14} className="text-sky-600" />
                    <span>Tipo de Vidrio (Simple o DVH)</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setInfillType("vs")}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        infillType === "vs"
                          ? "bg-sky-50/70 border-sky-600 ring-2 ring-sky-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-xs font-black uppercase text-slate-900">Vidrio Simple</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Cristal monolítico</div>
                    </button>

                    {webConfig.allowDVH && (
                      <button
                        type="button"
                        onClick={() => setInfillType("dvh")}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          infillType === "dvh"
                            ? "bg-sky-50/70 border-sky-600 ring-2 ring-sky-500/20"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-xs font-black uppercase text-slate-900 flex items-center gap-1">
                          <span>Doble Vidrio (DVH)</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Aislación termoacústica</div>
                      </button>
                    )}
                  </div>

                  {/* Sub-selectores de Cristales específicos de la base de datos */}
                  {infillType === "vs" ? (
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Seleccionar Cristal de la Base de Datos:
                      </label>
                      <select
                        value={selectedGlassId}
                        onChange={(e) => setSelectedGlassId(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        {glasses.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.detail} {g.thickness ? `(${g.thickness} mm)` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Composición del DVH (Base de Datos):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                            Vidrio Exterior
                          </label>
                          <select
                            value={selectedGlassOuterId}
                            onChange={(e) => setSelectedGlassOuterId(e.target.value)}
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800"
                          >
                            {glasses.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.detail}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                            Cámara de Aire
                          </label>
                          <select
                            value={selectedCameraId}
                            onChange={(e) => setSelectedCameraId(e.target.value)}
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800"
                          >
                            {dvhCameras.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.detail}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                            Vidrio Interior
                          </label>
                          <select
                            value={selectedGlassInnerId}
                            onChange={(e) => setSelectedGlassInnerId(e.target.value)}
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800"
                          >
                            {glasses.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.detail}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. TABLILLAS: COMPLETA O MITAD Y MITAD */}
                {webConfig.allowBlind && (
                  <div className="space-y-3 p-4 bg-slate-50/80 rounded-3xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Grid size={14} className="text-sky-600" />
                        <span>Configuración de Tablillas / Ciegos</span>
                      </label>
                      {tablillaMode !== "vidrio" && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">
                          {tablillaMode === "mitad" ? "1/2 Vidrio + 1/2 Tablilla" : "Tablilla Completa"}
                        </span>
                      )}
                    </div>

                    {/* Selector de Modo de Tablillas */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setTablillaMode("vidrio")}
                        className={`p-2.5 rounded-2xl border text-center transition-all ${
                          tablillaMode === "vidrio"
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-[11px] font-black uppercase">Vidrio Completo</div>
                        <div className="text-[9px] opacity-75 mt-0.5">100% Vidrio</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTablillaMode("mitad")}
                        className={`p-2.5 rounded-2xl border text-center transition-all ${
                          tablillaMode === "mitad"
                            ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-[11px] font-black uppercase">Mitad y Mitad</div>
                        <div className="text-[9px] opacity-75 mt-0.5">1/2 Tablilla + 1/2 Vidrio</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTablillaMode("completa")}
                        className={`p-2.5 rounded-2xl border text-center transition-all ${
                          tablillaMode === "completa"
                            ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-[11px] font-black uppercase">Tablilla Completa</div>
                        <div className="text-[9px] opacity-75 mt-0.5">100% Ciega</div>
                      </button>
                    </div>

                    {/* Selector del Modelo de Tablilla en la base de datos */}
                    {tablillaMode !== "vidrio" && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Modelo de Tablilla / Machimbre:
                        </label>
                        <select
                          value={selectedBlindPanelId}
                          onChange={(e) => setSelectedBlindPanelId(e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          {blindPanels.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.detail} ({b.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. SISTEMA DE TAPAJUNTAS (TJ) */}
                <div className="space-y-3 p-4 bg-slate-50/80 rounded-3xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={withTJ}
                        onChange={(e) => setWithTJ(e.target.checked)}
                        className="w-4 h-4 text-sky-600 rounded-md focus:ring-sky-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-black text-slate-800 uppercase block">
                          Sistema de Tapajuntas (TJ)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Contramarcos perimetrales para terminación de pared
                        </span>
                      </div>
                    </label>

                    {withTJ && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                        Activo
                      </span>
                    )}
                  </div>

                  {/* Lados de Tapajuntas (TOP, BOT, LEF, RIG) */}
                  {withTJ && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-500">
                          Lados con Tapajuntas:
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setTjSides({ top: true, bottom: true, left: true, right: true })
                            }
                            className="text-[10px] font-bold text-sky-600 hover:underline"
                          >
                            4 Lados
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() =>
                              setTjSides({ top: true, bottom: false, left: true, right: true })
                            }
                            className="text-[10px] font-bold text-sky-600 hover:underline"
                          >
                            3 Lados (s/umbral)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { key: "top", label: "Superior (TOP)" },
                          { key: "bottom", label: "Inferior (BOT)" },
                          { key: "left", label: "Izquierda (LEF)" },
                          { key: "right", label: "Derecha (RIG)" },
                        ].map((side) => {
                          const isActive = tjSides[side.key as keyof typeof tjSides];
                          return (
                            <button
                              key={side.key}
                              type="button"
                              onClick={() =>
                                setTjSides((prev) => ({
                                  ...prev,
                                  [side.key]: !prev[side.key as keyof typeof tjSides],
                                }))
                              }
                              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase transition-all text-center ${
                                isActive
                                  ? "bg-sky-600 text-white shadow-xs"
                                  : "bg-white border border-slate-200 text-slate-400 hover:bg-slate-100"
                              }`}
                            >
                              {side.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. MOSQUITERO & CANTIDAD */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withMosquitero}
                      onChange={(e) => setWithMosquitero(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded-md focus:ring-sky-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase block">
                        Agregar Mosquitero
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Marco de aluminio con tela mosquitera integrada
                      </span>
                    </div>
                  </label>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-xs text-slate-500 font-bold uppercase">Cantidad:</span>
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-sm"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-bold font-mono text-slate-900">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black uppercase text-xs sm:text-sm tracking-wider shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-98"
                >
                  <Plus size={18} />
                  <span>
                    Agregar al Presupuesto • ${(currentCustomizingPrice * quantity).toLocaleString()}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOPPING CART / QUOTE DRAWER (SLIDE-OVER) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={20} className="text-sky-600" />
                <h3 className="text-base font-black uppercase text-slate-900">
                  Mi Presupuesto de Aberturas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                  {totalItemsCount} u.
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <ShoppingBag size={32} />
                  </div>
                  <h4 className="text-sm font-black uppercase text-slate-800">
                    Tu presupuesto está vacío
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Seleccioná modelos desde el catálogo e ingresá tus medidas para cotizarlas.
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider mt-2"
                  >
                    Ver Catálogo
                  </button>
                </div>
              ) : (
                cartItems.map((item, idx) => {
                  const desc = getItemDescription(
                    item,
                    recipes,
                    treatments,
                    glasses,
                    dvhInputs,
                    blindPanels
                  );
                  const recipe = desc.recipe;
                  const mod = item.composition.modules[0];

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-sky-300 transition-colors flex items-center gap-3.5 shadow-2xs"
                    >
                      {/* Mini thumbnail illustration */}
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                        <OpeningIllustration
                          recipe={recipe}
                          width={item.width}
                          height={item.height}
                          color={desc.hexColor}
                          infillType={desc.tablillaMode === "completa" ? "tablilla" : mod?.isDVH ? "dvh" : "vs"}
                          tablillaMode={desc.tablillaMode}
                          blindPanelId={desc.blindPanelId}
                          withMosquitero={desc.hasMosquitero}
                          withTJ={desc.hasTJ}
                          tjSides={desc.tjSides}
                          allBlindPanels={blindPanels}
                          allProfiles={aluminum}
                          className="w-full h-full"
                          isThumbnail
                        />
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black uppercase text-slate-900 truncate">
                          {idx + 1}. {desc.recipeName}
                        </div>
                        <div className="text-[11px] text-slate-600 font-bold uppercase mt-0.5 font-mono">
                          {item.width} × {item.height} mm • {desc.colorName}
                        </div>
                        <div className="text-[10px] text-sky-700 font-semibold uppercase mt-0.5">
                          {desc.infillText}
                        </div>
                        {(desc.tjText || desc.hasMosquitero) && (
                          <div className="text-[9px] text-emerald-700 font-bold uppercase mt-1 flex flex-wrap gap-1">
                            {desc.tjText && (
                              <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {desc.tjText}
                              </span>
                            )}
                            {desc.hasMosquitero && (
                              <span className="bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-sky-700">
                                + Mosquitero
                              </span>
                            )}
                          </div>
                        )}
                        <div className="text-xs font-black text-slate-900 font-mono mt-1.5">
                          ${(item.calculatedCost * item.quantity).toLocaleString()}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            (${item.calculatedCost.toLocaleString()} c/u)
                          </span>
                        </div>
                      </div>

                      {/* Stepper & Delete */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            className="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold text-xs"
                          >
                            -
                          </button>
                          <span className="px-2 text-xs font-bold font-mono text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            className="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                          title="Eliminar de la lista"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer & Checkout Form */}
            {cartItems.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-4">
                {/* Total Counter */}
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Total Estimado ({totalItemsCount} unidades):
                  </span>
                  <span className="text-2xl font-black text-emerald-600 font-mono">
                    ${totalCartPrice.toLocaleString()}
                  </span>
                </div>

                {/* Lead Form Inputs */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Tus Datos para recibir el Presupuesto
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre y Apellido *"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp (con código) *"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Localidad / Obra"
                      value={leadCity}
                      onChange={(e) => setLeadCity(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="text"
                      placeholder="Aclaraciones o notas..."
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Checkout Actions */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleFinalizeAndSendWhatsApp}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <MessageCircle size={18} />
                    <span>Enviar Pedido por WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="w-full py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-black uppercase text-[11px] tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download size={14} />
                    <span>Descargar Presupuesto en PDF</span>
                  </button>
                </div>

                {webConfig.notes && (
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic text-center">
                    💡 {webConfig.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STORE FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-black uppercase tracking-wider text-slate-800">
            {config.companyName || "ARISTASTUDIO ALUM"} • Catálogo Digital
          </p>
          <p className="text-slate-400">
            {config.companyAddress || ""} • Tel: {config.companyPhone || ""}
          </p>
          <p className="text-[10px] text-slate-400 pt-3">
            Plataforma desarrollada con AristaStudio Engine • Cotizador Online Inteligente
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicWebQuoter;
