const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');
code = code.replace('data.attendance = data.attendance.filter(a => !a.isMock);', 'data.attendance = data.attendance.filter(a => !(a as any).isMock);');
fs.writeFileSync('services/storageService.ts', code);
