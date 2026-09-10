const fs = require('fs');
let content = fs.readFileSync('components/OutreachHub.tsx', 'utf8');

content = content.replace(
  /          if \(res\.success\) \{\n            if \(res\.data\) \{\n              setLocalPrayerSlots\(JSON\.parse\(JSON\.stringify\(res\.data\)\)\);\n            \}\n            onUpdate\(\);/g,
  `          if (res.success) {\n            onUpdate();`
);

fs.writeFileSync('components/OutreachHub.tsx', content);
