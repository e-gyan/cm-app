const fs = require('fs');
const file = './components/AnalyticsHub.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /if \(m\.status === MemberStatus\.ACTIVE\) \{/g,
  `if ([MemberStatus.ACTIVE, MemberStatus.INCONSISTENT, MemberStatus.NOT_ACTIVE].includes(m.status)) {`
);
fs.writeFileSync(file, content);
