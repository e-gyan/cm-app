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

export const Church = {
  UJ: "UJ",
  LJ: "LJ",
  K: "K",
  I: "I",
  N: "N",
  All: "All",
  CM: "CM",
} as const;
export type Church = "UJ" | "LJ" | "K" | "I" | "N" | "All" | "CM";

export const Role = {
  BRANCH_COORDINATOR: "BRANCH_COORDINATOR",
  DIRECTORATE_HEAD: "DIRECTORATE_HEAD",
  ZONAL_HEAD: "ZONAL_HEAD",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  NONE: "NONE",
  TEACHER: "TEACHER",
  VOLUNTEER: "VOLUNTEER",
} as const;
export type Role = "BRANCH_COORDINATOR" | "DIRECTORATE_HEAD" | "ZONAL_HEAD" | "ADMIN" | "SUPER_ADMIN" | "NONE" | "TEACHER" | "VOLUNTEER";
export type ServiceType = "JOY" | "ENLARGEMENT" | "SPECIAL";
export type NotificationType =
  | "TRANSFER_REQUEST"
  | "BIRTHDAY"
  | "GENERAL"
  | "STATUS_CHANGE"
  | "PROMOTION"
  | "GENERAL_INFO"
  | "ATTENDANCE"
  | "MEMBER_ADDED"
  | "TRANSACTION"
  | "OUTREACH"
  | "PRAYER"
  | "ORGANIZATION";

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
  assignedTeacherId?: string;
}

export interface Notification {
  branchId?: string;
  zoneId?: string;
  id: string;
  message: string;
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
  type?: string;
  relatedMemberId?: string;
  targetChurch?: string;
  actorName?: string;
  targetRole?: string;
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

export interface OrgBranch {
  id: string;
  name: string;
  churches?: string[];
}

export interface OrgZone {
  id: string;
  name: string;
  branches: OrgBranch[];
}

export interface AppOrganization {
  directorate?: string;
  zones: OrgZone[];
}

export interface AppSettings {
  organization?: AppOrganization;
  churches?: any;
  features?: any;
  permissions?: Record<string, string[]>;
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
