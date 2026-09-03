const fs = require('fs');
let settings = fs.readFileSync('components/Settings.tsx', 'utf8');

settings = settings.replace(/const handleSeedData = async \(\) => \{[\s\S]*?setIsSyncing\(false\);\s*\};/g, '');

settings = settings.replace(/<button\s*onClick=\{handleSeedData\}[\s\S]*?<\/button>/g, '');

fs.writeFileSync('components/Settings.tsx', settings);
