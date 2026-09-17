const fs = require('fs');
let content = fs.readFileSync('services/calculator.ts', 'utf8');

const targetStr = `  if (recipe.type === "Piel de Vidrio") {
    const paneW = evaluateFormula(getFormulaW(), width, height, cols, rows);
    if (!transoms || transoms.length === 0) {
      const paneH = evaluateFormula(getFormulaH(), width, height, cols, rows);
      for (let i = 0; i < cols * rows; i++) {
        glassPanes.push({ w: paneW, h: paneH });
      }
    } else {
      // Usar las alturas de paños calculadas desde los travesaños manuales
      for (let c = 0; c < cols; c++) {
        panesHeights.forEach((ph) => {
          glassPanes.push({ w: paneW, h: ph });
        });
      }
    }
  }`;

const replacementStr = `  if (recipe.type === "Piel de Vidrio") {
    let paneW = evaluateFormula(getFormulaW(), width, height, cols, rows);
    if (!getFormulaW().toUpperCase().includes("NX") && !getFormulaW().toUpperCase().includes("COLS")) {
       paneW = paneW / (cols || 1);
    }
    
    if (!transoms || transoms.length === 0) {
      let paneH = evaluateFormula(getFormulaH(), width, height, cols, rows);
      if (!getFormulaH().toUpperCase().includes("NY") && !getFormulaH().toUpperCase().includes("ROWS")) {
         paneH = paneH / (rows || 1);
      }
      for (let i = 0; i < cols * rows; i++) {
        glassPanes.push({ w: paneW, h: paneH });
      }
    } else {
      // Usar las alturas de paños calculadas desde los travesaños manuales
      for (let c = 0; c < cols; c++) {
        panesHeights.forEach((ph) => {
          glassPanes.push({ w: paneW, h: ph });
        });
      }
    }
  }`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('services/calculator.ts', content);
