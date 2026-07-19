const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'appData', 'main');
  const snap = await getDoc(docRef);
  const data = snap.data();
  
  const originalLength = data.members.length;
  
  // Remove Grace Anobeas with type Visitor and assignedChurch All
  data.members = data.members.filter(m => !(m.name === 'Grace Anobea' && m.type === 'Visitor' && m.assignedChurch === 'All'));
  
  const newLength = data.members.length;
  
  await setDoc(docRef, data);
  console.log(`Removed ${originalLength - newLength} records`);
  process.exit(0);
}
run();
