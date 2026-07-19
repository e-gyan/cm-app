const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'appData', 'main');
  const snap = await getDoc(docRef);
  console.log(JSON.stringify(snap.data().settings.organization, null, 2));
  process.exit(0);
}
run();
