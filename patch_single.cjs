const fs = require('fs');

let content = fs.readFileSync('components/ReportExport.tsx', 'utf-8');

const targetStr = `    if (activeChurch !== "CM") {
      const churchReport = renderSingleChurch(activeChurch);`;

const newStr = `    if (activeChurch !== "CM") {
      let currentBranchObj = undefined;
      if (currentUser.branchId) {
         currentBranchObj = { id: currentUser.branchId, name: currentUser.branchId };
      }
      const churchReport = renderSingleChurch(activeChurch, currentBranchObj);`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('components/ReportExport.tsx', content);
