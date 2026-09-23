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
    description: "Central ministry overview, attendance trends, and key performance indicators.",
    iconName: "LayoutDashboard",
    subfeatures: [
      { id: "overview_stats", name: "Overview Statistics", description: "View total registered children, attendance rate, first timers count, and growth." },
      { id: "weekly_trend_chart", name: "Weekly Attendance Trends", description: "Interactive trend chart comparing actual vs previous year attendance." },
      { id: "church_distribution", name: "Church Distribution", description: "Breakdown of attendance across UJ, LJ, K, I, and N churches." },
      { id: "gender_age_breakdown", name: "Gender and Age Analytics", description: "Distribution statistics for gender and age groups." },
      { id: "recent_activities", name: "Recent Activity Log", description: "Real-time feed of recent member updates, promotions, and logs." },
    ],
  },
  {
    id: "People Hub",
    name: "People Hub",
    description: "Comprehensive management of children, members, teachers, visitors, and volunteers.",
    iconName: "Users",
    subfeatures: [
      { id: "MEMBERS", name: "Children and Members", description: "Directory and profiles of children and regular church members." },
      { id: "TEACHERS", name: "Teachers and Staff", description: "Roster and assignments for teachers, helpers, and staff." },
      { id: "add_member", name: "Add Member", description: "Register individual members, children, and teachers." },
      { id: "bulk_add", name: "Bulk Add", description: "Paste or import lists of names to create multiple members at once." },
      { id: "edit_member", name: "Edit Member Profile", description: "Update personal details, birthdates, contact info, and addresses." },
      { id: "transfer_promote", name: "Transfer and Promotion", description: "Promote children to higher age churches or transfer between branches." },
      { id: "vacation_mode", name: "Vacation Management", description: "Set temporary vacation windows for children and teachers." },
      { id: "archive_restore", name: "Archive and Restore", description: "Soft-delete or reinstate inactive members without losing records." },
      { id: "export_members", name: "Export Directory", description: "Download directory data in Excel or CSV format." },
    ],
  },
  {
    id: "Attendance",
    name: "Attendance Taker",
    description: "Sunday and event attendance registration, punctuality tracking, and service selection.",
    iconName: "CalendarCheck",
    subfeatures: [
      { id: "MEMBERS", name: "Children Attendance", description: "Record and review attendance for children and visitors." },
      { id: "STAFF", name: "Staff and Teachers Attendance", description: "Track attendance for teachers, helpers, and volunteers." },
      { id: "mark_attendance", name: "Mark Attendance", description: "Mark attendees present for Sunday services." },
      { id: "track_punctuality", name: "Punctuality Tracking", description: "Record early arrivals and crown on-time attendees." },
      { id: "service_selection", name: "Service Selection", description: "Toggle between Joy Service, Enlargement Service, or Special Events." },
      { id: "add_first_timer_quick", name: "Add First Timer", description: "Register and mark present new visitors directly during attendance." },
      { id: "attendance_history", name: "Attendance History", description: "Review past service records and attendance sheets." },
      { id: "duplicate_cleaner", name: "Duplicate Cleaner", description: "Scan and resolve accidental duplicate submissions." },
    ],
  },
  {
    id: "Outreach",
    name: "Outreach Hub",
    description: "Teacher-child divisions, call and visit logging, prayer durations, and coverage metrics.",
    iconName: "HeartHandshake",
    subfeatures: [
      { id: "VISIT", name: "Visits", description: "Record physical home visits and pastoral visitation notes." },
      { id: "PRAYER", name: "Prayer", description: "Record minutes spent in intercession for assigned children." },
      { id: "CONNECT", name: "Contact Directory", description: "Directory of assigned children with one-tap phone calls and WhatsApp messaging." },
      { id: "TRACK", name: "Progress and Analytics", description: "View monthly trend charts and teacher outreach comparisons." },
      { id: "teacher_division", name: "Teacher Divisions", description: "View and distribute assigned children across ministry teachers." },
    ],
  },
  {
    id: "Analytics",
    name: "Analytics Hub",
    description: "In-depth intelligence on church demographics, retention, and teacher engagement.",
    iconName: "PieChart",
    subfeatures: [
      { id: "attendance_breakdown", name: "Attendance Breakdown", description: "Monthly attendance trends, frequency distributions, and peak attendance days." },
      { id: "age_demographics", name: "Age Demographics", description: "Detailed color-coded age bracket charts per church." },
      { id: "outreach_intelligence", name: "Teacher Outreach Intelligence", description: "Data and metrics focused on the logged-in teacher and their assigned kids." },
      { id: "financial_trend", name: "Financial Trend", description: "Summary graphs of incoming giving and collections across ministries." },
      { id: "export_data", name: "Export Data", description: "One-tap export of church demographic rosters and lists." },
    ],
  },
  {
    id: "Finances",
    name: "Finances and Treasury",
    description: "Track offerings, tithes, expenditure vouchers, budgets, and financial audits.",
    iconName: "Database",
    subfeatures: [
      { id: "view_balance", name: "Treasury Overview", description: "View total income, total expenditures, and current net balance." },
      { id: "record_income", name: "Record Income", description: "Log Sunday collections, gifts, and donations." },
      { id: "record_expense", name: "Record Expenditure", description: "Create expense entries with categories, notes, and receipts." },
      { id: "filter_reports", name: "Financial Statements", description: "Filter financial records by date range, church, or category." },
      { id: "export_finances", name: "Export Finances", description: "Download financial transaction spreadsheets for audits." },
    ],
  },
  {
    id: "Reports",
    name: "Reports and Insights",
    description: "Generate structured management reports, teacher allocations, executive summaries, and system data backups.",
    iconName: "Share2",
    subfeatures: [
      { id: "WHATSAPP", name: "Report", description: "Consolidated Sunday service attendance report with role-based aggregation and WhatsApp share." },
      { id: "KPI", name: "KPIs", description: "Key performance indicator metrics and Sunday attendance targets." },
      { id: "DIVISION", name: "Teacher Division", description: "Automated distribution and allocation of children to teachers." },
      { id: "EXECUTIVE", name: "Executive", description: "Executive summary and high-level leadership overview." },
      { id: "DATA", name: "Data", description: "Database operations, cloud sync, JSON backups, and data imports." },
      { id: "ANNUAL", name: "Annual Record", description: "Annual Sunday-by-Sunday attendance and performance records." },
    ],
  },
  {
    id: "Settings",
    name: "Settings and Configuration",
    description: "System preferences, organizational hierarchy, permissions, and theme customization.",
    iconName: "Settings",
    subfeatures: [
      { id: "GENERAL", name: "General", description: "Configure system name, defaults, and feature flags." },
      { id: "CHURCHES", name: "Churches", description: "Add or remove ministry categories (UJ, LJ, K, I, N)." },
      { id: "ORGANIZATION", name: "Organization Structure", description: "Build and modify Directorates, Zones, and Branches." },
      { id: "THEME", name: "Theme and Colors", description: "Customize primary brand accents and church color schemes." },
      { id: "PERMISSIONS", name: "Role Permissions", description: "Manage granular feature and subfeature access per role group." },
      { id: "CLOUD", name: "Cloud and Sync", description: "Inspect database sync status, inspect raw docs, and auth." },
      { id: "MAINTENANCE", name: "Maintenance", description: "Perform system diagnostics and cache clears." },
    ],
  },
];

export const DEFAULT_SETTINGS = {
  churches: ["UJ", "LJ", "K", "I", "N"],
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
      "Dashboard", "People Hub", "Attendance", "Outreach", "Analytics"
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
