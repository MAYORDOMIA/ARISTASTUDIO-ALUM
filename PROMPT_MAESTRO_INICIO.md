# PROMPT MAESTRO UNIVERSAL DE INICIO
## Para Generar: WoodStudio (Madera) o MetalStudio (Metalúrgica)

> **Instrucciones de uso:**
> Copia este prompt completo al iniciar un nuevo proyecto.
> Solo debes ajustar la primera línea (**VARIABLE DE RUBRO**) seleccionando `[MADERA]` o `[METALÚRGICA]`.

---

```markdown
# ESPECIFICACIÓN TÉCNICA Y SISTEMA BASE: SOFTWARE INDUSTRIAL DE COTIZACIÓN, DESPIECE Y GESTIÓN DE TALLER

> **SELECCIÓN DE RUBRO PARA ESTE PROYECTO (ELEGIR UNO):**
> [X] OPCIÓN A: CARPINTERÍA DE MADERA Y MOBILIARIO MODULAR (Nombre: WoodStudio | Color Acento: Naranja #ea580c | Fondo Acento: bg-orange-50/50 | Borde Acento: border-orange-100 | Ring: ring-orange-500)
> [ ] OPCIÓN B: METALÚRGICA, HERRERÍA Y ESTRUCTURAS (Nombre: MetalStudio | Color Acento: Azul Cobalto #2563eb | Fondo Acento: bg-blue-50/50 | Borde Acento: border-blue-100 | Ring: ring-blue-500)

Actúa como un arquitecto de software senior especializado en sistemas ERP/CAD industriales para manufactura a medida.
Debes construir una aplicación web SPA completa en React 19 + TypeScript + Tailwind CSS, siguiendo con máxima fidelidad la arquitectura de componentes, micro-estética técnica y flujo de trabajo de un software de taller industrial de alta precisión, completamente operativo, sin botones inertes ni parches.

---

### 1. SISTEMA DE DISEÑO VISUAL (LOOK & FEEL OBLIGATORIO)
* **Paleta Base:** Fondo general `bg-[#f8fafc]` (`slate-50`), tarjetas y paneles `bg-white border border-slate-200 rounded-2xl shadow-sm`, textos principales `text-slate-900`, secundarios `text-slate-500`.
* **Color de Acento:** Usa estrictamente el color definido según la opción seleccionada arriba (Naranja para Madera, Azul para Metalúrgica).
* **Tipografías:**
  * Interfaz general y tablas: `Inter` (sans-serif).
  * Cotas milimétricas, códigos, fórmulas y valores numéricos: `JetBrains Mono` (`font-mono`).
  * Informes PDF: `Helvetica`.
* **Micro-Tipografía de Control:**
  * Etiquetas de sección e inputs: `text-[8px]` o `text-[9px] font-black uppercase tracking-widest text-slate-400`.
  * Inputs numéricos: `h-8 px-2 rounded-lg border border-slate-200 font-mono font-black text-xs bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-opacity-50`.
  * Botones de incremento/decremento: Circulares `w-6 h-6 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 shadow-sm border border-slate-200 active:scale-95`.

---

### 2. BARRA SUPERIOR Y LOS 6 MÓDULOS OBLIGATORIOS (NAVBAR FIJA)
La barra superior incluye el logotipo corporativo, el nombre del software, selector de moneda (ARS / USD), badge de obra activa actual y exactamente 6 pestañas de navegación:
1. `quoter`: **Cotizador** (Pantalla central de dimensionado, ensamble modular y costeo en tiempo real).
2. `obras`: **Obras Activas** (Gestor de proyectos por cliente con estados: *Borrador, Cotizado, Aprobado, Producción, Entregado*, listado de ítems y exportación).
3. `history`: **Historial** (Registro cronológico de cotizaciones con buscador y duplicación/reapertura con recálculo de precios).
4. `recipes`: **Recetas / Sistemas** (Constructor paramétrico de fórmulas de corte $W, H, D$ para cada tipología).
5. `database`: **Base de Datos** (Maestro de insumos con subpestañas por familia de material, buscador, multiplicador masivo de precios e importación/exportación a Excel `.xlsx`).
6. `config`: **Ajustes** (Datos del taller para membrete, logo, porcentaje de merma/desperdicio, porcentaje de mano de obra, cotización dólar y margen comercial).

---

### 3. PANTALLA DEL COTIZADOR (LAYOUT ESTRICTO DE 3 COLUMNAS: `grid grid-cols-12 gap-4 h-full`)

#### Columna Izquierda (col-span-12 lg:col-span-3) - "Parámetros de Conjunto":
* Input: **Código de Ítem** (ej: en Madera `M1`, `COC-01`, `PLAC-02` | en Metalúrgica `P1`, `PORT-01`, `REJA-02`).
* Inputs numéricos: **Ancho Total (W)**, **Alto Total (H)**, **Profundidad Total (D)** en milímetros.
* Input: **Cantidad de Unidades**.
* Selector de **Tratamiento / Terminación / Color** (con vista previa circular en miniatura).
* **Estructura del Conjunto (Grilla Modular):**
  * Control de Columnas (`colSizes`): Permite sumar/quitar columnas contiguas a lo ancho, editando la cota milimétrica de cada columna individual.
  * Control de Filas (`rowSizes`): Permite sumar/quitar niveles o filas apiladas a lo alto.
  * Switch: **Modo Proporcional** vs. **Modo Manual** (en manual, la suma de las columnas/filas define el total; en proporcional, el total se distribuye automáticamente).

#### Columna Central (col-span-12 lg:col-span-6) - "Visor Técnico Interactivo":
* Pestaña superior flotante para alternar vistas: `[Plano 2D Técnico]` | `[Perspectiva 3D]`.
* **En Modo 2D:**
  * Canvas/SVG técnico sobre fondo cuadriculado milimétrico `bg-slate-50`.
  * Líneas de cota exteriores en los 4 bordes (arriba, abajo, izquierda, derecha) con flechas técnicas y números en `JetBrains Mono`.
  * Representación gráfica de cada nicho o celda de la grilla. Al hacer clic en un nicho, se abre un **Modal Flotante** para asignarle la tipología/receta correspondiente a esa celda.
* **En Modo 3D:**
  * Renderizado volumétrico paramétrico en tiempo real (WebGL / Canvas tridimensional).
  * Controles de órbita 360°, paneo y zoom con ratón o gestos táctiles.
  * Controles interactivos: **Slider de Apertura (0% a 100%)** (para abrir puertas/cajones o abatir portones) y **Slider de Vista Explosionada** (despiece flotante que separa las piezas en sus ejes).
  * Cotas 3D de cota milimétrica proyectadas en los bordes.

#### Columna Derecha (col-span-12 lg:col-span-3) - "Costos y Acciones":
* Resumen en vivo de consumo: Metros lineales de perfiles/caños o placas/chapas, cantidad de accesorios y herrajes.
* Tarjeta Financiera: Desglose claro de **Costo Materiales + Mano de Obra + Tratamiento + Margen Comercial = TOTAL**.
* Botón de Acción Principal (con color de acento del rubro): **"Despiece y Materiales"** (Abre modal exhaustivo con la tabla de corte pieza por pieza, medidas exactas, ángulos/tapacantos y consumo).
* Botón Secundario: **"Cargar a Obra Activa"** (Asigna el ítem a un proyecto existente o crea uno nuevo).
* Botón de Exportación: **"Descargar Presupuesto en PDF"**.

---

### 4. ADAPTACIÓN ESPECÍFICA SEGÚN EL RUBRO SELECCIONADO

#### Si se seleccionó [CARPINTERÍA DE MADERA]:
* **Base de Datos (Subpestañas):**
  1. *Placas:* Melaminas (18mm, 15mm, 25mm), MDF crudo, enchapados ($1.83 \times 2.60\text{ m}$) con sentido de veta.
  2. *Tapacantos:* Canto PVC delgado (0.45mm) y grueso (2mm) por metro lineal.
  3. *Fondos:* Fibroplus / MDF 3mm y 5.5mm.
  4. *Herrajes:* Correderas telescópicas (300 a 550mm), bisagras cazoleta (recta, codo, interior), minifix, tarugos.
  5. *Tiradores:* Manijas perfil J, tiradores barral, tiradores embutidos.
  6. *Terminaciones:* Laqueado poliuretánico, hidrolacas, barnices por $m^2$.
* **Recetas Pre-cargadas:**
  * Bajo Mesada 2 Puertas con estante regulable.
  * Bajo Mesada Cajonero (4 cajones con laterales y fondo ranurado).
  * Alacena Superior 2 Puertas.
  * Columna de Placard con barral y estantes.
  * Módulo Rinconero en L.

#### Si se seleccionó [METALÚRGICA / HERRERÍA]:
* **Base de Datos (Subpestañas):**
  1. *Caños Estructurales:* Tubos cuadrados y rectangulares ($40\times40$, $60\times40$, $80\times40$, $100\times100$, etc., barras de 6.00m).
  2. *Perfiles Laminados:* Ángulos de alas iguales, planchuelas macizas, perfiles UPN y C conformada.
  3. *Chapas y Mallas:* Chapa negra/pulida calibres 14, 16, 18, chapa antideslizante (semilla de melón) y metal desplegado.
  4. *Herrajes de Herrería:* Pomelas/bisagras munición reforzadas, ruedas con rulemán en V o U para portón, cerraduras de seguridad, pasadores y cremalleras.
  5. *Consumibles de Taller:* Kilos de electrodos / alambre MIG, discos de corte/desbaste de amoladora, gas de protección.
  6. *Pinturas:* Antióxido al cromato, convertidor de óxido, galvanizado y pintura epoxi por kg o $m^2$.
* **Recetas Pre-cargadas:**
  * Portón Corredizo sobre guía con bastidor y barrotes verticales.
  * Portón Levadizo con vainas contrapeso y chapa plegada.
  * Paño de Reja de Seguridad con distribución automática de barrotes (máximo 120 mm de luz libre).
  * Puerta de Acceso Peatonal con cerradura y pomo.
  * Baranda de Balcón con pasamanos en tubo y varillas de protección.

---

### 5. PERSISTENCIA, EXCEL Y REPORTES PDF
* **Gestor Excel (.xlsx):** En la Base de Datos, incluye botones operativos para exportar el inventario completo a Excel y subir archivos Excel para actualizar precios de forma masiva por código de producto.
* **Motor PDF (`jspdf` + `jspdf-autotable`):**
  * *Presupuesto Comercial:* Membrete del taller, datos del cliente, render técnico con cotas, especificación de materiales y precio total.
  * *Planilla de Taller / Hoja de Corte:* Lista minuciosa de cada pieza numerada, largo milimétrico, ancho, cantidad, ángulo de corte o tapacanto y peso/veta.
  * *Lista de Acopio:* Cantidad consolidada de barras comerciales de 6m o placas comerciales necesarias para comprar.

Genera la aplicación completa con todos sus componentes modularizados, tipos TypeScript rigurosos, estado en React interactivo y datos iniciales de muestra para que funcione al 100% de inmediato.
```
