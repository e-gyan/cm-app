const fs = require('fs');
let lines = fs.readFileSync('components/Settings.tsx', 'utf8').split('\n');

// Fix buttons
lines[240] = lines[240].replace('activeTab ==="GENERAL"', 'activeTab === "CHURCHES"');
lines[246] = lines[246].replace('activeTab ==="GENERAL"', 'activeTab === "ORGANIZATION"');
lines[252] = lines[252].replace('activeTab ==="GENERAL"', 'activeTab === "THEME"');
lines[264] = lines[264].replace('activeTab ==="GENERAL"', 'activeTab === "CLOUD"');

// Fix content areas
lines[360] = lines[360].replace('activeTab ==="GENERAL"', 'activeTab === "CHURCHES"');
lines[412] = lines[412].replace('activeTab ==="GENERAL"', 'activeTab === "ORGANIZATION"');
lines[631] = lines[631].replace('activeTab ==="GENERAL"', 'activeTab === "THEME"');
lines[755] = lines[755].replace('activeTab ==="GENERAL"', 'activeTab === "PERMISSIONS"');
lines[926] = lines[926].replace('activeTab ==="GENERAL"', 'activeTab === "CLOUD"');

fs.writeFileSync('components/Settings.tsx', lines.join('\n'));
