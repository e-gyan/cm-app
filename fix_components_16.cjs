const fs = require('fs');
let file;
file = fs.readFileSync('components/AttendanceTaker.tsx', 'utf8');
file = file.replace(/const dbData = loadData\(\)/g, 'const dbData = await loadData()');
// Fix the spread types created from object types error
file = file.replace(/...prev,/g, '...prev as any,');
fs.writeFileSync('components/AttendanceTaker.tsx', file);
