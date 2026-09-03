const fs = require('fs');

let file;
// The issue is that the App component uses standard React effects but the initial load returns immediately due to the fake true check

file = fs.readFileSync('components/AttendanceTaker.tsx', 'utf8');
file = file.replace(/const dbData = data;/g, 'const dbData = await loadData();');
fs.writeFileSync('components/AttendanceTaker.tsx', file);
