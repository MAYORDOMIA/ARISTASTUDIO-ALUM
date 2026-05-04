const fs = require("fs");
let c = fs.readFileSync("components/QuotingModule.tsx", "utf8");

c = c.replace(
  /\/\/ Redistribute total width equally among all columns setComposition/g,
  "/* Redistribute total width equally among all columns */ setComposition",
);
c = c.replace(
  /\/\/ Redistribute total width equally among setComposition/g,
  "/* Redistribute total width equally among */ setComposition",
);
c = c.replace(
  /\/\/ Redistribute total height equally among all rows setComposition/g,
  "/* Redistribute total height equally among all rows */ setComposition",
);
c = c.replace(
  /\/\/ Redistribute total height equally among setComposition/g,
  "/* Redistribute total height equally among */ setComposition",
);
c = c.replace(
  /\/\/ Hoja derecha -> Vértice izquierda \(<\) ctx\.moveTo/g,
  "/* Hoja derecha -> Vértice izquierda (<) */ ctx.moveTo",
);
c = c.replace(
  /\/\/ Hoja izquierda -> Vértice derecha \(>\) ctx\.moveTo/g,
  "/* Hoja izquierda -> Vértice derecha (>) */ ctx.moveTo",
);
c = c.replace(
  /\/\/ For double doors, leaf 0 opens left \(to the right vertex\) and leaf 1 opens right \(to the left vertex\) if/g,
  "/* doors */ if",
);
c = c.replace(
  /\/\/ Efecto de reflejo en el vidrio ctx\.beginPath/g,
  "/* Efecto de reflejo en el vidrio */ ctx.beginPath",
);
c = c.replace(
  /\/\/ Línea punteada ctx\.moveTo/g,
  "/* Línea punteada */ ctx.moveTo",
);
c = c.replace(
  /\/\/ Si están en la misma línea Y y están ce if/g,
  "/* Si estan en Y */ if",
);

fs.writeFileSync("components/QuotingModule.tsx", c);
