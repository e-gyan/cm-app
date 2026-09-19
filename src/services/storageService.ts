import { db, auth } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  AppData,
  Member,
  AttendanceRecord,
  Transaction,
  Notification,
  OutreachSession,
  PrayerSlot,
  AppSettings,
  MemberStatus,
} from "../types";
import { DEFAULT_SETTINGS } from "../constants";
import { verifyPasscode as verifyHash, hashPasscode as createHash } from "./securityService";

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
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const getAppDataRef = () => doc(db, "appData", "main");

// Local in-memory cache and subscriber registry for high performance
let memoryCache: AppData | null = null;
let inFlightLoadPromise: Promise<AppData> | null = null;
const activeSubscribers = new Set<(data: AppData) => void>();

const CACHE_STORAGE_KEY = "cmd_app_cache_v2";

const parseAppDataDoc = (docData: any): AppData => {
  const data: AppData = {
    members: Array.isArray(docData?.members) ? docData.members : [],
    attendance: Array.isArray(docData?.attendance) ? docData.attendance : [],
    transactions: Array.isArray(docData?.transactions) ? docData.transactions : [],
    notifications: Array.isArray(docData?.notifications) ? docData.notifications : [],
    outreachSessions: Array.isArray(docData?.outreachSessions) ? docData.outreachSessions : [],
    prayerSchedule: Array.isArray(docData?.prayerSchedule) ? docData.prayerSchedule : [],
    settings: { ...DEFAULT_SETTINGS, ...(docData?.settings || {}) },
    targets: docData?.targets || { UJ: 0, I: 0, K: 0, LJ: 0 },
  };

  // Filter out any mock/demo records if they still exist
  data.members = data.members.filter(
    (m) => !m.name.includes("Demo") && (m.type as any) !== "DEMO"
  );
  data.attendance = data.attendance.filter((a) => !(a as any).isMock);

  return data;
};

// Read local cache from localStorage for instant 0ms app boot
const loadLocalCache = (): AppData | null => {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.members)) {
        return parsed;
      }
    }
  } catch (e) {
    // localStorage might be unavailable or empty
  }
  return null;
};

const saveLocalCache = (data: AppData) => {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // ignore quota exceeded errors
  }
};

const notifySubscribers = (data: AppData) => {
  activeSubscribers.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error("Subscriber callback error:", e);
    }
  });
};

const fetchFromCloud = async (): Promise<AppData> => {
  try {
    const docSnap = await getDoc(getAppDataRef());
    if (docSnap.exists()) {
      const data = parseAppDataDoc(docSnap.data());
      memoryCache = data;
      saveLocalCache(data);
      notifySubscribers(data);
      return data;
    } else {
      const emptyData = parseAppDataDoc({});
      memoryCache = emptyData;
      return emptyData;
    }
  } catch (error) {
    console.warn("Could not fetch appData from cloud, falling back to cache:", error);
    if (memoryCache) return memoryCache;
    const local = loadLocalCache();
    if (local) {
      memoryCache = local;
      return local;
    }
    handleFirestoreError(error, OperationType.GET, "appData/main");
    throw error;
  }
};

export const loadData = async (forceCloudRefresh: boolean = false): Promise<AppData> => {
  // If memory cache exists and no forced cloud refresh, return immediately
  if (memoryCache && !forceCloudRefresh) {
    return memoryCache;
  }

  // If memory cache is null, populate from localStorage first for instant initial render
  if (!memoryCache) {
    const local = loadLocalCache();
    if (local) {
      memoryCache = local;
      // In background, refresh from cloud without blocking caller
      fetchFromCloud().catch(console.warn);
      return memoryCache;
    }
  }

  // If a cloud fetch is already in flight, reuse the promise
  if (inFlightLoadPromise) {
    return inFlightLoadPromise;
  }

  inFlightLoadPromise = fetchFromCloud();
  try {
    const res = await inFlightLoadPromise;
    return res;
  } finally {
    inFlightLoadPromise = null;
  }
};

export const subscribeToData = (callback: (data: AppData) => void) => {
  activeSubscribers.add(callback);

  // If memory cache exists, deliver it immediately
  if (memoryCache) {
    callback(memoryCache);
  } else {
    loadData().then(callback).catch(console.error);
  }

  // Realtime Firestore snapshot listener
  const unsub = onSnapshot(
    getAppDataRef(),
    (docSnap) => {
      if (docSnap.exists()) {
        const freshData = parseAppDataDoc(docSnap.data());
        memoryCache = freshData;
        saveLocalCache(freshData);
        notifySubscribers(freshData);
      }
    },
    (error) => {
      console.warn("Firestore onSnapshot error:", error);
    }
  );

  return () => {
    activeSubscribers.delete(callback);
    unsub();
  };
};

// Debounced / Batched Firestore Writer for High-Volume Operations
let pendingUpdates: Partial<AppData> = {};
let writeTimeout: any = null;

export const flushPendingWrites = async () => {
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  const payload = { ...pendingUpdates };
  pendingUpdates = {};
  if (Object.keys(payload).length > 0) {
    try {
      await setDoc(getAppDataRef(), payload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "appData/main");
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPendingWrites().catch(console.error);
    }
  });
  window.addEventListener("beforeunload", () => {
    flushPendingWrites().catch(console.error);
  });
}

const updateMainDoc = async (updates: Partial<AppData>): Promise<void> => {
  pendingUpdates = { ...pendingUpdates, ...updates };

  if (writeTimeout) {
    clearTimeout(writeTimeout);
  }

  return new Promise((resolve) => {
    writeTimeout = setTimeout(async () => {
      writeTimeout = null;
      const payload = { ...pendingUpdates };
      pendingUpdates = {};

      try {
        await setDoc(getAppDataRef(), payload, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, "appData/main");
      } finally {
        resolve();
      }
    }, 50);
  });
};

// Optimistic Member Operations
export const saveMembers = async (members: Member[]) => {
  const current = memoryCache || (await loadData());
  const newMembers = [...current.members];
  members.forEach((m) => {
    const idx = newMembers.findIndex((x) => x.id === m.id);
    if (idx >= 0) newMembers[idx] = m;
    else newMembers.push(m);
  });

  memoryCache = { ...current, members: newMembers };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ members: newMembers }).catch(console.error);
};

export const addMember = async (member: Member) => {
  const current = memoryCache || (await loadData());
  const members = [...current.members, member];
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ members }).catch(console.error);
};

export const addMembers = async (newMembersList: Member[]) => {
  if (!newMembersList || newMembersList.length === 0) return;
  const current = memoryCache || (await loadData());
  const members = [...current.members, ...newMembersList];
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ members }).catch(console.error);
};

export const updateMember = async (id: string, updates: Partial<Member>) => {
  const current = memoryCache || (await loadData());
  const members = current.members.map((m) => (m.id === id ? { ...m, ...updates } : m));
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ members }).catch(console.error);
  return { success: true, message: "" };
};

export const deleteMember = async (id: string) => {
  const current = memoryCache || (await loadData());
  const members = current.members.filter((m) => m.id !== id);
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ members }).catch(console.error);
  return { success: true, message: "" };
};

export const bulkArchiveMembers = async (ids: string[]) => {
  const current = memoryCache || (await loadData());
  const members = current.members.map((m) =>
    ids.includes(m.id) ? { ...m, status: MemberStatus.ARCHIVED } : m
  );
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ members }).catch(console.error);
  return { success: true, message: "" };
};

export const bulkDeleteMembers = async (ids: string[]) => {
  const current = memoryCache || (await loadData());
  const members = current.members.filter((m) => !ids.includes(m.id));
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ members }).catch(console.error);
  return { success: true, message: "" };
};

// Optimistic Attendance Operations
export const saveAttendance = async (id: string, records: AttendanceRecord[]) => {
  const current = memoryCache || (await loadData());
  let att = [...current.attendance];
  records.forEach((r) => {
    const idx = att.findIndex((x) => x.id === r.id);
    if (idx >= 0) att[idx] = r;
    else att.push(r);
  });
  memoryCache = { ...current, attendance: att };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ attendance: att }).catch(console.error);
};

export const deleteAttendanceRecord = async (id: string) => {
  const current = memoryCache || (await loadData());
  const attendance = current.attendance.filter((a) => a.id !== id);
  memoryCache = { ...current, attendance };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ attendance }).catch(console.error);
};

// Optimistic Settings Operations
export const updateSettings = async (settings: AppSettings) => {
  const current = memoryCache || (await loadData());
  memoryCache = { ...current, settings };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ settings });
};

// Optimistic Notifications Operations
export const addNotification = async (notification: Notification) => {
  const current = memoryCache || (await loadData());
  const notifications = [...(current.notifications || []), notification];
  memoryCache = { ...current, notifications };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ notifications });
};

export const markNotificationRead = async (id: string) => {
  const current = memoryCache || (await loadData());
  const notifications = (current.notifications || []).map((n) =>
    n.id === id ? { ...n, isRead: true } : n
  );
  memoryCache = { ...current, notifications };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ notifications });
};

export const clearNotifications = async () => {
  const current = memoryCache || (await loadData());
  memoryCache = { ...current, notifications: [] };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ notifications: [] });
};

export const deleteNotification = async (id: string) => {
  const current = memoryCache || (await loadData());
  const notifications = (current.notifications || []).filter((n) => n.id !== id);
  memoryCache = { ...current, notifications };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ notifications });
};

// Optimistic Transactions Operations
export const saveTransactions = async (transactions: Transaction[]) => {
  const current = memoryCache || (await loadData());
  let trans = [...(current.transactions || [])];
  transactions.forEach((t) => {
    const idx = trans.findIndex((x) => x.id === t.id);
    if (idx >= 0) trans[idx] = t;
    else trans.push(t);
  });
  memoryCache = { ...current, transactions: trans };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ transactions: trans });
};

export const addTransaction = async (t: any) => {
  const current = memoryCache || (await loadData());
  const transactions = [...(current.transactions || []), t];
  memoryCache = { ...current, transactions };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ transactions });
  return { success: true, message: "" };
};

export const deleteTransaction = async (id: string) => {
  const current = memoryCache || (await loadData());
  const transactions = (current.transactions || []).filter((t) => t.id !== id);
  memoryCache = { ...current, transactions };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ transactions }).catch(console.error);
};

// Optimistic Outreach Operations
export const saveOutreachSession = async (session: OutreachSession) => {
  const current = memoryCache || (await loadData());
  const outreachSessions = [...(current.outreachSessions || [])];
  const idx = outreachSessions.findIndex((x) => x.id === session.id);
  if (idx >= 0) outreachSessions[idx] = session;
  else outreachSessions.push(session);

  memoryCache = { ...current, outreachSessions };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ outreachSessions }).catch(console.error);
};

export const deleteOutreachSession = async (id: string) => {
  const current = memoryCache || (await loadData());
  const outreachSessions = (current.outreachSessions || []).filter((s) => s.id !== id);
  memoryCache = { ...current, outreachSessions };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ outreachSessions }).catch(console.error);
};

export const savePrayerSlot = async (slot: PrayerSlot) => {
  const current = memoryCache || (await loadData());
  const prayerSchedule = [...(current.prayerSchedule || [])];
  const idx = prayerSchedule.findIndex((x) => x.id === slot.id);
  if (idx >= 0) prayerSchedule[idx] = slot;
  else prayerSchedule.push(slot);

  memoryCache = { ...current, prayerSchedule };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ prayerSchedule }).catch(console.error);
};

export const deletePrayerSlot = async (id: string) => {
  const current = memoryCache || (await loadData());
  const prayerSchedule = (current.prayerSchedule || []).filter((s) => s.id !== id);
  memoryCache = { ...current, prayerSchedule };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ prayerSchedule }).catch(console.error);
};

export const clearAllData = async () => {
  memoryCache = null;
  localStorage.removeItem(CACHE_STORAGE_KEY);
};

export const importData = (_jsonData: string) => {
  return { success: false, message: "Use Firebase Console" };
};

export const verifyPasscode = async (name: string, passcode: string, isFast: boolean = false) => {
  try {
    const data = memoryCache || (await loadData());
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
  const current = memoryCache || (await loadData());
  memoryCache = { ...current, targets };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ targets });
};

export const generateOutreachSchedule = async (targetMembers: any[], dates: string[], teacherId?: string) => {
  try {
    const data = memoryCache || (await loadData());
    const existingSessions = data.outreachSessions || [];

    if (targetMembers.length === 0) {
      return { success: false, message: "No members available to assign for visitation." };
    }

    const visitCounts = new Map<string, number>();
    targetMembers.forEach((m) => visitCounts.set(m.id, 0));

    existingSessions.forEach((s) => {
      if (
        s.status === "COMPLETED" &&
        (s.sessionType === "VISITATION" || s.sessionType === "VISIT" || !s.sessionType)
      ) {
        s.visitedMemberIds?.forEach((id) => {
          if (visitCounts.has(id)) {
            visitCounts.set(id, visitCounts.get(id)! + 1);
          }
        });
      }
    });

    const newSessions: any[] = [];

    for (const dateStr of dates) {
      const shuffleAndSort = (membersList: any[]) => {
        return membersList
          .map((m) => ({ m, sortKey: (visitCounts.get(m.id) || 0) + Math.random() }))
          .sort((a, b) => a.sortKey - b.sortKey)
          .map((x) => x.m);
      };

      const membersOnly = targetMembers.filter((m) => m.type === "Member");
      const fnfsOnly = targetMembers.filter((m) => m.type === "FNF");
      const visitorsOnly = targetMembers.filter(
        (m) => m.type === "Visitor" || m.type === "Not Member"
      );

      const sortedMembers = shuffleAndSort(membersOnly);
      const sortedFnfs = shuffleAndSort(fnfsOnly);
      const sortedVisitors = shuffleAndSort(visitorsOnly);

      const selectedIds: string[] = [];

      // Strict rule: 2 Members, 1 FNF, 1 First Timer (Visitor)
      selectedIds.push(...sortedMembers.slice(0, 2).map((m) => m.id));
      selectedIds.push(...sortedFnfs.slice(0, 1).map((m) => m.id));
      selectedIds.push(...sortedVisitors.slice(0, 1).map((m) => m.id));

      selectedIds.forEach((id) => {
        visitCounts.set(id, (visitCounts.get(id) || 0) + 1);
      });

      newSessions.push({
        id: crypto.randomUUID(),
        date: dateStr,
        status: "PENDING",
        sessionType: "VISITATION",
        assignedMemberIds: selectedIds,
        visitedMemberIds: [],
        teacherId: teacherId || undefined,
        completedBy: teacherId || undefined,
        branchId: targetMembers[0]?.assignedChurch || "ALL",
      });
    }

    const updatedSessions = [...existingSessions, ...newSessions];
    const updated = { ...data, outreachSessions: updatedSessions };
    memoryCache = updated;
    saveLocalCache(updated);
    notifySubscribers(updated);
    await updateMainDoc({ outreachSessions: updatedSessions });
    return {
      success: true,
      data: updatedSessions,
      message: "Generated visitation schedule (2 members, 1 FNF, 1 First Timer per date)!",
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to generate schedule." };
  }
};

export const generatePrayerSchedule = async (prayerWeek: Date, targetMembers: Member[], teacherId?: string) => {
  try {
    const data = memoryCache || (await loadData());
    const existingSchedule = data.prayerSchedule || [];

    const newSlots: PrayerSlot[] = [];

    if (targetMembers.length === 0) {
      return { success: false, message: "No members available to generate schedule." };
    }

    const prayerCounts = new Map<string, number>();
    targetMembers.forEach((m) => prayerCounts.set(m.id, 0));

    existingSchedule.forEach((s) => {
      if (s.isCompleted) {
        s.assignedMemberIds?.forEach((id) => {
          if (prayerCounts.has(id)) {
            prayerCounts.set(id, prayerCounts.get(id)! + 1);
          }
        });
      }
    });

    for (let i = 0; i < 5; i++) {
      const slotDate = new Date(prayerWeek);
      slotDate.setDate(slotDate.getDate() + i);
      const dateStr = slotDate.toISOString().split('T')[0];
      const dayOfWeek = slotDate.toLocaleDateString("en-GB", { weekday: "long" });

      const shuffleAndSort = (membersList: any[]) => {
        return membersList
          .map((m) => ({ m, sortKey: (prayerCounts.get(m.id) || 0) + Math.random() }))
          .sort((a, b) => a.sortKey - b.sortKey)
          .map((x) => x.m);
      };

      const membersOnly = targetMembers.filter((m) => m.type === "Member");
      const fnfsOnly = targetMembers.filter((m) => m.type === "FNF");
      const visitorsOnly = targetMembers.filter(
        (m) => m.type === "Visitor" || m.type === "Not Member"
      );

      const sortedMembers = shuffleAndSort(membersOnly);
      const sortedFnfs = shuffleAndSort(fnfsOnly);
      const sortedVisitors = shuffleAndSort(visitorsOnly);

      const selectedIds: string[] = [];

      // Strict rule: 2 Members, 1 FNF, 1 First Timer (Visitor)
      selectedIds.push(...sortedMembers.slice(0, 2).map((m) => m.id));
      selectedIds.push(...sortedFnfs.slice(0, 1).map((m) => m.id));
      selectedIds.push(...sortedVisitors.slice(0, 1).map((m) => m.id));

      selectedIds.forEach((id) => {
        prayerCounts.set(id, (prayerCounts.get(id) || 0) + 1);
      });

      newSlots.push({
        id: crypto.randomUUID(),
        date: dateStr,
        dayOfWeek: dayOfWeek,
        isCompleted: false,
        assignedMemberIds: selectedIds,
        durationMins: 0,
        teacherId: teacherId || undefined,
        branchId: targetMembers[0]?.branchId || targetMembers[0]?.assignedChurch || "ALL",
      });
    }

    const updatedSchedule = [...existingSchedule, ...newSlots];
    const updated = { ...data, prayerSchedule: updatedSchedule };
    memoryCache = updated;
    saveLocalCache(updated);
    notifySubscribers(updated);
    await updateMainDoc({ prayerSchedule: updatedSchedule });

    return {
      success: true,
      data: updatedSchedule,
      message: "Generated weekly prayer schedule (2 members, 1 FNF, 1 First Timer daily)!",
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to generate schedule." };
  }
};

export const authenticateUser = async (_u: string, _p: string) => {
  return { success: true, member: null as any, message: "" };
};
