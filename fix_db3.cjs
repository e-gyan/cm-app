const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'appData', 'main');
  const snap = await getDoc(docRef);
  const data = snap.data();
  const grace = data.members.filter(m => m.name.toLowerCase().includes('grace'));
  console.log("Graces:", grace.map(g => g.name));
  process.exit(0);
}
run();
