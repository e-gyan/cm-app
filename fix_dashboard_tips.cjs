const fs = require('fs');
const file = './components/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /const inconsistentCount = data\.members\.filter\(m => m\.assignedChurch === activeChurch && m\.status === MemberStatus\.INCONSISTENT\)\.length;/,
  `const inconsistentCount = data.members.filter(m => m.assignedChurch === activeChurch && (m.status === MemberStatus.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE)).length;`
);
content = content.replace(
  /text: \`You have \$\{inconsistentCount\} active member\$\{inconsistentCount > 1 \? 's' : ''\} marked as Inconsistent\.\`,/,
  `text: \`You have \$\{inconsistentCount\} member\$\{inconsistentCount > 1 ? 's' : ''\} marked as Inconsistent or Not Active.\`,`
);
fs.writeFileSync(file, content);
