const fs = require('fs');
let content = fs.readFileSync('components/QuotingModule.tsx', 'utf8');

const target = `    const newCount = colSizes.length + 1;
    const newSize = Math.floor(totalWidth / newCount);
    const remainder = totalWidth % newCount;
    const newColSizes = Array(newCount).fill(newSize);
    for (let i = 0; i < remainder; i++) newColSizes[i]++;

    setModules([...(modules || []), ...newModules]);
    setColSizes(newColSizes);
    /* setTotalWidth is NOT called to preserve user input */ setShowCouplingModal(
      true,
    );
      };`;

const replacement = `    const newCount = colSizes.length + 1;
    
    if (isManualDim) {
      const lastSize = colSizes.length > 0 ? colSizes[colSizes.length - 1] : 1000;
      const newColSizes = [...colSizes, lastSize];
      const currentDeduction = Number(aluminum.find((p) => p.id === couplingProfileId)?.thickness ?? couplingDeduction ?? 0);
      setModules([...(modules || []), ...newModules]);
      setColSizes(newColSizes);
      setTotalWidth(newColSizes.reduce((a, b) => a + b, 0) + (newColSizes.length > 1 ? (newColSizes.length - 1) * currentDeduction : 0));
    } else {
      const newSize = Math.floor(totalWidth / newCount);
      const remainder = totalWidth % newCount;
      const newColSizes = Array(newCount).fill(newSize);
      for (let i = 0; i < remainder; i++) newColSizes[i]++;
      setModules([...(modules || []), ...newModules]);
      setColSizes(newColSizes);
    }
    
    /* setTotalWidth is NOT called to preserve user input */ setShowCouplingModal(
      true,
    );
  };`;

content = content.replace(target, replacement);
fs.writeFileSync('components/QuotingModule.tsx', content);
