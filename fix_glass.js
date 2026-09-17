const fs = require('fs');
let content = fs.readFileSync('services/calculator.ts', 'utf8');

content = content.replace(
  "const billingAreaPerPiece = Math.max(areaM2, 0.5);",
  "// Se eliminó el mínimo de 0.5m2 por paño ya que elevaba excesivamente el costo en divisiones pequeñas (ej. Piel de Vidrio)\n      const billingAreaPerPiece = areaM2;"
);

fs.writeFileSync('services/calculator.ts', content);
