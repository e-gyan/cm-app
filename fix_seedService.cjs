const fs = require('fs');
let file = fs.readFileSync('services/seedService.ts', 'utf8');

file = file.replace(/const branches = \["UJ", "LJ", "K", "I", "N"\];/, 'const branches = ["UJ", "LJ", "K", "I", "N", "CM"];');

fs.writeFileSync('services/seedService.ts', file);
