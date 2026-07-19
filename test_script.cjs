const fs = require('fs');
console.log(fs.readFileSync('components/ReportExport.tsx', 'utf-8').split('\n').slice(466, 620).join('\n'));
