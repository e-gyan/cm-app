const fs = require('fs');
const file = 'App.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('setActiveChurch(savedUser.assignedChurch);', 'setActiveChurch(savedUser.assignedChurch as Church);');
content = content.replace('setActiveChurch(branch.churches[0]);', 'setActiveChurch(branch.churches[0] as Church);');
fs.writeFileSync(file, content);
