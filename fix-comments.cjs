const fs = require("fs");

const filesToFix = [
  "App.tsx",
  "components/DatabaseCRUD.tsx",
  "components/ObrasModule.tsx",
  "components/ProductRecipeEditor.tsx",
  "components/QuotingModule.tsx",
  "components/Auth.tsx",
  "components/SuperAdminDashboard.tsx",
  "components/QuotesHistory.tsx",
];

// Helper to fix specific known comment issues by inserting a newline
function fixFile(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, "utf8");

  // Replace // (some text) (keyword) with // (some text)\n(keyword)
  // We use a regex that matches common code keywords that got appended.
  content = content.replace(
    /(\/\/[^\n]*?)\s+(return |const |let |if |try |await |document\.|set|setActive|window\.|console\.|_set|update|this\.|for |while |export )/g,
    "$1\n$2",
  );

  // Specific fixes if the generic one misses
  content = content.replace(
    /\/\/ Opción de Super Admin oculta para todos excepto para ti if/g,
    "// Opción de Super Admin oculta para todos excepto para ti\n if",
  );
  // Enforce uniqueness return
  content = content.replace(
    /\/\/ Enforce uniqueness return/g,
    "// Enforce uniqueness\n return",
  );
  // Suscripción en tiempo real para sincronización de activación useEffect
  content = content.replace(
    /\/\/ Suscripción en tiempo real para sincronización de activación useEffect/g,
    "// Suscripción en tiempo real para sincronización de activación\n useEffect",
  );

  fs.writeFileSync(file, content, "utf8");
}

filesToFix.forEach(fixFile);
console.log("Fixed comments");
