const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, collection, writeBatch, setDoc } = require("firebase/firestore");

const firebaseConfig = {
  "projectId": "gen-lang-client-0412977179",
  "appId": "1:850863345734:web:7809052c9ce24737297a47",
  "apiKey": "AIzaSyBtOqvgCdCSKP9_D-PeqKmqkIpSP0exfG0",
  "authDomain": "gen-lang-client-0412977179.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-20d429e0-694a-44f5-a4d2-6e008c0ff637",
  "storageBucket": "gen-lang-client-0412977179.firebasestorage.app",
  "messagingSenderId": "850863345734"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function migrateData() {
  try {
    const docRef = doc(db, "appData", "main");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("Found appData/main!");
      
      const members = data.members || [];
      const attendance = data.attendance || [];
      
      console.log(`Migrating ${members.length} members and ${attendance.length} attendance records...`);
      
      // Batch writes (max 500 operations per batch)
      let batch = writeBatch(db);
      let opCount = 0;
      let totalOps = 0;
      
      for (const m of members) {
        if (!m.id) {
           m.id = doc(collection(db, "members")).id;
        }
        batch.set(doc(db, "members", m.id), m);
        opCount++;
        totalOps++;
        if (opCount === 450) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
          console.log(`Committed ${totalOps} operations...`);
        }
      }
      
      for (const a of attendance) {
        if (!a.id) {
           a.id = doc(collection(db, "attendance")).id;
        }
        batch.set(doc(db, "attendance", a.id), a);
        opCount++;
        totalOps++;
        if (opCount === 450) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
          console.log(`Committed ${totalOps} operations...`);
        }
      }
      
      if (opCount > 0) {
        await batch.commit();
        console.log(`Committed final ${opCount} operations...`);
      }
      
      console.log("Migration successful!");
    } else {
      console.log("appData/main does not exist.");
    }
  } catch (error) {
    console.error("Error migrating data:", error);
  }
}
migrateData();
