const fs = require('fs');
let file;
file = fs.readFileSync('components/AttendanceTaker.tsx', 'utf8');
file = file.replace(/const allMembers = loadData\(\)\.members;/g, 'const allMembers = data.members;');
fs.writeFileSync('components/AttendanceTaker.tsx', file);
