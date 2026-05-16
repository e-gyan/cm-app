
import { Member, AttendanceRecord, MemberType, MemberStatus, AppSettings } from './types';

export const APP_VERSION = '1.7';

// SECURITY UPDATE: Using Environment Variables is recommended over hardcoding.
const ENV_API_KEY = (import.meta as any).env?.VITE_API_KEY || '';
const ENV_BIN_ID = (import.meta as any).env?.VITE_BIN_ID || '';

export const DEFAULT_CLOUD_CONFIG = {
    apiKey: ENV_API_KEY || '$2a$10$K5M6PsdqUpAmMJHp06t1PeEK2tabwlgLoFMHLo/yEWV5ndxGCMcRu', 
    binId: ENV_BIN_ID || '6968447b43b1c97be9314e21'   
};

export const DEFAULT_SETTINGS: AppSettings = {
  churches: ['I', 'K', 'LJ', 'UJ'],
  cloudConfig: {
    enabled: !!(DEFAULT_CLOUD_CONFIG.apiKey && DEFAULT_CLOUD_CONFIG.binId),
    apiKey: DEFAULT_CLOUD_CONFIG.apiKey,
    binId: DEFAULT_CLOUD_CONFIG.binId
  },
  features: {
    punctuality: true,
    outreach: true
  }
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

export const INITIAL_MEMBERS: Member[] = []; 

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
