import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, "appData", "main");
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    console.log("No data");
    return;
  }
  const data = snap.data();
  
  const beforeCount = data.attendance.length;
  // Remove LJ records for 2026-07-19
  data.attendance = data.attendance.filter((r: any) => !(r.churchId === "LJ" && r.date === "2026-07-19"));
  
  const afterCount = data.attendance.length;
  console.log(`Removed ${beforeCount - afterCount} records.`);
  
  await setDoc(docRef, data);
  console.log("Saved.");
}
run().then(() => process.exit(0)).catch(console.error);
