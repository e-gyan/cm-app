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

async function analyze() {
  const docRef = doc(db, "appData", "main");
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) { process.exit(0); }
  const data = docSnap.data();
  
  // Find members that might be mock members
  const isMock = m => m.name.includes("Demo") || m.name.includes("Mock") || m.type === "DEMO";
  const mocks = data.members.filter(isMock);
  console.log("Mock members (by name 'Demo' or 'Mock'):", mocks.length);
  
  // Let's check joined dates
  const joinedCounts = {};
  data.members.forEach(m => {
    const year = m.joinedDate ? new Date(m.joinedDate).getFullYear() : 'Unknown';
    joinedCounts[year] = (joinedCounts[year] || 0) + 1;
  });
  console.log("Members by joined year:", joinedCounts);
  
  // Let's check attendance dates
  const attCounts = {};
  data.attendance.forEach(a => {
    const year = a.date ? new Date(a.date).getFullYear() : 'Unknown';
    attCounts[year] = (attCounts[year] || 0) + 1;
  });
  console.log("Attendance by year:", attCounts);
  
  // Show a couple of member names
  console.log("Sample members:", data.members.slice(0,5).map(m => m.name));
  process.exit(0);
}
analyze();
