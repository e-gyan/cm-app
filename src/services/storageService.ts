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
  MemberType,
  isFnfCombined,
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

const isThesaurusHQ = (name?: string): boolean => {
  if (!name) return false;
  return /^thesaurus\s*hq$/i.test(name.trim());
};

const parseAppDataDoc = (docData: any): AppData => {
  const data: AppData = {
    members: Array.isArray(docData?.members) ? docData.members : [],
    attendance: Array.isArray(docData?.attendance) ? docData.attendance : [],
    transactions: Array.isArray(docData?.transactions) ? docData.transactions : [],
    notifications: Array.isArray(docData?.notifications) ? docData.notifications : [],
    outreachSessions: Array.isArray(docData?.outreachSessions) ? docData.outreachSessions : [],
    prayerSchedule: Array.isArray(docData?.prayerSchedule) ? docData.prayerSchedule : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(docData?.settings || {}),
      permissions: {
        ...DEFAULT_SETTINGS.permissions,
        ...(docData?.settings?.permissions || {}),
      },
    },
    targets: docData?.targets || { UJ: 0, I: 0, K: 0, LJ: 0 },
  };

  // Filter out any mock/demo records if they still exist
  data.members = data.members.filter(
    (m) => !m.name.includes("Demo") && (m.type as any) !== "DEMO"
  );
  data.attendance = data.attendance.filter((a) => !(a as any).isMock);

  // Automatic Migration: Attach all data and records of "Thesaurus HQ" to "Thesaurus"
  let hasThesaurusMigrations = false;

  if (data.settings?.organization?.zones) {
    data.settings.organization.zones = data.settings.organization.zones.map((zone) => ({
      ...zone,
      branches: (zone.branches || []).map((b) => {
        if (isThesaurusHQ(b.name)) {
          hasThesaurusMigrations = true;
          return { ...b, name: "Thesaurus" };
        }
        return b;
      }),
    }));
  }

  let hasVisitorMigrations = false;

  data.members = data.members.map((m) => {
    let changed = false;
    let bId = m.branchId;
    let ch = m.assignedChurch;
    let mType = m.type;

    if (isThesaurusHQ(bId)) {
      bId = "Thesaurus";
      changed = true;
      hasThesaurusMigrations = true;
    }
    if (isThesaurusHQ(ch)) {
      ch = "Thesaurus";
      changed = true;
      hasThesaurusMigrations = true;
    }
    // Automatically merge legacy "Visitor" records into FNF only when FNF & First Timers combining is enabled
    if (isFnfCombined(data.settings) && ((mType as string) === "Visitor" || (mType as any) === MemberType.VISITOR)) {
      if (!m.previousType) {
        m.previousType = MemberType.VISITOR;
      }
      mType = MemberType.FNF;
      changed = true;
      hasVisitorMigrations = true;
    }

    if (changed) {
      return { ...m, branchId: bId, assignedChurch: ch, type: mType };
    }
    return m;
  });

  data.attendance = data.attendance.map((a) => {
    if (isThesaurusHQ(a.branchId)) {
      hasThesaurusMigrations = true;
      return { ...a, branchId: "Thesaurus" };
    }
    return a;
  });

  data.transactions = (data.transactions || []).map((t) => {
    if (isThesaurusHQ(t.branchId)) {
      hasThesaurusMigrations = true;
      return { ...t, branchId: "Thesaurus" };
    }
    return t;
  });

  data.outreachSessions = (data.outreachSessions || []).map((s) => {
    if (isThesaurusHQ(s.branchId)) {
      hasThesaurusMigrations = true;
      return { ...s, branchId: "Thesaurus" };
    }
    return s;
  });

  data.prayerSchedule = (data.prayerSchedule || []).map((p) => {
    if (isThesaurusHQ(p.branchId)) {
      hasThesaurusMigrations = true;
      return { ...p, branchId: "Thesaurus" };
    }
    return p;
  });

  data.notifications = (data.notifications || []).map((n) => {
    if (isThesaurusHQ(n.branchId)) {
      hasThesaurusMigrations = true;
      return { ...n, branchId: "Thesaurus" };
    }
    return n;
  });

  // If any records were migrated from Thesaurus HQ or Visitor to FNF, queue persistence so cloud data is updated permanently
  if (hasThesaurusMigrations || hasVisitorMigrations) {
    setTimeout(() => {
      updateMainDoc({
        settings: data.settings,
        members: data.members,
        attendance: data.attendance,
        transactions: data.transactions,
        outreachSessions: data.outreachSessions,
        prayerSchedule: data.prayerSchedule,
        notifications: data.notifications,
      }).catch(console.error);
    }, 150);

    try {
      const active = sessionStorage.getItem("activeBranchId");
      if (isThesaurusHQ(active)) {
        sessionStorage.setItem("activeBranchId", "Thesaurus");
      }
      const savedUserRaw = sessionStorage.getItem("currentUser") || localStorage.getItem("cmd_current_user");
      if (savedUserRaw) {
        const u = JSON.parse(savedUserRaw);
        if (isThesaurusHQ(u.branchId)) {
          u.branchId = "Thesaurus";
          sessionStorage.setItem("currentUser", JSON.stringify(u));
          localStorage.setItem("cmd_current_user", JSON.stringify(u));
        }
      }
    } catch {}
  }

  return data;
};

// Read local cache from localStorage for instant 0ms app boot
export const loadLocalCache = (): AppData | null => {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.members)) {
        return parseAppDataDoc(parsed);
      }
    }
  } catch (e) {
    // localStorage might be unavailable or empty
  }
  return null;
};

// Returns synchronous cache immediately in 0ms so components render without waiting
export const getInstantData = (): AppData => {
  if (memoryCache) return memoryCache;
  const local = loadLocalCache();
  if (local) {
    memoryCache = local;
    return local;
  }
  return parseAppDataDoc({});
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dataUpdated"));
  }
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
  window.addEventListener("online", () => {
    console.log("[Offline Sync] Connection restored. Flushing queued writes...");
    flushPendingWrites().catch(console.error);
    loadData(true).catch(console.error);
  });
}

const OFFLINE_QUEUE_KEY = "cm_offline_pending_writes";

const getOfflineQueue = (): Partial<AppData> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveOfflineQueue = (queue: Partial<AppData>) => {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Ignore storage quota errors
  }
};

const updateMainDoc = async (updates: Partial<AppData>): Promise<void> => {
  pendingUpdates = { ...pendingUpdates, ...updates };

  if (writeTimeout) {
    clearTimeout(writeTimeout);
  }

  return new Promise((resolve) => {
    writeTimeout = setTimeout(async () => {
      writeTimeout = null;
      // Merge with any existing offline queue
      const offlineQueue = getOfflineQueue();
      const payload = { ...offlineQueue, ...pendingUpdates };
      pendingUpdates = {};

      try {
        await setDoc(getAppDataRef(), payload, { merge: true });
        saveOfflineQueue({}); // Clear offline queue on success
      } catch (error) {
        // Save to offline queue so it syncs immediately when connectivity returns
        saveOfflineQueue(payload);
        handleFirestoreError(error, OperationType.WRITE, "appData/main");
      } finally {
        resolve();
      }
    }, 50);
  });
};

// Actor helper for audit notifications
const getLoggedInActorName = (): string => {
  try {
    const raw = sessionStorage.getItem("currentUser") || localStorage.getItem("cmd_current_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.name) return parsed.name;
    }
  } catch {}
  return auth.currentUser?.displayName || auth.currentUser?.email || "User";
};

// Centralized activity notification recorder
export const recordActivityNotification = async (payload: {
  message: string;
  type: string;
  branchId?: string;
  zoneId?: string;
  targetChurch?: string;
  relatedMemberId?: string;
  actorName?: string;
}) => {
  const current = memoryCache || (await loadData());
  const actor = payload.actorName || getLoggedInActorName();
  const newNotif: Notification = {
    id: crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    message: payload.message,
    type: payload.type,
    branchId: payload.branchId || "ALL",
    zoneId: payload.zoneId,
    targetChurch: payload.targetChurch || "ALL",
    relatedMemberId: payload.relatedMemberId,
    actorName: actor,
    createdAt: new Date().toISOString(),
    isRead: false,
    read: false,
  };

  const notifications = [newNotif, ...(current.notifications || [])].slice(0, 150);
  memoryCache = { ...current, notifications };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  updateMainDoc({ notifications }).catch(console.error);
  return newNotif;
};

// Optimistic Member Operations
export const saveMembers = async (members: Member[]) => {
  const current = memoryCache || (await loadData());
  const newMembers = [...current.members];
  members.forEach((m) => {
    const updated = { ...m };
    if (!updated.assignedTeacherId || updated.assignedTeacherId === "UNASSIGNED") {
      delete updated.assignedTeacherId;
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`cm_hooked_teacher_${m.id}`);
        } catch {}
      }
    }
    const idx = newMembers.findIndex((x) => x.id === m.id);
    if (idx >= 0) newMembers[idx] = updated;
    else newMembers.push(updated);
  });

  // Strip undefined properties for safe Firestore array serialization
  const sanitizedMembers: Member[] = JSON.parse(JSON.stringify(newMembers));
  memoryCache = { ...current, members: sanitizedMembers };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ members: sanitizedMembers });
};

export const addMember = async (member: Member) => {
  const current = memoryCache || (await loadData());
  const shouldCombine = isFnfCombined(current.settings);
  const isVisitor = (member.type as string) === "Visitor" || (member.type as any) === MemberType.VISITOR;
  const normalizedMember: Member = {
    ...member,
    joinedDate: member.joinedDate || new Date().toISOString(),
    addedAt: member.addedAt || Date.now(),
    type: shouldCombine && isVisitor ? MemberType.FNF : member.type,
    previousType: member.previousType || (shouldCombine && isVisitor ? MemberType.VISITOR : undefined),
  };
  const members = [...current.members, normalizedMember];
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = { ...pendingUpdates, members };
  await flushPendingWrites();

  recordActivityNotification({
    message: `New member registered: ${normalizedMember.name} (${normalizedMember.assignedChurch || "General"})`,
    type: "MEMBER_ADDED",
    branchId: normalizedMember.branchId || "ALL",
    zoneId: normalizedMember.zoneId,
    targetChurch: normalizedMember.assignedChurch || "ALL",
    relatedMemberId: normalizedMember.id,
  }).catch(console.error);
};

export const addMembers = async (newMembersList: Member[]) => {
  if (!newMembersList || newMembersList.length === 0) return;
  const current = memoryCache || (await loadData());
  const shouldCombine = isFnfCombined(current.settings);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const normalizedList: Member[] = newMembersList.map((m) => {
    const isVisitor = (m.type as string) === "Visitor" || (m.type as any) === MemberType.VISITOR;
    return {
      ...m,
      joinedDate: m.joinedDate || nowIso,
      addedAt: m.addedAt || nowMs,
      type: shouldCombine && isVisitor ? MemberType.FNF : m.type,
      previousType: m.previousType || (shouldCombine && isVisitor ? MemberType.VISITOR : undefined),
    };
  });
  const members = [...current.members, ...normalizedList];
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = { ...pendingUpdates, members };
  await flushPendingWrites();

  recordActivityNotification({
    message: `${normalizedList.length} new members imported/registered`,
    type: "MEMBER_ADDED",
    branchId: normalizedList[0]?.branchId || "ALL",
    targetChurch: normalizedList[0]?.assignedChurch || "ALL",
  }).catch(console.error);
};

export const updateMember = async (id: string, updates: Partial<Member>) => {
  const current = memoryCache || (await loadData());
  const targetMember = current.members.find((m) => m.id === id);
  const members = current.members.map((m) => {
    if (m.id === id) {
      const up = { ...m, ...updates };
      const isVisitor = (up.type as string) === "Visitor" || (up.type as any) === MemberType.VISITOR;
      if (isFnfCombined(current.settings) && isVisitor) {
        if (!up.previousType) up.previousType = MemberType.VISITOR;
        up.type = MemberType.FNF;
      }
      if (!up.assignedTeacherId || up.assignedTeacherId === "UNASSIGNED") {
        delete up.assignedTeacherId;
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(`cm_hooked_teacher_${id}`);
          } catch {}
        }
      }
      return up;
    }
    return m;
  });
  const sanitizedMembers: Member[] = JSON.parse(JSON.stringify(members));
  memoryCache = { ...current, members: sanitizedMembers };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = { ...pendingUpdates, members: sanitizedMembers };
  await flushPendingWrites();

  if (targetMember && updates.status && updates.status !== targetMember.status) {
    recordActivityNotification({
      message: `Status of ${targetMember.name} changed to ${updates.status}`,
      type: "STATUS_CHANGE",
      branchId: updates.branchId || targetMember.branchId || "ALL",
      targetChurch: updates.assignedChurch || targetMember.assignedChurch || "ALL",
      relatedMemberId: id,
    }).catch(console.error);
  } else if (targetMember && updates.assignedChurch && updates.assignedChurch !== targetMember.assignedChurch) {
    recordActivityNotification({
      message: `${targetMember.name} transferred/promoted to ${updates.assignedChurch} Church`,
      type: "PROMOTION",
      branchId: updates.branchId || targetMember.branchId || "ALL",
      targetChurch: updates.assignedChurch,
      relatedMemberId: id,
    }).catch(console.error);
  }

  return { success: true, message: "" };
};

export const deleteMember = async (id: string) => {
  const current = memoryCache || (await loadData());
  const members = current.members.filter((m) => m.id !== id);
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = { ...pendingUpdates, members };
  await flushPendingWrites();
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
  pendingUpdates = { ...pendingUpdates, members };
  await flushPendingWrites();
  return { success: true, message: "" };
};

export const bulkDeleteMembers = async (ids: string[]) => {
  const current = memoryCache || (await loadData());
  const members = current.members.filter((m) => !ids.includes(m.id));
  memoryCache = { ...current, members };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = { ...pendingUpdates, members };
  await flushPendingWrites();
  return { success: true, message: "" };
};

// Optimistic Attendance Operations with immediate Firestore synchronization
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
  pendingUpdates = { ...pendingUpdates, attendance: att };
  await flushPendingWrites();

  if (records.length > 0) {
    const first = records[0];
    const presentCount = records.reduce((acc, r) => acc + (r.presentMemberIds?.length || 0), 0);
    const eventName = first.eventName || (first.churchId ? `${first.churchId} Church` : "Sunday Service");
    recordActivityNotification({
      message: `Attendance recorded for ${eventName} (${presentCount} present)`,
      type: "ATTENDANCE",
      branchId: first.branchId || "ALL",
      targetChurch: first.churchId || "ALL",
    }).catch(console.error);
  }
};

export const deleteAttendanceRecord = async (id: string) => {
  const current = memoryCache || (await loadData());
  const attendance = current.attendance.filter((a) => a.id !== id);
  memoryCache = { ...current, attendance };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = { ...pendingUpdates, attendance };
  await flushPendingWrites();
};

export interface RegroupResult {
  combined: boolean;
  firstTimersCount: number;
  fnfCount: number;
  totalAffected: number;
}

/**
 * Intelligently regroups and reassigns children/members between "First Timers" (Visitor) and "FNF" (Friends & Family).
 * - When separating (combine = false):
 *   Uses empirical attendance count and historical previous records:
 *   - Attendance count === 1 session: Assigned to "First Timers" (MemberType.VISITOR).
 *   - Attendance count >= 2 sessions: Assigned to "FNF" (MemberType.FNF) as returning guests/visitors.
 *   - Attendance count === 0 sessions: Falls back to previous record (if previousType is FNF -> FNF; else Visitor).
 * - When combining (combine = true):
 *   Preserves current category in previousType and merges all into MemberType.FNF.
 */
export const regroupFnfAndFirstTimers = async (
  combine: boolean,
  customSettings?: AppSettings
): Promise<RegroupResult> => {
  const current = memoryCache || (await loadData());
  const attendanceList = current.attendance || [];

  // Index attendance count for every member
  const attendanceCounts = new Map<string, number>();
  attendanceList.forEach((rec) => {
    if (Array.isArray(rec.presentMemberIds)) {
      rec.presentMemberIds.forEach((id) => {
        if (id) {
          attendanceCounts.set(id, (attendanceCounts.get(id) || 0) + 1);
        }
      });
    }
  });

  let firstTimersCount = 0;
  let fnfCount = 0;
  let totalAffected = 0;

  const updatedMembers: Member[] = current.members.map((m) => {
    const isCurrentlyVisitor =
      m.type === MemberType.VISITOR || (m.type as string) === "Visitor";
    const isCurrentlyFnf =
      m.type === MemberType.FNF || (m.type as string) === "FNF";
    const hadVisitorHistory =
      m.previousType === MemberType.VISITOR || (m.previousType as string) === "Visitor";
    const hadFnfHistory =
      m.previousType === MemberType.FNF || (m.previousType as string) === "FNF";

    // Strictly process children/members belonging to the visitor/guest/FNF categories
    if (!isCurrentlyVisitor && !isCurrentlyFnf && !hadVisitorHistory && !hadFnfHistory) {
      return m;
    }

    const count = attendanceCounts.get(m.id) || 0;
    let newType = m.type;
    let newPrevType = m.previousType;

    if (combine) {
      // Combining into unified FNF
      if (isCurrentlyVisitor) {
        newPrevType = MemberType.VISITOR;
      } else if (!newPrevType) {
        newPrevType = count <= 1 ? MemberType.VISITOR : MemberType.FNF;
      }
      newType = MemberType.FNF;
      fnfCount++;
      if (m.type !== MemberType.FNF || m.previousType !== newPrevType) {
        totalAffected++;
      }
    } else {
      // Separating into First Timers (Visitor) and FNFs
      // Intelligent rule:
      // 1. If 0 sessions attended: check previous record. If previousType was FNF and not visitor, keep FNF; otherwise First Timer.
      // 2. If 1 session attended: First Timer (attended once).
      // 3. If 2 or more sessions attended: FNF (returning guest / regular visitor).
      if (count === 0 && hadFnfHistory && !hadVisitorHistory) {
        newType = MemberType.FNF;
        fnfCount++;
      } else if (count <= 1) {
        newType = MemberType.VISITOR;
        firstTimersCount++;
      } else {
        newType = MemberType.FNF;
        fnfCount++;
      }

      if (!newPrevType) {
        newPrevType = m.type;
      }

      if (m.type !== newType || m.previousType !== newPrevType) {
        totalAffected++;
      }
    }

    return {
      ...m,
      type: newType,
      previousType: newPrevType,
    };
  });

  const sanitizedMembers: Member[] = JSON.parse(JSON.stringify(updatedMembers));
  const updatedSettings: AppSettings = {
    ...current.settings,
    ...(customSettings || {}),
    combineFnfAndFirstTimers: combine,
  };

  memoryCache = {
    ...current,
    members: sanitizedMembers,
    settings: updatedSettings,
  };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = {
    ...pendingUpdates,
    members: sanitizedMembers,
    settings: updatedSettings,
  };
  await flushPendingWrites();

  return {
    combined: combine,
    firstTimersCount,
    fnfCount,
    totalAffected,
  };
};

// Settings Operations with immediate Firestore synchronization
export const updateSettings = async (settings: AppSettings) => {
  const current = memoryCache || (await loadData());

  const oldCombine = current.settings?.combineFnfAndFirstTimers !== false;
  const newCombine = settings.combineFnfAndFirstTimers !== false;

  if (oldCombine !== newCombine) {
    await regroupFnfAndFirstTimers(newCombine, settings);
    return;
  }

  memoryCache = { ...current, settings };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  pendingUpdates = { ...pendingUpdates, settings };
  await flushPendingWrites();
};

export const saveRolePermissions = async (permissions: Record<string, string[]>) => {
  const current = memoryCache || (await loadData());
  const updatedSettings: AppSettings = {
    ...current.settings,
    permissions: {
      ...DEFAULT_SETTINGS.permissions,
      ...(current.settings?.permissions || {}),
      ...permissions,
    },
  };
  await updateSettings(updatedSettings);
  return updatedSettings;
};

// Cascade Branch Renaming throughout the entire application and dependencies
export const renameBranchCascade = async (
  oldBranchId: string,
  oldBranchName: string,
  newBranchName: string,
  updatedSettings: AppSettings,
  actorName?: string
) => {
  const current = memoryCache || (await loadData());
  const trimmedNewName = newBranchName.trim();
  const trimmedOldName = oldBranchName.trim();

  // If names match, just persist settings
  if (trimmedNewName === trimmedOldName && oldBranchId) {
    await updateSettings(updatedSettings);
    return;
  }

  const isTargetBranch = (val?: string): boolean => {
    if (!val) return false;
    const v = val.trim();
    if (v.toLowerCase() === trimmedOldName.toLowerCase()) return true;
    if (oldBranchId && v === oldBranchId) return true;
    if (trimmedOldName.toLowerCase() === "thesaurus" && isThesaurusHQ(v)) return true;
    if (isThesaurusHQ(trimmedOldName) && v.toLowerCase() === "thesaurus") return true;
    return false;
  };

  // 1. Cascade to members
  const members = current.members.map((m) => {
    let changed = false;
    let newBranchId = m.branchId;
    let newAssignedChurch = m.assignedChurch;

    if (isTargetBranch(m.branchId)) {
      newBranchId = trimmedNewName;
      changed = true;
    }

    if (isTargetBranch(m.assignedChurch)) {
      newAssignedChurch = trimmedNewName;
      changed = true;
    }

    return changed ? { ...m, branchId: newBranchId, assignedChurch: newAssignedChurch } : m;
  });

  // 2. Cascade to attendance
  const attendance = current.attendance.map((a) => {
    if (isTargetBranch(a.branchId)) {
      return { ...a, branchId: trimmedNewName };
    }
    return a;
  });

  // 3. Cascade to transactions
  const transactions = (current.transactions || []).map((t) => {
    if (isTargetBranch(t.branchId)) {
      return { ...t, branchId: trimmedNewName };
    }
    return t;
  });

  // 4. Cascade to outreach sessions
  const outreachSessions = (current.outreachSessions || []).map((s) => {
    if (isTargetBranch(s.branchId)) {
      return { ...s, branchId: trimmedNewName };
    }
    return s;
  });

  // 5. Cascade to prayer schedule
  const prayerSchedule = (current.prayerSchedule || []).map((p) => {
    if (isTargetBranch(p.branchId)) {
      return { ...p, branchId: trimmedNewName };
    }
    return p;
  });

  // 6. Cascade to existing notifications
  const updatedExistingNotifs = (current.notifications || []).map((n) => {
    if (isTargetBranch(n.branchId)) {
      return { ...n, branchId: trimmedNewName };
    }
    return n;
  });

  // 7. Create notification for branch renaming
  const actor = actorName || getLoggedInActorName();
  const renameNotif: Notification = {
    id: crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}`,
    message: `Branch "${trimmedOldName}" was renamed to "${trimmedNewName}" across the organization`,
    type: "ORGANIZATION",
    branchId: trimmedNewName,
    targetChurch: "ALL",
    actorName: actor,
    createdAt: new Date().toISOString(),
    isRead: false,
    read: false,
  };
  const notifications = [renameNotif, ...updatedExistingNotifs].slice(0, 150);

  // 8. Update browser active branch session/local storage
  try {
    const active = sessionStorage.getItem("activeBranchId");
    if (isTargetBranch(active || undefined)) {
      sessionStorage.setItem("activeBranchId", trimmedNewName);
    }
    const savedUserRaw = sessionStorage.getItem("currentUser") || localStorage.getItem("cmd_current_user");
    if (savedUserRaw) {
      const u = JSON.parse(savedUserRaw);
      if (isTargetBranch(u.branchId)) {
        u.branchId = trimmedNewName;
        sessionStorage.setItem("currentUser", JSON.stringify(u));
        localStorage.setItem("cmd_current_user", JSON.stringify(u));
      }
    }
  } catch (e) {
    console.warn("Could not update session branch info:", e);
  }

  // 9. Atomic commit to memoryCache, local storage, and Firestore
  const updatedData: AppData = {
    ...current,
    settings: updatedSettings,
    members,
    attendance,
    transactions,
    outreachSessions,
    prayerSchedule,
    notifications,
  };

  memoryCache = updatedData;
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);

  pendingUpdates = {
    ...pendingUpdates,
    settings: updatedSettings,
    members,
    attendance,
    transactions,
    outreachSessions,
    prayerSchedule,
    notifications,
  };

  await flushPendingWrites();
};

// Optimistic Notifications Operations
export const addNotification = async (notification: Notification) => {
  const current = memoryCache || (await loadData());
  const notifications = [notification, ...(current.notifications || [])].slice(0, 150);
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

  recordActivityNotification({
    message: `${t.type === "INCOME" ? "Income" : "Expense"} of GHS ${t.amount} recorded for "${t.description}"`,
    type: "TRANSACTION",
    branchId: t.branchId || "ALL",
    targetChurch: t.churchId || "ALL",
  }).catch(console.error);

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
  const isNew = idx < 0;
  if (idx >= 0) outreachSessions[idx] = session;
  else outreachSessions.push(session);

  memoryCache = { ...current, outreachSessions };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ outreachSessions });

  recordActivityNotification({
    message: isNew
      ? `New outreach session scheduled (${session.sessionType || "Outreach"})`
      : `Outreach session updated: ${session.outcome || session.status || "Completed"}`,
    type: "OUTREACH",
    branchId: session.branchId || "ALL",
  }).catch(console.error);
};

export const saveOutreachSessions = async (sessions: OutreachSession[]) => {
  if (!sessions || sessions.length === 0) return;
  const current = memoryCache || (await loadData());
  const outreachSessions = [...(current.outreachSessions || [])];

  sessions.forEach((session) => {
    const idx = outreachSessions.findIndex((x) => x.id === session.id);
    if (idx >= 0) outreachSessions[idx] = session;
    else outreachSessions.push(session);
  });

  memoryCache = { ...current, outreachSessions };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ outreachSessions });
};

export const deleteOutreachSession = async (id: string) => {
  const current = memoryCache || (await loadData());
  const outreachSessions = (current.outreachSessions || []).filter((s) => s.id !== id);
  memoryCache = { ...current, outreachSessions };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ outreachSessions });
};

export const savePrayerSlot = async (slot: PrayerSlot) => {
  const current = memoryCache || (await loadData());
  const prayerSchedule = [...(current.prayerSchedule || [])];
  const idx = prayerSchedule.findIndex((x) => x.id === slot.id);
  const isNew = idx < 0;
  if (idx >= 0) prayerSchedule[idx] = slot;
  else prayerSchedule.push(slot);

  memoryCache = { ...current, prayerSchedule };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ prayerSchedule });

  if (isNew || slot.isCompleted) {
    recordActivityNotification({
      message: slot.isCompleted
        ? `Prayer slot on ${slot.dayOfWeek || slot.date} marked completed`
        : `Prayer slot scheduled for ${slot.dayOfWeek || slot.date}`,
      type: "PRAYER",
      branchId: slot.branchId || "ALL",
    }).catch(console.error);
  }
};

export const savePrayerSlots = async (slots: PrayerSlot[]) => {
  if (!slots || slots.length === 0) return;
  const current = memoryCache || (await loadData());
  const prayerSchedule = [...(current.prayerSchedule || [])];

  slots.forEach((slot) => {
    const idx = prayerSchedule.findIndex((x) => x.id === slot.id);
    if (idx >= 0) prayerSchedule[idx] = slot;
    else prayerSchedule.push(slot);
  });

  memoryCache = { ...current, prayerSchedule };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ prayerSchedule });

  const completedCount = slots.filter((s) => s.isCompleted).length;
  if (completedCount > 0) {
    recordActivityNotification({
      message: `${completedCount} prayer ${completedCount === 1 ? "slot" : "slots"} marked completed`,
      type: "PRAYER",
      branchId: slots[0]?.branchId || "ALL",
    }).catch(console.error);
  }
};

export const deletePrayerSlot = async (id: string) => {
  const current = memoryCache || (await loadData());
  const prayerSchedule = (current.prayerSchedule || []).filter((s) => s.id !== id);
  memoryCache = { ...current, prayerSchedule };
  saveLocalCache(memoryCache);
  notifySubscribers(memoryCache);
  await updateMainDoc({ prayerSchedule });
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

    // Strictly filter to active, inconsistent, and not active members only (no FNFs or First Timers/Visitors)
    const eligibleMembers = targetMembers.filter(
      (m) =>
        m.type === MemberType.MEMBER &&
        (m.status === MemberStatus.ACTIVE ||
          m.status === MemberStatus.INCONSISTENT ||
          m.status === MemberStatus.NOT_ACTIVE)
    );

    if (eligibleMembers.length === 0) {
      return { success: false, message: "No active, inconsistent, or not active members available to assign for visitation." };
    }

    const visitCounts = new Map<string, number>();
    eligibleMembers.forEach((m) => visitCounts.set(m.id, 0));

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

      const sortedMembers = shuffleAndSort(eligibleMembers);
      const selectedMembers = sortedMembers.slice(0, 4);
      const selectedIds: string[] = selectedMembers.map((m) => m.id);

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
        branchId: eligibleMembers[0]?.branchId || eligibleMembers[0]?.assignedChurch || "ALL",
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
      message: "Generated visitation schedule successfully!",
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

    // Strictly filter to active, inconsistent, and not active members only (no FNFs or First Timers/Visitors)
    const eligibleMembers = targetMembers.filter(
      (m) =>
        m.type === MemberType.MEMBER &&
        (m.status === MemberStatus.ACTIVE ||
          m.status === MemberStatus.INCONSISTENT ||
          m.status === MemberStatus.NOT_ACTIVE)
    );

    if (eligibleMembers.length === 0) {
      return { success: false, message: "No active, inconsistent, or not active members available to generate prayer schedule." };
    }

    const prayerCounts = new Map<string, number>();
    eligibleMembers.forEach((m) => prayerCounts.set(m.id, 0));

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

      const sortedMembers = shuffleAndSort(eligibleMembers);
      const selectedMembers = sortedMembers.slice(0, 4);
      const selectedIds: string[] = selectedMembers.map((m) => m.id);

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
        branchId: eligibleMembers[0]?.branchId || eligibleMembers[0]?.assignedChurch || "ALL",
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
      message: "Generated weekly prayer schedule successfully!",
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to generate schedule." };
  }
};

export const authenticateUser = async (_u: string, _p: string) => {
  return { success: true, member: null as any, message: "" };
};
