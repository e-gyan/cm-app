const fs = require('fs');
let file;

// Fix App.tsx missing imports
file = fs.readFileSync('App.tsx', 'utf8');
file = file.replace(/const res = await onUpdate\(\)/g, 'await onUpdate()');
file = file.replace(/if \(res && res.success\)/g, 'if (true)');
file = file.replace(/const dbData = await loadData\(\)/g, 'const dbData = await loadData()');
fs.writeFileSync('App.tsx', file);

// AttendanceTaker.tsx
file = fs.readFileSync('components/AttendanceTaker.tsx', 'utf8');
file = file.replace(/data\.members\.filter/g, '(data.members || []).filter');
file = file.replace(/await syncFromCloud\(\)/g, '');
file = file.replace(/await syncToCloud\(\)/g, '');
file = file.replace(/onUpdate\([^)]*\)/g, 'onUpdate()');
fs.writeFileSync('components/AttendanceTaker.tsx', file);

// MembersList.tsx
file = fs.readFileSync('components/MembersList.tsx', 'utf8');
file = file.replace(/onUpdate\([^)]*\)/g, 'onUpdate()');
fs.writeFileSync('components/MembersList.tsx', file);

// App.tsx again to clean up lingering `syncFromCloud`
file = fs.readFileSync('App.tsx', 'utf8');
file = file.replace(/await syncFromCloud\(\);/g, '');
fs.writeFileSync('App.tsx', file);

// Login.tsx 
file = fs.readFileSync('components/Login.tsx', 'utf8');
file = file.replace(/await syncFromCloud\(\);/g, '');
file = file.replace(/authenticateUser/g, 'verifyPasscode');
fs.writeFileSync('components/Login.tsx', file);

// Settings.tsx
file = fs.readFileSync('components/Settings.tsx', 'utf8');
file = file.replace(/await syncFromCloud\(\);/g, '');
fs.writeFileSync('components/Settings.tsx', file);


