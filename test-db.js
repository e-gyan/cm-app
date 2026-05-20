import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkDb() {
  try {
    const docRef = doc(db, "appData", "main");
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.log("No data found in appData/main");
    } else {
      const data = docSnap.data();
      console.log("Admins:");
      const admins = data.members.filter((m) => m.role === "ADMIN" || m.type === "Teacher" || m.name === "Main Admin");
      for (const a of admins) {
        console.log(`- ${a.name} (Role: ${a.role}, Passcode: ${a.passcode})`);
      }
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
checkDb();
