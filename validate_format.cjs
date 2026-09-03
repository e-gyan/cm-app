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

async function check() {
  const docSnap = await getDoc(doc(db, "appData", "main"));
  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log("Member 0:", data.members[0]);
    console.log("Attendance 0:", data.attendance[0]);
  }
  process.exit(0);
}
check();
