import { AppData, Member, AttendanceRecord, MemberType, MemberStatus, Church, CloudConfig, Transaction } from '../types';
import { INITIAL_MEMBERS, INITIAL_ATTENDANCE, DEFAULT_CLOUD_CONFIG } from '../constants';
import { sanitizeInput, hashString, isValidSchema } from './securityService';

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
      // Ensure targets exists
      if (!parsed.targets) parsed.targets = { UJ: 0, I: 0, K: 0, LJ: 0 };
    } else {
      parsed = {
        members: [...INITIAL_MEMBERS],
        attendance: [...INITIAL_ATTENDANCE],
        transactions: [],
        targets: { UJ: 0, I: 0, K: 0, LJ: 0 },
        lastUpdated: 0 // Set to 0 ensures cloud data is accepted on fresh install
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
            passcode: "2026", // Plaintext initially, will be hashed on auth or next save cycle logic
            isAccessActive: true
        });
    }

    // Async Migration Trigger (Fire and forget, will persist on next save)
    (async () => {
        let hasUpdates = false;
        for (const m of parsed.members) {
            if (m.passcode && m.passcode.length < 64) {
                m.passcode = await hashString(m.passcode);
                hasUpdates = true;
            }
        }
        if (hasUpdates) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            console.log("Security Migration: Passcodes hashed successfully.");
        }
    })();

    return parsed;
  } catch (e) {
    console.error("Failed to load from local storage", e);
    return {
        members: [...INITIAL_MEMBERS],
        attendance: [...INITIAL_ATTENDANCE],
        transactions: [],
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
};

// --- CLOUD SYNC SERVICE ---
const getCloudConfig = (): CloudConfig | null => {
    // 1. Check for Env Var / Constants (Prioritize Code)
    // Only use if strictly defined
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
        syncFromCloud(); 
    }
};

// Helper to handle the "Master Key" vs "Access Key" header ambiguity in JSONBin V3
const fetchWithRetryHeaders = async (url: string, method: string, apiKey: string, body?: string) => {
    const headersMaster = {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey
    };

    // Attempt 1: Try with Master Key
    let response = await fetch(url, { method, headers: headersMaster, body });
    
    // Attempt 2: If unauthorized (401), try with Access Key
    if (response.status === 401) {
        const headersAccess = {
            'Content-Type': 'application/json',
            'X-Access-Key': apiKey
        };
        response = await fetch(url, { method, headers: headersAccess, body });
    }
    
    return response;
};

const syncToCloud = async () => {
    const config = getCloudConfig();
    if (!config || !config.enabled || !config.apiKey || !config.binId) return;

    try {
        await fetchWithRetryHeaders(`${config.url}/${config.binId}`, 'PUT', config.apiKey, JSON.stringify(inMemoryData));
        console.log("Data synced to cloud successfully.");
    } catch (e) {
        console.error("Failed to sync to cloud", e);
    }
};

export const syncFromCloud = async (): Promise<{success: boolean, message?: string}> => {
    const config = getCloudConfig();
    if (!config || !config.enabled || !config.apiKey || !config.binId) {
        return { success: false, message: 'Cloud not configured' };
    }

    try {
        // Add timestamp to prevent caching
        const response = await fetchWithRetryHeaders(
            `${config.url}/${config.binId}?t=${Date.now()}`, 
            'GET', 
            config.apiKey
        );
        
        if (!response.ok) {
            // Provide specific error messages for common issues
            if (response.status === 404) throw new Error("Bin ID not found. Check Configuration.");
            if (response.status === 401 || response.status === 403) throw new Error("Invalid API Key.");
            throw new Error(`Cloud fetch failed: ${response.status}`);
        }

        const result = await response.json();
        const cloudData: AppData = result.record || result; 
        
        // Security Check: Validate Schema of Cloud Data before merging
        if (!isValidSchema(cloudData)) {
            console.error("Security Alert: Cloud data schema invalid.", cloudData);
            return { success: false, message: 'Cloud data corrupted or invalid.' };
        }

        const localTime = inMemoryData.lastUpdated || 0;
        const cloudTime = cloudData.lastUpdated || 0;

        // Sync if cloud is newer OR local is effectively "empty/default" (timestamp 0)
        if (cloudTime > localTime || localTime === 0) {
            // Re-sanitize incoming cloud names just in case
            cloudData.members.forEach(m => m.name = sanitizeInput(m.name));
            if (!cloudData.targets) cloudData.targets = { UJ: 0, I: 0, K: 0, LJ: 0 }; 
            
            inMemoryData = cloudData;
            persistData(false); 
            return { success: true, message: 'New data downloaded from cloud' };
        } else {
            return { success: true, message: 'Local data is up to date' };
        }
    } catch (e: any) {
        console.error("Failed to pull from cloud", e);
        return { success: false, message: e.message || 'Failed to connect to cloud' };
    }
};

const persistData = (shouldSyncToCloud: boolean = true) => {
  try {
    inMemoryData.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
    
    if (shouldSyncToCloud) {
        syncToCloud();
    }
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }
};

let isDirty = false;

export const getAppData = (): AppData => {
  return inMemoryData;
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

    // AUTH LOGIC: Check hash
    // If stored passcode is short, it's legacy plaintext.
    let isValid = false;
    
    if (user.passcode && user.passcode.length < 64) {
        // Legacy check (Plaintext)
        if (user.passcode === passcode) {
            isValid = true;
            // Upgrade to hash immediately
            user.passcode = await hashString(passcode);
            persistData(); 
        }
    } else {
        // Secure check (Hash)
        const inputHash = await hashString(passcode);
        if (user.passcode === inputHash) {
            isValid = true;
        }
    }

    if (isValid) {
        localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({ count: 0, lastAttempt: now, lockedUntil: null }));
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: user.id,
            timestamp: now
        }));
        
        syncFromCloud();
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
    
    // Security Schema Validation
    if (!isValidSchema(parsed)) {
        return { success: false, message: "Security Warning: Invalid or malformed data file." };
    }

    // Migration & Sanitization during Import
    parsed.members.forEach((m: any) => {
        if (m.name) m.name = sanitizeInput(m.name); // Sanitize imported names
        if (!m.assignedChurch) m.assignedChurch = 'UJ';
        if (!m.role) m.role = 'NONE';
    });
    parsed.attendance.forEach((r: any) => {
        if (!r.churchId) r.churchId = 'UJ';
    });
    
    // Ensure transactions are initialized
    if (!parsed.transactions) parsed.transactions = [];
    if (!parsed.targets) parsed.targets = { UJ: 0, I: 0, K: 0, LJ: 0 };

    parsed.lastUpdated = Date.now();

    inMemoryData = parsed;
    persistData(true); 
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
    birthDate: string = '', 
    status: MemberStatus = MemberStatus.ACTIVE
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
    role: 'NONE', 
    isAccessActive: false
  };
  inMemoryData.members.push(newMember);
  isDirty = true;
  persistData();
  autoTransferMembersBasedOnAge();
  return newMember;
};

export const updateMember = async (updatedMember: Member) => {
  const index = inMemoryData.members.findIndex(m => m.id === updatedMember.id);
  if (index !== -1) {
    // Sanitize before saving
    updatedMember.name = sanitizeInput(updatedMember.name);
    
    // If this is a user update involving passcode (that isn't already hashed), hash it
    if (updatedMember.passcode && updatedMember.passcode.length < 64 && updatedMember.role !== 'NONE') {
        updatedMember.passcode = await hashString(updatedMember.passcode);
    }

    inMemoryData.members[index] = updatedMember;
    isDirty = true;
    persistData();
    autoTransferMembersBasedOnAge();
  }
};

export const updateTargets = (newTargets: Record<string, number>) => {
    inMemoryData.targets = { ...inMemoryData.targets, ...newTargets };
    isDirty = true;
    persistData();
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
    persistData();
  }
};

// --- AUTOMATION RULES ---
const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
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
                    member.assignedChurch = targetChurch;
                    transferChanges = true;
                }
            }
        }
    });
    
    if (transferChanges) {
        isDirty = true;
        persistData();
    }
};

const checkAndAutoUpdateMemberStatus = (churchId: Church) => {
  if (churchId === 'CM') return;

  const sortedAttendance = inMemoryData.attendance
    .filter(r => r.churchId === churchId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedAttendance.length === 0) return;
  const churchMembers = inMemoryData.members.filter(m => m.assignedChurch === churchId);

  // LOGIC 1: DEMOTION
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

  // LOGIC 2: REACTIVATION
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
            isDirty = true;
        }
    });
  }
  if (isDirty) persistData();
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
  persistData();
  if (churchId !== 'CM') {
      checkAndAutoUpdateMemberStatus(churchId);
  }
  autoTransferMembersBasedOnAge();
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
    persistData();
};

export const deleteTransaction = (id: string) => {
    if (!inMemoryData.transactions) return;
    const initialLen = inMemoryData.transactions.length;
    inMemoryData.transactions = inMemoryData.transactions.filter(t => t.id !== id);
    if (inMemoryData.transactions.length !== initialLen) {
        isDirty = true;
        persistData();
    }
};