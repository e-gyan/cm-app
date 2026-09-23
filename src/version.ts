/**
 * Centralized Application Versioning & Release Log
 * Follows Semantic Versioning (SemVer: MAJOR.MINOR.PATCH)
 *
 * Rules for Version Increments:
 * - MAJOR: Breaking architectural shifts, database restructuring, or fundamental workflows.
 * - MINOR: New feature modules (e.g. Photo Studio, Branch Cascade, Notification Engine).
 * - PATCH: Bug fixes, UI adjustments, text-wrapping improvements, performance tuning.
 */

export interface ReleaseLog {
  version: string;
  date: string;
  title: string;
  badge?: string;
  changes: string[];
}

export const APP_VERSION = "1.5.0";
export const APP_RELEASE_NAME = "Children's Photo Studio & Dynamic Backdrops";
export const APP_BUILD_DATE = "2026-09-23";

export const CHANGELOG: ReleaseLog[] = [
  {
    version: "1.5.0",
    date: "2026-09-23",
    title: "Children's Photo Studio & Constant Studio Backgrounds",
    badge: "Current Release",
    changes: [
      "In-browser Photo Studio with live webcam capture and drag-and-drop file upload",
      "Preset constant studio backgrounds (Church Indigo, Royal Blue, Warm Amber, Studio Slate, Fresh Emerald, Clean Light)",
      "Automatic circular framing, interactive pan/zoom (0.8x - 2.5x), and studio edge feathering",
      "Optimized 256x256 WebP compression (<25KB) with Firebase Cloud Storage upload and resilient Firestore collection fallback",
      "Reusable MemberAvatar with deterministic initials badges in the member directory, drawer, and attendance rosters",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-09-23",
    title: "Thesaurus Auto-Attachment & Cascade Branch Renaming",
    changes: [
      "Automatic migration attaching all historical and new Thesaurus HQ data to Thesaurus across all tables",
      "Atomic branch rename cascade across members, attendance, finances, outreach, prayers, notifications, and sessions",
      "Context-aware activity notification engine filtered by role (Super Admin, Zonal Head, Coordinator, Teacher)",
      "Seamless multi-line text wrapping in Settings across zones and permission matrix without ellipsis dots",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-09-20",
    title: "Granular Permission Matrix & Multi-tenant Organization",
    changes: [
      "Role-based feature and subfeature access control matrix across all leadership tiers",
      "Zonal and Branch structural hierarchy management with instant reassignments",
      "Multi-tenant data scoping for zones and branch coordinators",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09-15",
    title: "Attendance Taker with Punctuality & Dual-Service",
    changes: [
      "Punctuality tracking with 30-child capacity thresholds",
      "Joy Service and Service 2 dual-service attendance logging",
      "Bulk attendance check-in and search filtering",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-01",
    title: "Initial Children's Ministry Directorate Release",
    changes: [
      "Core member management, attendance logging, and basic dashboard metrics",
      "Cloud Firestore real-time synchronization with 0ms local storage caching",
    ],
  },
];
