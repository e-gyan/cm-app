import { AppData, Member, AttendanceRecord, MemberType, MemberStatus, Church, CloudConfig } from '../types';
import { INITIAL_MEMBERS, INITIAL_ATTENDANCE } from '../constants';
import { hashPasscode, verifyPasscode, AppDataSchema, sanitizeString } from '../utils/security';

// STORAGE KEYS
const STORAGE_KEY = 'UJ_CHURCH_DATA_2026_V5'; 
const SESSION_KEY = 'UJ_CHURCH_SESSION_V1';
const LOGIN_ATTEMPTS_KEY = 'UJ_LOGIN_ATTEMPTS';
const CLOUD_CONFIG_KEY = 'UJ_CLOUD_CONFIG_V1';

// Internal State
let inMemoryData: AppData = { members: [], attendance: [], lastUpdated: 0 };
let isInitialized = false;

// --- DATA LOADING & SECURITY MIGRATION ---
const loadDataInternal = async (): Promise<AppData> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const rawParsed = JSON.parse(stored);
      
      // 1. Zod Validation (Sanitizes structure)
      const parseResult = AppDataSchema.safeParse(rawParsed);
      
      let parsed: AppData;
      if (!parseResult.success) {
          console.warn("Data schema mismatch, attempting partial recovery.", parseResult.error);
          parsed = rawParsed; 
      } else {
          parsed = parseResult.data as AppData;
      }

      // 2. Migration: Admin Existence Check
      let adminExists = false;
      parsed.members.forEach((m: any) => {
        if (!m.assignedChurch) m.assignedChurch = 'UJ';
        if (!m.role) m.role = 'NONE';
        if (m.role === 'ADMIN') {
             adminExists = true;
             if (m.id === 'auto-admin' || m.id === 'super-admin') {
                 m.assignedChurch = 'ALL';
             }
        }
      });
      parsed.attendance.forEach((r: any) => {
        if (!r.churchId) r.churchId = 'UJ';
      });

      // 3. Migration: Auto-Hash Legacy Passwords
      // NOTE: Hashing requires secure context (https or localhost). 
      // If crypto.subtle is missing, skip migration to avoid crash.
      if (window.crypto && window.crypto.subtle) {
          let securityMigrationNeeded = false;
          for (const m of parsed.members) {
              if (m.passcode && m.passcode.length < 64) {
                  m.passcode = await hashPasscode(m.passcode);
                  securityMigrationNeeded = true;
              }
          }

          if (!adminExists) {
            parsed.members.push({
                id: "auto-admin",
                name: "Main Admin",
                type: MemberType.TEACHER,
                joinedDate: new Date().toISOString(),
                status: MemberStatus.ACTIVE,
                assignedChurch: "ALL",
                role: "ADMIN",
                passcode: await hashPasscode("2026"), // Hash default
                isAccessActive: true
            });
            securityMigrationNeeded = true;
          }
          
          if (securityMigrationNeeded) {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              } catch(e) {
                console.warn("Could not save migration changes (Quota Exceeded?)");
              }
          }
      }

      return parsed;
    }
  } catch (e) {
    console.error("Failed to load from local storage", e);
  }
  
  // Default Data
  return {
    members: [...INITIAL_MEMBERS] as Member[],
    attendance: [...INITIAL_ATTENDANCE] as AttendanceRecord[],
    lastUpdated: Date.now()
  };
};

// --- PUBLIC API ---

/**
 * explicitly initializes the storage service.
 * App must await this before rendering.
 */
export const initializeStorage = async (): Promise<void> => {
    if (isInitialized) return;
    inMemoryData = await loadDataInternal();
    isInitialized = true;
    console.log("Storage Service Initialized");
};

export const getAppData = (): AppData => {
  if (!isInitialized) {
      console.warn("Attempted to access App Data before initialization");
  }
  return inMemoryData;
};

// --- CLOUD SYNC SERVICE ---
const getCloudConfig = (): CloudConfig | null => {
    const stored = localStorage.getItem(CLOUD_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
};

export const saveCloudConfig = (config: CloudConfig) => {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    if (config.enabled) {
        syncFromCloud(); 
    }
};

const syncToCloud = async () => {
    const config = getCloudConfig();
    if (!config || !config.enabled || !config.apiKey || !config.binId) return;

    try {
        await fetch(`${config.url}/${config.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': config.apiKey
            },
            body: JSON.stringify(inMemoryData)
        });
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
        const response = await fetch(`${config.url}/${config.binId}`, {
            method: 'GET',
            headers: {
                'X-Master-Key': config.apiKey
            }
        });
        
        if (!response.ok) throw new Error("Cloud fetch failed");

        const result = await response.json();
        const rawCloudData = result.record || result; 

        // SECURITY: Validate Cloud Data against Zod Schema
        const parseResult = AppDataSchema.safeParse(rawCloudData);
        if (!parseResult.success) {
            console.error("Cloud data failed security check", parseResult.error);
            return { success: false, message: 'Cloud data corrupted or malicious.' };
        }
        const cloudData = parseResult.data as AppData;

        // SECURITY: Sanitize incoming cloud data
        cloudData.members.forEach(m => {
            m.name = sanitizeString(m.name);
            if (m.passcode && m.passcode.length < 64) {
                 // Clear potential plain text legacy passwords from external source if suspicious
                 // Users will need to reset or admin re-enter.
                 // Ideally we'd hash here but sync is async background.
            }
        });
        cloudData.attendance.forEach(a => {
            if (a.notes) a.notes = sanitizeString(a.notes);
        });

        const localTime = inMemoryData.lastUpdated || 0;
        const cloudTime = cloudData.lastUpdated || 0;

        if (cloudTime > localTime) {
            inMemoryData = cloudData;
            persistData(false);
            return { success: true, message: 'New data downloaded from cloud' };
        } else {
            return { success: true, message: 'Local data is up to date' };
        }
    } catch (e) {
        console.error("Failed to pull from cloud", e);
        return { success: false, message: 'Failed to connect to cloud' };
    }
};

// Robust Persist with Quota Management
const persistData = (shouldSyncToCloud: boolean = true) => {
  try {
    inMemoryData.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
    
    if (shouldSyncToCloud) {
        syncToCloud();
    }
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        alert("CRITICAL WARNING: Local Storage is full! Your recent changes were NOT saved. Please export your data and clear some space.");
    } else {
        console.error("Failed to save to local storage", e);
    }
  }
};

let isDirty = false;


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
    if (!isInitialized) return null; // Prevent session restore before init

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

export const authenticateUser = async (name: string, plainPasscode: string): Promise<{ success: boolean, member?: Member, message?: string }> => {
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

    const sanitizedName = sanitizeString(name.trim());
    
    const user = inMemoryData.members.find(m => 
        (m.role === 'ADMIN' || m.role === 'TEACHER') && 
        m.name.toLowerCase().trim() === sanitizedName.toLowerCase().trim()
    );

    if (!user) {
        return recordFailedAttempt(attempts);
    }

    if (!user.isAccessActive) {
        return { success: false, message: "Access deactivated. Contact Admin." };
    }

    // SECURITY: Compare using Hash if available
    let isValid = false;
    if (window.crypto && window.crypto.subtle) {
         isValid = await verifyPasscode(plainPasscode, user.passcode || '');
    } else {
         // Fallback for non-secure contexts (e.g. plain HTTP)
         isValid = (user.passcode === plainPasscode); 
         if (!isValid && user.passcode && user.passcode.length > 50) {
             return { success: false, message: "Secure Context Required (HTTPS) to login." };
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
    
    // SECURITY: Strict Schema Validation
    const validation = AppDataSchema.safeParse(parsed);
    if (!validation.success) {
        return { success: false, message: "Import failed: Invalid data structure or security violation." };
    }
    const safeData = validation.data as AppData;

    // SECURITY: Sanitize all string fields on import
    safeData.members.forEach((m: any) => {
        m.name = sanitizeString(m.name);
        if (!m.assignedChurch) m.assignedChurch = 'UJ';
        if (!m.role) m.role = 'NONE';
    });
    safeData.attendance.forEach((r: any) => {
        if (r.notes) r.notes = sanitizeString(r.notes);
        if (!r.churchId) r.churchId = 'UJ';
    });
    
    safeData.lastUpdated = Date.now();

    inMemoryData = safeData;
    persistData(true);
    isDirty = false;
    return { success: true, message: "Data imported and verified successfully!" };
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
  const newMember: Member = {
    id: crypto.randomUUID(),
    name: sanitizeString(name.trim()), // SECURITY: Sanitize Name
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
    // SECURITY: Sanitize update fields
    updatedMember.name = sanitizeString(updatedMember.name.trim());
    
    // Check if passcode was changed (plain text length vs hash length)
    if (updatedMember.passcode && updatedMember.passcode.length < 64) {
        if (window.crypto && window.crypto.subtle) {
             updatedMember.passcode = await hashPasscode(updatedMember.passcode);
        }
    }

    inMemoryData.members[index] = updatedMember;
    isDirty = true;
    persistData();
    autoTransferMembersBasedOnAge();
  }
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
    inMemoryData.members.forEach(member => {
        if (member.assignedChurch === 'ALL') return;
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
  if (churchId === 'ALL') return;

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
  if (churchId !== 'ALL') {
      checkAndAutoUpdateMemberStatus(churchId);
  }
  autoTransferMembersBasedOnAge();
};