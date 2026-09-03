const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc } = require("firebase/firestore");
const firebaseConfig = {
  "projectId": "gen-lang-client-0412977179",
  "appId": "1:850863345734:web:7809052c9ce24737297a47",
  "apiKey": "AIzaSyBtOqvgCdCSKP9_D-PeqKmqkIpSP0exfG0",
  "authDomain": "gen-lang-client-0412977179.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-20d429e0-694a-44f5-a4d2-6e008c0ff637"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function fix() {
  const docRef = doc(db, "appData", "main");
  const snap = await getDoc(docRef);
  const data = snap.data();
  const att = data.attendance || [];
  
  const uniqueAtt = [];
  const seen = new Set();
  
  // Sort by lastUpdated or assume later in array is newer/older, let's keep the one with most present members if duplicate
  const attMap = {};
  att.forEach(a => {
    const key = a.date + "_" + a.churchId;
    if (!attMap[key]) {
      attMap[key] = a;
    } else {
      // Merge presentMemberIds or keep the largest one
      const existingLen = attMap[key].presentMemberIds ? attMap[key].presentMemberIds.length : 0;
      const newLen = a.presentMemberIds ? a.presentMemberIds.length : 0;
      if (newLen > existingLen) {
        attMap[key] = a;
      } else if (newLen === existingLen) {
        // Merge to be safe
        attMap[key].presentMemberIds = [...new Set([...(attMap[key].presentMemberIds || []), ...(a.presentMemberIds || [])])];
      }
    }
  });
  
  const cleanAtt = Object.values(attMap);
  console.log("Original:", att.length, "Cleaned:", cleanAtt.length);
  
  await setDoc(docRef, { attendance: cleanAtt }, { merge: true });
  console.log("Fixed duplicates in Firestore.");
  process.exit(0);
}
fix();
