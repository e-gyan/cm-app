const fs = require('fs');

let content = fs.readFileSync('components/ReportExport.tsx', 'utf-8');

const targetStr = `    function renderSingleChurch(churchId: string, branchObj?: { id?: string, name: string }) {
      const record = data.attendance.find(
        (r) => r.date === selectedDate && r.churchId === churchId,
      );`;

const newStr = `    function renderSingleChurch(churchId: string, branchObj?: { id?: string, name: string }) {
      const record = data.attendance.find(
        (r) => r.date === selectedDate && r.churchId === churchId && (!branchObj || r.branchId === branchObj.id || r.branchId === branchObj.name || (!r.branchId))
      );`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('components/ReportExport.tsx', content);
