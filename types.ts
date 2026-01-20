export enum MemberType {
  TEACHER = 'Teacher',
  HELPER = 'Helper',
  VOLUNTEER = 'Volunteer',
  MEMBER = 'Member',
  FNF = 'FNF', // Friends and Family / New
  NOT_MEMBER = 'Not a Member',
  INCONSISTENT = 'Inconsistent'
}

export enum MemberStatus {
  ACTIVE = 'Active',
  NOT_ACTIVE = 'Not Active',
  ARCHIVED = 'Archived',
  TRANSFERRED = 'Transferred'
}

export type Church = 'UJ' | 'I' | 'K' | 'LJ' | 'CM';

export type Role = 'ADMIN' | 'TEACHER' | 'NONE';

export interface Member {
  id: string;
  name: string;
  type: MemberType;
  joinedDate: string;
  status: MemberStatus;
  birthDate?: string; // ISO Date string (YYYY-MM-DD)
  assignedChurch: Church;
  // Auth Fields
  role?: Role;
  passcode?: string;
  isAccessActive?: boolean;
  // Automation Fields
  transferPendingDate?: string; // ISO Date string for the 1-week notification period
}

export interface AttendanceRecord {
  date: string; // ISO Date string (YYYY-MM-DD)
  presentMemberIds: string[];
  punctualMemberIds?: string[]; // IDs of the top 3 punctual members
  notes?: string;
  churchId: Church;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  churchId: Church;
  recordedBy?: string;
}

export interface AppData {
  members: Member[];
  attendance: AttendanceRecord[];
  transactions: Transaction[];
  lastUpdated?: number; // Timestamp for sync conflict resolution
}

export interface CloudConfig {
  enabled: boolean;
  apiKey: string;
  binId: string;
  url: string; // e.g., https://api.jsonbin.io/v3/b
}