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

export const APP_VERSION = "1.7.0";
export const APP_RELEASE_NAME = "AI Neural Background Removal, Studio Depth & Zero-Lag Previews";
export const APP_BUILD_DATE = "2026-09-24";

export const CHANGELOG: ReleaseLog[] = [
  {
    version: "1.7.0",
    date: "2026-09-24",
    title: "AI Neural Background Removal, Studio Depth & Zero-Lag Previews",
    badge: "Current Release",
    changes: [
      "Dual-engine subject isolation combining dynamic in-browser AI neural background removal (@imgly/background-removal) with an instant ~15ms algorithmic fallback",
      "Subject visual depth enhancement: added 3D Studio Drop Shadow and Silhouette Edge Pop rim lighting to make the subject physically stand out from any chosen backdrop",
      "Zero-lag cached cutout architecture eliminating main-thread pixel re-computation during panning, zooming, rotation, and backdrop switching",
      "Instant live real-world previews for Card View (80px) and Roster Badge (40px) updated in real-time on the exact same frame",
      "New vibrant studio presets: Velvet Purple and Sunset Crimson added to the permanent studio collection",
      "Real-time background processing status indicators (AI Isolating, AI Studio Cutout, Smart Cutout Active) and quick Re-isolate button",
      "Enhanced Wednesday cell and mid-week attendance saving and report template preservation for Branch Coordinators",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-09-23",
    title: "Consolidated Reports, Dual Camera & Subject Background Removal",
    changes: [
      "Permanent resolution of Branch Coordinator & Admin 'All / CM Church' report generation with multi-department consolidation across UJ, LJ, K, I, and N",
      "Corrected Branch Coordinator role evaluation preventing teacher profile classifications from suppressing the Mega Center reporting template",
      "Dual mobile phone camera integration with front/rear switching and native OS camera capture fallbacks",
      "Intelligent client-side portrait background removal (subject cutout) isolating child from room backgrounds",
      "Custom backdrop image upload and custom solid color picker with live preview and hex entry",
      "Removed generic sparkles across the entire application and introduced extensible AppLogoSlot brand architecture",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-09-23",
    title: "Children's Photo Studio & Constant Studio Backgrounds",
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
