const fs = require('fs');
const content = fs.readFileSync('components/Settings.tsx', 'utf-8');

let newContent = content.replace(
  'import { updateSettings, syncFromCloud } from "../services/storageService";',
  'import { updateSettings, syncFromCloud, syncToCloud } from "../services/storageService";\nimport { doc, getDoc } from "firebase/firestore";\nimport { db, loginWithGoogle } from "../services/firebase";'
);

newContent = newContent.replace('const { doc, getDoc } = await import("firebase/firestore");\n', '');
newContent = newContent.replace('const { db } = await import("../services/firebase");\n', '');
newContent = newContent.replace('const { syncToCloud } = await import("../services/storageService");\n', '');
newContent = newContent.replace('const { loginWithGoogle } =\n                          await import("../services/firebase");', '/* loginWithGoogle statically imported */');

fs.writeFileSync('components/Settings.tsx', newContent);
