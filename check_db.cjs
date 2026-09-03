const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ai-studio-20d429e0-694a-44f5-a4d2-6e008c0ff637' });
const db = admin.firestore();

async function check() {
  const doc = await db.collection('appData').doc('main').get();
  console.log("appData/main exists:", doc.exists);
  if (doc.exists) {
    const data = doc.data();
    console.log("Keys in appData/main:", Object.keys(data));
    if (data.members) console.log("Members count:", data.members.length);
    if (data.attendance) console.log("Attendance count:", data.attendance.length);
    if (data.transactions) console.log("Transactions count:", data.transactions.length);
  }
}
check().catch(console.error);
