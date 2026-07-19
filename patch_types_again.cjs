const fs = require('fs');
let content = fs.readFileSync('components/ReportExport.tsx', 'utf-8');
content = content.replace(/m\.type !== "TEACHER"/g, 'm.type !== MemberType.TEACHER');
fs.writeFileSync('components/ReportExport.tsx', content);
