const fs = require('fs');
let code = fs.readFileSync('components/Login.tsx', 'utf8');
code = code.replace(
  /const \{ generateDemoData \} = await import\("\.\.\/services\/seedService"\);\s*await generateDemoData\(\);/g,
  ''
);
code = code.replace(
  /Database initialized! You can now log in as 'Demo Admin' with passcode '0000'\./g,
  'Database synced!'
);
fs.writeFileSync('components/Login.tsx', code);

let seedCode = fs.readFileSync('services/seedService.ts', 'utf8');
seedCode = seedCode.replace(/export const generateDemoData = async \(\) => \{[\s\S]*?\};/g, 'export const generateDemoData = async () => {};');
fs.writeFileSync('services/seedService.ts', seedCode);
