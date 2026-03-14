
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

export type Church = string; // Changed from union type to string to allow dynamic configuration

export type Role = 'ADMIN' | 'TEACHER' | 'NONE';

export type ServiceType = 'JOY' | 'ENLARGEMENT' | 'SPECIAL';

export interface Member {
  id: string;
  name: string;
  type: MemberType;
  joinedDate: string;
  status: MemberStatus;
  birthDate?: string; // ISO Date string (DD/MM/YYYY)
  assignedChurch: Church;
  // Auth Fields
  role?: Role;
  passcode?: string;
  isAccessActive?: boolean;
  // Automation Fields
  transferPendingDate?: string; // ISO Date string for the 1-week notification period
  // Contact & Location (New)
  phone?: string;
  parentPhone?: string;
  address?: string;
  gpsCoordinates?: string; // e.g., "5.6037, -0.1870" for Maps
  promotionHistory?: PromotionRecord[];
  lastActivationDate?: string; // Date when status changed from Inconsistent to Active/FNF
}

export interface PromotionRecord {
  date: string; // ISO Date
  fromChurch: Church;
  toChurch: Church;
}

export interface AttendanceRecord {
  date: string; // ISO Date string (YYYY-MM-DD)
  presentMemberIds: string[];
  punctualMemberIds?: string[]; // IDs of the top 3 punctual members
  serviceMap?: Record<string, ServiceType>; // Map member ID to specific service
  eventName?: string; // Name of the special event if serviceType is SPECIAL
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

export type NotificationType = 'BIRTHDAY' | 'PROMOTION' | 'STATUS_CHANGE' | 'TEEN_ALERT';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: string; // ISO Date
  targetChurch: Church; // The church staff who should see this
  relatedMemberId?: string;
  isRead: boolean;
}

// --- NEW OUTREACH TYPES ---
export interface OutreachSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "10:00"
  endTime: string; // "15:00"
  assignedMemberIds: string[]; // The group assigned
  visitedMemberIds?: string[]; // Track who was actually visited
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  completedBy?: string;
}

export interface PrayerSlot {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Monday, Tuesday...
  assignedMemberIds: string[]; // Who we are praying for
  isCompleted: boolean;
  durationMins: number; // Default 30
}

export interface AppSettings {
  churches: string[]; // Dynamic list of active branches
  cloudConfig: {
    enabled: boolean;
    apiKey: string;
    binId: string;
  };
  features: {
    punctuality: boolean;
    outreach: boolean;
  };
}

export interface AppData {
  members: Member[];
  attendance: AttendanceRecord[];
  transactions: Transaction[];
  notifications: Notification[];
  outreachSessions?: OutreachSession[];
  prayerSchedule?: PrayerSlot[];
  targets?: Record<string, number>; 
  settings: AppSettings; // Centralized Configuration
  lastUpdated?: number; 
}

export interface CloudConfig {
  enabled: boolean;
  apiKey: string;
  binId: string;
  url: string; 
}
