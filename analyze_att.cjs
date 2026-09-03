const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
const firebaseConfig = {
  "projectId": "gen-lang-client-0412977179",
  "appId": "1:850863345734:web:7809052c9ce24737297a47",
  "apiKey": "AIzaSyBtOqvgCdCSKP9_D-PeqKmqkIpSP0exfG0",
  "authDomain": "gen-lang-client-0412977179.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-20d429e0-694a-44f5-a4d2-6e008c0ff637"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, "appData", "main");
  const snap = await getDoc(docRef);
  if (!snap.exists()) { console.log("No appData/main"); process.exit(0); }
  const data = snap.data();
  const att = data.attendance || [];
  console.log("Total attendance records:", att.length);
  
  const branchCounts = {};
  const dateCounts = {};
  const duplicates = [];
  const seen = new Set();
  
  att.forEach(a => {
    branchCounts[a.churchId] = (branchCounts[a.churchId] || 0) + 1;
    dateCounts[a.date] = (dateCounts[a.date] || 0) + 1;
    
    const key = a.date + "_" + a.churchId;
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  });
  
  console.log("By branch:", branchCounts);
  console.log("Duplicates (date_branch):", duplicates.length, duplicates.slice(0,5));
  
  // Also check members just in case
  console.log("Total members:", (data.members || []).length);
  
  process.exit(0);
}
run();
