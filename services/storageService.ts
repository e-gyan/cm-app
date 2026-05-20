import {
  AppData,
  Member,
  AttendanceRecord,
  MemberType,
  MemberStatus,
  Church,
  CloudConfig,
  Transaction,
  Notification,
  NotificationType,
  OutreachSession,
  PrayerSlot,
  Role,
  ServiceType,
  AppSettings,
} from "../types";
import {
  INITIAL_MEMBERS,
  INITIAL_ATTENDANCE,
  DEFAULT_CLOUD_CONFIG,
  DEFAULT_SETTINGS,
} from "../constants";
import {
  sanitizeInput,
  hashString,
  isValidSchema,
  hashPasscode,
  verifyPasscode,
} from "./securityService";

// STORAGE KEYS
const STORAGE_KEY = "UJ_CHURCH_DATA_2026_V5";
const SESSION_KEY = "UJ_CHURCH_SESSION_V1";
const LOGIN_ATTEMPTS_KEY = "UJ_LOGIN_ATTEMPTS";
const CLOUD_CONFIG_KEY = "UJ_CLOUD_CONFIG_V1";

// --- DATA LOADING & MIGRATION ---
const loadData = (): AppData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let parsed: AppData;

    if (stored) {
      parsed = JSON.parse(stored);
      // Ensure transactions exists if loaded from legacy data
      if (!parsed.transactions) parsed.transactions = [];
      if (!parsed.notifications) parsed.notifications = [];
      if (!parsed.targets) parsed.targets = { UJ: 0, I: 0, K: 0, LJ: 0 };
      if (!parsed.outreachSessions) parsed.outreachSessions = [];
      if (!parsed.prayerSchedule) parsed.prayerSchedule = [];
      if (!parsed.settings) parsed.settings = { ...DEFAULT_SETTINGS };
    } else {
      parsed = {
        members: [...INITIAL_MEMBERS],
        attendance: [...INITIAL_ATTENDANCE],
        transactions: [],
        notifications: [],
        outreachSessions: [],
        prayerSchedule: [],
        targets: { UJ: 0, I: 0, K: 0, LJ: 0 },
        settings: { ...DEFAULT_SETTINGS },
        lastUpdated: Date.now(),
      };
    }

    // --- SECURITY MIGRATION: HASH PLAIN TEXT PASSWORDS ---
    // If a passcode is short (e.g. "1234"), it's plaintext. SHA-256 hex is 64 chars.
    let migrationNeeded = false;

    // We can't await inside synchronous loadData, so we'll schedule it.
    // However, to ensure consistency, we check on usage.
    // For initial load, we assume if they are short they are legacy.

    // Migration Logic:
    let adminExists = false;
    parsed.members.forEach((m: any) => {
      if (!m.assignedChurch) m.assignedChurch = "UJ";
      if (!m.role) m.role = "NONE";

      // Ensure critical fields are sanitized even from local storage
      if (m.name) m.name = sanitizeInput(m.name);

      if (m.role === "ADMIN") {
        adminExists = true;
        if (m.id === "auto-admin" || m.id === "super-admin") {
          m.assignedChurch = "CM";
        }
      }
    });

    if (!adminExists) {
      parsed.members.push({
        id: "auto-admin",
        name: "Main Admin",
        type: MemberType.TEACHER,
        joinedDate: new Date().toISOString(),
        status: MemberStatus.ACTIVE,
        assignedChurch: "CM",
        role: "ADMIN",
        passcode: "2026", // Plaintext initially, will be hashed on auth or next save cycle logic
        isAccessActive: true,
      });
    }

    // Async Migration Trigger (Fire and forget, will persist on next save)
    (async () => {
      let hasUpdates = false;
      for (const m of parsed.members) {
        // Migrate Plaintext (len < 64) directly to PBKDF2
        if (m.passcode && m.passcode.length < 64) {
          m.passcode = await hashPasscode(m.passcode);
          hasUpdates = true;
        }
      }
      if (hasUpdates) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    })();

    return parsed;
  } catch (e) {
    console.error("Failed to load from local storage", e);
    return {
      members: [...INITIAL_MEMBERS],
      attendance: [...INITIAL_ATTENDANCE],
      transactions: [],
      notifications: [],
      outreachSessions: [],
      prayerSchedule: [],
      targets: { UJ: 0, I: 0, K: 0, LJ: 0 },
      settings: { ...DEFAULT_SETTINGS },
      lastUpdated: Date.now(),
    };
  }
};

let inMemoryData: AppData = loadData();

export const initializeRepository = async () => {
  if (!inMemoryData) {
    inMemoryData = loadData();
  }
  // Check for birthdays on init
  checkBirthdaysAndTeens();
};

// --- CLOUD SYNC SERVICE ---
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { handleFirestoreError, OperationType } from "./firebaseErrors";
import { isValidSchema } from "./securityService";
// DEBOUNCE TIMER
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export const syncToCloud = async (immediate = false): Promise<void> => {
  const performSync = async () => {
    try {
      const docRef = doc(db, "appData", "main");
      // Use the monolithic appData block to replace the single JSONbin.
      await setDoc(docRef, inMemoryData);
      console.log("Data synced to Firebase successfully.");
    } catch (e: any) {
      console.warn(`Failed to sync to Firebase: ${e.message}`);
      handleFirestoreError(e, OperationType.WRITE, "appData/main");
    }
  };

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  if (immediate) {
    return performSync();
  } else {
    syncTimer = setTimeout(() => performSync().catch(e => console.warn("Background sync failed", e)), 2000);
    return Promise.resolve();
  }
};

export const syncFromCloud = async (
  force: boolean = false,
): Promise<{ success: boolean; message?: string }> => {
  try {
    const docRef = doc(db, "appData", "main");
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
       return { success: true, message: "No cloud data found. Ready to push." };
    }

    const cloudData: AppData = docSnap.data() as AppData;

    // Security Check: Validate Schema of Cloud Data before merging
    if (!isValidSchema(cloudData)) {
      console.warn("Security Alert: Cloud data schema invalid.");
      return { success: false, message: "Cloud data corrupted or invalid." };
    }

    const localTime = inMemoryData.lastUpdated || 0;
    const cloudTime = cloudData.lastUpdated || 0;

    if (force || localTime === 0 || cloudTime > localTime) {
      cloudData.members.forEach((m) => (m.name = sanitizeInput(m.name)));
      if (!cloudData.targets) cloudData.targets = { UJ: 0, I: 0, K: 0, LJ: 0 };
      if (!cloudData.notifications) cloudData.notifications = [];
      if (!cloudData.outreachSessions) cloudData.outreachSessions = [];
      if (!cloudData.prayerSchedule) cloudData.prayerSchedule = [];
      if (!cloudData.settings) cloudData.settings = { ...DEFAULT_SETTINGS }; // Ensure settings

      inMemoryData = cloudData;
      persistData("NONE");
      return { success: true, message: "New data downloaded from Firebase" };
    } else {
      return { success: true, message: "Local data is up to date" };
    }
  } catch (e: any) {
    if (e.message && e.message.includes('missing or insufficient permissions') || e.code === 'permission-denied') {
        handleFirestoreError(e, OperationType.GET, "appData/main");
    }
    console.warn(`Failed to pull from Firebase: ${e.message}`);
    return {
      success: false,
      message: e.message || "Failed to connect to Firebase",
    };
  }
};

const persistData = (
  syncStrategy: "IMMEDIATE" | "DEBOUNCE" | "NONE" = "DEBOUNCE",
): Promise<void> => {
  try {
    inMemoryData.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));

    if (syncStrategy !== "NONE") {
      return syncToCloud(syncStrategy === "IMMEDIATE");
    }
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }
  return Promise.resolve();
};

let isDirty = false;

export const getAppData = (): AppData => {
  return inMemoryData;
};

export const updateSettings = (newSettings: AppSettings) => {
  inMemoryData.settings = newSettings;
  isDirty = true;
  persistData("IMMEDIATE");
};

// ... (Authentication, Import, Member Management) ...
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}
const getLoginAttempts = (): LoginAttempt => {
  const stored = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
  return stored
    ? JSON.parse(stored)
    : { count: 0, lastAttempt: 0, lockedUntil: null };
};
const saveLoginAttempts = (attempt: LoginAttempt) => {
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempt));
};
export const restoreSession = (): Member | null => {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);
    const now = Date.now();
    if (now - session.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const user = inMemoryData.members.find((m) => m.id === session.userId);
    if (
      user &&
      user.isAccessActive &&
      (user.role === "ADMIN" || user.role === "TEACHER")
    ) {
      return user;
    }
    localStorage.removeItem(SESSION_KEY);
    return null;
  } catch (e) {
    return null;
  }
};
export const logoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
};
export const authenticateUser = async (
  name: string,
  passcode: string,
  skipFailureRecord: boolean = false
): Promise<{ success: boolean; member?: Member; message?: string }> => {
  const attempts = getLoginAttempts();
  const now = Date.now();
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    const remainingMinutes = Math.ceil((attempts.lockedUntil - now) / 60000);
    return {
      success: false,
      message: `Account locked. Try again in ${remainingMinutes}m.`,
    };
  }
  if (now - attempts.lastAttempt > 10 * 60 * 1000) {
    attempts.count = 0;
    attempts.lockedUntil = null;
  }
  const cleanName = sanitizeInput(name);
  const user = inMemoryData.members.find(
    (m) =>
      (m.role === "ADMIN" || m.role === "TEACHER") &&
      m.name.toLowerCase().trim() === cleanName.toLowerCase().trim(),
  );
  if (!user) {
    return skipFailureRecord ? { success: false, message: "Invalid credentials." } : recordFailedAttempt(attempts);
  }
  if (!user.isAccessActive) {
    return { success: false, message: "Access deactivated. Contact Admin." };
  }
  let isValid = false;
  if (user.passcode && user.passcode.includes(":")) {
    isValid = await verifyPasscode(passcode, user.passcode);
  } else if (user.passcode && user.passcode.length === 64) {
    const inputHash = await hashString(passcode);
    if (user.passcode === inputHash) {
      isValid = true;
      user.passcode = await hashPasscode(passcode);
      persistData("IMMEDIATE");
    }
  } else if (user.passcode === passcode) {
    isValid = true;
    user.passcode = await hashPasscode(passcode);
    persistData("IMMEDIATE");
  }
  if (isValid) {
    localStorage.setItem(
      LOGIN_ATTEMPTS_KEY,
      JSON.stringify({ count: 0, lastAttempt: now, lockedUntil: null }),
    );
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ userId: user.id, timestamp: now }),
    );
    syncFromCloud(true);
    return { success: true, member: user };
  }
  return skipFailureRecord ? { success: false, message: "Invalid credentials." } : recordFailedAttempt(attempts);
};
const recordFailedAttempt = (attempts: LoginAttempt) => {
  const now = Date.now();
  attempts.count++;
  attempts.lastAttempt = now;
  if (attempts.count >= 5) {
    attempts.lockedUntil = now + 5 * 60 * 1000;
    saveLoginAttempts(attempts);
    return {
      success: false,
      message: "Too many failed attempts. Locked for 5m.",
    };
  }
  saveLoginAttempts(attempts);
  return { success: false, message: "Invalid credentials." };
};
export const importData = (
  jsonString: string,
): { success: boolean; message: string } => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!isValidSchema(parsed)) {
      return { success: false, message: "Invalid data file." };
    }
    parsed.members.forEach((m: any) => {
      if (m.name) m.name = sanitizeInput(m.name);
      if (!m.assignedChurch) m.assignedChurch = "UJ";
      if (!m.role) m.role = "NONE";
    });
    parsed.attendance.forEach((r: any) => {
      if (!r.churchId) r.churchId = "UJ";
    });
    parsed.lastUpdated = Date.now();
    if (!parsed.notifications) parsed.notifications = [];
    if (!parsed.targets) parsed.targets = { UJ: 0, I: 0, K: 0, LJ: 0 };
    if (!parsed.outreachSessions) parsed.outreachSessions = [];
    if (!parsed.prayerSchedule) parsed.prayerSchedule = [];
    if (!parsed.settings) parsed.settings = { ...DEFAULT_SETTINGS };
    inMemoryData = parsed;
    persistData("IMMEDIATE");
    isDirty = false;
    return { success: true, message: "Data imported successfully!" };
  } catch (e) {
    return { success: false, message: "Failed to parse JSON file." };
  }
};
export const addMember = (
  name: string,
  type: MemberType,
  assignedChurch: Church,
  birthDate: string = "",
  status: MemberStatus = MemberStatus.ACTIVE,
): Member => {
  const cleanName = sanitizeInput(name);
  const newMember: Member = {
    id: crypto.randomUUID(),
    name: cleanName,
    type,
    joinedDate: new Date().toISOString(),
    status,
    birthDate,
    assignedChurch,
    role: "NONE",
    isAccessActive: false,
  };
  inMemoryData.members.push(newMember);
  isDirty = true;
  persistData("DEBOUNCE");
  autoTransferMembersBasedOnAge();
  return newMember;
};
export const updateMember = async (updatedMember: Member) => {
  const index = inMemoryData.members.findIndex(
    (m) => m.id === updatedMember.id,
  );
  if (index !== -1) {
    updatedMember.name = sanitizeInput(updatedMember.name);
    if (
      updatedMember.passcode &&
      !updatedMember.passcode.includes(":") &&
      updatedMember.passcode.length < 64 &&
      updatedMember.role !== "NONE"
    ) {
      updatedMember.passcode = await hashPasscode(updatedMember.passcode);
    }
    inMemoryData.members[index] = updatedMember;
    isDirty = true;
    persistData("DEBOUNCE");
    autoTransferMembersBasedOnAge();
  }
};
export const deleteMember = (id: string) => {
  inMemoryData.members = inMemoryData.members.filter((m) => m.id !== id);
  isDirty = true;
  persistData("IMMEDIATE");
};
export const bulkArchiveMembers = (ids: string[]) => {
  let hasChanges = false;
  inMemoryData.members.forEach((member) => {
    if (ids.includes(member.id)) {
      member.status = MemberStatus.ARCHIVED;
      hasChanges = true;
    }
  });
  if (hasChanges) {
    isDirty = true;
    persistData("DEBOUNCE");
  }
};
const calculateAge = (birthDate: string) => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};
const autoTransferMembersBasedOnAge = () => {
  let transferChanges = false;
  const today = new Date();
  inMemoryData.members.forEach((member) => {
    if (member.assignedChurch === "CM") return;
    if (member.status !== MemberStatus.ACTIVE) return;
    if (member.type !== MemberType.MEMBER) return;
    if (!member.birthDate) return;
    const age = calculateAge(member.birthDate);
    let targetChurch: Church | "ARCHIVE" | null = null;
    if (age >= 0 && age <= 1) targetChurch = "I";
    else if (age >= 2 && age <= 5) targetChurch = "K";
    else if (age >= 6 && age <= 8) targetChurch = "LJ";
    else if (age >= 9 && age <= 13) targetChurch = "UJ";
    else if (age > 13) targetChurch = "ARCHIVE";
    if (targetChurch === "ARCHIVE" && member.assignedChurch === "UJ") {
      if (!member.transferPendingDate) {
        member.transferPendingDate = today.toISOString();
        transferChanges = true;
      } else {
        const pendingDate = new Date(member.transferPendingDate);
        const diffTime = Math.abs(today.getTime() - pendingDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) {
          member.status = MemberStatus.ARCHIVED;
          member.type = MemberType.NOT_MEMBER;
          member.transferPendingDate = undefined;
          transferChanges = true;
        }
      }
      return;
    }
    if (targetChurch && targetChurch !== "ARCHIVE") {
      if (member.assignedChurch !== targetChurch) {
        member.assignedChurch = targetChurch;
        transferChanges = true;
      }
    }
  });
  if (transferChanges) {
    isDirty = true;
    persistData("DEBOUNCE");
  }
};

// --- HELPER: NOTIFICATIONS ---
const addNotification = (
  type: NotificationType,
  message: string,
  churchId: Church,
  memberId?: string,
) => {
  const exists = inMemoryData.notifications.some(
    (n) =>
      n.relatedMemberId === memberId &&
      n.type === type &&
      n.message === message &&
      Date.now() - new Date(n.createdAt).getTime() < 24 * 60 * 60 * 1000,
  );
  if (exists) return;

  const newNotif: Notification = {
    id: crypto.randomUUID(),
    type,
    message,
    createdAt: new Date().toISOString(),
    targetChurch: churchId,
    relatedMemberId: memberId,
    isRead: false,
  };
  inMemoryData.notifications.unshift(newNotif);

  if (inMemoryData.notifications.length > 50) {
    inMemoryData.notifications = inMemoryData.notifications.slice(0, 50);
  }
};

const checkAndAutoUpdateMemberStatus = (churchId: Church) => {
  if (churchId === "CM") return;

  const sortedAttendance = inMemoryData.attendance
    .filter((r) => r.churchId === churchId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedAttendance.length < 3) return; // Need at least 3 for smallest check
  const churchMembers = inMemoryData.members.filter(
    (m) => m.assignedChurch === churchId,
  );

  churchMembers.forEach((member) => {
    // Skip staff, archived, transferred
    if (["Teacher", "Helper", "Volunteer", "Admin"].includes(member.type))
      return;
    if (
      member.status === MemberStatus.ARCHIVED ||
      member.status === MemberStatus.TRANSFERRED
    )
      return;

    // 1. ACTIVATION / REACTIVATION
    if (member.status === MemberStatus.NOT_ACTIVE) {
      // FNF Specific Activation: 3 Consecutive
      if (member.type === MemberType.FNF) {
        if (sortedAttendance.length >= 3) {
          const last3 = sortedAttendance.slice(0, 3);
          const presentInAll3 = last3.every((r) =>
            r.presentMemberIds.includes(member.id),
          );

          if (presentInAll3) {
            member.status = MemberStatus.ACTIVE;
            addNotification(
              "STATUS_CHANGE",
              `${member.name} marked Active! (3 consecutive visits)`,
              churchId,
              member.id,
            );
            isDirty = true;
            return; // Move to next member
          }
        }
      }
      // Regular Member Reactivation: 4 Consecutive
      else if (sortedAttendance.length >= 4) {
        const last4 = sortedAttendance.slice(0, 4);
        const presentInAll4 = last4.every((r) =>
          r.presentMemberIds.includes(member.id),
        );

        if (presentInAll4) {
          member.status = MemberStatus.ACTIVE;
          member.type = MemberType.MEMBER;
          addNotification(
            "STATUS_CHANGE",
            `${member.name} reactivated! (4 consecutive attendances)`,
            churchId,
            member.id,
          );
          isDirty = true;
          return;
        }
      }
    }

    // 2. PROMOTION: FNF -> Member (7 consecutive attendances)
    if (
      member.type === MemberType.FNF &&
      member.status === MemberStatus.ACTIVE
    ) {
      if (sortedAttendance.length >= 7) {
        const last7 = sortedAttendance.slice(0, 7);
        const presentInAll7 = last7.every((r) =>
          r.presentMemberIds.includes(member.id),
        );

        if (presentInAll7) {
          member.type = MemberType.MEMBER;
          addNotification(
            "PROMOTION",
            `${member.name} promoted to Full Member! (7 consecutive attendances)`,
            churchId,
            member.id,
          );
          isDirty = true;
          return;
        }
      }
    }

    // 3. DEACTIVATION: Active -> Not Active (7 consecutive absences)
    // This applies to both MEMBERS and FNF who are currently ACTIVE
    if (member.status === MemberStatus.ACTIVE) {
      if (sortedAttendance.length >= 7) {
        const last7 = sortedAttendance.slice(0, 7);
        // Check if the member existed during these 7 sessions (joined before the oldest of the 7)
        const oldestInWindow = new Date(last7[last7.length - 1].date);
        const joinedDate = new Date(member.joinedDate);

        if (joinedDate <= oldestInWindow) {
          const absentAll7 = last7.every(
            (r) => !r.presentMemberIds.includes(member.id),
          );

          if (absentAll7) {
            member.status = MemberStatus.NOT_ACTIVE;
            if (member.type === MemberType.MEMBER) {
              member.type = MemberType.INCONSISTENT;
            }
            addNotification(
              "STATUS_CHANGE",
              `${member.name} marked Not Active (7 consecutive absences).`,
              churchId,
              member.id,
            );
            isDirty = true;
          }
        }
      }
    }
  });

  if (isDirty) persistData("DEBOUNCE");
};

export const checkBirthdaysAndTeens = () => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const year = today.getFullYear();
  const todayStr = today.toISOString().split("T")[0];
  inMemoryData.members.forEach((m) => {
    if (m.status !== MemberStatus.ACTIVE || !m.birthDate) return;
    const birth = new Date(m.birthDate);
    if (birth.getDate() === currentDay && birth.getMonth() === currentMonth) {
      const exists = inMemoryData.notifications.some(
        (n) =>
          n.type === "BIRTHDAY" &&
          n.relatedMemberId === m.id &&
          n.createdAt.startsWith(todayStr),
      );
      if (!exists) {
        inMemoryData.notifications.push({
          id: crypto.randomUUID(),
          type: "BIRTHDAY",
          message: `It's ${m.name}'s birthday today!`,
          createdAt: today.toISOString(),
          targetChurch: m.assignedChurch,
          relatedMemberId: m.id,
          isRead: false,
        });
        isDirty = true;
      }
    }
    let age = year - birth.getFullYear();
    const mMonth = today.getMonth() - birth.getMonth();
    if (mMonth < 0 || (mMonth === 0 && today.getDate() < birth.getDate()))
      age--;
    if (age === 13) {
      const exists = inMemoryData.notifications.some(
        (n) =>
          n.type === "TEEN_ALERT" &&
          n.relatedMemberId === m.id &&
          n.createdAt.startsWith(year.toString()),
      );
      if (!exists) {
        inMemoryData.notifications.push({
          id: crypto.randomUUID(),
          type: "TEEN_ALERT",
          message: `${m.name} is 13. Transition to Youth?`,
          createdAt: today.toISOString(),
          targetChurch: m.assignedChurch,
          relatedMemberId: m.id,
          isRead: false,
        });
        isDirty = true;
      }
    }
  });
  if (isDirty) persistData("DEBOUNCE");
};
export const updateTargets = (targets: Record<string, number>) => {
  inMemoryData.targets = targets;
  isDirty = true;
  persistData("IMMEDIATE");
};
export const markNotificationAsRead = (id: string) => {
  const note = inMemoryData.notifications.find((n) => n.id === id);
  if (note) {
    note.isRead = true;
    isDirty = true;
    persistData("DEBOUNCE");
  }
};
export const clearAllNotifications = (church: Church) => {
  if (church === "CM") {
    inMemoryData.notifications = [];
  } else {
    inMemoryData.notifications = inMemoryData.notifications.filter(
      (n) => n.targetChurch !== church,
    );
  }
  isDirty = true;
  persistData("IMMEDIATE");
};
export const addTransaction = (txn: Partial<Transaction>) => {
  if (!txn.amount || !txn.category || !txn.type) return;
  const newTxn: Transaction = {
    id: crypto.randomUUID(),
    date: txn.date || new Date().toISOString().split("T")[0],
    amount: Number(txn.amount),
    type: txn.type,
    category: txn.category,
    description: txn.description || "",
    churchId: txn.churchId || "UJ",
    recordedBy: txn.recordedBy || "System",
  };
  if (!inMemoryData.transactions) inMemoryData.transactions = [];
  inMemoryData.transactions.push(newTxn);
  isDirty = true;
  persistData("IMMEDIATE");
};
export const deleteTransaction = (id: string) => {
  if (!inMemoryData.transactions) return;
  inMemoryData.transactions = inMemoryData.transactions.filter(
    (t) => t.id !== id,
  );
  isDirty = true;
  persistData("IMMEDIATE");
};
export const saveOutreachSession = (session: OutreachSession) => {
  if (!inMemoryData.outreachSessions) inMemoryData.outreachSessions = [];
  const idx = inMemoryData.outreachSessions.findIndex(
    (s) => s.id === session.id,
  );
  if (!session.visitedMemberIds) session.visitedMemberIds = [];
  if (idx >= 0) inMemoryData.outreachSessions[idx] = session;
  else inMemoryData.outreachSessions.push(session);
  isDirty = true;
  return persistData("IMMEDIATE");
};
export const deleteOutreachSession = async (id: string) => {
  if (!inMemoryData.outreachSessions) return;
  inMemoryData.outreachSessions = inMemoryData.outreachSessions.filter(
    (s) => s.id !== id,
  );
  isDirty = true;
  await persistData("IMMEDIATE");
};

export const saveAttendance = (
  date: string,
  churchId: Church,
  presentIds: string[],
  punctualIds: string[],
  serviceMap?: Record<string, ServiceType>,
  eventName?: string,
) => {
  const existingIndex = inMemoryData.attendance.findIndex(
    (r) => r.date === date && r.churchId === churchId,
  );
  const record: AttendanceRecord = {
    date,
    churchId,
    presentMemberIds: presentIds,
    punctualMemberIds: punctualIds,
    serviceMap: serviceMap, // Persist the service map
    eventName: eventName,
  };
  if (existingIndex >= 0) {
    inMemoryData.attendance[existingIndex] = record;
  } else {
    inMemoryData.attendance.push(record);
  }
  isDirty = true;
  persistData("DEBOUNCE");
  if (churchId !== "CM") {
    checkAndAutoUpdateMemberStatus(churchId);
  }
  autoTransferMembersBasedOnAge();
};

export const savePrayerSlot = (slot: PrayerSlot) => {
  if (!inMemoryData.prayerSchedule) inMemoryData.prayerSchedule = [];
  const idx = inMemoryData.prayerSchedule.findIndex((s) => s.id === slot.id);
  if (idx >= 0) inMemoryData.prayerSchedule[idx] = slot;
  else inMemoryData.prayerSchedule.push(slot);
  isDirty = true;
  return persistData("IMMEDIATE");
};

export const generateOutreachSchedule = (
  dates: string[],
  members: Member[],
): { success: boolean; message: string; data?: OutreachSession[] } => {
  if (dates.length === 0 || members.length === 0)
    return { success: false, message: "No dates or members." };
  if (!inMemoryData.outreachSessions) inMemoryData.outreachSessions = [];

  const existingDates = inMemoryData.outreachSessions.map((s) => s.date);
  const duplicates = dates.filter((d) => existingDates.includes(d));
  if (duplicates.length > 0)
    return { success: false, message: `Dates already exist.` };

  const today = new Date().toISOString().split("T")[0];
  const missedMemberIds = new Set<string>();

  // INTERVAL LOGIC: Exclude members visited in the last 60 days
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
  const recentVisitedIds = new Set<string>();

  inMemoryData.outreachSessions.forEach((session) => {
    // Collect missed visits from pending past sessions
    if (session.date < today && session.status !== "COMPLETED") {
      const visited = session.visitedMemberIds || [];
      session.assignedMemberIds.forEach((id) => {
        if (!visited.includes(id)) missedMemberIds.add(id);
      });
    }

    // Collect recently visited members (to exclude from rotation)
    // We consider any visit in the record as a "touch point", regardless of session completion status
    if (new Date(session.date) >= twoMonthsAgo && session.visitedMemberIds) {
      session.visitedMemberIds.forEach((id) => recentVisitedIds.add(id));
    }
  });

  const missedMembers = members.filter((m) => missedMemberIds.has(m.id));

  // General Pool: Exclude those already missed (handled above) AND those recently visited
  const generalPool = members.filter(
    (m) => !missedMemberIds.has(m.id) && !recentVisitedIds.has(m.id),
  );

  const active = generalPool.filter(
    (m) => m.status === MemberStatus.ACTIVE && m.type === MemberType.MEMBER,
  );
  const fnf = generalPool.filter((m) => m.type === MemberType.FNF);
  const inconsistent = generalPool.filter(
    (m) =>
      m.type === MemberType.INCONSISTENT ||
      m.status === MemberStatus.NOT_ACTIVE,
  );

  const shuffle = (array: Member[]) => array.sort(() => Math.random() - 0.5);

  shuffle(active);
  shuffle(fnf);
  shuffle(inconsistent);

  const priorityQueue = [...missedMembers]; // Missed members skip the rotation filter to ensure they are caught up

  let dateIndex = 0;
  while (dateIndex < dates.length) {
    if (
      priorityQueue.length === 0 &&
      active.length === 0 &&
      fnf.length === 0 &&
      inconsistent.length === 0
    )
      break;

    const group: string[] = [];
    const slotsPerDay = 4;

    // 1. Fill with Priority (Missed) first
    while (group.length < slotsPerDay && priorityQueue.length > 0) {
      group.push(priorityQueue.shift()!.id);
    }

    // 2. Ensure Mix: 2 Active, 1 FNF, 1 Inconsistent (if slots available)
    if (group.length < slotsPerDay) {
      // Need 1 Inconsistent
      if (
        inconsistent.length > 0 &&
        !group.some(
          (id) =>
            members.find((m) => m.id === id)?.type === MemberType.INCONSISTENT,
        )
      ) {
        group.push(inconsistent.shift()!.id);
      }

      // Need 1 FNF
      if (
        group.length < slotsPerDay &&
        fnf.length > 0 &&
        !group.some(
          (id) => members.find((m) => m.id === id)?.type === MemberType.FNF,
        )
      ) {
        group.push(fnf.shift()!.id);
      }

      // Need 2 Active
      let activeCount = group.filter(
        (id) => members.find((m) => m.id === id)?.type === MemberType.MEMBER,
      ).length;
      while (
        group.length < slotsPerDay &&
        activeCount < 2 &&
        active.length > 0
      ) {
        group.push(active.shift()!.id);
        activeCount++;
      }

      // 3. Fill Remainder with any available type if specific pools exhausted
      while (group.length < slotsPerDay) {
        if (active.length > 0) group.push(active.shift()!.id);
        else if (fnf.length > 0) group.push(fnf.shift()!.id);
        else if (inconsistent.length > 0) group.push(inconsistent.shift()!.id);
        else break;
      }
    }

    if (group.length > 0) {
      inMemoryData.outreachSessions.push({
        id: crypto.randomUUID(),
        date: dates[dateIndex],
        startTime: "10:00",
        endTime: "15:00",
        assignedMemberIds: group,
        visitedMemberIds: [],
        status: "PENDING",
      });
    }
    dateIndex++;
  }

  isDirty = true;
  persistData("IMMEDIATE");
  return {
    success: true,
    message: `Scheduled ${dates.length} visits.`,
    data: inMemoryData.outreachSessions,
  };
};

export const generatePrayerSchedule = (
  startWeekDate: Date,
  members: Member[],
): { success: boolean; message: string; data?: PrayerSlot[] } => {
  if (!inMemoryData.prayerSchedule) inMemoryData.prayerSchedule = [];
  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();

  // 1. FAIRNESS: Calculate how many times each member has been prayed for THIS YEAR
  const prayerCounts: Record<string, number> = {};
  members.forEach((m) => (prayerCounts[m.id] = 0)); // Init all

  inMemoryData.prayerSchedule.forEach((slot) => {
    if (new Date(slot.date).getFullYear() === currentYear) {
      slot.assignedMemberIds.forEach((id) => {
        if (prayerCounts[id] !== undefined) {
          prayerCounts[id]++;
        }
      });
    }
  });

  // 2. Identify Missed/Expired Slots (Priority 1)
  const missedIds = new Set<string>();
  inMemoryData.prayerSchedule.forEach((slot) => {
    if (slot.date < today && !slot.isCompleted) {
      slot.assignedMemberIds.forEach((id) => missedIds.add(id));
    }
  });

  const allowedTypes = [
    MemberType.MEMBER,
    MemberType.FNF,
    MemberType.INCONSISTENT,
  ];

  // 3. Create Pools
  const missedMembers = members.filter(
    (m) =>
      missedIds.has(m.id) &&
      allowedTypes.includes(m.type) &&
      m.status !== MemberStatus.ARCHIVED,
  );
  const cleanMembers = members.filter(
    (m) =>
      !missedIds.has(m.id) &&
      allowedTypes.includes(m.type) &&
      m.status !== MemberStatus.ARCHIVED,
  );

  // Filter pools
  let active = cleanMembers.filter(
    (m) => m.type === MemberType.MEMBER && m.status === MemberStatus.ACTIVE,
  );
  let fnf = cleanMembers.filter((m) => m.type === MemberType.FNF);
  let inconsistent = cleanMembers.filter(
    (m) =>
      m.type === MemberType.INCONSISTENT ||
      (m.status === MemberStatus.NOT_ACTIVE && allowedTypes.includes(m.type)),
  );

  // 4. FAIRNESS SORTING: Sort by Prayer Count (ASC) to prioritize those with fewest prayers
  const sortByFairness = (arr: Member[]) => {
    return arr.sort((a, b) => {
      const countDiff = (prayerCounts[a.id] || 0) - (prayerCounts[b.id] || 0);
      if (countDiff !== 0) return countDiff;
      return Math.random() - 0.5; // If counts equal, shuffle randomly
    });
  };

  active = sortByFairness(active);
  fnf = sortByFairness(fnf);
  inconsistent = sortByFairness(inconsistent);

  // Priority Pool is also sorted fairly
  const priorityPool = sortByFairness(missedMembers);

  const days = 5; // Mon-Fri
  let generatedCount = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(startWeekDate);
    d.setDate(startWeekDate.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    // Skip if already generated for this date
    if (inMemoryData.prayerSchedule.some((s) => s.date === dateStr)) continue;

    const dailyIds: Set<string> = new Set();
    const TARGET_PER_DAY = 5;

    // Fill with Missed first
    while (priorityPool.length > 0 && dailyIds.size < TARGET_PER_DAY) {
      dailyIds.add(priorityPool.shift()!.id);
    }

    // Helper to get next best candidate
    const getFromPool = (pool: Member[], source: Member[]): Member | null => {
      if (pool.length === 0) return null;

      // Try to get top candidate (lowest prayer count)
      let candidate = pool.shift();

      // Ensure not already added today
      let tries = 0;
      while (candidate && dailyIds.has(candidate.id) && tries < source.length) {
        pool.push(candidate); // Put back at end
        candidate = pool.shift();
        tries++;
      }

      return !candidate || dailyIds.has(candidate.id) ? null : candidate;
    };

    // Strategy: Try to include at least 1 FNF and 1 Inconsistent if available, then fill with Active
    // This ensures variety even if Active members have lower counts overall
    if (dailyIds.size < TARGET_PER_DAY) {
      const hasFNF = Array.from(dailyIds).some(
        (id) => members.find((m) => m.id === id)?.type === MemberType.FNF,
      );
      if (!hasFNF) {
        const m = getFromPool(
          fnf,
          members.filter((x) => x.type === MemberType.FNF),
        );
        if (m) dailyIds.add(m.id);
      }
    }

    if (dailyIds.size < TARGET_PER_DAY) {
      const hasInc = Array.from(dailyIds).some(
        (id) =>
          members.find((m) => m.id === id)?.type === MemberType.INCONSISTENT,
      );
      if (!hasInc) {
        const m = getFromPool(
          inconsistent,
          members.filter((x) => x.type === MemberType.INCONSISTENT),
        );
        if (m) dailyIds.add(m.id);
      }
    }

    // Fill remainder primarily with Active, then fallback to others
    const combinedPool = sortByFairness([...active, ...fnf, ...inconsistent]);

    while (dailyIds.size < TARGET_PER_DAY && combinedPool.length > 0) {
      const m = combinedPool.shift();
      if (m && !dailyIds.has(m.id)) {
        dailyIds.add(m.id);
      }
    }

    if (dailyIds.size > 0) {
      inMemoryData.prayerSchedule.push({
        id: crypto.randomUUID(),
        date: dateStr,
        dayOfWeek: d.toLocaleDateString("en-US", { weekday: "long" }),
        assignedMemberIds: Array.from(dailyIds),
        isCompleted: false,
        durationMins: 30,
      });
      generatedCount++;
    }
  }

  isDirty = true;
  persistData("IMMEDIATE");
  return {
    success: true,
    message: `Generated ${generatedCount} days. ${missedIds.size > 0 ? `Inc. ${missedIds.size} missed prayers.` : ""}`,
    data: inMemoryData.prayerSchedule,
  };
};
