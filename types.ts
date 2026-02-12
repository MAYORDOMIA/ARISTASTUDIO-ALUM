
export interface GlobalConfig {
  aluminumPricePerKg: number;
  laborPercentage: number;
  discWidth: number; 
  taxRate: number;
  blindPanelPricePerM2: number;
  meshPricePerM2: number; 
  companyName?: string;
  companyLogo?: string; 
  companyAddress?: string;
  companyPhone?: string;
}

export interface AluminumProfile {
  id: string;
  code: string;
  detail: string;
  weightPerMeter: number;
  barLength: number;
  treatmentCost: number; 
  thickness: number; 
}

export interface Glass {
  id: string;
  code: string;
  detail: string;
  width: number;
  height: number;
  pricePerM2: number;
  isMirror?: boolean;
}

export interface BlindPanel {
  id: string;
  code: string;
  detail: string;
  price: number;
  unit: 'm2' | 'ml';
}

export interface Accessory {
  id: string;
  code: string;
  detail: string;
  unitPrice: number;
}

export interface DVHInput {
  id: string;
  type: 'Cámara' | 'Butilo' | 'Sales' | 'Escuadras';
  detail: string;
  cost: number;
}

export interface Treatment {
  id: string;
  name: string;
  pricePerKg: number;
  hexColor?: string; 
}

export interface RecipeProfile {
  profileId: string;
  quantity: number;
  formula: string; 
  cutStart: '45' | '90';
  cutEnd: '45' | '90';
  role?: 'Marco' | 'Hoja' | 'Zócalo' | 'Travesaño' | 'Encuentro' | 'Acople' | 'Tapajuntas' | 'Mosquitero' | 'Otro';
}

export interface RecipeAccessory {
  accessoryId: string;
  quantity: number;
  isLinear?: boolean; 
  formula?: string;   
  label?: string;       // Nueva etiqueta para agrupar opciones
  isAlternative?: boolean; // Marca si es una opción secundaria (no se suma por defecto)
}

export type VisualOpeningType = string;

export interface CustomVisualType {
  id: string;
  label: string;
  description: string;
}

export interface ProductRecipe {
  id: string;
  name: string;
  line: string; 
  type: 'Ventana' | 'Puerta' | 'Banderola' | 'Mampara' | 'Paño Fijo' | 'Baranda' | 'Vidriera';
  visualType?: VisualOpeningType;
  profiles: RecipeProfile[];
  accessories: RecipeAccessory[];
  glassFormulaW: string; 
  glassFormulaH: string; 
  defaultTransomProfileId?: string;
  transomFormula?: string; 
  transomThickness?: number; 
  transomGlassDeduction?: number;
  defaultTransoms?: { height: number; profileId: string }[];
  glassDeductionW?: number;
  glassDeductionH?: number;
  image?: string;
  isLocked?: boolean;
  defaultTapajuntas?: boolean;
  tapajuntasThickness?: number; 
  defaultTapajuntasProfileId?: string;
  defaultCouplingProfileId?: string;
  defaultCouplingDeduction?: number;
  defaultMosquitero?: boolean;
  mosquiteroProfileId?: string;
  mosquiteroFormulaW?: string;
  mosquiteroFormulaH?: string;
}

export interface MeasurementModule {
  id: string;
  recipeId: string;
  x: number;
  y: number;
  isDVH: boolean;
  glassOuterId: string;
  glassInnerId?: string;
  dvhCameraId?: string;
  blindPanes?: number[];
  blindPaneIds?: Record<number, string>;
  slatProfileIds?: Record<number, string>; // Nuevo: Perfil de tablilla por paño
  transoms?: { height: number; profileId: string; formula?: string }[];
  overriddenAccessories?: RecipeAccessory[];
}

export interface QuoteItemBreakdown {
  aluCost: number;
  glassCost: number;
  accCost: number;
  laborCost: number;
  materialCost: number;
  totalWeight: number;
}

export interface QuoteItem {
  id: string;
  itemCode: string; 
  clientName?: string;
  width: number;
  height: number;
  colorId: string;
  quantity: number;
  calculatedCost: number;
  previewImage?: string;
  breakdown?: QuoteItemBreakdown;
  
  composition: {
    modules: MeasurementModule[];
    colRatios: number[];
    rowRatios: number[];
    couplingDeduction: number;
  };
  
  extras: {
    mosquitero: boolean;
    tapajuntas: boolean;
    tapajuntasSides: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
    };
  };
  couplingProfileId?: string;
}

export interface Quote {
  id: string;
  clientName: string;
  date: string;
  items: QuoteItem[];
  totalPrice: number;
}
