import { Member, AttendanceRecord, MemberType, MemberStatus } from './types';

// SECURITY UPDATE: Using Environment Variables is recommended over hardcoding.
// If not using a build tool, you can still manually set these, but be careful not to share this file publicly.
const ENV_API_KEY = (import.meta as any).env?.VITE_API_KEY || '';
const ENV_BIN_ID = (import.meta as any).env?.VITE_BIN_ID || '';

export const DEFAULT_CLOUD_CONFIG = {
    apiKey: ENV_API_KEY || '$2a$10$ND0zIcPdo58JCZimZAcwRO.hL596gLZ3bxo/F0Po4bcSu.b0nvjEa', // Pre-configured Key
    binId: ENV_BIN_ID || '6968447b43b1c97be9314e21'    // Pre-configured Bin ID
};

export const getSundaysInYear = (year: number) => {
  const date = new Date(year, 0, 1);
  const sundays: Date[] = [];

  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }

  while (date.getFullYear() === year) {
    sundays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }

  return sundays;
};

// DATA SOURCE CHANGE: 
// We no longer fallback to hardcoded sample members. 
// The app will initialize with an empty list (plus a default admin generated in storageService)
// and attempt to pull live data from the Cloud immediately.
export const INITIAL_MEMBERS: Member[] = []; 

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];