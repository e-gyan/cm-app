const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'appData', 'main');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    console.log("No data found");
    return;
  }
  
  const data = snap.data();
  console.log("Members count:", data.members.length);
  const grace = data.members.find(m => m.name.toLowerCase().includes('grace anobea'));
  
  if (grace) {
    console.log("Found Grace:", grace.id, grace.name);
    // Remove from attendance
    let modified = false;
    for (const record of data.attendance) {
      if (record.date === '2026-07-19') { // Or whatever today is
        if (record.presentMemberIds.includes(grace.id)) {
           record.presentMemberIds = record.presentMemberIds.filter(id => id !== grace.id);
           modified = true;
           console.log("Removed from attendance on", record.date);
        }
      }
    }
    
    if (modified) {
      await updateDoc(docRef, { attendance: data.attendance });
      console.log("Successfully updated attendance.");
    } else {
      console.log("Grace was not found in today's attendance.");
    }
  } else {
    console.log("Grace not found in members.");
  }
  process.exit(0);
}

run().catch(console.error);
