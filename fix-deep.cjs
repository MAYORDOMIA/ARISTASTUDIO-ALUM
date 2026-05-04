const fs = require("fs");

function cleanFile(f) {
  let c = fs.readFileSync(f, "utf8");

  // Find all remaining // comments and just wipe them using a regex that replaces // up until a valid keyword
  const removals = [
    "// Redistribute total width equally among all columns ",
    "// Redistribute total width equally among ",
    "// Redistribute total height equally among all rows ",
    "// Redistribute total height equally among ",
    "// Autoincremento inteligente de código (V1 -> V2) ",
    "// Solo incrementar automáticamente si es un código base autogenerado (V1, V2, etc.) ",
    "// Preservar ceros a la izquierda si existen (ej: V01 -> V02) ",
    "// Limpiar formulario si finalizó la edición ",
    "// 1. Recolección de segmentos de contorno (exteriores) ",
    "// Calculamos los límites absolutos del contorno ",
    "// Lógica de sustracción de intervalos para encontrar Huecos (Tramos huecos en Y) ",
    "// Solo aplicamos el toggle si el segmento clickeado es un TRAVESAÑO y está dentro de los límites de la hoja ",
    "// Si están en la misma línea Y y están cerca en X",
    "// Si están en la misma línea X y están cerca en Y",
    "// right ",
  ];

  removals.forEach((r) => {
    let split = c.split(r);
    c = split.join("");
  });

  c = c.replace(
    /\/\/ Redistribute total width equally among all columns[^]*(?=setComposition)/g,
    "/* width all */",
  );
  c = c.replace(
    /\/\/ Redistribute total width equally among[^]*(?=setComposition)/g,
    "/* width */",
  );
  c = c.replace(
    /\/\/ Redistribute total height equally among all rows[^]*(?=setComposition)/g,
    "/* height all */",
  );
  c = c.replace(
    /\/\/ Redistribute total height equally among[^]*(?=setComposition)/g,
    "/* height */",
  );

  fs.writeFileSync(f, c);
}

cleanFile("components/QuotingModule.tsx");

let app = fs.readFileSync("App.tsx", "utf8");
// Fix App.tsx missing brace or bracket near `/* Verificar`
app = app.replace(
  /\]\);\s*\/\* Verificar si hay errores críticos.*?\*\/\s*const criticalError/g,
  "]); const criticalError",
);
app = app.replace(
  /const \[ aluRes.*?confRes \]\s*=\s*await Promise\.all\(\[\s*supabase.*?single\(\)\s*\]\);\s*const criticalError/g,
  'const [ aluRes, glsRes, accRes, trtRes, pnlRes, dvhRes, recRes, quoRes, confRes ] = await Promise.all([ supabase.from("materiales_perfiles_usuario").select("*").eq("user_id", userId), supabase.from("materiales_vidrios_usuario").select("*").eq("user_id", userId), supabase.from("materiales_accesorios_usuario").select("*").eq("user_id", userId), supabase.from("tratamientos_usuario").select("*").eq("user_id", userId), supabase.from("paneles_usuario").select("*").eq("user_id", userId), supabase.from("dvh_usuario").select("*").eq("user_id", userId), supabase.from("recetas_usuario").select("*").eq("user_id", userId), supabase.from("presupuestos").select("*").eq("user_id", userId), supabase.from("configuracion_usuario").select("config_data").eq("user_id", userId).single() ]); const criticalError',
);
fs.writeFileSync("App.tsx", app);
