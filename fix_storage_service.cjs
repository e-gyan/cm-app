const fs = require('fs');

let file = fs.readFileSync('services/storageService.ts', 'utf8');
file = file.replace(/from "\.\/firebaseService";/g, 'from "./firebase";');
fs.writeFileSync('services/storageService.ts', file);
