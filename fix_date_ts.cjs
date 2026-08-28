const fs = require('fs');
const file = './components/ReportExport.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('uniqueDates.forEach(dateStr => {', 'uniqueDates.forEach((dateStr: any) => {');
fs.writeFileSync(file, content);
