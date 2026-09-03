const fs = require('fs');
let storage = fs.readFileSync('services/storageService.ts', 'utf8');

const loadDataContent = `
export const loadData = async (): Promise<AppData> => {
  try {
    const data: AppData = {
      members: [],
      attendance: [],
      transactions: [],
      notifications: [],
      outreachSessions: [],
      prayerSchedule: [],
      settings: DEFAULT_SETTINGS,
      targets: { UJ: 0, I: 0, K: 0, LJ: 0 },
    };

    const membersSnap = await getDocs(collection(db, "members"));
    membersSnap.forEach(doc => data.members.push({ id: doc.id, ...doc.data() } as Member));

    const attSnap = await getDocs(collection(db, "attendance"));
    attSnap.forEach(doc => data.attendance.push({ id: doc.id, ...doc.data() } as AttendanceRecord));

    const transSnap = await getDocs(collection(db, "transactions"));
    transSnap.forEach(doc => data.transactions!.push({ id: doc.id, ...doc.data() } as Transaction));

    const outSnap = await getDocs(collection(db, "outreach"));
    outSnap.forEach(doc => data.outreachSessions!.push({ id: doc.id, ...doc.data() } as OutreachSession));

    try {
      const setSnap = await getDoc(doc(db, "settings", "global"));
      if (setSnap.exists()) {
        const d = setSnap.data();
        if (d.settings) data.settings = d.settings;
        if (d.targets) data.targets = d.targets;
        if (d.prayerSchedule) data.prayerSchedule = d.prayerSchedule;
      }
    } catch (e) {
      console.warn("Could not load settings", e);
    }

    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "multiple collections");
    throw error;
  }
};
`;

storage = storage.replace(/export const loadData = async \(\): Promise<AppData> => \{[\s\S]*?catch \(error\) \{[\s\S]*?throw error;\s*\}\s*\};/, loadDataContent.trim());

fs.writeFileSync('services/storageService.ts', storage);
