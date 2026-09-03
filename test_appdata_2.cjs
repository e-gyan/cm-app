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

async function checkData() {
  try {
    const docRef = doc(db, "appData", "main");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("Found appData/main!");
      console.log("Members count:", data.members ? data.members.length : 0);
      console.log("Attendance count:", data.attendance ? data.attendance.length : 0);
    } else {
      console.log("appData/main does not exist.");
    }
  } catch (error) {
    console.error("Error fetching doc:", error);
  }
  process.exit(0);
}
checkData();
