import { AppData, Member, AttendanceRecord, MemberType, MemberStatus, Church, CloudConfig } from '../types';
import { INITIAL_MEMBERS, INITIAL_ATTENDANCE } from '../constants';

// STORAGE KEYS
const STORAGE_KEY = 'UJ_CHURCH_DATA_2026_V5'; 
const SESSION_KEY = 'UJ_CHURCH_SESSION_V1';
const LOGIN_ATTEMPTS_KEY = 'UJ_LOGIN_ATTEMPTS';
const CLOUD_CONFIG_KEY = 'UJ_CLOUD_CONFIG_V1';

// --- DATA LOADING ---
const loadData = (): AppData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration logic
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

      if (!adminExists) {
        parsed.members.push({
            id: "auto-admin",
            name: "Main Admin",
            type: MemberType.TEACHER,
            joinedDate: new Date().toISOString(),
            status: MemberStatus.ACTIVE,
            assignedChurch: "ALL",
            role: "ADMIN",
            passcode: "2026",
            isAccessActive: true
        });
      }
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load from local storage", e);
  }
  return {
    members: [...INITIAL_MEMBERS] as Member[],
    attendance: [...INITIAL_ATTENDANCE] as AttendanceRecord[],
    lastUpdated: Date.now()
  };
};

let inMemoryData: AppData = loadData();

// --- CLOUD SYNC SERVICE ---
const getCloudConfig = (): CloudConfig | null => {
    const stored = localStorage.getItem(CLOUD_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
};

export const saveCloudConfig = (config: CloudConfig) => {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    // Trigger an immediate pull when config is saved
    if (config.enabled) {
        syncFromCloud(); 
    }
};

// Push Data to Cloud
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

// Pull Data from Cloud
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
        // JSONBin v3 returns data in record wrapper, verify structure
        const cloudData: AppData = result.record || result; 

        // Conflict Resolution: Last Write Wins based on timestamp
        const localTime = inMemoryData.lastUpdated || 0;
        const cloudTime = cloudData.lastUpdated || 0;

        if (cloudTime > localTime) {
            inMemoryData = cloudData;
            persistData(false); // Persist locally, but don't push back to cloud immediately
            return { success: true, message: 'New data downloaded from cloud' };
        } else {
            return { success: true, message: 'Local data is up to date' };
        }
    } catch (e) {
        console.error("Failed to pull from cloud", e);
        return { success: false, message: 'Failed to connect to cloud' };
    }
};

const persistData = (shouldSyncToCloud: boolean = true) => {
  try {
    inMemoryData.lastUpdated = Date.now(); // Update timestamp on every save
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

export const authenticateUser = (name: string, passcode: string): { success: boolean, member?: Member, message?: string } => {
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

    const user = inMemoryData.members.find(m => 
        (m.role === 'ADMIN' || m.role === 'TEACHER') && 
        m.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (!user) {
        return recordFailedAttempt(attempts);
    }

    if (!user.isAccessActive) {
        return { success: false, message: "Access deactivated. Contact Admin." };
    }

    if (user.passcode === passcode) {
        localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({ count: 0, lastAttempt: now, lockedUntil: null }));
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: user.id,
            timestamp: now
        }));
        
        // Try to sync on login to ensure user has latest data
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
    if (!parsed.members || !Array.isArray(parsed.members) || !parsed.attendance || !Array.isArray(parsed.attendance)) {
        return { success: false, message: "Invalid data format." };
    }
    // Migration
    parsed.members.forEach((m: any) => {
        if (!m.assignedChurch) m.assignedChurch = 'UJ';
        if (!m.role) m.role = 'NONE';
    });
    parsed.attendance.forEach((r: any) => {
        if (!r.churchId) r.churchId = 'UJ';
    });
    
    // Preserve Cloud timestamp if exists, or create new
    parsed.lastUpdated = Date.now();

    inMemoryData = parsed;
    persistData(true); // Sync import to cloud
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
  const newMember: Member = {
    id: crypto.randomUUID(),
    name,
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

export const updateMember = (updatedMember: Member) => {
  const index = inMemoryData.members.findIndex(m => m.id === updatedMember.id);
  if (index !== -1) {
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