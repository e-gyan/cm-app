const fs = require('fs');
let types = fs.readFileSync('types.ts', 'utf8');
types = types.replace('endTime?: string;\n}', 'endTime?: string;\n  notes?: string;\n  branchId?: string;\n}');
fs.writeFileSync('types.ts', types);
