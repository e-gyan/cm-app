const fs = require('fs');
let content = fs.readFileSync('components/AttendanceTaker.tsx', 'utf-8');
content = content.replace(
  'const targetChurch = currentUser?.assignedChurch || (isCombinedView ? "UJ" : (effectiveChurch as Church));',
  'const targetChurch = (currentUser?.assignedChurch && currentUser?.assignedChurch !== "All" && currentUser?.assignedChurch !== "CM") ? currentUser.assignedChurch : (effectiveChurch as Church || "UJ");'
);
fs.writeFileSync('components/AttendanceTaker.tsx', content);
