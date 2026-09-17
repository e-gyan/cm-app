export enum MemberType {
  MEMBER = "Member",
  FNF = "FNF",
  VISITOR = "Visitor",
  TEACHER = "Teacher",
  HELPER = "Helper",
  VOLUNTEER = "Volunteer",
  NOT_MEMBER = "Not Member"
}

export enum MemberStatus {
  ACTIVE = "Active",
  ARCHIVED = "Archived",
  TRANSFERRED = "Transferred",
  INCONSISTENT = "Inconsistent",
  NOT_ACTIVE = "Not Active",
  VACATION = "Vacation"
}

export type Church = "UJ" | "LJ" | "K" | "I" | "N" | "All" | "CM";
export type Role = "BRANCH_COORDINATOR" | "DIRECTORATE_HEAD" | "ZONAL_HEAD" | "ADMIN" | "SUPER_ADMIN" | "NONE" | "TEACHER" | "VOLUNTEER";
export type ServiceType = "JOY" | "ENLARGEMENT" | "SPECIAL";
export type NotificationType = "TRANSFER_REQUEST" | "BIRTHDAY" | "GENERAL" | "STATUS_CHANGE" | "PROMOTION" | "GENERAL_INFO";

export interface PromotionRecord {
  date: string;
  fromChurch: string;
  toChurch: string;
}

export interface Member {
  addedAt?: number;
  id: string;
  name: string;
  role?: string;
  assignedChurch?: string;
  branchId?: string;
  zoneId?: string;
  type: MemberType;
  status: MemberStatus;
  gender?: string;
  parentPhone?: string;
  phone?: string;
  address?: string;
  gpsCoordinates?: string;
  joinedDate?: string;
  birthDate?: string;
  passcode?: string;
  isAccessActive?: boolean;
  transferPendingDate?: string;
  promotionHistory?: PromotionRecord[];
  lastActivationDate?: string;
  vacationStartDate?: string;
  vacationEndDate?: string;
}

export interface Notification {
  branchId?: string;
  id: string;
  message: string;
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
  type?: string;
  relatedMemberId?: string;
  targetChurch?: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  description: string;
  category?: string;
  churchId?: string;
  branchId?: string;
  recordedBy?: string;
}

export interface AppSettings {
  organization?: any;
  churches?: any;
  features?: any;
  permissions?: any;
  themeColors?: any;
}

export interface AttendanceRecord {
  punctualMemberIds?: string[];
  id: string;
  date: string;
  churchId: string;
  branchId?: string;
  eventName?: string;
  presentMemberIds: string[];
  serviceMap?: any;
  lastUpdated?: number | string;
}

export interface CloudConfig {
  apiKey?: string;
  projectId?: string;
}

export interface OutreachSession {
  date?: string;
  status?: string;
  sessionType?: string;
  outcome?: string;
  assignedMemberIds?: string[];
  visitedMemberIds?: string[];
  id: string;
  completedBy?: string;
  teacherId?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  branchId?: string;
}
export interface PrayerSlot {
  date?: string;
  isCompleted?: boolean;
  assignedMemberIds?: string[];
  durationMins?: number;
  id: string;
  dayOfWeek?: string;
  teacherId?: string;
  branchId?: string;
}

export interface AppData {
  members: Member[];
  attendance: AttendanceRecord[];
  settings: AppSettings;
  notifications?: Notification[];
  targets?: any;
  transactions?: Transaction[];
  outreachSessions?: OutreachSession[];
  prayerSchedule?: PrayerSlot[];
  lastUpdated?: string | number;
}
