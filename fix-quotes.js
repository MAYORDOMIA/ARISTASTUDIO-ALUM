const fs = require('fs');
let c = fs.readFileSync('components/QuotingModule.tsx', 'utf8');

const replacements = [
  '// CONSTANTES TÉCNICAS PARA RENDERIZADO ALTA FIDELIDAD',
  '// NUEVAS TIPOLOGÍAS INDUSTRIALES CON EFECTOS',
  '// NUEVAS TIPOLOGÍAS DE BARANDAS',
  '// Efecto de reflejo en el vidrio',
  '// 2. Dibujar Pasamano (si aplica)',
  '// Oscilobatiente: Abre al costado Y de arriba',
  '// 1. Apertura lateral (Swing) - SOLIDA',
  '// Bisagra al costado -> Vértice al lado opuesto',
  '// Bisagra derecha -> Vértice derecha (>)',
  '// Bisagra izquierda (default) -> Vértice izquierda (<)',
  '// 2. Apertura superior (Banderola/Tilt) - RAYAS',
  '// Línea punteada',
  '// For double doors, leaf 0 opens left (to the right vertex) and leaf 1 opens right (to the left vertex)',
  '// Hoja izquierda -> Vértice derecha (>)',
  '// Hoja derecha -> Vértice izquierda (<)',
  '// Hoja derecha (Bisagra derecha) -> Vértice derecha (>)',
  '// Hoja izquierda (Bisagra izquierda) -> Vértice izquierda (<)',
  '// Aumentamos la tolerancia para considerar la separación por acoples',
  '// Suficiente para cubrir gaps de acoples comunes',
  '// Ensure there is always a product selected',
  '// Redistribute total width equally among all columns',
  '// Redistribute total height equally among all rows',
  '// Autoincremento inteligente de código (V1 -> V2)',
  '// Solo incrementar automáticamente si es un código base autogenerado (V1, V2, etc.)',
  '// Preservar ceros a la izquierda si existen (ej: V01 -> V02)',
  '// Limpiar formulario si finalizó la edición',
  '// 1. Recolección de segmentos de contorno (exteriores)',
  '// Calculamos los límites absolutos del contorno',
  '// Lógica de sustracción de intervalos para encontrar Huecos (Tramos huecos en Y)',
  '// Solo aplicamos el toggle si el segmento clickeado es un TRAVESAÑO y está dentro de los límites de la hoja',
];

replacements.forEach(r => {
  const escaped = r.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
  c = c.replace(new RegExp(escaped, 'g'), '/* ' + r + ' */');
});

c = c.replace(/\/\/ Efecto de reflejo en el vidrio ctx\.beginPath/g, '/* Efecto de reflejo en el vidrio */ ctx.beginPath');
c = c.replace(/\/\/ Línea punteada ctx\.moveTo/g, '/* Línea punteada */ ctx.moveTo');
c = c.replace(/\/\/ Redistribute total width equally among setComposition/g, '/* Redistribute total width equally among */ setComposition');
c = c.replace(/\/\/ Redistribute total width equally among all columns setComposition/g, '/* Redistribute total width equally among all columns */ setComposition');
c = c.replace(/\/\/ Redistribute total height equally among setComposition/g, '/* Redistribute total height equally among */ setComposition');
c = c.replace(/\/\/ Redistribute total height equally among all rows setComposition/g, '/* Redistribute total height equally among all rows */ setComposition');
c = c.replace(/\/\/ Hoja derecha -> Vértice izquierda \(<\) ctx\.moveTo/g, '/* Hoja derecha -> Vértice izquierda */ ctx.moveTo');
c = c.replace(/\/\/ Hoja izquierda -> Vértice derecha \(>\) ctx\.moveTo/g, '/* Hoja izquierda -> Vértice derecha */ ctx.moveTo');

fs.writeFileSync('components/QuotingModule.tsx', c);
