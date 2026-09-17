import fs from 'fs';
let content = fs.readFileSync('components/QuotingModule.tsx', 'utf8');

const target = `    /* height eq */ const newCount = rowSizes.length + 1;
    const newSize = Math.floor(totalHeight / newCount);
    const remainder = totalHeight % newCount;
    const newRowSizes = Array(newCount).fill(newSize);
    for (let i = 0; i < remainder; i++) newRowSizes[i]++;
    setModules([...(modules || []), ...newModules]);
    setRowSizes(newRowSizes);
    /* setTotalHeight is NOT called */ setShowCouplingModal(true);
      };
  const removeRow = () => {
    if (rowSizes.length <= 1) return;
    const lastY = bounds.maxY; /* remaining rows */
    const newCount = rowSizes.length - 1;
    const newSize = Math.floor(totalHeight / newCount);
    const remainder = totalHeight % newCount;
    const newRowSizes = Array(newCount).fill(newSize);
    for (let i = 0; i < remainder; i++) newRowSizes[i]++;
    setModules((modules || []).filter((m) => m && m.y !== lastY));
    setRowSizes(newRowSizes);
    /* setTotalHeight is NOT called */`;

const replacement = `    /* height eq */ const newCount = rowSizes.length + 1;
    if (isManualDim) {
      const lastSize = rowSizes.length > 0 ? rowSizes[rowSizes.length - 1] : 1000;
      const newRowSizes = [...rowSizes, lastSize];
      const currentDeduction = Number(aluminum.find((p) => p.id === couplingProfileId)?.thickness ?? couplingDeduction ?? 0);
      setModules([...(modules || []), ...newModules]);
      setRowSizes(newRowSizes);
      setTotalHeight(newRowSizes.reduce((a, b) => a + b, 0) + (newRowSizes.length > 1 ? (newRowSizes.length - 1) * currentDeduction : 0));
    } else {
      const newSize = Math.floor(totalHeight / newCount);
      const remainder = totalHeight % newCount;
      const newRowSizes = Array(newCount).fill(newSize);
      for (let i = 0; i < remainder; i++) newRowSizes[i]++;
      setModules([...(modules || []), ...newModules]);
      setRowSizes(newRowSizes);
    }
    /* setTotalHeight is NOT called */ setShowCouplingModal(true);
      };
  const removeRow = () => {
    if (rowSizes.length <= 1) return;
    const lastY = bounds.maxY; /* remaining rows */
    const newCount = rowSizes.length - 1;
    if (isManualDim) {
      const newRowSizes = rowSizes.slice(0, -1);
      const currentDeduction = Number(aluminum.find((p) => p.id === couplingProfileId)?.thickness ?? couplingDeduction ?? 0);
      setModules((modules || []).filter((m) => m && m.y !== lastY));
      setRowSizes(newRowSizes);
      setTotalHeight(newRowSizes.reduce((a, b) => a + b, 0) + (newRowSizes.length > 1 ? (newRowSizes.length - 1) * currentDeduction : 0));
    } else {
      const newSize = Math.floor(totalHeight / newCount);
      const remainder = totalHeight % newCount;
      const newRowSizes = Array(newCount).fill(newSize);
      for (let i = 0; i < remainder; i++) newRowSizes[i]++;
      setModules((modules || []).filter((m) => m && m.y !== lastY));
      setRowSizes(newRowSizes);
    }
    /* setTotalHeight is NOT called */`;

content = content.replace(target, replacement);
fs.writeFileSync('components/QuotingModule.tsx', content);
