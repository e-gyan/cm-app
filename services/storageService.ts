import { AppData, Member, AttendanceRecord, MemberType, MemberStatus, Church, CloudConfig, Transaction, Notification, NotificationType, OutreachSession, PrayerSlot } from '../types';
import { INITIAL_MEMBERS, INITIAL_ATTENDANCE, DEFAULT_CLOUD_CONFIG } from '../constants';
import { sanitizeInput, hashString, isValidSchema, hashPasscode, verifyPasscode } from './securityService';

// STORAGE KEYS
const STORAGE_KEY = 'UJ_CHURCH_DATA_2026_V5'; 
const SESSION_KEY = 'UJ_CHURCH_SESSION_V1';
const LOGIN_ATTEMPTS_KEY = 'UJ_LOGIN_ATTEMPTS';
const CLOUD_CONFIG_KEY = 'UJ_CLOUD_CONFIG_V1';

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
      if (!parsed.outreachSessions) parsed.outreachSessions = []; // Init Outreach
      if (!parsed.prayerSchedule) parsed.prayerSchedule = []; // Init Prayer
      if (!parsed.targets) parsed.targets = { UJ: 0, I: 0, K: 0, LJ: 0 };
    } else {
      parsed = {
        members: [...INITIAL_MEMBERS],
        attendance: [...INITIAL_ATTENDANCE],
        transactions: [],
        notifications: [],
        outreachSessions: [],
        prayerSchedule: [],
        targets: { UJ: 0, I: 0, K: 0, LJ: 0 },
        lastUpdated: 0 
      };
    }

    // --- SECURITY MIGRATION: HASH PLAIN TEXT PASSWORDS ---
    let adminExists = false;
    parsed.members.forEach((m: any) => {
        if (!m.assignedChurch) m.assignedChurch = 'UJ';
        if (!m.role) m.role = 'NONE';
        
        // Ensure critical fields are sanitized even from local storage
        if (m.name) m.name = sanitizeInput(m.name);

        if (m.role === 'ADMIN') {
             adminExists = true;
             if (m.id === 'auto-admin' || m.id === 'super-admin') {
                 m.assignedChurch = 'CM';
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
            passcode: "2026", 
            isAccessActive: true
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
        lastUpdated: 0
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
const getCloudConfig = (): CloudConfig | null => {
    // 1. Check for Env Var / Constants (Prioritize Code)
    if (DEFAULT_CLOUD_CONFIG.apiKey && DEFAULT_CLOUD_CONFIG.binId) {
        return {
            enabled: true, 
            apiKey: DEFAULT_CLOUD_CONFIG.apiKey,
            binId: DEFAULT_CLOUD_CONFIG.binId,
            url: 'https://api.jsonbin.io/v3/b'
        };
    }

    // 2. Fallback to Local Storage Config
    const stored = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (stored) {
        return JSON.parse(stored);
    }

    return null;
};

export const saveCloudConfig = (config: CloudConfig) => {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    if (config.enabled) {
        syncFromCloud(true); // Force sync when saving new config
    }
};

// Helper to handle the "Master Key" vs "Access Key" header ambiguity in JSONBin V3
const fetchWithRetryHeaders = async (url: string, method: string, apiKey: string, body?: string) => {
    const headersMaster = {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey
    };

    try {
        // Attempt 1: Try with Master Key
        let response = await fetch(url, { method, headers: headersMaster, body });
        
        // Attempt 2: If unauthorized (401) or Forbidden (403), try with Access Key
        if (response.status === 401 || response.status === 403) {
            const headersAccess = {
                'Content-Type': 'application/json',
                'X-Access-Key': apiKey
            };
            response = await fetch(url, { method, headers: headersAccess, body });
        }
        return response;
    } catch (e) {
        // Re-throw to be caught by the caller
        throw e;
    }
};

// DEBOUNCE TIMER
let syncTimer: ReturnType<typeof setTimeout> | null = null;

const syncToCloud = async (immediate = false): Promise<void> => {
    const config = getCloudConfig();
    if (!config || !config.enabled || !config.apiKey || !config.binId) return Promise.resolve();

    const performSync = async () => {
        try {
            await fetchWithRetryHeaders(
                `${config.url}/${config.binId}`, 
                'PUT', 
                config.apiKey, 
                JSON.stringify(inMemoryData)
            );
            console.log("Data synced to cloud successfully.");
        } catch (e) {
            console.error("Failed to sync to cloud", e);
        }
    };

    if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
    }

    if (immediate) {
        return performSync();
    } else {
        // Debounce for 2 seconds to allow multiple quick actions (checking boxes)
        syncTimer = setTimeout(performSync, 2000); 
        return Promise.resolve();
    }
};

export const syncFromCloud = async (force: boolean = false): Promise<{success: boolean, message?: string}> => {
    const config = getCloudConfig();
    if (!config || !config.enabled || !config.apiKey || !config.binId) {
        return { success: false, message: 'Cloud not configured' };
    }

    try {
        // We append a timestamp to prevent caching issues
        const response = await fetchWithRetryHeaders(
            `${config.url}/${config.binId}?t=${Date.now()}`, 
            'GET', 
            config.apiKey
        );
        
        if (!response.ok) {
            if (response.status === 404) throw new Error("Bin ID not found. Check Configuration.");
            if (response.status === 401 || response.status === 403) throw new Error("Invalid API Key.");
            throw new Error(`Cloud fetch failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const cloudData: AppData = result.record || result; 
        
        if (!isValidSchema(cloudData)) {
            console.error("Security Alert: Cloud data schema invalid.");
            return { success: false, message: 'Cloud data corrupted or invalid.' };
        }

        const localTime = inMemoryData.lastUpdated || 0;
        const cloudTime = cloudData.lastUpdated || 0;

        // Sync Logic:
        // 1. If force is TRUE, always accept cloud (Login scenario)
        // 2. If local is 0 (fresh install/reset), always accept cloud.
        // 3. If cloud is newer than local, accept cloud.
        if (force || localTime === 0 || cloudTime > localTime) {
            cloudData.members.forEach(m => m.name = sanitizeInput(m.name));
            if (!cloudData.targets) cloudData.targets = { UJ: 0, I: 0, K: 0, LJ: 0 }; 
            if (!cloudData.notifications) cloudData.notifications = [];
            if (!cloudData.outreachSessions) cloudData.outreachSessions = [];
            if (!cloudData.prayerSchedule) cloudData.prayerSchedule = [];
            
            inMemoryData = cloudData;
            persistData('NONE'); // Save to local storage without pushing back to cloud
            return { success: true, message: 'New data downloaded from cloud' };
        } else {
            return { success: true, message: 'Local data is up to date' };
        }
    } catch (e: any) {
        console.error("Failed to pull from cloud", e);
        return { success: false, message: e.message || 'Failed to connect to cloud' };
    }
};

const persistData = (syncStrategy: 'IMMEDIATE' | 'DEBOUNCE' | 'NONE' = 'DEBOUNCE'): Promise<void> => {
  try {
    inMemoryData.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
    
    if (syncStrategy !== 'NONE') {
        return syncToCloud(syncStrategy === 'IMMEDIATE');
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

// --- NOTIFICATION SYSTEM ---
const addNotification = (type: NotificationType, message: string, targetChurch: Church, memberId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const exists = inMemoryData.notifications.find(n => 
        n.type === type && 
        n.relatedMemberId === memberId && 
        n.createdAt.startsWith(today)
    );

    if (!exists) {
        inMemoryData.notifications.unshift({
            id: crypto.randomUUID(),
            type,
            message,
            createdAt: new Date().toISOString(),
            targetChurch,
            relatedMemberId: memberId,
            isRead: false
        });
        if (inMemoryData.notifications.length > 50) {
            inMemoryData.notifications = inMemoryData.notifications.slice(0, 50);
        }
        isDirty = true;
    }
};

export const markNotificationAsRead = (id: string) => {
    const note = inMemoryData.notifications.find(n => n.id === id);
    if (note) {
        note.isRead = true;
        isDirty = true;
        persistData('DEBOUNCE');
    }
};

export const clearAllNotifications = (churchId: Church) => {
    let changed = false;
    inMemoryData.notifications.forEach(n => {
        if ((n.targetChurch === churchId || churchId === 'CM') && !n.isRead) {
            n.isRead = true;
            changed = true;
        }
    });
    if (changed) {
        isDirty = true;
        persistData('DEBOUNCE');
    }
};

const checkBirthdaysAndTeens = () => {
    if (!inMemoryData.members) return;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    inMemoryData.members.forEach(m => {
        if (!m.birthDate || m.status !== MemberStatus.ACTIVE) return;
        const birth = new Date(m.birthDate);
        const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        if (thisYearBirthday < today) thisYearBirthday.setFullYear(today.getFullYear() + 1);
        
        const diffTime = thisYearBirthday.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7 && diffDays >= 0) {
            const alreadyNotified = inMemoryData.notifications.some(n => 
                n.type === 'BIRTHDAY' && 
                n.relatedMemberId === m.id && 
                new Date(n.createdAt).getFullYear() === today.getFullYear()
            );

            if (!alreadyNotified) {
                const dayText = diffDays === 0 ? 'TODAY!' : `in ${diffDays} days.`;
                addNotification('BIRTHDAY', `🎂 ${m.name}'s birthday is ${dayText}`, m.assignedChurch, m.id);
            }
        }

        const age = today.getFullYear() - birth.getFullYear();
        if (age === 12 && diffDays <= 7 && diffDays >= 0) {
             const alreadyNotifiedTeen = inMemoryData.notifications.some(n => n.type === 'TEEN_ALERT' && n.relatedMemberId === m.id);
            if (!alreadyNotifiedTeen) {
                addNotification('TEEN_ALERT', `🎓 Teen Alert: ${m.name} turns 13 in ${diffDays} days! Prepare for graduation.`, m.assignedChurch, m.id);
            }
        }
    });
    if (isDirty) persistData('DEBOUNCE');
};

// --- AUTHENTICATION & SECURITY ---
interface LoginAttempt {
    count: number;
    lastAttempt: number;
    lockedUntil: number | null;
}

const getLoginAttempts = (): LoginAttempt => {
    const stored = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    return stored ? JSON.parse(stored) : { count: 0, lastAttempt: 0, lockedUntil: null };
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
        const user = inMemoryData.members.find(m => m.id === session.userId);
        if (user && user.isAccessActive && (user.role === 'ADMIN' || user.role === 'TEACHER')) {
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

export const authenticateUser = async (name: string, passcode: string): Promise<{ success: boolean, member?: Member, message?: string }> => {
    const attempts = getLoginAttempts();
    const now = Date.now();

    if (attempts.lockedUntil && now < attempts.lockedUntil) {
        const remainingMinutes = Math.ceil((attempts.lockedUntil - now) / 60000);
        return { success: false, message: `Too many failed attempts. Try again in ${remainingMinutes} minutes.` };
    }

    if (now - attempts.lastAttempt > 10 * 60 * 1000) {
        attempts.count = 0;
        attempts.lockedUntil = null;
    }

    const cleanName = sanitizeInput(name);
    const user = inMemoryData.members.find(m => 
        (m.role === 'ADMIN' || m.role === 'TEACHER') && 
        m.name.toLowerCase().trim() === cleanName.toLowerCase().trim()
    );

    if (!user) {
        return recordFailedAttempt(attempts);
    }
    if (!user.isAccessActive) {
        return { success: false, message: "Access deactivated. Contact Admin." };
    }

    let isValid = false;
    let needsUpgrade = false;

    // SCENARIO 1: Plaintext Legacy (len < 64)
    if (user.passcode && user.passcode.length < 64) {
        if (user.passcode === passcode) {
            isValid = true;
            needsUpgrade = true;
        }
    } 
    // SCENARIO 2: SHA-256 Legacy (len == 64)
    else if (user.passcode && user.passcode.length === 64) {
        const inputHash = await hashString(passcode);
        if (user.passcode === inputHash) {
            isValid = true;
            needsUpgrade = true;
        }
    }
    // SCENARIO 3: PBKDF2 Modern (len > 64, specifically 32(salt) + 1(:) + 64(key) = 97)
    else {
        isValid = await verifyPasscode(passcode, user.passcode || '');
    }

    if (isValid) {
        if (needsUpgrade) {
            user.passcode = await hashPasscode(passcode);
            persistData('IMMEDIATE');
        }

        localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({ count: 0, lastAttempt: now, lockedUntil: null }));
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, timestamp: now }));
        syncFromCloud(); // Trigger background sync after login as well
        return { success: true, member: user };
    }

    return recordFailedAttempt(attempts);
};

const recordFailedAttempt = (attempts: LoginAttempt) => {
    const now = Date.now();
    attempts.count++;
    attempts.lastAttempt = now;

    if (attempts.count >= 5) {
        attempts.lockedUntil = now + 5 * 60 * 1000;
        saveLoginAttempts(attempts);
        return { success: false, message: "Too many failed attempts. Account locked for 5 minutes." };
    }
    saveLoginAttempts(attempts);
    return { success: false, message: "Invalid credentials." };
};

// --- DATA IMPORT/EXPORT ---
export const importData = (jsonString: string): { success: boolean; message: string } => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!isValidSchema(parsed)) {
        return { success: false, message: "Security Warning: Invalid or malformed data file." };
    }
    parsed.members.forEach((m: any) => {
        if (m.name) m.name = sanitizeInput(m.name);
        if (!m.assignedChurch) m.assignedChurch = 'UJ';
        if (!m.role) m.role = 'NONE';
    });
    parsed.attendance.forEach((r: any) => {
        if (!r.churchId) r.churchId = 'UJ';
    });
    parsed.lastUpdated = Date.now();
    if (!parsed.notifications) parsed.notifications = [];
    if (!parsed.outreachSessions) parsed.outreachSessions = [];
    if (!parsed.prayerSchedule) parsed.prayerSchedule = [];
    if (!parsed.targets) parsed.targets = { UJ: 0, I: 0, K: 0, LJ: 0 };

    inMemoryData = parsed;
    persistData('IMMEDIATE'); 
    isDirty = false;
    return { success: true, message: "Data imported successfully!" };
  } catch (e) {
    return { success: false, message: "Failed to parse JSON file." };
  }
};

export const addMember = async (name: string, type: MemberType, assignedChurch: Church, birthDate: string = '', status: MemberStatus = MemberStatus.ACTIVE): Promise<Member> => {
  const cleanName = sanitizeInput(name);
  const newMember: Member = {
    id: crypto.randomUUID(),
    name: cleanName,
    type,
    joinedDate: new Date().toISOString(),
    status,
    birthDate,
    assignedChurch,
    role: 'NONE', 
    isAccessActive: false
  };
  inMemoryData.members.push(newMember);
  isDirty = true;
  await persistData('IMMEDIATE');
  autoTransferMembersBasedOnAge();
  return newMember;
};

// This wrapper is for components that don't need async (AttendanceTaker uses sync version)
// But to ensure compatibility we will keep the export signature flexible if possible, or assume caller handles promise.
// AttendanceTaker just calls addMember, result is used. Promise is fine.

export const updateMember = async (updatedMember: Member) => {
  const index = inMemoryData.members.findIndex(m => m.id === updatedMember.id);
  if (index !== -1) {
    updatedMember.name = sanitizeInput(updatedMember.name);
    // Note: Passcode hashing is handled by the caller (MembersList) or migration logic, 
    // unless it's a raw plain-text update from the UI.
    // If we detect a short passcode here that looks like user input, hash it.
    if (updatedMember.passcode && updatedMember.passcode.length < 64 && updatedMember.role !== 'NONE') {
        updatedMember.passcode = await hashPasscode(updatedMember.passcode);
    }
    
    inMemoryData.members[index] = updatedMember;
    isDirty = true;
    persistData('DEBOUNCE');
    autoTransferMembersBasedOnAge();
  }
};

// PERMANENT DELETE MEMBER
export const deleteMember = (id: string) => {
    inMemoryData.members = inMemoryData.members.filter(m => m.id !== id);
    isDirty = true;
    persistData('IMMEDIATE');
};

export const bulkArchiveMembers = (ids: string[]) => {
  let hasChanges = false;
  inMemoryData.members.forEach(member => {
    if (ids.includes(member.id)) {
      member.status = MemberStatus.ARCHIVED;
      hasChanges = true;
    }
  });
  if (hasChanges) {
    isDirty = true;
    persistData('DEBOUNCE');
  }
};

export const updateTargets = (newTargets: Record<string, number>) => {
    inMemoryData.targets = { ...inMemoryData.targets, ...newTargets };
    isDirty = true;
    persistData('DEBOUNCE');
};

// --- AUTOMATION RULES ---
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
    inMemoryData.members.forEach(member => {
        if (member.assignedChurch === 'CM') return;
        if (member.status !== MemberStatus.ACTIVE) return;
        if (member.type !== MemberType.MEMBER) return;
        if (!member.birthDate) return;

        const age = calculateAge(member.birthDate);
        let targetChurch: Church | 'ARCHIVE' | null = null;

        if (age >= 0 && age <= 1) targetChurch = 'I';
        else if (age >= 2 && age <= 5) targetChurch = 'K';
        else if (age >= 6 && age <= 8) targetChurch = 'LJ';
        else if (age >= 9 && age <= 13) targetChurch = 'UJ';
        else if (age > 13) targetChurch = 'ARCHIVE';

        if (targetChurch === 'ARCHIVE' && member.assignedChurch === 'UJ') {
             if (!member.transferPendingDate) {
                 member.transferPendingDate = today.toISOString();
                 addNotification('TEEN_ALERT', `🎓 ${member.name} is scheduled for Moving Up in 1 week!`, member.assignedChurch, member.id);
                 transferChanges = true;
                 return;
             } else {
                 const pendingDate = new Date(member.transferPendingDate);
                 const diffTime = Math.abs(today.getTime() - pendingDate.getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 if (diffDays >= 7) {
                     member.status = MemberStatus.ARCHIVED;
                     member.type = MemberType.NOT_MEMBER;
                     member.transferPendingDate = undefined; 
                     addNotification('PROMOTION', `🎓 ${member.name} has officially graduated to the next level.`, member.assignedChurch, member.id);
                     transferChanges = true;
                 }
                 return;
             }
        }
        if (targetChurch) {
            if (targetChurch === 'ARCHIVE') {
                member.status = MemberStatus.ARCHIVED;
                member.type = MemberType.NOT_MEMBER;
                transferChanges = true;
            } else {
                if (member.assignedChurch !== targetChurch) {
                    const oldChurch = member.assignedChurch;
                    member.assignedChurch = targetChurch;
                    addNotification('PROMOTION', `🚀 ${member.name} promoted from ${oldChurch} to ${targetChurch} Church!`, targetChurch, member.id);
                    transferChanges = true;
                }
            }
        }
    });
    if (transferChanges) {
        isDirty = true;
        persistData('DEBOUNCE');
    }
};

const checkAndAutoUpdateMemberStatus = (churchId: Church) => {
  if (churchId === 'CM') return;
  const sortedAttendance = inMemoryData.attendance
    .filter(r => r.churchId === churchId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (sortedAttendance.length === 0) return;
  const churchMembers = inMemoryData.members.filter(m => m.assignedChurch === churchId);

  if (sortedAttendance.length >= 10) {
    const last10Weeks = sortedAttendance.slice(0, 10);
    const oldestDateInWindow = new Date(last10Weeks[last10Weeks.length - 1].date);
    const presentInLast10Weeks = new Set<string>();
    last10Weeks.forEach(record => {
      record.presentMemberIds.forEach(id => presentInLast10Weeks.add(id));
    });

    churchMembers.forEach(member => {
      if (member.status === MemberStatus.ARCHIVED || member.status === MemberStatus.TRANSFERRED) return;
      if (member.role === 'ADMIN' || member.role === 'TEACHER') return;
      const joined = new Date(member.joinedDate);
      if (joined > oldestDateInWindow) return;
      if (!presentInLast10Weeks.has(member.id)) {
        if (member.type !== MemberType.INCONSISTENT || member.status !== MemberStatus.NOT_ACTIVE) {
          member.type = MemberType.INCONSISTENT;
          member.status = MemberStatus.NOT_ACTIVE;
          isDirty = true;
        }
      }
    });
  }

  if (sortedAttendance.length >= 7) {
    const last7Weeks = sortedAttendance.slice(0, 7);
    const candidatesForReactivation = churchMembers.filter(m => 
        (m.type === MemberType.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE) &&
        m.status !== MemberStatus.ARCHIVED && 
        m.status !== MemberStatus.TRANSFERRED
    );
    candidatesForReactivation.forEach(member => {
        const attendedAll7 = last7Weeks.every(record => record.presentMemberIds.includes(member.id));
        if (attendedAll7) {
            member.type = MemberType.MEMBER;
            member.status = MemberStatus.ACTIVE;
            addNotification('STATUS_CHANGE', `✨ ${member.name} is now ACTIVE after consistent attendance!`, member.assignedChurch, member.id);
            isDirty = true;
        }
    });
  }
  if (isDirty) persistData('DEBOUNCE');
};

export const saveAttendance = (date: string, churchId: Church, presentIds: string[], punctualIds: string[]) => {
  const existingIndex = inMemoryData.attendance.findIndex(r => r.date === date && r.churchId === churchId);
  const record: AttendanceRecord = {
    date,
    churchId,
    presentMemberIds: presentIds,
    punctualMemberIds: punctualIds
  };
  if (existingIndex >= 0) {
    inMemoryData.attendance[existingIndex] = record;
  } else {
    inMemoryData.attendance.push(record);
  }
  isDirty = true;
  persistData('DEBOUNCE'); // Saving attendance involves multiple checkboxes, use debounce
  if (churchId !== 'CM') {
      checkAndAutoUpdateMemberStatus(churchId);
  }
  autoTransferMembersBasedOnAge();
  checkBirthdaysAndTeens(); 
};

// --- OUTREACH & PRAYER METHODS ---
export const saveOutreachSession = (session: OutreachSession) => {
    if (!inMemoryData.outreachSessions) inMemoryData.outreachSessions = [];
    const idx = inMemoryData.outreachSessions.findIndex(s => s.id === session.id);
    // Ensure visitedMemberIds is init
    if (!session.visitedMemberIds) session.visitedMemberIds = [];
    
    if (idx >= 0) inMemoryData.outreachSessions[idx] = session;
    else inMemoryData.outreachSessions.push(session);
    isDirty = true;
    persistData('DEBOUNCE'); // Toggle checkboxes
};

export const deleteOutreachSession = async (id: string) => {
    if (!inMemoryData.outreachSessions) return;
    inMemoryData.outreachSessions = inMemoryData.outreachSessions.filter(s => s.id !== id);
    isDirty = true;
    await persistData('IMMEDIATE'); // Deleting a schedule is a critical action, sync immediately and wait
};

export const savePrayerSlot = (slot: PrayerSlot) => {
    if (!inMemoryData.prayerSchedule) inMemoryData.prayerSchedule = [];
    const idx = inMemoryData.prayerSchedule.findIndex(s => s.id === slot.id);
    if (idx >= 0) inMemoryData.prayerSchedule[idx] = slot;
    else inMemoryData.prayerSchedule.push(slot);
    isDirty = true;
    persistData('DEBOUNCE');
};

export const generateOutreachSchedule = (dates: string[], members: Member[]): { success: boolean, message: string } => {
    if (dates.length === 0 || members.length === 0) return { success: false, message: 'No dates or members.' };
    if (!inMemoryData.outreachSessions) inMemoryData.outreachSessions = [];

    // Check for Duplicate Dates
    const existingDates = inMemoryData.outreachSessions.map(s => s.date);
    const duplicates = dates.filter(d => existingDates.includes(d));
    
    if (duplicates.length > 0) {
        return { 
            success: false, 
            message: `Cannot schedule: Date(s) ${duplicates.join(', ')} already have sessions. Please remove them or edit existing.` 
        };
    }

    // Filter UJ pools
    const active = members.filter(m => m.status === MemberStatus.ACTIVE && m.type === MemberType.MEMBER);
    const fnf = members.filter(m => m.type === MemberType.FNF);
    const inconsistent = members.filter(m => m.type === MemberType.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE);

    // Shuffle each pool for fairness
    const shuffle = (array: Member[]) => array.sort(() => Math.random() - 0.5);
    shuffle(active);
    shuffle(fnf);
    shuffle(inconsistent);

    let dateIndex = 0;
    
    while (dateIndex < dates.length) {
        if (active.length < 2 && fnf.length < 1 && inconsistent.length < 1) break;

        const group: string[] = [];
        // Take 2 active
        for (let i=0; i<2; i++) { if (active.length > 0) group.push(active.shift()!.id); }
        // Take 1 FNF
        if (fnf.length > 0) group.push(fnf.shift()!.id);
        // Take 1 Inconsistent
        if (inconsistent.length > 0) group.push(inconsistent.shift()!.id);

        // Fill remaining spot if logic allows (logic above guarantees 4 slots)
        while (group.length < 4) {
            if (inconsistent.length > 0) group.push(inconsistent.shift()!.id);
            else if (fnf.length > 0) group.push(fnf.shift()!.id);
            else if (active.length > 0) group.push(active.shift()!.id);
            else break;
        }

        if (group.length > 0) {
            const session: OutreachSession = {
                id: crypto.randomUUID(),
                date: dates[dateIndex],
                startTime: '10:00',
                endTime: '15:00',
                assignedMemberIds: group,
                visitedMemberIds: [], // Start empty
                status: 'PENDING'
            };
            inMemoryData.outreachSessions.push(session);
        }
        
        dateIndex++;
    }
    
    isDirty = true;
    persistData('IMMEDIATE');
    return { success: true, message: 'Schedule generated successfully.' };
};

export const generatePrayerSchedule = (startWeekDate: Date, members: Member[]): { success: boolean, message: string } => {
    if (!inMemoryData.prayerSchedule) inMemoryData.prayerSchedule = [];
    
    // --- ROBUST POOL CREATION ---
    // Pool A: Active Members
    let active = members.filter(m => m.type === MemberType.MEMBER && m.status === MemberStatus.ACTIVE);
    
    // Pool B: FNF
    let fnf = members.filter(m => m.type === MemberType.FNF);
    
    // Pool C: Inconsistent (Includes explicit 'INCONSISTENT' types OR 'NOT_ACTIVE' status of any type)
    let inconsistent = members.filter(m => 
        (m.type === MemberType.INCONSISTENT) || 
        (m.status === MemberStatus.NOT_ACTIVE) ||
        (m.type === MemberType.NOT_MEMBER)
    );

    // Shuffle
    const shuffle = (arr: Member[]) => arr.sort(() => Math.random() - 0.5);
    active = shuffle([...active]);
    fnf = shuffle([...fnf]);
    inconsistent = shuffle([...inconsistent]);

    const days = 5; // Mon-Fri
    let generatedCount = 0;

    for (let i = 0; i < days; i++) {
        const d = new Date(startWeekDate);
        d.setDate(startWeekDate.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Skip if already exists
        if (inMemoryData.prayerSchedule.some(s => s.date === dateStr)) continue;

        const dailyIds: Set<string> = new Set();

        // --- HELPER: GET MEMBER WITH AUTO-REFILL ---
        // Tries to get from Primary Pool. If empty, tries Source (refill).
        const getFromPool = (pool: Member[], source: Member[]): Member | null => {
            if (pool.length === 0) {
                if (source.length === 0) return null; // Source also empty
                // Refill pool from source, shuffle, but exclude those already selected today if possible
                pool.push(...shuffle([...source]));
            }
            
            // Try to find one not in dailyIds
            let candidate = pool.shift();
            let tries = 0;
            const maxTries = pool.length + 2; 

            while (candidate && dailyIds.has(candidate.id) && tries < maxTries) {
                pool.push(candidate); // Put back
                candidate = pool.shift();
                tries++;
            }
            
            return candidate || null;
        };

        // --- SELECTION: EXACTLY 3 Members + 1 FNF + 1 Inconsistent ---
        
        // 1. Pick 3 Active Members
        const sourceActive = members.filter(m => m.type === MemberType.MEMBER && m.status === MemberStatus.ACTIVE);
        for(let k=0; k<3; k++) {
            const m = getFromPool(active, sourceActive);
            if(m) dailyIds.add(m.id);
        }

        // 2. Pick 1 FNF
        const sourceFNF = members.filter(m => m.type === MemberType.FNF);
        let mFnf = getFromPool(fnf, sourceFNF);
        
        // FALLBACK FOR FNF: If no FNF available, take Inconsistent, then Active
        if (!mFnf) {
             const sourceInc = members.filter(m => m.type === MemberType.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE);
             mFnf = getFromPool(inconsistent, sourceInc);
        }
        if (!mFnf) mFnf = getFromPool(active, sourceActive);
        
        if(mFnf && !dailyIds.has(mFnf.id)) dailyIds.add(mFnf.id);

        // 3. Pick 1 Inconsistent
        const sourceInc = members.filter(m => m.type === MemberType.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE);
        let mInc = getFromPool(inconsistent, sourceInc);

        // FALLBACK FOR INC: If no Inc available, take FNF, then Active
        if (!mInc) mInc = getFromPool(fnf, sourceFNF);
        if (!mInc) mInc = getFromPool(active, sourceActive);

        if(mInc && !dailyIds.has(mInc.id)) dailyIds.add(mInc.id);

        // --- FINAL SAFETY FILL: FORCE 5 ---
        // If duplicates or empty pools prevented reaching 5, fill with ANYONE available unique
        if (dailyIds.size < 5) {
            const allUnique = members.filter(m => !dailyIds.has(m.id) && !['Teacher','Helper','Volunteer'].includes(m.type));
            const shuffledUnique = shuffle([...allUnique]);
            
            while(dailyIds.size < 5 && shuffledUnique.length > 0) {
                const pick = shuffledUnique.shift();
                if(pick) dailyIds.add(pick.id);
            }
        }

        if (dailyIds.size > 0) {
            inMemoryData.prayerSchedule.push({
                id: crypto.randomUUID(),
                date: dateStr,
                dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'long'}),
                assignedMemberIds: Array.from(dailyIds),
                isCompleted: false,
                durationMins: 30
            });
            generatedCount++;
        }
    }

    isDirty = true;
    persistData('IMMEDIATE');
    
    if (generatedCount === 0) {
        return { success: false, message: 'Schedule already exists for this week.' };
    }
    return { success: true, message: `Prayer schedule generated for ${generatedCount} days.` };
};


// --- FINANCIAL SERVICE METHODS ---
export const addTransaction = (txn: Partial<Transaction>) => {
    if (!txn.amount || !txn.category || !txn.type) return;
    const newTxn: Transaction = {
        id: crypto.randomUUID(),
        date: txn.date || new Date().toISOString().split('T')[0],
        amount: Number(txn.amount),
        type: txn.type,
        category: txn.category,
        description: txn.description || '',
        churchId: txn.churchId || 'UJ',
        recordedBy: txn.recordedBy || 'System',
    };
    if (!inMemoryData.transactions) inMemoryData.transactions = [];
    inMemoryData.transactions.push(newTxn);
    isDirty = true; 
    persistData('IMMEDIATE');
};

export const deleteTransaction = (id: string) => {
    if (!inMemoryData.transactions) return;
    const initialLen = inMemoryData.transactions.length;
    inMemoryData.transactions = inMemoryData.transactions.filter(t => t.id !== id);
    if (inMemoryData.transactions.length !== initialLen) {
        isDirty = true;
        persistData('IMMEDIATE');
    }
};