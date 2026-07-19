const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'appData', 'main');
  const snap = await getDoc(docRef);
  const data = snap.data();
  
  const originalLength = data.members.length;
  data.members = data.members.filter(m => !m.name.toLowerCase().includes('grace anobea'));
  
  if (data.members.length !== originalLength) {
    await updateDoc(docRef, { members: data.members });
    console.log(`Deleted ${originalLength - data.members.length} records.`);
  } else {
    console.log("No records found to delete.");
  }
  process.exit(0);
}
run();
