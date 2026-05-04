const fs = require('fs');
let code = fs.readFileSync('components/DatabaseCRUD.tsx', 'utf8');

code = code.replace(/\/\/ Reset input so it can be selected again \};\s*/g, '/* Reset input */ };\n');
code = code.replace(/\/\/docs\.google\.com\/spreadsheets\/d\/\$\{sheetId\}\/export\?format=xlsx\`;/g, '/* docs */ export?format=xlsx`;');
code = code.replace(/\/\/docs\.google\.com\/spreadsheets\/d\/\.\.\.\"\s*className=/g, '/docs... " className=');

fs.writeFileSync('components/DatabaseCRUD.tsx', code);
