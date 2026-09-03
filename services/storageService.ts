import { db, auth } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { AppData, Member, AttendanceRecord, Transaction, Notification, OutreachSession, PrayerSlot, AppSettings, MemberType, MemberStatus } from "../types";
import { DEFAULT_SETTINGS } from "../constants";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getAppDataRef = () => doc(db, "appData", "main");

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

    const docSnap = await getDoc(getAppDataRef());
    if (docSnap.exists()) {
      const docData = docSnap.data();
      if (docData.members) data.members = docData.members;
      if (docData.attendance) data.attendance = docData.attendance;
      if (docData.transactions) data.transactions = docData.transactions;
      if (docData.notifications) data.notifications = docData.notifications;
      if (docData.outreachSessions) data.outreachSessions = docData.outreachSessions;
      if (docData.prayerSchedule) data.prayerSchedule = docData.prayerSchedule;
      if (docData.settings) data.settings = { ...DEFAULT_SETTINGS, ...docData.settings };
      if (docData.targets) data.targets = docData.targets;
      
      // Filter out any mock/demo records if they still exist
      data.members = data.members.filter(m => !m.name.includes("Demo") && m.type !== "DEMO" as any);
      data.attendance = data.attendance.filter(a => !(a as any).isMock);
    }
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "appData/main");
    throw error;
  }
};

export const subscribeToData = (callback: (data: AppData) => void) => {
  const unsub = onSnapshot(getAppDataRef(), (docSnap) => {
    loadData().then(callback).catch(console.error);
  }, (error) => handleFirestoreError(error, OperationType.LIST, "appData/main"));
  return unsub;
};

// Generic save function to update the main doc
const updateMainDoc = async (updates: Partial<AppData>) => {
  try {
    await setDoc(getAppDataRef(), updates, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "appData/main");
  }
};

export const saveMembers = async (members: Member[]) => {
  const data = await loadData();
  const newMembers = [...data.members];
  members.forEach(m => {
    const idx = newMembers.findIndex(x => x.id === m.id);
    if (idx >= 0) newMembers[idx] = m;
    else newMembers.push(m);
  });
  await updateMainDoc({ members: newMembers });
};

export const addMember = async (member: Member) => {
  const data = await loadData();
  await updateMainDoc({ members: [...data.members, member] });
};

export const updateMember = async (id: string, updates: Partial<Member>) => {
  const data = await loadData();
  const members = data.members.map(m => m.id === id ? { ...m, ...updates } : m);
  await updateMainDoc({ members });
  return { success: true, message: "" };
};

export const deleteMember = async (id: string) => {
  const data = await loadData();
  const members = data.members.filter(m => m.id !== id);
  await updateMainDoc({ members });
  return { success: true, message: "" };
};

export const bulkArchiveMembers = async (ids: string[]) => {
  const data = await loadData();
  const members = data.members.map(m => ids.includes(m.id) ? { ...m, status: MemberStatus.ARCHIVED } : m);
  await updateMainDoc({ members });
  return { success: true, message: "" };
};

export const bulkDeleteMembers = async (ids: string[]) => {
  const data = await loadData();
  const members = data.members.filter(m => !ids.includes(m.id));
  await updateMainDoc({ members });
  return { success: true, message: "" };
};

export const saveAttendance = async (id: string, records: AttendanceRecord[]) => {
  const data = await loadData();
  let att = [...data.attendance];
  records.forEach(r => {
    const idx = att.findIndex(x => x.id === r.id);
    if (idx >= 0) att[idx] = r;
    else att.push(r);
  });
  await updateMainDoc({ attendance: att });
};

export const deleteAttendanceRecord = async (id: string) => {
  const data = await loadData();
  const attendance = data.attendance.filter(a => a.id !== id);
  await updateMainDoc({ attendance });
};

export const updateSettings = async (settings: AppSettings) => {
  await updateMainDoc({ settings });
};

export const addNotification = async (notification: Notification) => {
  const data = await loadData();
  await updateMainDoc({ notifications: [...(data.notifications || []), notification] });
};

export const markNotificationRead = async (id: string) => {
  const data = await loadData();
  const notifications = (data.notifications || []).map(n => n.id === id ? { ...n, isRead: true } : n);
  await updateMainDoc({ notifications });
};

export const clearNotifications = async () => {
  await updateMainDoc({ notifications: [] });
};

export const deleteNotification = async (id: string) => {
  const data = await loadData();
  const notifications = (data.notifications || []).filter(n => n.id !== id);
  await updateMainDoc({ notifications });
};

export const saveTransactions = async (transactions: Transaction[]) => {
  const data = await loadData();
  let trans = [...(data.transactions || [])];
  transactions.forEach(t => {
    const idx = trans.findIndex(x => x.id === t.id);
    if (idx >= 0) trans[idx] = t;
    else trans.push(t);
  });
  await updateMainDoc({ transactions: trans });
};

export const addTransaction = async (t: any) => {
  const data = await loadData();
  await updateMainDoc({ transactions: [...(data.transactions || []), t] });
  return { success: true, message: "" };
};

export const deleteTransaction = async (id: string) => {
  const data = await loadData();
  const transactions = (data.transactions || []).filter(t => t.id !== id);
  await updateMainDoc({ transactions });
};

export const saveOutreachSession = async (session: OutreachSession) => {
  const data = await loadData();
  const outreachSessions = [...(data.outreachSessions || [])];
  const idx = outreachSessions.findIndex(x => x.id === session.id);
  if (idx >= 0) outreachSessions[idx] = session;
  else outreachSessions.push(session);
  await updateMainDoc({ outreachSessions });
};

export const deleteOutreachSession = async (id: string) => {
  const data = await loadData();
  const outreachSessions = (data.outreachSessions || []).filter(s => s.id !== id);
  await updateMainDoc({ outreachSessions });
};

export const savePrayerSlot = async (slot: PrayerSlot) => {
  const data = await loadData();
  const prayerSchedule = [...(data.prayerSchedule || [])];
  const idx = prayerSchedule.findIndex(x => x.id === slot.id);
  if (idx >= 0) prayerSchedule[idx] = slot;
  else prayerSchedule.push(slot);
  await updateMainDoc({ prayerSchedule });
};

export const deletePrayerSlot = async (id: string) => {
  const data = await loadData();
  const prayerSchedule = (data.prayerSchedule || []).filter(s => s.id !== id);
  await updateMainDoc({ prayerSchedule });
};

export const clearAllData = async () => {};

export const importData = (jsonData: string) => { return { success: false, message: "Use Firebase Console" }; };

import { verifyPasscode as verifyHash, hashPasscode as createHash } from "./securityService";

export const verifyPasscode = async (name: string, passcode: string, isFast: boolean = false) => {
  try {
    const data = await loadData();
    const cleanName = name.trim().toLowerCase();
        
    const member = data.members.find(
      (m) => m.name.trim().toLowerCase() === cleanName
    );
        
    if (member && member.passcode) {
      let isValid = false;
      if (member.passcode === passcode) {
        isValid = true;
      } else {
        isValid = await verifyHash(passcode, member.passcode);
      }
            
      if (isValid) {
        return { success: true, member, message: "" };
      }
    }
    return { success: false, message: "Invalid credentials.", member: null as any };
  } catch (e) {
    return { success: false, message: "Error verifying credentials.", member: null as any };
  }
};

export const hashPasscode = async (passcode: string) => {
  return await createHash(passcode);
};

export const updateTargets = async (targets: any) => {
  await updateMainDoc({ targets });
};

export const generateOutreachSchedule = async (m: any, d: any) => { return { success: true, data: [] as string[], message: "" }; };
export const generatePrayerSchedule = async (m: any, d: any) => { return { success: true, data: [] as Date[], message: "" }; };
export const authenticateUser = async (u: string, p: string) => { return { success: true, member: null as any, message: "" }; };
