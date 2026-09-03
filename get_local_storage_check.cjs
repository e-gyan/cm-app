const fs = require('fs');
console.log(fs.readFileSync('components/Login.tsx', 'utf8').includes('localStorage'));
