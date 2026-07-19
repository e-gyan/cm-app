const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'appData', 'main');
  const snap = await getDoc(docRef);
  const data = snap.data();
  const grace = data.members.find(m => m.name.toLowerCase().includes('grace anobea'));
  
  let modified = false;
  for (const record of data.attendance) {
    if (record.presentMemberIds.includes(grace.id)) {
       console.log("Grace is in attendance on", record.date);
       record.presentMemberIds = record.presentMemberIds.filter(id => id !== grace.id);
       modified = true;
    }
  }
  
  if (modified) {
    await updateDoc(docRef, { attendance: data.attendance });
    console.log("Successfully updated attendance.");
  }
  process.exit(0);
}
run();
