# ARQUITECTURAL SCHEMA: FAMILIA DE APLICACIONES INDUSTRIALES
## Suite de Cotización, Despiece y Gestión de Taller (Aluminio / Madera / Metalúrgica)

**Versión:** 2.0.0  
**Estado:** Especificación Maestra de Arquitectura  
**Estándar de Calidad:** Nivel Producción Industrial (Cero Parches / Single Source of Truth)

---

## 1. INTRODUCCIÓN Y PRINCIPIOS DE DISEÑO

El objetivo de esta arquitectura es proporcionar un **Chasis de Software Unificado** para tres aplicaciones web independientes de manufactura a medida:
1. **AlumStudio:** Carpintería de Aluminio & PVC (Color primario: **Celeste / Sky** `#0ea5e9`).
2. **WoodStudio:** Carpintería de Madera & Mobiliario Modular (Color primario: **Naranja / Orange** `#ea580c`).
3. **MetalStudio:** Metalúrgica, Herrería y Estructuras Metálicas (Color primario: **Azul / Cobalt Blue** `#2563eb`).

### Principios Rectores:
* **Identidad Visual Idéntica (Look & Feel):** Mismo sistema de espaciado, componentes, micro-tipografías y flujo de usuario; únicamente varía el color de acento según la especialidad.
* **Separación Estricta de Capas:** El motor de cálculo matemático, el modelo de datos y la persistencia son agnósticos al método de renderizado (2D o 3D).
* **Módulos Idénticos:** Cada programa contiene exactamente las mismas 6 vistas principales (Cotizador, Obras Activas, Historial, Recetas/Sistemas, Base de Datos con pestañas, Ajustes).

---

## 2. MATRIZ DE COLOR Y TOKENS DE DISEÑO

| Variable / Token | Carpintería Aluminio (`AlumStudio`) | Carpintería Madera (`WoodStudio`) | Metalúrgica (`MetalStudio`) |
| :--- | :--- | :--- | :--- |
| **Color Acento Primario** | `#0ea5e9` (`sky-600`) | `#ea580c` (`orange-600`) | `#2563eb` (`blue-600`) |
| **Acento Hover / Active** | `#0284c7` (`sky-700`) | `#c2410c` (`orange-700`) | `#1d4ed8` (`blue-700`) |
| **Fondo Suave de Acento** | `bg-sky-50/50` | `bg-orange-50/50` | `bg-blue-50/50` |
| **Borde Suave de Acento** | `border-sky-100` | `border-orange-100` | `border-blue-100` |
| **Anillo de Foco (Focus Ring)**| `ring-sky-500` | `ring-orange-500` | `ring-blue-500` |
| **Tipografía UI / Tablas** | `Inter`, -apple-system, sans-serif | `Inter`, -apple-system, sans-serif | `Inter`, -apple-system, sans-serif |
| **Tipografía Numérica / Cotas**| `JetBrains Mono`, monospace | `JetBrains Mono`, monospace | `JetBrains Mono`, monospace |
| **Tipografía Documentos PDF** | `Helvetica` | `Helvetica` | `Helvetica` |
| **Fondo General del Sistema** | `#f8fafc` (`bg-slate-50`) | `#f8fafc` (`bg-slate-50`) | `#f8fafc` (`bg-slate-50`) |
| **Superficie de Tarjetas** | `#ffffff` (`border-slate-200`) | `#ffffff` (`border-slate-200`) | `#ffffff` (`border-slate-200`) |

---

## 3. ARQUITECTURA DE CAPAS (LAYERED ARCHITECTURE)

```
+-----------------------------------------------------------------------------------+
|                            CAPA DE PRESENTACIÓN (UI)                             |
|  [Topbar Global] -> [6 Módulos: Cotizador | Obras | Historial | Recetas | BD | Config]  |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-------------------------------------+  +------------------------------------+  |
|  |     RENDERIZADOR 2D TÉCNICO         |  |      RENDERIZADOR 3D PARAMÉTRICO   |  |
|  |   (SVG / HTML5 Canvas con Cotas)    |  |    (WebGL / Three.js con Cotas)    |  |
|  +-------------------------------------+  +------------------------------------+  |
|                     ^                                        ^                    |
|                     |             VIEWPORT ADAPTER           |                    |
|                     +--------------------+-------------------+                    |
|                                          |                                        |
+------------------------------------------v----------------------------------------+
|                               CAPA DE NEGOCIO (CORE)                              |
|  - Gestor de Grilla Paramétrica (Columns: colSizes[], Rows: rowSizes[], W, H, D)  |
|  - Evaluador de Fórmulas Matemáticas (Parser W, H, D, Espesor, Holguras)         |
|  - Motor de Costeo y Márgenes (Materiales + Mano de Obra + Tratamientos + Margen)  |
|  - Motor de Optimización de Cortes (1D Barras / Tirantes / Caños, 2D Placas/Chapas)|
|  - Generador de Documentos Industriales (PDFs Comerciales y de Taller)            |
+-----------------------------------------------------------------------------------+
|                               CAPA DE DATOS (DATA)                                |
|  - Tablas Normalizadas: Elementos Lineales, Superficiales, Accesorios, Recetas    |
|  - Motor Importador/Exportador Excel (.xlsx)                                      |
|  - Adaptador Supabase / Base de Datos Relacional                                 |
+-----------------------------------------------------------------------------------+
```

---

## 4. MODELO DE DATOS UNIVERSAL (CORE SCHEMAS - `types.ts`)

A continuación se define el esquema de tipos en TypeScript puro que gobierna a los tres programas sin mutaciones ad-hoc:

```typescript
// ==========================================
// 1. CONFIGURACIÓN GLOBAL DEL TALLER
// ==========================================
export interface GlobalConfig {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyLogo: string;
  currencySymbol: string; // "$" | "USD"
  currencyRate: number;   // Cotización oficial/paralela
  taxRate: number;        // ej: 21%
  laborPercentage: number; // Margen de mano de obra
  generalWastePercentage: number; // Merma general de corte
  linearCuttingDiscWidth: number; // Ancho de corte del disco (mm)
  extraOverheadMargin: number;    // Gastos generales / amortización (%)
}

// ==========================================
// 2. INSUMOS Y MATERIALES (EL MAESTRO DE DATOS)
// ==========================================

// Insumo Lineal: Perfil de Aluminio / Tirante de Madera / Caño Estructural
export interface LinearMaterial {
  id: string;
  code: string;
  name: string;
  lineOrFamily: string; // ej: "Módena", "Roble 2x4", "Tubo 40x40x1.6"
  barLengthMm: number;  // Típicamente 6000 mm (aluminio/acero) o 3660 mm (madera)
  weightKgPerMeter?: number; // Crítico en metalúrgica y aluminio
  pricePerUnit: number; // Precio por barra o por kilo
  priceType: "POR_BARRA" | "POR_KG" | "POR_METRO";
  colorOrFinish?: string;
}

// Insumo Superficial: Vidrio / Placa Melamínica / Chapa de Acero
export interface SheetMaterial {
  id: string;
  code: string;
  name: string;
  type: string; // ej: "DVH 4+9+4", "Melamina 18mm", "Chapa Calibre 14"
  thicknessMm: number;
  widthMm: number;  // Dimensión comercial de la hoja (ej: 1830, 1500, 2500)
  heightMm: number; // Dimensión comercial de la hoja (ej: 2600, 3000, 3600)
  pricePerM2: number;
  hasGrainDirection?: boolean; // Sentido de veta (Madera)
}

// Accesorios y Herrajes
export interface AccessoryItem {
  id: string;
  code: string;
  name: string;
  category: "HERRAJE" | "TORNILLERIA" | "BURLETE_O_CANTO" | "CONSUMIBLE";
  pricePerUnit: number;
  unitOfMeasure: "UNIDAD" | "PAR" | "JUEGO" | "METRO_LINEAL" | "KILO";
}

// Tratamiento o Acabado Superficial
export interface SurfaceTreatment {
  id: string;
  name: string;
  pricePerKg?: number; // Aluminio y Metalúrgica
  pricePerM2?: number; // Madera (laqueado) o Metalúrgica (chapa)
  hexColorPreview?: string;
}

// ==========================================
// 3. RECETAS / SISTEMAS PARAMÉTRICOS
// ==========================================
export interface RecipePiece {
  id: string;
  name: string; // ej: "Parante Lateral", "Zócalo", "Estante", "Refuerzo"
  materialId: string;
  materialType: "LINEAR" | "SHEET" | "ACCESSORY";
  quantityFormula: string; // ej: "2", "cols + 1", "Math.ceil(W / 120)"
  lengthFormula: string;   // ej: "H", "W - 2 * E", "H - 70"
  widthFormula?: string;   // Para piezas de placa o chapa: ej: "D - 20"
  cutAngleStart?: "45" | "90";
  cutAngleEnd?: "45" | "90";
  edgeBanding?: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  }; // Requerido en Madera
}

export interface ProductRecipe {
  id: string;
  code: string;
  name: string;
  category: string; // "Ventana" | "Bajo Mesada" | "Portón"
  description: string;
  pieces: RecipePiece[];
  defaultAccessories: { accessoryId: string; formulaQuantity: string }[];
  visualType: string; // Identificador para el motor visual
}

// ==========================================
// 4. GRILLA Y COTIZADOR (EL ESPACIO COMPUESTO)
// ==========================================
export interface MeasurementCell {
  id: string;
  colIndex: number;
  rowIndex: number;
  recipeId: string;
  customParameters?: Record<string, any>; // Opciones particulares del nicho
}

export interface AssemblyComposition {
  totalWidth: number;
  totalHeight: number;
  totalDepth: number;
  colSizes: number[]; // Milímetros de cada columna
  rowSizes: number[]; // Milímetros de cada fila
  isManualMode: boolean; // true = las partes mandan; false = proporcional
  cells: MeasurementCell[];
}

export interface QuoteItem {
  id: string;
  itemCode: string; // ej: "V1", "MUEBLE-COCINA", "PORTON-ACCESO"
  quantity: number;
  colorOrTreatmentId: string;
  composition: AssemblyComposition;
  unitPrice: number;
  totalPrice: number;
  breakdown: {
    linearMaterialsCost: number;
    sheetMaterialsCost: number;
    accessoriesCost: number;
    treatmentCost: number;
    laborCost: number;
    commercialMargin: number;
  };
}

export interface WorkProject {
  id: string;
  projectCode: string;
  title: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  status: "BORRADOR" | "COTIZADO" | "APROBADO" | "EN_PRODUCCION" | "ENTREGADO";
  items: QuoteItem[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. CAPA DE RENDERIZADO VISUAL DESACOPLADA (2D vs 3D)

Para garantizar que el sistema funcione con **cero parches**, el área central del cotizador no dibuja geometría de manera desordenada en el componente, sino que invoca a un **Adaptador de Visualización Común**:

```typescript
// src/components/visualizer/types.ts
export interface VisualizerProps {
  composition: AssemblyComposition;
  selectedCellId: string | null;
  onSelectCell: (cellId: string) => void;
  recipes: ProductRecipe[];
  primaryAccentColor: string; // "#0ea5e9" | "#ea580c" | "#2563eb"
  mode: "2D_TECHNICAL" | "3D_PERSPECTIVE";
}
```

### Componente Contenedor `UnifiedVisualizer.tsx`:
```tsx
export const UnifiedVisualizer: React.FC<VisualizerProps> = ({
  mode,
  ...props
}) => {
  return (
    <div className="relative w-full h-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
      {/* Selector de Modo Superior */}
      <div className="absolute top-3 right-3 z-10 flex bg-white/90 backdrop-blur p-1 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => props.onSelectMode?.("2D_TECHNICAL")}
          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
            mode === "2D_TECHNICAL" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-700"
          }`}
        >
          Plano 2D Técnico
        </button>
        <button
          onClick={() => props.onSelectMode?.("3D_PERSPECTIVE")}
          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
            mode === "3D_PERSPECTIVE" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-700"
          }`}
        >
          Perspectiva 3D
        </button>
      </div>

      {/* Renderizado Condicional de la Geometría */}
      {mode === "2D_TECHNICAL" ? (
        <Technical2DRenderer {...props} />
      ) : (
        <Parametric3DRenderer {...props} />
      )}
    </div>
  );
};
```

1. **`Technical2DRenderer` (Plano 2D Técnico):**
   * Dibuja líneas ortogonales milimétricas en SVG/Canvas con cotas perimetrales e intermedias en gris técnico (`#64748b`) y texto en `JetBrains Mono`.
   * Permite hacer clic en cada cuadrante para cambiar la tipología o ver divisiones internas.
2. **`Parametric3DRenderer` (Perspectiva 3D):**
   * Genera las extrusiones paramétricas en tiempo real a partir del mismo arreglo de `colSizes`, `rowSizes` y `totalDepth`.
   * Aplica materiales PBR ligeros:
     * *Aluminio:* Metal pulido / anodizado / epoxi.
     * *Madera:* Vetas de roble/nogal o melamina mate con textura suave.
     * *Metalúrgica:* Acero laminado, caño estructural negro o forja.
   * Cuenta con herramientas de: Órbita con mouse, Slider de Apertura (0% a 100%) y Vista Explosionada (Despiece flotante).

---

## 6. MAPEO ESPECÍFICO DE MÓDULOS POR RUBRO

Cada uno de los tres programas utiliza exactamente la misma barra de navegación con 6 botones. Solo cambia la adaptación del contenido a su industria:

| Módulo Global | Carpintería de Aluminio (`AlumStudio`) | Carpintería de Madera (`WoodStudio`) | Metalúrgica (`MetalStudio`) |
| :--- | :--- | :--- | :--- |
| **1. Cotizador (`quoter`)** | Vano de Abertura (Ancho $\times$ Alto). Grilla de paños fijos, hojas corredizas o batientes. Descuento de vidrios. | Mueble modular (Ancho $\times$ Alto $\times$ Fondo). Grilla de módulos bajos, alacenas, cajoneras y frentes. | Estructura/Cerramiento (Ancho $\times$ Alto $\times$ Profundidad). Grilla de paños de reja, portones o bastidores. |
| **2. Obras Activas (`obras`)** | Lista de aberturas de la vivienda (V1, P1). Cálculo de kg de aluminio y m² de vidrio. | Lista de ambientes/muebles (Cocina, Placard). Cálculo de placas necesarias y m de canto. | Lista de carpinterías metálicas. Cálculo de peso neto en Kg y metros de soldadura. |
| **3. Historial (`history`)** | Historial de cotizaciones emitidas con buscador por cliente/obra y opción de reapertura. | Mismo comportamiento: búsqueda, clonación y reajuste de precios a valor dólar actual. | Mismo comportamiento: trazabilidad de presupuestos con histórico de cotización. |
| **4. Recetas (`recipes`)** | Corredizas 2H, 3H, 4H; De abrir; Banderolas; Oscilobatientes; Piel de Vidrio; Mosquiteros. | Bajo mesada; Cajoneros; Alacenas; Placards; Vanitorys; Bibliotecas; Puertas placa. | Portones corredizos; Portones levadizos; Rejas perimetrales; Barandas; Escaleras; Tinglados. |
| **5. Base de Datos (`database`)** | *Sub-tabs:* Perfiles Alum, Vidrios/DVH, Paneles, Accesorios, Felpas/Burletes, Pinturas. | *Sub-tabs:* Placas Melamina/MDF, Tapacantos, Fondos 3mm, Correderas/Bisagras, Tiradores, Lacas. | *Sub-tabs:* Caños Estructurales, Chapas/Mallas, Perfiles C/UPN, Pomelas/Ruedas, Electrodos/Gas, Pinturas. |
| **6. Ajustes (`config`)** | Merma aluminio %, ancho de disco de ingletadora (4mm), % armado, membrete y datos de taller. | Merma de placa %, espesor de sierra escuadradora, costo hora armado, membrete y datos de taller. | Merma de caño %, costo por kg de soldadura, mano de obra herrería, membrete y datos de taller. |

---

## 7. MOTOR DE IMPORTACIÓN / EXPORTACIÓN EXCEL (.XLSX)

En los 3 sistemas, la pestaña **Base de Datos** cuenta con el mismo mecanismo industrial mediante `xlsx`:
* **Exportar Catálogo a Excel:** Descarga un libro con una hoja por categoría (ej: `Perfiles`, `Vidrios`, `Accesorios` o `Placas`, `Tapacantos`, `Herrajes`).
* **Actualización Masiva:** El usuario modifica columnas de costo en Excel y lo sube con un botón drag & drop.
* **Importación Atómica:** Se validan los códigos únicos (`code`). Si el código existe, se actualiza el precio; si no existe, se inserta.

---

## 8. MOTOR DE REPORTES INDUSTRIALES (PDFS)

Ambas tres herramientas generan la misma tríada de documentos oficiales (`jspdf` + `jspdf-autotable`):

1. **Presupuesto Comercial (Para el Cliente):**
   * Membrete corporativo, datos del cliente y estado de validez de la oferta.
   * Render técnico (2D vectorial o captura 3D nítida con cotas).
   * Resumen descriptivo de los ítems con precios unitarios y total consolidado en la moneda elegida.
2. **Hoja de Taller y Despiece (Para el Operario):**
   * Tabla con el listado exhaustivo de cortes milimétricos: Pieza, Cantidad, Medida de Corte, Ángulo (45°/90°) o Tapacanto asignado.
3. **Orden de Compra / Lista de Acopio (Para el Proveedor):**
   * Consolidado de materiales comerciales completos necesarios (Barras enteras de 6m, Hojas de placa completas, Hojas de chapa y unidades exactas de herrajes).

---

## 9. CHECKLIST PARA CREAR LAS APPS DERIVADAS

Para instanciar `WoodStudio` o `MetalStudio` a partir de esta arquitectura:
1. Mantener intacta la carpeta de componentes y el flujo de navegación (`App.tsx`).
2. Configurar la paleta de colores en `constants.tsx`:
   * Si es Madera: Reemplazar `sky` por `orange` / `#ea580c`.
   * Si es Metalúrgica: Reemplazar `sky` por `blue` / `#2563eb`.
3. Inyectar el catálogo inicial de tipos e insumos correspondiente en la base de datos o migraciones de Supabase.
4. Conectar el componente de visualización `UnifiedVisualizer` con el adaptador visual correspondiente a la tipología del rubro.
