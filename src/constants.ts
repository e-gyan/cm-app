export { APP_VERSION } from "./version";

export interface SubFeatureDef {
  id: string;
  name: string;
  description: string;
}

export interface FeatureDef {
  id: string;
  name: string;
  description: string;
  iconName: string;
  subfeatures: SubFeatureDef[];
}

export const APP_FEATURES_REGISTRY: FeatureDef[] = [
  {
    id: "Dashboard",
    name: "Dashboard",
    description: "Ministry overview, attendance trends, and targets.",
    iconName: "LayoutDashboard",
    subfeatures: [
      { id: "overview_stats", name: "Overview Statistics", description: "View total members, attendance rate, and FNF counts." },
      { id: "weekly_trend_chart", name: "Weekly Attendance Trends", description: "Compare weekly attendance against prior records." },
      { id: "church_distribution", name: "Church Distribution", description: "Attendance breakdown across UJ, LJ, K, and I." },
      { id: "gender_age_breakdown", name: "Gender and Age Analytics", description: "Gender and age group distribution." },
      { id: "recent_activities", name: "Recent Activity Log", description: "Live feed of member updates and promotions." },
    ],
  },
  {
    id: "People Hub",
    name: "People Hub",
    description: "Manage children, members, shepherds, and FNFs.",
    iconName: "Users",
    subfeatures: [
      { id: "MEMBERS", name: "Children and Members", description: "Directory of children and church members." },
      { id: "TEACHERS", name: "Shepherds", description: "Roster and assignments for shepherds." },
      { id: "add_member", name: "Add Member", description: "Register new children and shepherds." },
      { id: "bulk_add", name: "Bulk Add", description: "Paste names to register multiple records at once." },
      { id: "edit_member", name: "Edit Member Profile", description: "Update member details, contacts, and addresses." },
      { id: "transfer_promote", name: "Transfer and Promotion", description: "Move children between churches or branches." },
      { id: "vacation_mode", name: "Vacation Management", description: "Set excused break windows for members." },
      { id: "archive_restore", name: "Archive and Restore", description: "Archive or restore inactive records." },
      { id: "export_members", name: "Export Directory", description: "Download member lists as CSV." },
    ],
  },
  {
    id: "Attendance",
    name: "Attendance Taker",
    description: "Record service attendance, punctuality, and First Timers.",
    iconName: "CalendarCheck",
    subfeatures: [
      { id: "MEMBERS", name: "Children Attendance", description: "Record attendance for children and FNFs." },
      { id: "STAFF", name: "Shepherds Attendance", description: "Record attendance for shepherds." },
      { id: "mark_attendance", name: "Mark Attendance", description: "Check in attendees for services." },
      { id: "track_punctuality", name: "Punctuality Tracking", description: "Mark early arrivals." },
      { id: "service_selection", name: "Service Selection", description: "Switch between Joy, Enlargement, and Special services." },
      { id: "add_first_timer_quick", name: "Add First Timer / FNF", description: "Add new visitors during attendance." },
      { id: "attendance_history", name: "Attendance History", description: "View past attendance records." },
      { id: "duplicate_cleaner", name: "Duplicate Cleaner", description: "Remove duplicate attendance entries." },
    ],
  },
  {
    id: "Outreach",
    name: "Outreach Hub",
    description: "Manage home visits, prayer logs, and contact follow-ups.",
    iconName: "HeartHandshake",
    subfeatures: [
      { id: "VISIT", name: "Visits", description: "Log home visits and follow-up outcomes." },
      { id: "PRAYER", name: "Prayer", description: "Log prayer slots and durations." },
      { id: "CONNECT", name: "Contact Directory", description: "Call or message assigned members." },
      { id: "TRACK", name: "Progress and Analytics", description: "Track visit and prayer completion." },
      { id: "teacher_division", name: "Shepherd Divisions", description: "View shepherd member allocations." },
    ],
  },
  {
    id: "Analytics",
    name: "Analytics Hub",
    description: "Demographics, retention trends, and outreach metrics.",
    iconName: "PieChart",
    subfeatures: [
      { id: "attendance_breakdown", name: "Attendance Breakdown", description: "Monthly attendance trends and frequency." },
      { id: "age_demographics", name: "Age Demographics", description: "Age distribution per church." },
      { id: "outreach_intelligence", name: "Shepherd Outreach Intelligence", description: "Outreach metrics per shepherd." },
      { id: "financial_trend", name: "Financial Trend", description: "Giving and collection trends." },
      { id: "export_data", name: "Export Data", description: "Export analytics rosters." },
    ],
  },
  {
    id: "Finances",
    name: "Finances and Treasury",
    description: "Track income, expenses, and financial summaries.",
    iconName: "Database",
    subfeatures: [
      { id: "view_balance", name: "Treasury Overview", description: "View total income, expenses, and balance." },
      { id: "record_income", name: "Record Income", description: "Log service offerings and tithes." },
      { id: "record_expense", name: "Record Expenditure", description: "Log ministry expenses." },
      { id: "filter_reports", name: "Financial Statements", description: "Filter transactions by date or church." },
      { id: "export_finances", name: "Export Finances", description: "Download financial records." },
    ],
  },
  {
    id: "Reports",
    name: "Reports and Insights",
    description: "Generate WhatsApp reports, transition lists, and backups.",
    iconName: "Share2",
    subfeatures: [
      { id: "WHATSAPP", name: "Report", description: "Generate and share service attendance reports." },
      { id: "DYNAMIC", name: "Dynamic Builder", description: "Toggle and bundle live system modules into a custom report." },
      { id: "PROMOTIONS", name: "Due Soon (Transitions)", description: "Track upcoming church age transitions and low attendance." },
      { id: "KPI", name: "KPIs", description: "Manage attendance targets and KPIs." },
      { id: "DIVISION", name: "Shepherd Division", description: "View and export shepherd member divisions." },
      { id: "EXECUTIVE", name: "Executive", description: "High-level leadership summary." },
      { id: "DATA", name: "Data", description: "Backup and restore system data." },
      { id: "ANNUAL", name: "Annual Record", description: "Yearly Sunday attendance summary." },
    ],
  },
  {
    id: "Settings",
    name: "Settings",
    description: "System preferences, organization, permissions, and sync.",
    iconName: "Settings",
    subfeatures: [
      { id: "GENERAL", name: "General", description: "Configure feature toggles and defaults." },
      { id: "COMPONENTS", name: "Components & Attendance", description: "Set FNF rules, attendance days, and alerts." },
      { id: "ALLOCATIONS", name: "Shepherd Allocations", description: "Assign children to shepherds." },
      { id: "CHURCHES", name: "Churches", description: "Manage church categories." },
      { id: "ORGANIZATION", name: "Organization", description: "Manage zones and branches." },
      { id: "THEME", name: "Theme Colors", description: "Customize interface colors." },
      { id: "PERMISSIONS", name: "Permissions", description: "Set role access permissions." },
      { id: "CLOUD", name: "Cloud Sync", description: "Manage Firebase sync." },
      { id: "MAINTENANCE", name: "Maintenance", description: "Clean duplicate records." },
    ],
  },
];

export const DEFAULT_SETTINGS = {
  churches: ["UJ", "LJ", "K", "I"],
  combineFnfAndFirstTimers: true,
  attendanceCountMode: "SUNDAY_ONLY" as const,
  attendanceDays: ["SUNDAY"],
  showSundayAttendanceCountOnChildRecord: true,
  notificationConfig: {
    enabled: true,
    prayerAlertsEnabled: true,
    prayerAlertEnabled: true,
    prayerReminderTime: "06:00",
    prayerAlertTime: "18:00",
    outreachAlertsEnabled: true,
    outreachAlertEnabled: true,
    outreachReminderDay: "SATURDAY",
    outreachAlertDay: "SATURDAY",
    outreachReminderTime: "09:00",
    outreachAlertTime: "09:00",
    reportingAlertsEnabled: true,
    reportingAlertEnabled: true,
    reportingReminderTime: "13:00",
    reportingAlertTime: "13:00",
    promotionAlertsEnabled: true,
    promotionsAlertEnabled: true,
  },
  organization: {
    directorate: "Central Children's Ministry Directorate",
    zones: [
      {
        id: "zone-central",
        name: "Central Zone",
        branches: [
          { id: "branch-main", name: "Main Campus Branch", churches: ["I", "K", "LJ", "UJ"] }
        ]
      }
    ]
  },
  features: {},
  permissions: {
    SUPER_ADMIN: ["ALL"],
    ADMIN: ["ALL"],
    DIRECTORATE_HEAD: [
      "Dashboard", "People Hub", "Attendance", "Outreach", "Analytics", "Finances", "Reports", "Settings"
    ],
    ZONAL_HEAD: [
      "Dashboard", "People Hub", "Attendance", "Outreach", "Analytics", "Reports"
    ],
    BRANCH_COORDINATOR: [
      "Dashboard", "People Hub", "Attendance", "Outreach", "Analytics", "Reports"
    ],
    TEACHER: [
      "Dashboard", "People Hub", "Attendance", "Outreach", "Analytics", "Reports"
    ],
    VOLUNTEER: [
      "Attendance"
    ],
  },
  themeColors: {}
};
export const getSundaysInYear = (year: number) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const sundays = [];

  let d = new Date(startDate);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }

  while (d <= endDate) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
};
export const INITIAL_MEMBERS: any[] = [];
export const INITIAL_ATTENDANCE: any[] = [];
export const DEFAULT_CLOUD_CONFIG: any = {};
