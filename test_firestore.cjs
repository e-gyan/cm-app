const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, setDoc } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    await setDoc(doc(db, "test", "write"), { ok: true });
    console.log("Write success!");
  } catch (e) {
    console.error("Write fail", e.message);
  }
}
run();
