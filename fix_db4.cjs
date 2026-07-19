const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'appData', 'main');
  const snap = await getDoc(docRef);
  const data = snap.data();
  const grace = data.members.filter(m => m.name.toLowerCase().includes('grace anobea'));
  console.log("Graces:", JSON.stringify(grace, null, 2));
  
  // Find where they appear in attendance
  for (const g of grace) {
      for (const record of data.attendance) {
        if (record.presentMemberIds.includes(g.id)) {
           console.log(g.id, "is in attendance on", record.date);
        }
      }
  }
  process.exit(0);
}
run();
