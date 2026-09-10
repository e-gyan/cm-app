const fs = require('fs');

let outreachPath = 'components/OutreachHub.tsx';
let outreachContent = fs.readFileSync(outreachPath, 'utf8');

outreachContent = outreachContent.replace(
  /    if \(res\.success\) \{\n      if \(res\.data\) \{\n        setLocalPrayerSlots\(JSON\.parse\(JSON\.stringify\(res\.data\)\)\);\n      \}\n      setGenMsg\(\{ type: "success", text: res\.message \}\);\n      onUpdate\(\);\n    \}/g,
  `    if (res.success) {\n      setGenMsg({ type: "success", text: res.message });\n      onUpdate();\n    }`
);

fs.writeFileSync(outreachPath, outreachContent);
