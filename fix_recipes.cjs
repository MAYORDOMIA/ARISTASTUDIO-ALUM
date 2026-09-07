const fs = require('fs');
let code = fs.readFileSync('src/components/SuperAdminDashboard.tsx', 'utf-8');

// 1. Add normalization for recipes
code = code.replace(
  'if (jsonData.dvh && !jsonData.dvhInputs) jsonData.dvhInputs = jsonData.dvh;',
  'if (jsonData.dvh && !jsonData.dvhInputs) jsonData.dvhInputs = jsonData.dvh;\n        if (jsonData.recetas && !jsonData.recipes) jsonData.recipes = jsonData.recetas;\n        if (jsonData.recipes && !jsonData.recetas) jsonData.recetas = jsonData.recipes;'
);

// 2. Change the available lines logic to check jsonData.recetas (since we populated it above)
// We'll leave it as jsonData.recetas because we normalized it to both.

// 3. Let's make sure handleBulkInjection uses recipes
code = code.replace(
  'if (selectedCategories.recetas) {\n        dataToInject.recetas = (bulkData.recetas || []).filter((r: any) => selectedLines.includes(r.line));\n    }',
  'if (selectedCategories.recetas) {\n        dataToInject.recipes = (bulkData.recetas || []).filter((r: any) => selectedLines.includes(r.line));\n    }'
);

fs.writeFileSync('src/components/SuperAdminDashboard.tsx', code);
console.log('Fixed recipes key');
