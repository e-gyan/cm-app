const fs = require('fs');
let file = fs.readFileSync('components/Settings.tsx', 'utf8');

file = file.replace(/import \{ Activity, /g, 'import { ');
if (!file.includes('Activity,')) {
    file = file.replace(/import \{([^}]*?)(Database)([^}]*?)\} from "lucide-react";/, 'import {$1Database, Activity$3} from "lucide-react";');
}
fs.writeFileSync('components/Settings.tsx', file);
