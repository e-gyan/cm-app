export const APP_VERSION = "1.0.0";

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
      { id: "gender_age_breakdown", name: "Gender & Age Analytics", description: "Distribution statistics for gender and age groups." },
      { id: "recent_activities", name: "Recent Activity Log", description: "Real-time feed of recent member updates, promotions, and logs." },
    ],
  },
  {
    id: "People Hub",
    name: "People Hub (Members)",
    description: "Comprehensive management of children, members, teachers, visitors, and volunteers.",
    iconName: "Users",
    subfeatures: [
      { id: "view_directory", name: "View Directory", description: "Browse and search through members, teachers, and visitors." },
      { id: "add_member", name: "Add Member", description: "Register individual members, children, and teachers." },
      { id: "bulk_add", name: "Bulk Add / Import", description: "Paste or import lists of names to create multiple members at once." },
      { id: "edit_member", name: "Edit Member Profile", description: "Update personal details, birthdates, contact info, and addresses." },
      { id: "transfer_promote", name: "Transfer & Promotion", description: "Promote children to higher age churches or transfer between branches." },
      { id: "vacation_mode", name: "Vacation Management", description: "Set temporary vacation windows for children and teachers." },
      { id: "archive_restore", name: "Archive & Restore", description: "Soft-delete or reinstate inactive members without losing records." },
      { id: "permanent_delete", name: "Permanent Delete", description: "Irreversibly delete member records from the database." },
      { id: "bulk_assign", name: "Bulk Assign Zone/Branch", description: "Assign selected members to designated zones and branches." },
      { id: "bulk_gender", name: "Bulk Gender Update", description: "Apply gender tags to selected members in batch." },
      { id: "export_members", name: "Export Directory", description: "Download directory data in Excel or CSV format." },
    ],
  },
  {
    id: "Attendance",
    name: "Attendance Taker",
    description: "Sunday and event attendance registration, punctuality tracking, and service selection.",
    iconName: "CalendarCheck",
    subfeatures: [
      { id: "mark_attendance", name: "Mark Weekly Attendance", description: "Mark children and staff as present for Sunday services." },
      { id: "track_punctuality", name: "Punctuality Tracking", description: "Record early arrivals and crown on-time attendees." },
      { id: "service_selection", name: "Service Selection", description: "Toggle between Joy Service, Enlargement Service, or Special Events." },
      { id: "add_first_timer_quick", name: "Add First Timer on the Fly", description: "Register and mark present new visitors directly during attendance." },
      { id: "staff_attendance", name: "Staff & Teacher Attendance", description: "Track attendance for teachers, helpers, and volunteers." },
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
      { id: "teacher_division", name: "Teacher Divisions", description: "View and distribute assigned children across ministry teachers." },
      { id: "log_visits", name: "Log Outreach Visits", description: "Record physical home visits and pastoral visitation notes." },
      { id: "track_calls", name: "Call Tracking & Outcomes", description: "Log phone calls, reached/unreachable status, and parent discussions." },
      { id: "track_prayer", name: "Prayer Time Tracking", description: "Record minutes spent in intercession for assigned children." },
      { id: "progress_analytics", name: "Outreach Progress & Coverage", description: "View monthly trend charts and teacher outreach comparisons." },
      { id: "schedule_management", name: "Schedule Management", description: "Create, edit, reschedule, or cancel future outreach sessions." },
      { id: "contact_actions", name: "Quick Contact Actions", description: "One-tap direct calling and WhatsApp messaging from contact cards." },
    ],
  },
  {
    id: "Analytics",
    name: "Analytics Hub",
    description: "In-depth intelligence on church demographics, retention, and teacher engagement.",
    iconName: "PieChart",
    subfeatures: [
      { id: "kpi_summary", name: "KPI Summary Cards", description: "Review ministry-wide engagement metrics and growth benchmarks." },
      { id: "demographics_chart", name: "Demographics & Age Analysis", description: "Detailed color-coded age bracket charts per church." },
      { id: "outreach_intelligence", name: "Teacher Outreach Intelligence", description: "Data and metrics focused on the logged-in teacher and their assigned kids." },
      { id: "retention_metrics", name: "Retention & Inconsistency", description: "Identify at-risk children and track attendance consistency." },
    ],
  },
  {
    id: "Finances",
    name: "Finances & Treasury",
    description: "Track offerings, tithes, expenditure vouchers, budgets, and financial audits.",
    iconName: "Database",
    subfeatures: [
      { id: "view_balance", name: "Treasury Overview", description: "View total income, total expenditures, and current net balance." },
      { id: "record_income", name: "Record Income / Offering", description: "Log Sunday collections, gifts, and donations." },
      { id: "record_expense", name: "Record Expenditure", description: "Create expense entries with categories, notes, and receipts." },
      { id: "filter_reports", name: "Financial Statements & Filtering", description: "Filter financial records by date range, church, or category." },
      { id: "export_finances", name: "Export Financial Data", description: "Download financial transaction spreadsheets for audits." },
    ],
  },
  {
    id: "Reports",
    name: "Reports & Exports",
    description: "Generate structured management reports and printable summaries.",
    iconName: "Share2",
    subfeatures: [
      { id: "attendance_reports", name: "Standard Attendance Reports", description: "Consolidated Sunday reports across all age ministries." },
      { id: "demographics_reports", name: "Demographic Spreadsheets", description: "Summary tables of ages, genders, and school transitions." },
      { id: "export_pdf", name: "Export to PDF", description: "Generate formatted printable PDF documentation." },
      { id: "export_csv_excel", name: "Export to CSV / Excel", description: "Export raw or grouped tabular data to spreadsheet formats." },
    ],
  },
  {
    id: "Settings",
    name: "Settings & Configuration",
    description: "System preferences, organizational hierarchy, permissions, and theme customization.",
    iconName: "Settings",
    subfeatures: [
      { id: "general_config", name: "General Preferences", description: "Configure system name, defaults, and feature flags." },
      { id: "church_management", name: "Church Branches", description: "Add or remove ministry categories (UJ, LJ, K, I, N)." },
      { id: "org_structure", name: "Organization Structure", description: "Build and modify Directorates, Zones, and Branches." },
      { id: "theme_customizer", name: "Theme & Colors", description: "Customize primary brand accents and church color schemes." },
      { id: "role_permissions", name: "Role Permissions Matrix", description: "Manage granular feature and subfeature access per role group." },
      { id: "cloud_sync", name: "Cloud & Firebase Sync", description: "Inspect database sync status, inspect raw docs, and auth." },
      { id: "maintenance_tools", name: "Maintenance & Diagnostics", description: "Perform system diagnostics and cache clears." },
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
