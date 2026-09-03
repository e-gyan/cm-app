const fs = require('fs');
let file = fs.readFileSync('services/firebase.ts', 'utf8');

file = file.replace(/export const app = initializeApp\(firebaseConfig\);/, 
  'export const app = (getApps && getApps().length > 0) ? getApp() : initializeApp(firebaseConfig);');

file = file.replace(/export const db = initializeFirestore\([^;]+;/, `
let dbInstance;
try {
  dbInstance = initializeFirestore(
    app,
    { experimentalForceLongPolling: true },
    firebaseConfig.firestoreDatabaseId
  );
} catch (e) {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = dbInstance;
`);

file = `import { getApps, getApp } from "firebase/app";\n` + file;

fs.writeFileSync('services/firebase.ts', file);
