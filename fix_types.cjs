const fs = require('fs');
let file = fs.readFileSync('types.ts', 'utf8');

file = file.replace(/lastActivationDate\?: string;/g, 'lastActivationDate?: string;\n  vacationStartDate?: string;\n  vacationEndDate?: string;');
file = file.replace(/NOT_ACTIVE = "Not Active"/g, 'NOT_ACTIVE = "Not Active",\n  VACATION = "Vacation"');

fs.writeFileSync('types.ts', file);
