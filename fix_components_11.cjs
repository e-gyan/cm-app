const fs = require('fs');

let file;
// Login.tsx 
file = fs.readFileSync('components/Login.tsx', 'utf8');
file = file.replace(/await \(\) => true\(/g, 'await (async () => true)(');
fs.writeFileSync('components/Login.tsx', file);
