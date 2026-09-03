const fs = require('fs');
const file = 'components/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('Object.values(data.settings.features || {}).some(f => f.outreach)', 'Object.values(data.settings.features || {}).some((f: any) => f.outreach)');
fs.writeFileSync(file, content);
