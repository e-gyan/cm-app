import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { AppData } from "./types";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, "appData", "main");
  const snap = await getDoc(docRef);
  const data = snap.data() as AppData;

  const kMembers = data.members.filter(m => m.assignedChurch === 'K');
  console.log("K Members:", kMembers.map(m => m.name));
  process.exit(0);
}
run();
