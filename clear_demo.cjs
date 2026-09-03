const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function clearCollections() {
  let deletedMembers = 0;
  let deletedOthers = 0;
  
  const collections = ["members", "attendance", "transactions", "outreach"];
  for (const c of collections) {
    const snap = await getDocs(collection(db, c));
    const deletePromises = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (c === "members" && data.passcode === "0000") {
        deletePromises.push(deleteDoc(d.ref));
        deletedMembers++;
      } else if (c !== "members") {
        // Clear all attendance, transactions, outreach for now
        deletePromises.push(deleteDoc(d.ref));
        deletedOthers++;
      }
    }
    await Promise.all(deletePromises);
  }
  console.log(`Deleted ${deletedMembers} demo members and ${deletedOthers} other records.`);
  process.exit(0);
}

clearCollections().catch(e => {
  console.error(e);
  process.exit(1);
});
